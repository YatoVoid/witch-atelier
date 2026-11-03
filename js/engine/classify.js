// Classifies a drawn sign (one or more strokes) into a shape family.
function strokeLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

// Resamples to even arc-length spacing so shape comparison doesn't depend on how fast the
// stroke was drawn.
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
  // Callers rely on getting back exactly `count` points for point-by-point comparison; the loop
  // above can already reach that on its own.
  if (out.length < count) out.push(points[points.length - 1]);
  return out;
}

// Points this close to the ring's center have unreliable angles (a little jitter to either side
// of center reads as ~180 degrees apart on a straight line).
const SPREAD_DEAD_ZONE = 20;

function angularSpread(points) {
  const usable = points.filter((p) => Math.hypot(p.x, p.y) > SPREAD_DEAD_ZONE);
  if (usable.length < 2) return 0;
  const angles = usable.map((p) => Math.atan2(p.y, p.x)).sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < angles.length; i++) {
    const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + Math.PI * 2;
    maxGap = Math.max(maxGap, next - angles[i]);
  }
  return Math.PI * 2 - maxGap;
}

// How steady a stroke's distance from the ring's center stays.
function radiusRatio(points) {
  let minR = Infinity;
  let maxR = 0;
  for (const p of points) {
    const r = Math.hypot(p.x, p.y);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
  }
  return maxR < 1e-6 ? 0 : minR / maxR;
}

// Counts sharp direction reversals within a stroke.
function sharpTurnCount(points, angleThreshold) {
  let count = 0;
  let prevHeading = null;
  let prevDiff = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    if (Math.hypot(dx, dy) < 0.5) continue;
    const heading = Math.atan2(dy, dx);
    if (prevHeading !== null) {
      let diff = heading - prevHeading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      // A corner near a resample boundary can split into two hops each under threshold on their
      // own.
      const combined = Math.sign(diff) === Math.sign(prevDiff) ? diff + prevDiff : diff;
      if (Math.abs(diff) > angleThreshold || Math.abs(combined) > angleThreshold) {
        count++;
        prevDiff = 0;
        prevHeading = heading;
        continue;
      }
      prevDiff = diff;
    }
    prevHeading = heading;
  }
  return count;
}

// Geometry only tells families apart, not which of the 24 named signs was meant within a family
// (a straight outward line could be Column, Crosshair, or Enlarge; the source material doesn't
// distinguish them by shape either).
const SIGN_BUCKETS = {
  straightOut: ["column", "crosshair", "enlarge", "levitation"],
  straightIn: ["pull"],
  wideOut: ["dispersion", "radial", "rain", "billowing", "weave"],
  wideIn: ["convergence", "window", "collection"],
  wavy: ["float", "dancing-puppet", "vision"],
  zigzag: ["bolt", "bend", "direction", "bird"],
  closedSmooth: ["diamond", "repetition", "eye"],
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

// point-cloud shape matching
// A multi-stroke sign.
const TEMPLATE_SAMPLE_COUNT = 64;

function centroidOf(points) {
  let sx = 0,
    sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

function translateToOrigin(points) {
  const c = centroidOf(points);
  return points.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
}

function scaleToUnit(points) {
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
  const diag = Math.hypot(maxX - minX, maxY - minY) || 1;
  return points.map((p) => ({ x: p.x / diag, y: p.y / diag }));
}

function rotateBy(points, theta) {
  const cos = Math.cos(theta),
    sin = Math.sin(theta);
  return points.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
}

// Resample -> recenter -> rescale -> rotate so the first point sits due east of center (the
// "indicative angle").
function normalizeForMatching(rawPoints) {
  const resampled = resample(rawPoints, TEMPLATE_SAMPLE_COUNT);
  const centered = translateToOrigin(resampled);
  const scaled = scaleToUnit(centered);
  const indicativeAngle = Math.atan2(scaled[0].y, scaled[0].x);
  return rotateBy(scaled, -indicativeAngle);
}

function meanPointDistance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return d / a.length;
}

// Golden section search for the rotation (within +/-45 degrees of the indicative-angle
// alignment already applied) that best aligns candidate and template.
function bestAlignedDistance(candidate, template) {
  const phi = 0.5 * (Math.sqrt(5) - 1);
  let a = -Math.PI / 4,
    b = Math.PI / 4;
  const angleThreshold = 0.05;
  const distanceAt = (theta) => meanPointDistance(rotateBy(candidate, theta), template);
  let x1 = phi * a + (1 - phi) * b;
  let f1 = distanceAt(x1);
  let x2 = (1 - phi) * a + phi * b;
  let f2 = distanceAt(x2);
  while (Math.abs(b - a) > angleThreshold) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = phi * a + (1 - phi) * b;
      f1 = distanceAt(x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = (1 - phi) * a + phi * b;
      f2 = distanceAt(x2);
    }
  }
  return Math.min(f1, f2);
}

