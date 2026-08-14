// Reads the shape of a drawn sign (one or more strokes, since most of the
// reference glyphs are a few short parts combined, not one continuous
// line) and picks which family it belongs to.
//
// Two different techniques, used for what each is actually good at:
//
// - Closedness (does the stroke loop back on itself) and ring-relative
//   spread (does it sweep across a wide angle around the ring's center)
//   are properties of the RAW, undistorted geometry, so they're read
//   directly off it, same as before.
// - Everything else (is this basically a straight line, a single corner,
//   a multi-turn zigzag, or a gentle wiggle) is answered by comparing the
//   stroke, after normalizing away its position/scale/rotation, against a
//   small set of reference templates and taking the closest match. This
//   is the $1 Unistroke Recognizer approach (Wobbrock, Wilson & Li,
//   2007): matching the overall shape as a point cloud is far less
//   sensitive to hand tremor and to decoration (an arrowhead, a crossbar,
//   several strokes radiating from one point) than counting corners and
//   comparing segment lengths ever was, because averaging distance over
//   many points cancels noise a single threshold on one measurement
//   can't. classifyStrokeGroup() takes an optional second argument of
//   extra templates (personal corrections saved via the in-app training
//   flow, layered on top of the shipped set in js/data/templates.js)
//   without needing a network call or a trained model file.
function strokeLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

// Fast strokes produce sparse points, slow strokes produce dense ones.
// Resampling to even arc-length spacing keeps shape comparison
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
  // The loop above can fill `out` to exactly `count` on its own (when the
  // last target lands exactly on the final source point); appending
  // unconditionally would then overshoot to count+1. Every caller now
  // relies on getting back exactly `count` points (shape-template
  // comparison needs equal-length arrays to compare point by point).
  if (out.length < count) out.push(points[points.length - 1]);
  return out;
}

// Angle from the ring's exact center is a genuinely poor signal for a
// point that close to it: two points just a little to either side of
// center read as ~180 degrees apart even along a dead-straight line, and
// any small sign (a peak, a zigzag, not just a straight line) drawn near
// center can subtend just as wide an angle as an actual sweep around the
// ring, purely from proximity to the origin rather than any real spread.
// Now that spread is checked before shape matching (so a decorated
// straight line isn't mistaken for a sweep), this has to be generous
// enough to fully exclude a whole small sign drawn near center, not just
// individual noisy points, while staying well under where a real
// wide-sweep sign is actually drawn.
const SPREAD_DEAD_ZONE = 60;

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

// Sharp direction reversals within a single stroke. The angle threshold
// is deliberately high (~77 degrees) so a smooth wave, which still turns
// but gradually, doesn't register as a zigzag.
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
      // A corner landing near a resample boundary interpolates through the
      // vertex and splits into two hops that are each individually under
      // threshold. Only combining same-direction hops means independent
      // jitter (which flips sign often) mostly doesn't accumulate, while a
      // real corner (whose smeared halves turn the same way) still gets
      // caught.
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

