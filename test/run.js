// Plain-node regression test for the recognition engine: no build step, no
// dependencies. Loads the app's browser globals into a vm context the same
// way index.html loads them as sequential <script> tags, then drives
// classifyStrokeGroup() and matchSpell() with synthetic stroke geometry.
//
// Run with: node test/run.js
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const files = [
  "js/data/sigils.js",
  "js/data/signs.js",
  "js/data/spellbook.js",
  "js/engine/constants.js",
  "js/engine/vector.js",
  "js/data/templates.js",
  "js/engine/classify.js",
  "js/data/signatures.js",
  "js/engine/compose.js",
];

const sandbox = {};
vm.createContext(sandbox);
for (const f of files) {
  const code = fs.readFileSync(path.join(root, f), "utf8");
  vm.runInContext(code, sandbox, { filename: f });
}
// Top-level `const`/`let` in vm-run scripts land in the context's lexical
// scope, not as own properties of the sandbox object (only `var` and
// function declarations do that), so pull them out explicitly.
vm.runInContext(
  "this.classifyStrokeGroup = classifyStrokeGroup; this.matchSpell = matchSpell; " +
    "this.familyKeyOf = familyKeyOf; this.bucketCandidates = bucketCandidates; " +
    "this.composeSpell = composeSpell; " +
    "this.SPELL_SIGNATURES = SPELL_SIGNATURES; this.SIGN_ARCHETYPES = SIGN_ARCHETYPES;",
  sandbox
);
const { classifyStrokeGroup, matchSpell, familyKeyOf, bucketCandidates, composeSpell, SPELL_SIGNATURES, SIGN_ARCHETYPES } = sandbox;

let pass = 0;
let fail = 0;
const failures = [];

function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    pass++;
  } else {
    fail++;
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ---- stroke builders (all in ring-center-relative coordinates, matching
// app.js's toLocal()) ----
function line(x1, y1, x2, y2, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t });
  }
  return pts;
}

// Two straight arms meeting at one corner. equalArms=true makes a
// symmetric peak (bend); a short second arm makes a spine+tick (should
// stay in the straight family, dominance high).
function corner(x0, y0, xa, ya, x1, y1) {
  return [...line(x0, y0, xa, ya), ...line(xa, ya, x1, y1).slice(1)];
}

// A symmetric "^" peak of a fixed shape/size, just translated to (ox, oy)
// (not rotated to the local radial direction): translating only, like a
// real hand-drawn sign, avoids degenerate collinear points that a
// direction-dependent construction can produce at some ring angles.
function peakAt(ox, oy, arm = 35) {
  const local = corner(-arm, arm, 0, -arm, arm, arm);
  return local.map((p) => ({ x: p.x + ox, y: p.y + oy }));
}

// A real zigzag: 3+ turns, no single dominant arm.
function zigzag(cx, cy, spread, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const x = cx + (i / steps) * spread - spread / 2;
    const y = cy + (i % 2 === 0 ? -1 : 1) * 25;
    pts.push({ x, y });
  }
  return pts;
}

// A gentle wiggle that loops back near (not exactly onto) its own start.
function wavyWiggle(cx, cy, amp) {
  const pts = [];
  const len = amp * 3.2;
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    pts.push({ x: cx + t * len, y: cy + Math.sin(t * Math.PI * 2.5) * amp });
  }
  return pts;
}

// A real diamond: 4 straight edges, sharp ~90 degree corners.
function realDiamond(cx, cy, r) {
  const corners = [
    { x: cx, y: cy - r },
    { x: cx + r, y: cy },
    { x: cx, y: cy + r },
    { x: cx - r, y: cy },
    { x: cx, y: cy - r },
  ];
  let pts = [corners[0]];
  for (let i = 1; i < corners.length; i++) {
    pts = pts.concat(line(pts[pts.length - 1].x, pts[pts.length - 1].y, corners[i].x, corners[i].y, 12).slice(1));
  }
  return pts;
}