let builtinTemplateCache = null;
function normalizedBuiltinTemplates() {
  if (builtinTemplateCache) return builtinTemplateCache;
  builtinTemplateCache = {};
  for (const label in SHAPE_TEMPLATES) {
    builtinTemplateCache[label] = SHAPE_TEMPLATES[label].map(normalizeForMatching);
  }
  return builtinTemplateCache;
}

// Matches a shape.
function mirrorPoints(points) {
  return points.map((p) => ({ x: -p.x, y: p.y }));
}

function matchShapeTemplate(rawPoints, extraTemplates) {
  const candidate = normalizeForMatching(rawPoints);
  const candidateMirrored = normalizeForMatching(mirrorPoints(rawPoints));
  const pools = [normalizedBuiltinTemplates()];
  if (extraTemplates) pools.push(extraTemplates);

  let bestLabel = null;
  let bestDistance = Infinity;
  for (const pool of pools) {
    for (const label in pool) {
      for (const template of pool[label]) {
        const d = Math.min(bestAlignedDistance(candidate, template), bestAlignedDistance(candidateMirrored, template));
        if (d < bestDistance) {
          bestDistance = d;
          bestLabel = label;
        }
      }
    }
  }
  return { label: bestLabel, distance: bestDistance };
}

// True if 3+ strokes converge on a shared point (a crosshair-style hub).
function radiatesFromSharedHub(strokes) {
  // Crosshair's own canon count is exactly 4 strokes; nothing else in this vocabulary is
  // hub-shaped.
  if (strokes.length < 3 || strokes.length > 6) return false;
  const endpoints = strokes.map((s) => [s[0], s[s.length - 1]]);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const s of strokes) {
    for (const p of s) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  const boundingDiag = Math.hypot(maxX - minX, maxY - minY);
  const radius = Math.max(15, boundingDiag * 0.1);
  let bestHubSize = 0;
  for (let i = 0; i < endpoints.length; i++) {
    for (const anchor of endpoints[i]) {
      let hubSize = 0;
      for (let j = 0; j < endpoints.length; j++) {
        const closeEnough = endpoints[j].some((p) => Math.hypot(p.x - anchor.x, p.y - anchor.y) <= radius);
        if (closeEnough) hubSize++;
      }
      bestHubSize = Math.max(bestHubSize, hubSize);
    }
  }
  return bestHubSize >= 3;
}

