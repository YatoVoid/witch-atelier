// Classifies a drawn sign (one or more strokes) into a shape family.
// Closedness and ring-relative angular spread are read off the raw
// geometry. Everything else (straight line, single corner, zigzag, gentle
// wiggle) is decided by normalizing the stroke's position/scale/rotation
// and comparing it to reference templates ($1 Unistroke Recognizer:
// Wobbrock, Wilson & Li, 2007). classifyStrokeGroup()'s second argument is
// an optional pool of extra templates (personal corrections from the
// in-app training flow, layered on top of js/data/templates.js).
function strokeLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

// Resamples to even arc-length spacing so shape comparison doesn't depend
// on how fast the stroke was drawn.
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
  // Callers rely on getting back exactly `count` points for point-by-point
  // comparison; the loop above can already reach that on its own.
  if (out.length < count) out.push(points[points.length - 1]);
  return out;
}

// Points this close to the ring's center have unreliable angles (a little
// jitter to either side of center reads as ~180 degrees apart on a
// straight line). Kept small since spread is only checked once shape
// matching already failed to find a confident straight/bend/bolt/wavy
// match, so it doesn't need to rule out a whole peak or zigzag on its own.
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

// How steady a stroke's distance from the ring's center stays. A genuine
// wide sweep holds roughly the same radius throughout (this ratio rarely
// drops under ~0.65 even under heavy jitter); a corner or line that
// happens to pass near center dips toward zero at that point (rarely
// above ~0.4), even though it can span just as wide an angle as seen from
// there. Distinguishes the two far more reliably than angular spread
// alone, which both share.
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

// Counts sharp direction reversals within a stroke. Threshold is
// deliberately high (~77 degrees) so a smooth wave doesn't register as one.
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
      // A corner near a resample boundary can split into two hops each
      // under threshold on their own. Combining only same-direction hops
      // catches that without letting independent jitter (which flips sign)
      // accumulate.
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

// Geometry only tells families apart, not which of the 24 named signs was
// meant within a family (a straight outward line could be Column,
// Crosshair, or Enlarge; the source material doesn't distinguish them by
// shape either). classifyStrokeGroup() returns the family's most common
// member as a default; the sign row's dropdown offers the rest of the
// family as alternatives. Bucket membership follows each sign's actual
// glyph shape (assets/signs), not its effect: Direction's glyph is a bare
// peak, so it sits with Bend/Bolt rather than Pull despite pulling inward.
// Vision and Dancing Puppet stay under "wavy" as a known gap: neither
// glyph matches any family's detection reliably.
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

// ---- point-cloud shape matching ($1 Unistroke Recognizer) ----

// A multi-stroke sign (a decorated arrowhead, Crosshair's four arms
// concatenated) packs more actual shape into the same point budget than a
// single clean curve does -- 32 points spread across four arms is only
// 8 per arm. Every candidate and every template share this one constant
// (bestAlignedDistance compares them point-for-point, so the counts have
// to match), so raising it gives every shape more resolution rather than
// only the complex ones specifically, but that lands exactly where it's
// needed most without the mismatched-length problem a truly per-shape
// count would create.
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

// Resample -> recenter -> rescale -> rotate so the first point sits due
// east of center (the "indicative angle"), giving every shape a
// consistent starting orientation so the rotation search below only
// needs to correct for minor variation, not the full circle.
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
// indicative-angle alignment already applied) that best aligns candidate
// and template.
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

