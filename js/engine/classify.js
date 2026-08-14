// Reads the shape of a drawn stroke and picks which sign archetype it is.
// Nothing is pre-selected before drawing: the geometry decides. Deterministic
// heuristics, no network call and no model, so it runs instantly and the same
// shape always classifies the same way.
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

function classifyStroke(rawPoints) {
  if (rawPoints.length < 2) return null;
  const points = resample(rawPoints, 20);
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

  let totalTurning = 0;
  let sharpTurns = 0;
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
      totalTurning += Math.abs(diff);
      if (Math.abs(diff) > 1.1) sharpTurns++;
    }
    prevHeading = heading;
  }
  const avgTurning = totalTurning / (points.length - 1);
  const spread = angularSpread(points);

  const closedShape = loopClosure > 0.6 && arcLength > boundSize * 0.7;
  if (closedShape) return avgTurning < 0.6 ? "diamond" : "crushing";
  if (sharpTurns >= 3 && loopClosure < 0.5) return "bolt";
  if (spread > 0.85) return radialDelta >= 0 ? "dispersion" : "convergence";
  if (straightness > 0.85) return radialDelta >= 0 ? "column" : "pulling";
  return "levitation";
}