function classifyShapeFamily(paths, extraTemplates) {
  const valid = paths.filter((p) => p.length >= 2 && strokeLength(p) > 1e-3);
  if (valid.length === 0) return null;

  // Closedness is checked first, on the whole undivided shape.
  const overallSpine = valid.reduce((a, b) => (strokeLength(b) > strokeLength(a) ? b : a));
  const totalStrokeLength = valid.reduce((sum, p) => sum + strokeLength(p), 0);
  // A fixed sample count regardless of size meant a small closed shape got sampled at much
  // tighter spacing (proportionally) than a large one.
  const closedSampleCount = Math.max(10, Math.min(20, Math.round(strokeLength(overallSpine) / 8)));
  const spinePoints = resample(overallSpine, closedSampleCount);
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
  // A steep, narrow peak can fold its two arms back close enough together to pass a looser
  // closure check without ever actually enclosing anything.
  const overallSpineDominant = strokeLength(overallSpine) / totalStrokeLength > 0.65;
  // Diamond/Repetition/Eye/Crush, everything this branch can return, top out at 5 strokes total
  // between all four of them (see SIGN_STROKE_RANGE below).
  const plausibleStrokeCount = valid.length <= 5;
  const closedShape = plausibleStrokeCount && overallSpineDominant && loopClosure > 0.82 && strokeLength(spinePoints) > boundSize * 0.7;
  // A real diamond measures ~2-3 sharp turns here even under hand jitter; a chaotic scribble
  // runs 7+.
  if (closedShape) return sharpTurnCount(spinePoints, ZIGZAG_ANGLE) <= 5 ? "diamond" : "crush";

  // Outward/inward direction is read from the longest single stroke, not first-to-last
  // endpoint.
  function averagedEndpoint(points, fromEnd) {
    const n = Math.min(4, points.length);
    const slice = fromEnd ? points.slice(-n) : points.slice(0, n);
    let sx = 0,
      sy = 0;
    for (const p of slice) {
      sx += p.x;
      sy += p.y;
    }
    return { x: sx / slice.length, y: sy / slice.length };
  }
  const mainStroke = valid.reduce((a, b) => (strokeLength(b) > strokeLength(a) ? b : a));
  const overallStart = averagedEndpoint(mainStroke, false);
  const overallEnd = averagedEndpoint(mainStroke, true);
  // Distance-from-center of end vs start: a straightforward and correct measure of a wide
  // sweep's radial trend.
  const radialDelta = Math.hypot(overallEnd.x, overallEnd.y) - Math.hypot(overallStart.x, overallStart.y);
  // Comparing raw distance-from-center of start vs end breaks down for a straight.
  const startMag = Math.hypot(overallStart.x, overallStart.y) || 1e-6;
  const radialUnit = { x: overallStart.x / startMag, y: overallStart.y / startMag };
  const directionalDelta = (overallEnd.x - overallStart.x) * radialUnit.x + (overallEnd.y - overallStart.y) * radialUnit.y;

  // Matched against mainStroke alone once it's most of the ink, so a decoration (an arrowhead
  // barb) doesn't create a false "jump" when concatenated.
  let match = null;
  if (strokeLength(mainStroke) / totalStrokeLength > 0.65) {
    match = matchShapeTemplate(mainStroke, extraTemplates);
  } else if (radiatesFromSharedHub(valid)) {
    return "crosshair";
  } else {
    match = matchShapeTemplate(valid.flat(), extraTemplates);
  }

  // A wide sweep is checked by two independent geometric facts.
  const spread = angularSpread(mainStroke);
  // radiusRatio only guards shapes drawn far enough from center to give it a meaningful
  // reading.
  const maxRadius = Math.max(...mainStroke.map((p) => Math.hypot(p.x, p.y)));
  const steadyRadius = maxRadius < 50 || radiusRatio(mainStroke) > 0.5;
  // A shape the matcher is nearly certain about (a razor-sharp corner, not just a
  // passable-by-chance one) is trusted outright.
  const VERY_CONFIDENT_MATCH = 0.03;
  if (match.distance >= VERY_CONFIDENT_MATCH && spread > 0.85 && steadyRadius) {
    return radialDelta >= 0 ? "dispersion" : "convergence";
  }

  if (match.label === "straight") {
    // Checked before direction: a symmetric 4-arm hub has no reliable "outward" arm to measure
    // direction from.
    if (radiatesFromSharedHub(valid)) return "crosshair";
    return directionalDelta >= 0 ? "column" : "pull";
  }
  // "levitation" here (instead of "float", the wavy family's actual default per SIGN_BUCKETS)
  // was a leftover from before Levitation's own glyph, a plain straight arrow, got reassigned
  // out of the wavy family into straightOut.
  if (match.label === "wavy") return "float";
  // A bend-shaped stroke (single sharp peak) defaults to "direction" rather than the template's
  // own name "bend".
  if (match.label === "bend") return "direction";
  return match.label; // "bolt"
}