// Chaotic closed scribble -> crush.
function chaoticScribble(cx, cy, r) {
  const pts = [];
  const angles = [10, 190, 40, 220, 70, 250, 100, 280, 130, 310, 10];
  for (const a of angles) {
    const rad = (a * Math.PI) / 180;
    pts.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) });
  }
  return pts;
}

// ---- 1. classifyStrokeGroup: one representative stroke per family, at
// several positions/angles around the ring. ----
const positions = [
  { label: "east", ox: 150, oy: 0 },
  { label: "north", ox: 0, oy: -150 },
  { label: "southwest", ox: -110, oy: 90 },
  { label: "near-center", ox: 15, oy: -10 },
];

for (const { label, ox, oy } of positions) {
  // straightOut (column): radially outward
  check(
    `straightOut @ ${label}`,
    classifyStrokeGroup([line(ox * 0.6, oy * 0.6, ox * 1.3, oy * 1.3)]),
    "column"
  );

  // straightIn (pull): radially inward
  check(
    `straightIn @ ${label}`,
    classifyStrokeGroup([line(ox * 1.3, oy * 1.3, ox * 0.6, oy * 0.6)]),
    "pull"
  );

  // zigzag/bend shape (single sharp peak, symmetric arms) defaults to
  // "direction", the more commonly used of that family's members.
  check(`zigzag/bend shape @ ${label} defaults to direction`, classifyStrokeGroup([peakAt(ox, oy)]), "direction");

  // zigzag/bolt: real multi-turn zigzag
  check(`zigzag/bolt @ ${label}`, classifyStrokeGroup([zigzag(ox, oy, 90, 5)]), "bolt");

  // wavy: tight wiggle that loops back near its start
  check(`wavy @ ${label}`, classifyStrokeGroup([wavyWiggle(ox, oy, 22)]), "float");

  // closed smooth -> diamond
  check(`closedSmooth @ ${label}`, classifyStrokeGroup([realDiamond(ox, oy, 45)]), "diamond");

  // closed chaotic -> crush
  check(`closedChaotic @ ${label}`, classifyStrokeGroup([chaoticScribble(ox, oy, 40)]), "crush");
}

// wideOut/wideIn need angular spread around the ring center (0,0), since
// angularSpread is measured from the origin, not the arc's own position.
function arcSweep(radius, startDeg, endDeg, outward) {
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const deg = startDeg + (endDeg - startDeg) * t;
    const rad = (deg * Math.PI) / 180;
    const r = outward ? radius + t * 20 : radius - t * 20;
    pts.push({ x: r * Math.cos(rad), y: r * Math.sin(rad) });
  }
  return pts;
}
check("wideOut (dispersion)", classifyStrokeGroup([arcSweep(90, -70, 70, true)]), "dispersion");
check("wideIn (convergence)", classifyStrokeGroup([arcSweep(90, -70, 70, false)]), "convergence");

// A wide sweep sometimes scores a passable, if not great, point-cloud
// match against "bend" or "wavy" purely by chance (both are smooth
// curves, easy to superficially resemble): gating the spread check on
// shape-match confidence used to leave those sweeps stuck with whatever
// family they happened to score OK against, with no way back to
// reconsider them. Swept across radius, span, and start angle, since the
// earlier bug specifically only showed up for some combinations, not all.
function checkArcSweepRobust(label, outward, passRate = 0.95) {
  let ok = 0;
  const total = 60;
  for (let seed = 1; seed <= total; seed++) {
    const rand = seededRandom(seed * 71);
    const radius = 50 + rand() * 130;
    const span = 90 + rand() * 90;
    const startDeg = rand() * 360;
    const jitterAmt = 2 + rand() * 6;
    const pts = jitterPath(densify(arcSweep(radius, startDeg, startDeg + span, outward), 4), jitterAmt, seed * 131);
    if (classifyStrokeGroup([pts]) === (outward ? "dispersion" : "convergence")) ok++;
  }
  const rate = ok / total;
  if (rate >= passRate) {
    pass++;
  } else {
    fail++;
    failures.push(`${label}: only ${ok}/${total} (${(rate * 100).toFixed(0)}%) classified correctly`);
  }
}
checkArcSweepRobust("wideOut (dispersion), swept radius/span/start angle", true);
checkArcSweepRobust("wideIn (convergence), swept radius/span/start angle", false);

