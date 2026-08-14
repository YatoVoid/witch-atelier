// Reads the shape of a drawn sign (one or more strokes, since most of the
// reference glyphs are a few short parts combined, not one continuous line)
// and picks which family it belongs to. Deterministic heuristics, no
// network call and no model, so it runs instantly and the same shape always
// classifies the same way.
function strokeLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

// Fast strokes produce sparse points, slow strokes produce dense ones.
// Resampling to even arc-length spacing keeps turn/zigzag detection
// independent of how fast the stroke was drawn.
function resample(points, count) {
  const total = strokeLength(points);
  if (total < 1e-6) return points;
  const out = [points[0]];
  const step = total / (count - 1);
  let target = step;
  let covered = 0;
  for (let i = 1; i < points.length && out.length < count; i++) {
    const segLen = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    while (covered + segLen >= target && out.length < count) {
      const t = segLen < 1e-6 ? 0 : (target - covered) / segLen;
      out.push({
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      });
      target += step;
    }
    covered += segLen;
  }
  out.push(points[points.length - 1]);
  return out;
}

function angularSpread(points) {
  const angles = points.map((p) => Math.atan2(p.y, p.x)).sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < angles.length; i++) {
    const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + Math.PI * 2;
    maxGap = Math.max(maxGap, next - angles[i]);
  }
  return Math.PI * 2 - maxGap;
}

// Sharp direction reversals within a single stroke. Never compared across
// two separate strokes, a pen lift between parts isn't a turn.
function sharpTurnCount(points) {
  let count = 0;
  let prevHeading = null;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    if (Math.hypot(dx, dy) < 0.5) continue;
    const heading = Math.atan2(dy, dx);
    if (prevHeading !== null) {
      let diff = heading - prevHeading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 1.1) count++;
    }
    prevHeading = heading;
  }
  return count;
}

// Simple geometry can only tell families of shape apart, not which of the
// 24 named signs you meant within a family (a straight outward line could
// be Column, Crosshair, or Enlarge; there's no shape difference between
// them in the source material either, they're distinguished by context).
// classifyStrokeGroup() returns the family's most common member as a
// default. Each sign row in the UI offers the rest of its family as
// alternatives, so the shape narrows it down and you make the final call,
// rather than the app pretending to detect a distinction that isn't there.
const SIGN_BUCKETS = {
  straightOut: ["column", "crosshair", "enlarge"],
  straightIn: ["pull", "direction"],
  wideOut: ["dispersion", "radial", "rain", "billowing", "weave"],
  wideIn: ["convergence", "window", "collection"],
  wavy: ["levitation", "float", "bird", "dancing-puppet", "eye", "vision"],
  zigzag: ["bolt", "bend"],
  closedSmooth: ["diamond", "repetition"],
  closedChaotic: ["crush"],
};

function bucketCandidates(archetypeId) {
  for (const key in SIGN_BUCKETS) {
    if (SIGN_BUCKETS[key].includes(archetypeId)) return SIGN_BUCKETS[key];
  }
  return [archetypeId];
}

// A sign is one or more strokes drawn close together in time (see app.js's
// grouping window). Most of the reference glyphs are a short spine plus one
// or two small ticks or caps, so the spine (the longest stroke) carries the
// direction and shape; the shorter strokes only get checked for a zigzag
// (any part drawn as a zigzag reads as Bolt/Bend regardless of the rest).
function classifyStrokeGroup(paths) {
  const valid = paths.filter((p) => p.length >= 2 && strokeLength(p) > 1e-3);
  if (valid.length === 0) return null;

  for (const path of valid) {
    const resampled = resample(path, Math.min(20, Math.max(6, path.length)));
    if (sharpTurnCount(resampled) >= 3) return "bolt";
  }

  const spine = valid.reduce((a, b) => (strokeLength(b) > strokeLength(a) ? b : a));
  const points = resample(spine, 20);
  const start = points[0];
  const end = points[points.length - 1];
  const arcLength = strokeLength(points);
  const chordLength = Math.hypot(end.x - start.x, end.y - start.y);
  const straightness = chordLength / (arcLength || 1e-6);
  const radialDelta = Math.hypot(end.x, end.y) - Math.hypot(start.x, start.y);

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const boundSize = Math.hypot(maxX - minX, maxY - minY) || 1e-6;
  const loopClosure = Math.max(0, 1 - chordLength / boundSize);
  const closedShape = loopClosure > 0.6 && arcLength > boundSize * 0.7;
  if (closedShape) return sharpTurnCount(points) < 2 ? "diamond" : "crush";

  const allPoints = valid.flatMap((p) => p);
  const spread = angularSpread(allPoints);
  if (spread > 0.85) return radialDelta >= 0 ? "dispersion" : "convergence";
  if (straightness > 0.8) return radialDelta >= 0 ? "column" : "pull";
  return "levitation";
}