// Separate strokes per sign, min and max, reported from the source material: Column always 2,
// Crosshair always 4, Enlarge always 12, Pull 2-6.
const STROKE_COUNT_OVERRIDES = {
  straightOut: [
    { min: 3, max: 4, id: "levitation" },
    { min: 10, max: 14, id: "enlarge" },
  ],
  wideOut: [
    { min: 4, max: 4, id: "billowing" },
    { min: 13, max: 16, id: "rain" },
  ],
  // Collection is documented as always exactly 1 stroke, which doesn't overlap Window's 3-6.
  wideIn: [{ min: 3, max: 6, id: "window" }],
  wavy: [
    { min: 4, max: 4, id: "vision" },
    { min: 12, max: 13, id: "dancing-puppet" },
  ],
  zigzag: [
    { min: 4, max: 5, id: "bolt" },
    { min: 11, max: 14, id: "bird" },
  ],
  closedSmooth: [{ min: 5, max: 5, id: "repetition" }],
};

function refineByStrokeCount(id, strokeCount) {
  if (id === "crosshair") return id;
  const rules = STROKE_COUNT_OVERRIDES[familyKeyOf(id)];
  if (!rules) return id;
  for (const rule of rules) {
    if (strokeCount >= rule.min && strokeCount <= rule.max) return rule.id;
  }
  return id;
}

// Same canon min/max data STROKE_COUNT_OVERRIDES promotes toward, flattened to one range per
// archetype.
const SIGN_STROKE_RANGE = {
  column: [2, 2],
  crosshair: [4, 4],
  enlarge: [12, 12],
  pull: [2, 6],
  direction: [1, 2],
  radial: [2, 2],
  rain: [13, 16],
  billowing: [1, 4],
  weave: [1, 3],
  window: [3, 6],
  collection: [1, 1],
  crush: [1, 1],
  bend: [1, 3],
  bolt: [2, 5],
  diamond: [1, 4],
  repetition: [4, 5],
  levitation: [2, 4],
  float: [2, 2],
  bird: [11, 14],
  "dancing-puppet": [12, 13],
  eye: [2, 3],
  vision: [4, 4],
};

function familyStrokeCeiling(id) {
  let max = -Infinity;
  for (const memberId of bucketCandidates(id)) {
    const range = SIGN_STROKE_RANGE[memberId];
    if (range) max = Math.max(max, range[1]);
  }
  return max === -Infinity ? null : max;
}

// A drawing with far more strokes than this family could ever use, even at its single most
// generous documented member.
function enforceNotWildlyImpossible(id, strokeCount) {
  const ceiling = familyStrokeCeiling(id);
  if (ceiling === null || strokeCount <= ceiling + 4) return id;
  let closest = null;
  let closestCeiling = Infinity;
  for (const candidateId in SIGN_STROKE_RANGE) {
    const [min, max] = SIGN_STROKE_RANGE[candidateId];
    if (strokeCount >= min && strokeCount <= max) return candidateId;
    if (max >= strokeCount && max < closestCeiling) {
      closestCeiling = max;
      closest = candidateId;
    }
  }
  return closest || id;
}

function classifyStrokeGroup(paths, extraTemplates) {
  const id = classifyShapeFamily(paths, extraTemplates);
  if (id === null) return null;
  const strokeCount = paths.filter((p) => p.length >= 2 && strokeLength(p) > 1e-3).length;
  const refined = refineByStrokeCount(id, strokeCount);
  return enforceNotWildlyImpossible(refined, strokeCount);
}