// Matches a shape (points from one or more strokes, concatenated in
// drawing order) against the shipped templates plus any extra ones
// (already-normalized personal corrections) passed in.
// bestAlignedDistance's rotation search only covers +/-45 degrees from the
// indicative-angle alignment, not a full search, and never considers a
// reflection at all. A real hand can draw the same shape mirrored (a peak
// swept left-to-right instead of right-to-left, a hook curling the other
// way) with no less legitimate a claim to the same sign. Rather than
// storing a mirrored copy of every template, the candidate is matched in
// both its original and mirrored form and the closer of the two wins --
// covers every family/template at once, including personal corrections.
// Mirroring has to happen on the RAW points, before normalization: the
// indicative-angle step rotates so the first point sits due east, and
// mirroring an already-normalized candidate flips that first point to
// due west, which the rotation search's +/-45 degree window can't recover
// from. Mirroring first and re-normalizing keeps the alignment honest.
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
// Requires 3+ specifically because a plain corner or zigzag only ever
// joins 2 strokes.
//
// Real hand-drawn decorated signs (Pull's spine + small triangle +
// connector + arrowhead, Repetition's own multi-part glyph) exposed a
// false-positive here: the radius used to scale off the single longest
// stroke's own path length ("* 0.3"), which is fine for a genuine hub
// (Crosshair's arms are all comparably long, so that's close to the
// glyph's actual size), but wildly oversized for an asymmetric decorated
// glyph -- a 300px spine with 20-100px decorations gets a 90px radius
// applied to a glyph whose whole footprint might only span 100-150px, at
// which point nearly every stroke's endpoint reads as "close enough" to
// nearly every other one, regardless of whether they're actually a
// radiating hub or just a sequential chain of parts. Scaling off the
// bounding box's own diagonal (the glyph's actual footprint) instead,
// with a much tighter fraction, keeps the radius meaningful relative to
// the shape actually drawn: real Crosshair data still clears it,
// real Pull/Repetition data (measured directly) mostly no longer does.
function radiatesFromSharedHub(strokes) {
  if (strokes.length < 3) return false;
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

function classifyStrokeGroup(paths, extraTemplates) {
  const valid = paths.filter((p) => p.length >= 2 && strokeLength(p) > 1e-3);
  if (valid.length === 0) return null;

  // Closedness is checked first, on the whole undivided shape, because a
  // sharp-cornered outline (Diamond) would otherwise look identical to a
  // zigzag or a chaotic scribble to the shape matcher below.
  const overallSpine = valid.reduce((a, b) => (strokeLength(b) > strokeLength(a) ? b : a));
  const totalStrokeLength = valid.reduce((sum, p) => sum + strokeLength(p), 0);
  // A fixed sample count regardless of size meant a small closed shape got
  // sampled at much tighter spacing (proportionally) than a large one,
  // making a few px of hand tremor a far bigger fraction of the gap
  // between samples: a small clean Diamond's corners started reading as
  // chaotic noise (misread as Crush) well before a large one's did.
  // Scaling the count with the shape's own perimeter, the same idea
  // splitAtCorners already uses, keeps the noise-to-spacing ratio roughly
  // constant across sizes instead of penalizing small ones specifically.
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
  // A steep, narrow peak can fold its two arms back close enough together
  // to pass a looser closure check without ever actually enclosing
  // anything -- measured directly against a real (jittered) closed shape:
  // a genuine Diamond's start and end land close enough to call it closed
  // even under heavy hand tremor, closer than the tightest a folded-back
  // peak ever gets by coincidence. 0.82 sits in the gap measured between
  // the two (peak tops out under 0.80, Diamond stays above 0.85).
  // Real hand-drawn decorated signs exposed a gap here: a multi-part
  // glyph (Pull's spine + small triangle + connector + arrowhead) can
  // have its single longest stroke be a decoration -- an arrowhead is
  // itself a small near-closed V or triangle -- rather than the spine,
  // with none of the parts anywhere near a majority of the ink (measured
  // at 36-52% for real Pull drawings, well under the 0.65 dominance bar
  // used everywhere else in this function for exactly this reason: a
  // decoration shouldn't be able to speak for the whole gesture). Without
  // requiring dominance here too, that one decorative stroke's own
  // closedness got read as the WHOLE sign being closed, misreading a
  // genuinely open multi-part sign as Diamond or Crush.
  const overallSpineDominant = strokeLength(overallSpine) / totalStrokeLength > 0.65;
  const closedShape = overallSpineDominant && loopClosure > 0.82 && strokeLength(spinePoints) > boundSize * 0.7;
  // A real diamond measures ~2-3 sharp turns here even under hand jitter;
  // a chaotic scribble runs 7+.
  if (closedShape) return sharpTurnCount(spinePoints, ZIGZAG_ANGLE) <= 5 ? "diamond" : "crush";

  // Outward/inward direction is read from the longest single stroke, not
  // first-to-last endpoint, so a decoration drawn as its own stroke (an
  // arrowhead, a cap) can't override which way the actual gesture went.
  // Endpoints are averaged over a few points since hand tremor swings a
  // single raw point more than it swings an average of several.
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
  // Distance-from-center of end vs start: a straightforward and correct
  // measure of a wide sweep's radial trend, where the interesting motion
  // (a slight radius change) is small next to the sweep's own tangential
  // travel around the ring, so what matters is only the two ends' overall
  // distance from center, not the path between them.
  const radialDelta = Math.hypot(overallEnd.x, overallEnd.y) - Math.hypot(overallStart.x, overallStart.y);
  // Comparing raw distance-from-center of start vs end breaks down for a
  // straight, radially-aimed stroke specifically: a decisive inward pull
  // that overshoots past the ring's exact center reads the far side as
  // farther from center than the start, the same way a genuinely outward
  // stroke would, even though the whole gesture moved toward center
  // throughout. Projecting the motion onto the radial direction at the
  // start point instead measures which way it actually moved, not just
  // where the two ends happen to land -- but only makes sense for a
  // motion that's mostly radial to begin with, unlike a sweep's mostly
  // tangential travel, so Column/Pull uses this and Dispersion/
  // Convergence keeps the distance-based measure above.
  const startMag = Math.hypot(overallStart.x, overallStart.y) || 1e-6;
  const radialUnit = { x: overallStart.x / startMag, y: overallStart.y / startMag };
  const directionalDelta = (overallEnd.x - overallStart.x) * radialUnit.x + (overallEnd.y - overallStart.y) * radialUnit.y;

  // Matched against mainStroke alone once it's most of the ink, so a
  // decoration (an arrowhead barb) doesn't create a false "jump" when
  // concatenated. Below that ratio, a genuine multi-arm hub is always
  // Crosshair in this vocabulary -- returned directly from the structural
  // fact (3+ strokes sharing an endpoint) rather than routed through a
  // per-arm shape vote. A per-arm vote used to decide it instead, but a
  // short arm's jitter can easily out-vote "straight" against a shape
  // template it superficially resembles (a wave, a shallow corner)
  // without the arm's own shape actually being ambiguous -- the hub
  // structure alone is already unambiguous evidence of what this is.
  let match = null;
  if (strokeLength(mainStroke) / totalStrokeLength > 0.65) {
    match = matchShapeTemplate(mainStroke, extraTemplates);
  } else if (radiatesFromSharedHub(valid)) {
    return "crosshair";
  } else {
    match = matchShapeTemplate(valid.flat(), extraTemplates);
  }

  // A wide sweep is checked by two independent geometric facts, not by
  // whether shape matching happened to find a confident family: a peak or
  // zigzag can span just as wide an angle from the ring's center as a
  // genuine sweep once its arms are long enough (angular spread alone
  // doesn't tell them apart), but it does so by swinging close to center
  // at its corner, where a real sweep holds a roughly steady distance
  // throughout (radiusRatio does tell them apart -- see its own comment).
  // Gating on shape-match confidence instead used to also block plenty of
  // genuine sweeps that happened to score a passable, if not great, match
  // against "bend" or "wavy" by chance (both are smooth curves, easy to
  // resemble at a glance), with no way back to reconsider them as a sweep.
  // Measured from mainStroke alone: a wide sweep is one continuous arc,
  // not a dominant arc plus a decoration at a different bearing.
  const spread = angularSpread(mainStroke);
  // radiusRatio only guards shapes drawn far enough from center to give it
  // a meaningful reading. A genuinely tight Convergence, drawn small,
  // legitimately closes toward a near-zero radius by design -- its ratio
  // reads even lower than a peak's does, so below this size there's no
  // threshold that accepts one and rejects the other; the two really are
  // close to indistinguishable at that scale, the same accepted limit as
  // a tiny Diamond elsewhere in this file. Left ungated there rather than
  // wrongly rejecting real small sweeps to chase a fix this scale doesn't
  // support.
  const maxRadius = Math.max(...mainStroke.map((p) => Math.hypot(p.x, p.y)));
  const steadyRadius = maxRadius < 50 || radiusRatio(mainStroke) > 0.5;
  // A shape the matcher is nearly certain about (a razor-sharp corner, not
  // just a passable-by-chance one) is trusted outright, even if it also
  // happens to pass the two geometric checks above from wherever it was
  // drawn -- a tight, unambiguous match shouldn't lose to a coincidence.
  // Set far below the old blanket confidence gate (which blocked plenty
  // of genuine sweeps that scored merely OK, not this good) so it only
  // catches shapes the matcher truly isn't guessing about.
  const VERY_CONFIDENT_MATCH = 0.03;
  if (match.distance >= VERY_CONFIDENT_MATCH && spread > 0.85 && steadyRadius) {
    return radialDelta >= 0 ? "dispersion" : "convergence";
  }

  if (match.label === "straight") {
    // Checked before direction: a symmetric 4-arm hub has no reliable
    // "outward" arm to measure direction from.
    if (radiatesFromSharedHub(valid)) return "crosshair";
    return directionalDelta >= 0 ? "column" : "pull";
  }
  // "levitation" here (instead of "float", the wavy family's actual
  // default per SIGN_BUCKETS) was a leftover from before Levitation's own
  // glyph -- a plain straight arrow -- got reassigned out of the wavy
  // family into straightOut. Every genuinely wavy-shaped stroke was
  // coming back labeled with a straightOut archetype ever since, a
  // silent family mismatch real hand-drawn data (Float/Dancing Puppet/
  // Vision all reading as straightOut instead of wavy) caught that no
  // amount of synthetic testing had, since synthetic tests only ever
  // checked the label string, not which family it actually belonged to.
  if (match.label === "wavy") return "float";
  return match.label; // "bend" or "bolt"
}
