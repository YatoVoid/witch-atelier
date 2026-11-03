// Custom cast animations for the handful of named spells classify.js/ signatures.js can
// recognize with confidence (see matchSpell in js/data/signatures.js).
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

// result.match (see composeSpell/matchSpell) can be "A or B" when two spells share an identical
// detectable signature (Watershot Seal / Rising Wave); either name resolving to the same
// preset, or neither having one, is fine, so just check each candidate in turn.
function castPresetFor(matchName) {
  if (!matchName) return null;
  for (const name of matchName.split(" or ")) {
    if (CAST_PRESETS[name]) return CAST_PRESETS[name];
  }
  return null;
}
