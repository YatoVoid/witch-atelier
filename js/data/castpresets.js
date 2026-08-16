// Custom cast animations for the handful of named spells classify.js/
// signatures.js can recognize with confidence (see matchSpell in
// js/data/signatures.js). Everything else -- unrecognized combinations,
// and most of the 104-spell reference gallery, which was never meant to
// be castable -- gets the generic per-element animation in
// js/engine/render.js, driven purely by composeSpell()'s params. This
// file only overrides the MOTION shape for spells whose documented or
// art-confirmed effect doesn't look like a generic radial burst.
//
// mode selects a branch in castEffect()'s particle motion:
//   "burst"  (default)  -- radiates from center, direction-aware.
//   "beam"    -- narrow, fast, mostly-vertical stream instead of a
//                radial spread. Light Beam's own wiki entry describes a
//                single steady beam, not a burst in every direction,
//                even though its sign geometry (four outward Columns)
//                reads the same as a radiant pattern -- this is the one
//                place the documented effect and the drawn geometry are
//                already known to disagree (see signatures.js).
//   "vortex"  -- spirals inward to center instead of radiating out,
//                for a spell whose whole point is pulling things in.
//   "orbit"   -- circles at a roughly fixed radius instead of traveling
//                outward, for a spell about holding something in place
//                around the seal rather than launching it anywhere.
//   "hover"   -- drifts and bobs gently near the ring instead of
//                launching, for spells about lifting/holding something
//                aloft rather than projecting it.
const CAST_PRESETS = {
  "Light Beam": { mode: "beam", intensityBoost: 1.3 },
  "Grasping Wind": { mode: "vortex" },
  "Carousel of Lights": { mode: "orbit" },
  "Floating Drops": { mode: "hover" },
  "Floatglow Lamp": { mode: "hover" },
  "Sylph Shoes Seal": { mode: "hover" },
  "Torrential Flow Seal": { mode: "burst", intensityBoost: 1.4 },
  "Vapor Bubble": { mode: "burst", intensityBoost: 1.2 },
};

// result.match (see composeSpell/matchSpell) can be "A or B" when two
// spells share an identical detectable signature (Watershot Seal /
// Rising Wave); either name resolving to the same preset, or neither
// having one, is fine, so just check each candidate in turn.
function castPresetFor(matchName) {
  if (!matchName) return null;
  for (const name of matchName.split(" or ")) {
    if (CAST_PRESETS[name]) return CAST_PRESETS[name];
  }
  return null;
}
