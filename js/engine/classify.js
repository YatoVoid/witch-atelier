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

// How far the stroke wanders sideways off the straight line from its start
// to its end, relative to how far it travels. A hand-drawn "straight" line
// still has a few pixels of tremor in it; measuring total path length
// against the chord (the old approach) penalizes that tremor heavily over a
// long stroke. Measuring the worst sideways wobble instead barely reacts to
// small jitter and still catches an actual curve.
function maxDeviationRatio(points) {
  const start = points[0];
  const end = points[points.length - 1];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chordLenSq = dx * dx + dy * dy;
  if (chordLenSq < 1e-6) return 1;
  let maxDev = 0;
  for (const p of points) {
    const t = ((p.x - start.x) * dx + (p.y - start.y) * dy) / chordLenSq;
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    const dev = Math.hypot(p.x - projX, p.y - projY);
    if (dev > maxDev) maxDev = dev;
  }
  return maxDev / Math.sqrt(chordLenSq);
}

// Sharp direction reversals within a single stroke. Never compared across
// two separate strokes, a pen lift between parts isn't a turn. The angle
// threshold is deliberately high (~85 degrees) so a smooth wave, which
// still turns but gradually, doesn't register as a zigzag.
function sharpTurnCount(points, angleThreshold) {
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
      if (Math.abs(diff) > angleThreshold) count++;
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

function familyKeyOf(archetypeId) {
  for (const key in SIGN_BUCKETS) {
    if (SIGN_BUCKETS[key].includes(archetypeId)) return key;
  }
  return null;
}

const ZIGZAG_ANGLE = 1.35; // ~77 degrees, used for the closed-shape smooth/chaotic call
const CORNER_ANGLE = 1.2; // ~69 degrees, used to cut a path at a real corner

// Cuts a path everywhere it turns sharply, so a shape drawn as one
// continuous stroke (no pen lift) still separates into the same parts it
// would if you'd drawn them separately. A corner is a corner either way.
function splitAtCorners(rawPoints) {
  const len = strokeLength(rawPoints);
  if (len < 1e-6) return [rawPoints];
  const count = Math.max(8, Math.min(40, Math.round(len / 6)));
  const points = resample(rawPoints, count);
  const segments = [];
  let current = [points[0]];
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
      if (Math.abs(diff) > CORNER_ANGLE) {
        current.push(points[i]);
        segments.push(current);
        current = [points[i]];
        prevHeading = heading;
        continue;
      }
    }
    current.push(points[i]);
    prevHeading = heading;
  }
  segments.push(current);
  return segments.filter((s) => strokeLength(s) > 1e-3);
}

// A sign is one or more strokes drawn close together in time (see app.js's
// grouping window). Most of the reference glyphs are a short spine plus one
// or two small ticks or caps, whether that's drawn as separate strokes or
// as one continuous line that turns a corner. Closedness is checked first,
// on the whole undivided shape, because a sharp-cornered outline (Diamond)
// would otherwise look identical to a zigzag. Everything else gets cut at
// its corners and judged by whether one part dominates the total length: a
// T-shape's spine dominates, a lightning-bolt zigzag has no dominant part.
function classifyStrokeGroup(paths) {
  const valid = paths.filter((p) => p.length >= 2 && strokeLength(p) > 1e-3);
  if (valid.length === 0) return null;

  const overallSpine = valid.reduce((a, b) => (strokeLength(b) > strokeLength(a) ? b : a));
  const spinePoints = resample(overallSpine, 20);
  const spineStart = spinePoints[0];
  const spineEnd = spinePoints[spinePoints.length - 1];
  const spineChord = Math.hypot(spineEnd.x - spineStart.x, spineEnd.y - spineStart.y);

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of spinePoints) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const boundSize = Math.hypot(maxX - minX, maxY - minY) || 1e-6;
  const loopClosure = Math.max(0, 1 - spineChord / boundSize);
  const closedShape = loopClosure > 0.6 && strokeLength(spinePoints) > boundSize * 0.7;
  if (closedShape) return sharpTurnCount(spinePoints, ZIGZAG_ANGLE) < 2 ? "diamond" : "crush";

  const segments = valid.flatMap((p) => splitAtCorners(p));
  const totalLength = segments.reduce((sum, seg) => sum + strokeLength(seg), 0);
  const spine = segments.reduce((a, b) => (strokeLength(b) > strokeLength(a) ? b : a));
  const dominance = strokeLength(spine) / (totalLength || 1e-6);
  if (segments.length >= 3 && dominance < 0.55) return "bolt";

  const points = resample(spine, 20);
  const start = points[0];
  const end = points[points.length - 1];
  const wobble = maxDeviationRatio(points);
  const radialDelta = Math.hypot(end.x, end.y) - Math.hypot(start.x, start.y);

  const allPoints = valid.flatMap((p) => p);
  const spread = angularSpread(allPoints);
  if (spread > 0.85) return radialDelta >= 0 ? "dispersion" : "convergence";
  if (wobble < 0.25) return radialDelta >= 0 ? "column" : "pull";
  return "levitation";
}