// A peak's arms can subtend a wide angle from the ring center once drawn
// long enough, the same way a straight line passing near center does,
// without being any less a single sharp corner.
for (const arm of [35, 70, 100]) {
  check(`wide-armed bend (arm=${arm}) is not mistaken for a sweep`, classifyStrokeGroup([peakAt(150, 0, arm)]), "direction");
}

// Direction's glyph is a bare peak, so it must be reachable from the
// same family a peak actually classifies into (Bend/Bolt), not Pull's.
check("Direction is reachable from a peak's own family", bucketCandidates("bend").includes("direction"), true);
check("Direction is not still listed under Pull's family", bucketCandidates("pull").includes("direction"), false);

// Levitation/Bird/Eye moved out of "wavy" to match their actual glyph
// shape (see SIGN_BUCKETS in classify.js).
check("Levitation is reachable from Column's family (its glyph is a straight arrow)", bucketCandidates("column").includes("levitation"), true);
check("Levitation is not still listed under wavy", bucketCandidates("float").includes("levitation"), false);
check("Bird is reachable from Bend's family (its glyph is a curved hook)", bucketCandidates("bend").includes("bird"), true);
check("Bird is not still listed under wavy", bucketCandidates("float").includes("bird"), false);
check("Eye is reachable from Diamond's family (its glyph is a closed oval)", bucketCandidates("diamond").includes("eye"), true);
check("Eye is not still listed under wavy", bucketCandidates("float").includes("eye"), false);

// A T-shape (spine + short tick) must NOT be misread as bend: the spine
// should dominate. Drawn radially, not tangentially, since a tangential
// stroke has both endpoints equidistant from center by construction and
// leaves "outward vs inward" undefined regardless of detection quality.
const tSpine = line(20, -20, 170, -170); // outward along a diagonal
const tTick = line(170, -170, 200, -145).slice(1); // short perpendicular-ish cap
check("T-shape spine dominates (not bend)", classifyStrokeGroup([[...tSpine, ...tTick]]), "column");

// ---- 2. every SIGN_ARCHETYPES member belongs to exactly one SIGN_BUCKETS
// family, and every family has a reachable default. ----
for (const archetype of SIGN_ARCHETYPES) {
  const family = familyKeyOf(archetype.id);
  if (!family) failures.push(`sign data integrity: "${archetype.id}" is not in any SIGN_BUCKETS family`), fail++;
  else pass++;
}

// ---- 3. matchSpell(): every declared signature actually matches its own
// exact recipe, and clearly wrong recipes don't. ----
function familyToArchetype(familyKey) {
  const map = {
    straightOut: "column",
    straightIn: "pull",
    wideOut: "dispersion",
    wideIn: "convergence",
    wavy: "float",
    zigzag: "bolt",
    closedSmooth: "diamond",
    closedChaotic: "crush",
  };
  return map[familyKey];
}

function buildSigns(familyKeys) {
  return familyKeys.map((fk, i) => ({
    archetypeId: familyToArchetype(fk),
    angle: (i / familyKeys.length) * Math.PI * 2,
    length: 0.6,
    inverted: false,
  }));
}

