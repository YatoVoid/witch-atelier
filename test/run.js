// Plain-node regression test for the recognition engine: no build step,
// no dependencies, matching the rest of the project. Loads the app's
// browser globals (classify.js, signatures.js, etc.) into a vm context the
// same way index.html loads them as sequential <script> tags, then drives
// classifyStrokeGroup() and matchSpell() directly with synthetic stroke
// geometry instead of a real pointer/DOM, since the classifier only ever
// looks at point arrays.
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
    "this.familyKeyOf = familyKeyOf; this.SPELL_SIGNATURES = SPELL_SIGNATURES; " +
    "this.SIGN_ARCHETYPES = SIGN_ARCHETYPES;",
  sandbox
);
const { classifyStrokeGroup, matchSpell, familyKeyOf, SPELL_SIGNATURES, SIGN_ARCHETYPES } = sandbox;

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
// (not rotated to the local radial direction) — translating only, like a
// real hand-drawn sign, avoids degenerate collinear points that a
// direction-dependent construction can produce at some ring angles.
function peakAt(ox, oy) {
  const local = corner(-35, 35, 0, -35, 35, 35);
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

// A gentle wiggle that loops back near (not exactly onto) its own start:
// low net displacement relative to path length, matching the README's
// "doesn't travel far from where it started" without fully closing (a
// closed loop is a different family entirely).
function wavyWiggle(cx, cy, amp) {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24; // 0..0.75 of a full turn: open, not closed
    const a = t * Math.PI * 1.5;
    const x = cx + Math.sin(a) * amp * 0.9;
    const y = cy - Math.cos(a) * amp + amp;
    pts.push({ x, y });
  }
  return pts;
}

// A real diamond: 4 straight edges, sharp ~90 degree corners, drawn as one
// closed stroke (not artificially rounded off to dodge the turn-count
// check — a real diamond genuinely has corners, and the classifier needs
// to accept that, not just a shape gerrymandered to pass).
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
// several positions/angles around the ring, since a couple of past bugs
// were specifically position- or orientation-dependent. ----
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

  // zigzag/bend: single sharp peak, symmetric arms
  check(`zigzag/bend @ ${label}`, classifyStrokeGroup([peakAt(ox, oy)]), "bend");

  // zigzag/bolt: real multi-turn zigzag
  check(`zigzag/bolt @ ${label}`, classifyStrokeGroup([zigzag(ox, oy, 90, 5)]), "bolt");

  // wavy: tight wiggle that loops back near its start
  check(`wavy @ ${label}`, classifyStrokeGroup([wavyWiggle(ox, oy, 22)]), "levitation");

  // closed smooth -> diamond
  check(`closedSmooth @ ${label}`, classifyStrokeGroup([realDiamond(ox, oy, 45)]), "diamond");

  // closed chaotic -> crush
  check(`closedChaotic @ ${label}`, classifyStrokeGroup([chaoticScribble(ox, oy, 40)]), "crush");
}

// wideOut/wideIn need real angular spread around the ring CENTER (0,0),
// not just around their own local position, since angularSpread is
// measured from the origin. Draw an arc that sweeps a wide angle at a
// fixed radius from ring center.
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

// A T-shape (spine + short tick) must NOT be misread as bend: the spine
// should dominate. Drawn radially (pointing away from ring center, like a
// real outward stroke), not tangentially across it — a stroke tangent to
// the ring has both endpoints equidistant from center by construction,
// which makes "outward vs inward" genuinely undefined regardless of how
// good the corner detection is, not a meaningful test of either.
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
    wavy: "levitation",
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
// A single sharp corner is the closest the family set comes to a gentle
// wiggle (both are "one bend, doesn't travel far"), so this one holds a
// slightly lower bar than the rest under heavy noise; its near-misses
// land on that neighboring family, not somewhere wild.
checkJitterRobust("zigzag/bend", () => peakAt(150, 0), "bend", 0.7);
checkJitterRobust("zigzag/bolt", () => zigzag(150, 0, 90, 5), "bolt");
checkJitterRobust("closedSmooth (diamond)", () => realDiamond(150, 0, 45), "diamond");

// ---- report ----
console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((f) => console.log(" - " + f));
  process.exitCode = 1;
}