// Simple geometry can only tell families of shape apart, not which of the
// 24 named signs you meant within a family (a straight outward line could
// be Column, Crosshair, or Enlarge; there's no shape difference between
// them in the source material either, they're distinguished by context).
// classifyStrokeGroup() returns the family's most common member as a
// default. Each sign row in the UI offers the rest of its family as
// alternatives, so the shape narrows it down and you make the final call,
// rather than the app pretending to detect a distinction that isn't there.
// Direction's reference glyph (assets/signs/direction.webp) is a bare "^"
// peak, no straight spine at all, unlike Pull's own glyph (a mostly
// straight line with a small arrowhead). It reads geometrically as a
// single sharp corner, the same shape as Bend, not as "mostly straight",
// so it belongs with Bend/Bolt: drawing a peak-shaped sign never used to
// offer Direction as an option at all, since the dropdown only offers
// alternatives within whichever family the shape actually got classified
// into, and a peak was never going to classify as straightIn no matter
// how the geometry was read.
const SIGN_BUCKETS = {
  straightOut: ["column", "crosshair", "enlarge"],
  straightIn: ["pull"],
  wideOut: ["dispersion", "radial", "rain", "billowing", "weave"],
  wideIn: ["convergence", "window", "collection"],
  wavy: ["levitation", "float", "bird", "dancing-puppet", "eye", "vision"],
  zigzag: ["bolt", "bend", "direction"],
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

// ---- point-cloud shape matching ($1 Unistroke Recognizer) ----

const TEMPLATE_SAMPLE_COUNT = 32;

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

// Resample -> recenter -> rescale -> rotate so the first point sits due
// east of center. That last step (the "indicative angle") gives every
// normalized shape a consistent starting orientation so the rotation
// search below only has to correct for minor variation around it, not
// search the full circle.
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

// Golden section search for the rotation (within +/-45 degrees of the
// indicative-angle alignment already applied) that best aligns the
// candidate with a template, so two shapes that are the same but drawn a
// little differently rotated don't get penalized for it.
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

// Matches a (possibly multi-stroke, points concatenated in drawing order)
// shape against the shipped templates plus any extra ones (personal
// corrections from localStorage, already normalized) passed in.
function matchShapeTemplate(rawPoints, extraTemplates) {
  const candidate = normalizeForMatching(rawPoints);
  const pools = [normalizedBuiltinTemplates()];
  if (extraTemplates) pools.push(extraTemplates);

  let bestLabel = null;
  let bestDistance = Infinity;
  for (const pool of pools) {
    for (const label in pool) {
      for (const template of pool[label]) {
        const d = bestAlignedDistance(candidate, template);
        if (d < bestDistance) {
          bestDistance = d;
          bestLabel = label;
        }
      }
    }
  }
  return { label: bestLabel, distance: bestDistance };
}

// A sign is one or more strokes drawn close together in time (see app.js's
// grouping window). Most of the reference glyphs are a short spine plus
// one or two small ticks or caps, whether that's drawn as separate
// strokes or as one continuous line that turns a corner.
function classifyStrokeGroup(paths, extraTemplates) {
  const valid = paths.filter((p) => p.length >= 2 && strokeLength(p) > 1e-3);
  if (valid.length === 0) return null;

  // Closedness is checked first, on the whole undivided shape, because a
  // sharp-cornered outline (Diamond) would otherwise look identical to a
  // zigzag or a chaotic scribble to the shape matcher below.
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
  // A real diamond (4 corners) measures ~2-3 sharp turns here even under
  // hand jitter, since it's a controlled shape with a handful of clean
  // corners; a genuinely chaotic scribble runs 7+ from its many erratic
  // reversals. The gap between them is wide, so the threshold doesn't
  // need to sit close to either side.
  if (closedShape) return sharpTurnCount(spinePoints, ZIGZAG_ANGLE) <= 5 ? "diamond" : "crush";

  // Direction (outward/inward) for whatever family this turns out to be.
  // Read from the longest single stroke, not from "first stroke's start
  // to last stroke's end": a decoration (a cap, a tick, an arrowhead
  // flourish) is often drawn as its own separate stroke, and whichever
  // end of the gesture it happens to land nearest to has nothing to do
  // with which way the sign was actually drawn. A decoration landing
  // near the inner end, added after an unambiguously outward main line,
  // used to read the whole sign as drawn inward, since the farthest
  // point the main line actually reached was never even considered, only
  // the first and last strokes' own endpoints were. The longest stroke is
  // the actual gesture; decorations shouldn't be able to override it.
  // Endpoints are averaged over a few points rather than trusted from a
  // single raw one, since hand tremor swings a lone point's position more
  // than it swings an average of several.
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
  const totalStrokeLength = valid.reduce((sum, p) => sum + strokeLength(p), 0);
  const overallStart = averagedEndpoint(mainStroke, false);
  const overallEnd = averagedEndpoint(mainStroke, true);
  const radialDelta = Math.hypot(overallEnd.x, overallEnd.y) - Math.hypot(overallStart.x, overallStart.y);

  // Concatenating every stroke in drawing order (the only option before)
  // works when several comparably-sized strokes together form the shape
  // (a crosshair's four arms, a zigzag drawn as separate segments), but
  // not when one stroke is clearly the actual gesture and another is a
  // minor decoration landing wherever it happens to land relative to
  // drawing order, an arrowhead barb or a cap added near whichever end
  // felt natural. Concatenated regardless of position, that decoration
  // can create a large "jump" in the shape between the main stroke's real
  // endpoint and the decoration's position, which reads as a corner that
  // was never actually drawn. mainStroke alone doesn't have that problem,
  // so it's used whenever it already accounts for most of the ink, same
  // threshold and reasoning as the old dominance check this replaced.
  const shapeInput = strokeLength(mainStroke) / totalStrokeLength > 0.65 ? mainStroke : valid.flat();
  const match = matchShapeTemplate(shapeInput, extraTemplates);

  // A confident shape match (a clean corner, a clean zigzag) is checked
  // before wide sweep, not after: a peak or a zigzag genuinely can span a
  // wide angle as seen from the ring's center once its arms are drawn
  // long enough, the same way a straight line passing near center does,
  // even though it's obviously not a smooth sweep around the ring. Only
  // when the shape doesn't clearly match any single family (its distance
  // to the closest template is still fairly large) is spread worth
  // checking at all: a genuine arc doesn't look like a clean straight
  // line, corner, or zigzag either, so this doesn't cost real wide-sweep
  // signs anything. Threshold set from the actual gap measured between
  // the two: every tested straight/bend/bolt/wavy shape, including under
  // hand tremor, matched under 0.06; every tested wide sweep of a
  // reasonable width matched no better than roughly that.
  const CONFIDENT_SHAPE_MATCH = 0.06;
  if (match.distance >= CONFIDENT_SHAPE_MATCH) {
    // Measured from the longest single stroke alone, not every stroke
    // combined, same reasoning as above: a wide sweep is described (and
    // drawn) as one continuous arc, not a dominant arc plus a separate
    // decoration, so there's no real multi-stroke case this loses. What
    // it fixes is a straight line with a decoration landing at a
    // noticeably different bearing from the ring's center than the main
    // line, which used to be able to drag the combined point cloud's
    // angular spread over threshold even though the main line's own
    // bearing barely varies.
    const spread = angularSpread(mainStroke);
    if (spread > 0.85) return radialDelta >= 0 ? "dispersion" : "convergence";
  }

  if (match.label === "straight") return radialDelta >= 0 ? "column" : "pull";
  if (match.label === "wavy") return "levitation";
  return match.label; // "bend" or "bolt"
}