for (const sig of SPELL_SIGNATURES) {
  const count = Math.max(sig.minSigns || 1, sig.requiredFamilies.length);
  // Build signs cycling through the allowed families, guaranteeing every
  // required family appears at least once, up to `count` total signs.
  const families = [];
  for (const req of sig.requiredFamilies) families.push(req);
  while (families.length < count) families.push(sig.allowedFamilies[families.length % sig.allowedFamilies.length]);

  const state = { sigilId: sig.sigilId, signs: buildSigns(families) };
  const result = matchSpell(state);
  const matchedNames = result ? result.split(" or ") : [];
  const ok = matchedNames.includes(sig.name);
  if (ok) pass++;
  else {
    fail++;
    failures.push(`signature "${sig.name}": exact recipe did not match, got ${JSON.stringify(result)}`);
  }

  // Negative: wrong sigil should never match.
  const wrongSigilState = { sigilId: sig.sigilId + "-nope", signs: buildSigns(families) };
  check(`signature "${sig.name}" rejects wrong sigil`, matchSpell(wrongSigilState), null);

  // Negative: missing a required family (drop the last required one, if
  // there's more than the minimum) should not match this signature. Only
  // meaningful when there's a required family to drop.
  if (sig.requiredFamilies.length > 0 && count > sig.requiredFamilies.length) {
    const withoutRequired = families.filter((f) => f !== sig.requiredFamilies[0]);
    if (withoutRequired.length > 0) {
      const state2 = { sigilId: sig.sigilId, signs: buildSigns(withoutRequired) };
      const result2 = matchSpell(state2);
      const stillMatches = Boolean(result2) && result2.split(" or ").includes(sig.name);
      check(`signature "${sig.name}" requires "${sig.requiredFamilies[0]}"`, stillMatches, false);
    }
  }

  // Negative: a disallowed family mixed in should break the match.
  const allFamilyKeys = ["straightOut", "straightIn", "wideOut", "wideIn", "wavy", "zigzag", "closedSmooth", "closedChaotic"];
  const disallowed = allFamilyKeys.find((f) => !sig.allowedFamilies.includes(f));
  if (disallowed) {
    const state3 = { sigilId: sig.sigilId, signs: buildSigns([...families, disallowed]) };
    const result3 = matchSpell(state3);
    const stillMatches = Boolean(result3) && result3.split(" or ").includes(sig.name);
    check(`signature "${sig.name}" rejects disallowed family "${disallowed}"`, stillMatches, false);
  }
}

// ---- 4. jitter robustness. A real finger on a small touchscreen circle
// easily produces a few px of tremor per point; a shape that only
// classifies correctly when drawn geometrically perfectly isn't actually
// usable. Each shape has to hold up across a majority of noisy seeds at a
// jitter level real drawing plausibly produces, not just at jitter=0. ----
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
function jitterPath(pts, jitterPx, seed) {
  const rand = seededRandom(seed);
  return pts.map((p, i) => (i === 0 ? p : { x: p.x + (rand() - 0.5) * 2 * jitterPx, y: p.y + (rand() - 0.5) * 2 * jitterPx }));
}
function densify(pts, stepPx) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1],
      b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(d / stepPx));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

const JITTER_PX = 6; // plausible finger tremor on a small ring, with margin
const JITTER_SEEDS = 20;
const JITTER_PASS_RATE = 0.8; // majority-correct, not perfect, is the bar

function checkJitterRobust(label, shapeFn, expected, passRate = JITTER_PASS_RATE) {
  let ok = 0;
  for (let seed = 1; seed <= JITTER_SEEDS; seed++) {
    const result = classifyStrokeGroup([jitterPath(densify(shapeFn(), 4), JITTER_PX, seed * 97)]);
    if (result === expected) ok++;
  }
  const rate = ok / JITTER_SEEDS;
  if (rate >= passRate) {
    pass++;
  } else {
    fail++;
    failures.push(`${label} (jittered): only ${ok}/${JITTER_SEEDS} still classified as "${expected}"`);
  }
}

checkJitterRobust("straightOut (column)", () => line(90, 0, 180, 0), "column");
checkJitterRobust("straightIn (pull)", () => line(180, 0, 90, 0), "pull");
// A single sharp corner is the closest neighboring family to a gentle
// wiggle, so this one holds a slightly lower bar under heavy noise.
checkJitterRobust("zigzag/bend shape defaults to direction", () => peakAt(150, 0), "direction", 0.7);
checkJitterRobust("zigzag/bolt", () => zigzag(150, 0, 90, 5), "bolt");
checkJitterRobust("closedSmooth (diamond)", () => realDiamond(150, 0, 45), "diamond");

// Below ~50px across, diamonds aren't reliably recoverable (tremor is
// 15-40% of the shape's own size) -- tracked as an accepted floor.
checkJitterRobust("wideOut (dispersion), drawn small", () => arcSweep(25, -70, 70, true), "dispersion");
checkJitterRobust("wideIn (convergence), drawn small", () => arcSweep(25, -70, 70, false), "convergence");
checkJitterRobust("closedSmooth (diamond), drawn small", () => realDiamond(150, 0, 50), "diamond");
checkJitterRobust("closedSmooth (diamond), drawn tiny (known limitation, low bar)", () => realDiamond(150, 0, 25), "diamond", 0.3);

// ---- 5. real hand-drawn examples that came back misclassified in
// practice, traced from actual screenshots. Multi-stroke, so built
// directly rather than through checkJitterRobust's single-stroke helper. ----
function realSignJitterRobust(label, pathsFn, expected, passRate = 0.7, jitterPx = JITTER_PX) {
  let ok = 0;
  for (let seed = 1; seed <= JITTER_SEEDS; seed++) {
    const rand = seededRandom(seed * 97);
    const paths = pathsFn().map((p) =>
      densify(p, 4).map((pt, i) => (i === 0 ? pt : { x: pt.x + (rand() - 0.5) * 2 * jitterPx, y: pt.y + (rand() - 0.5) * 2 * jitterPx }))
    );
    if (classifyStrokeGroup(paths) === expected) ok++;
  }
  const rate = ok / JITTER_SEEDS;
  if (rate >= passRate) {
    pass++;
  } else {
    fail++;
    failures.push(`${label} (jittered): only ${ok}/${JITTER_SEEDS} still classified as "${expected}"`);
  }
}

// Vertical line into a small arrowhead, plus a separate wide crossbar
// drawn through the tip.
function realSign0(ox, oy) {
  const mainLine = [...line(0, -35, 0, 22), ...line(0, 22, -9, 15).slice(1), ...line(-9, 15, 0, 22).slice(1), ...line(0, 22, 9, 15).slice(1)];
  const crossbar = line(-19, 27, 19, 27);
  return [mainLine, crossbar].map((p) => p.map((pt) => ({ x: pt.x + ox, y: pt.y + oy })));
}
// A crosshair: four separate straight strokes radiating from a shared
// center, deliberately uneven lengths (up 45, down 35, left 29, right 31)
// since a real hand rarely draws four perfectly equal arms.
function realSign1(ox, oy) {
  const up = line(0, 0, 0, -45);
  const down = line(0, 0, 0, 35);
  const left = line(0, 0, -29, 0);
  const right = line(0, 0, 31, 0);
  return [up, down, left, right].map((p) => p.map((pt) => ({ x: pt.x + ox, y: pt.y + oy })));
}
// Positioned north (not east): the sideways crossbar is tangential to the
// ring there, and the main line's descent is unambiguously inward,
// instead of both competing to shift the direction reading.
realSignJitterRobust("real: line + arrowhead + crossbar", () => realSign0(0, -150), "pull", 0.7, 3);
realSignJitterRobust("real: crosshair (4 separate arms)", () => realSign1(150, 0), "crosshair", 0.6);

// Real crosshair from a user's devtools log: unlike realSign1, its four
// arms don't share an exact origin pixel.
function realSign2() {
  return [
    [{ x: -10, y: -111.8 }, { x: -10, y: -107.8 }, { x: -10, y: -103.8 }, { x: -11, y: -98.8 }, { x: -11, y: -92.8 }, { x: -11, y: -87.8 }, { x: -12, y: -81.8 }, { x: -12, y: -77.8 }, { x: -12, y: -73.8 }, { x: -12, y: -69.8 }, { x: -12, y: -66.8 }, { x: -12, y: -63.8 }],
    [{ x: -6, y: -50.8 }, { x: -4, y: -50.8 }, { x: -2, y: -50.8 }, { x: 2, y: -50.8 }, { x: 7, y: -50.8 }, { x: 12, y: -50.8 }, { x: 16, y: -50.8 }, { x: 19, y: -50.8 }, { x: 22, y: -50.8 }, { x: 28, y: -50.8 }, { x: 31, y: -50.8 }, { x: 35, y: -50.8 }, { x: 37, y: -50.8 }, { x: 39, y: -50.8 }, { x: 41, y: -50.8 }, { x: 43, y: -50.8 }],
    [{ x: -23, y: -49.8 }, { x: -31, y: -49.8 }, { x: -36, y: -48.8 }, { x: -38, y: -48.8 }, { x: -41, y: -48.8 }, { x: -45, y: -48.8 }, { x: -49, y: -48.8 }, { x: -51, y: -48.8 }, { x: -53, y: -48.8 }, { x: -55, y: -48.8 }, { x: -57, y: -48.8 }, { x: -59, y: -48.8 }, { x: -62, y: -49.8 }, { x: -64, y: -49.8 }, { x: -66, y: -49.8 }, { x: -68, y: -49.8 }, { x: -70, y: -49.8 }],
    [{ x: -15, y: -44.8 }, { x: -15, y: -42.8 }, { x: -15, y: -40.8 }, { x: -15, y: -37.8 }, { x: -15, y: -34.8 }, { x: -15, y: -31.8 }, { x: -15, y: -29.8 }, { x: -15, y: -25.8 }, { x: -15, y: -23.8 }, { x: -15, y: -20.8 }, { x: -15, y: -18.8 }, { x: -15, y: -16.8 }, { x: -15, y: -14.8 }, { x: -15, y: -12.8 }, { x: -15, y: -10.8 }, { x: -15, y: -8.8 }, { x: -15, y: -6.8 }],
  ];
}
check("real: crosshair with imperfectly-shared arm origins", classifyStrokeGroup(realSign2()), "crosshair");
realSignJitterRobust("real: crosshair with imperfectly-shared arm origins", realSign2, "crosshair", 0.6);

// ---- 5b. a bare peak (Direction/Bend's shared shape) has to read as
// "direction" from any rotation and either hand chirality (mirrored), not
// just the one orientation it happened to be traced at. Real hands rarely draw
// a peak with equal arm lengths or a dead-centered apex either, so the
// peak itself is built asymmetric and re-randomized per seed. ----
function rotatePoints(points, deg) {
  const r = (deg * Math.PI) / 180;
  return points.map((p) => ({ x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) }));
}
function mirrorPointsX(points) {
  return points.map((p) => ({ x: -p.x, y: p.y }));
}
function asymmetricPeak(armA, armB, apexOffset) {
  return [
    { x: -armA, y: armA * 0.9 },
    { x: -armA * 0.4, y: armA * 0.3 },
    { x: apexOffset, y: -Math.max(armA, armB) },
    { x: armB * 0.4, y: armB * 0.35 },
    { x: armB, y: armB * 0.85 },
  ];
}
const PEAK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
function checkPeakOrientations(label, ringOffset, passRate) {
  let ok = 0;
  let total = 0;
  for (let seed = 1; seed <= 15; seed++) {
    const rand = seededRandom(seed * 53);
    const armA = 35 + rand() * 15;
    const armB = 28 + rand() * 15;
    const apexOffset = (rand() - 0.5) * 8;
    for (const deg of PEAK_ANGLES) {
      for (const flip of [false, true]) {
        total++;
        let pts = asymmetricPeak(armA, armB, apexOffset);
        if (flip) pts = mirrorPointsX(pts);
        pts = rotatePoints(pts, deg).map((p) => ({
          x: p.x + ringOffset * Math.cos((deg * Math.PI) / 180),
          y: p.y + ringOffset * Math.sin((deg * Math.PI) / 180),
        }));
        pts = jitterPath(densify(pts, 3), JITTER_PX, seed * 131 + deg + (flip ? 1000 : 0));
        if (classifyStrokeGroup([pts]) === "direction") ok++;
      }
    }
  }
  const rate = ok / total;
  if (rate >= passRate) {
    pass++;
  } else {
    fail++;
    failures.push(`${label}: only ${ok}/${total} (${(rate * 100).toFixed(0)}%) classified as "direction"`);
  }
}
// Drawn at a normal ring-relative position (matching the offset the other
// position-sweep tests in section 1 use): every rotation, both
// chiralities, under jitter.
checkPeakOrientations("bare peak, any rotation/mirror, normal ring position", 150, 0.95);
// Drawn close enough to ring center that its own arms span a wide angle
// from the origin, the same ambiguity a genuinely small Dispersion/
// Convergence arc has there (see the small-Diamond note below): a corner
// and a tight curve become hard to tell apart from noise alone at this
// scale, not a gap specific to peaks. Tracked with a low bar rather than
// silently left unmeasured.
checkPeakOrientations("bare peak, any rotation/mirror, drawn close to ring center (known limitation, low bar)", 39, 0.55);

// A steep, narrow peak (its two arms folding back close enough together
// to nearly meet near its own base) used to satisfy the closed-shape
// check meant for Diamond/Crush, without ever actually enclosing
// anything -- misread as Diamond. Built with a real curve (quadratic,
// not straight segments) since a rounded corner is how a hand actually
// draws a sharp turn, and that curvature is what pushed loopClosure over
// the old, looser threshold.
function quadTo(a, b, c, n, out) {
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push({
      x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
      y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
    });
  }
}
function curvedPeak(x0, y0, xTip, yTip, x1, y1) {
  const pts = [];
  quadTo({ x: x0, y: y0 }, { x: (x0 + xTip * 2) / 3, y: (y0 + yTip * 2) / 3 }, { x: xTip, y: yTip }, 20, pts);
  quadTo({ x: xTip, y: yTip }, { x: (xTip * 2 + x1) / 3, y: (yTip * 2 + y1) / 3 }, { x: x1, y: y1 }, 20, pts);
  return pts;
}
checkJitterRobust(
  "steep narrow peak is not mistaken for a closed shape",
  () => curvedPeak(-20, 60, 0, -90, 25, 55),
  "direction",
  0.95
);

// A shape the matcher is very sure about (here, a razor-sharp corner,
// point-cloud distance to "bend" under 0.02) has to stay on the bend
// family's default (Direction) even when drawn at a position where its
// endpoints happen to sit at a similar distance from ring center and span
// a wide angle from there -- the same coincidence a genuine wide sweep
// produces. Regression test for a mirror-matching side effect: removing
// the old confidence gate entirely (to let genuine sweeps that scored a
// mediocre match get reconsidered, see the wideOut/wideIn tests above)
// briefly let this get misread as Dispersion too.
check(
  "a confidently-matched sharp corner is not mistaken for a sweep",
  classifyStrokeGroup([[
    { x: -60, y: 50 }, { x: -5, y: -70 }, { x: 55, y: 55 },
  ]]),
  "direction"
);

// ---- 6. drawing a sign larger produces a noticeably stronger reading,
// reflected in the label text, not just the underlying number. ----
const smallColumn = composeSpell({
  sigilId: "fire",
  signs: [{ archetypeId: "column", angle: 0, length: 0.15, inverted: false }],
  ringComplete: true,
});
const largeColumn = composeSpell({
  sigilId: "fire",
  signs: [{ archetypeId: "column", angle: 0, length: 1.4, inverted: false }],
  ringComplete: true,
});
check("a single large sign reads as higher intensity than a small one", largeColumn.params.intensity > smallColumn.params.intensity, true);
check("that difference actually shows up in the label text, not just the number", largeColumn.label !== smallColumn.label, true);

// ---- report ----
console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(" - " + f));
  process.exitCode = 1;
}
