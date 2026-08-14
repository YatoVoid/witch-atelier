// Recognizes a drawn spell as one of the named spells in the spellbook, but
// only for the spells whose actual composition has been confirmed, either
// documented on the wiki (Grasping Wind, Sylph Shoes Seal) or read directly
// off the reference art (see spellbook.js). All 104 spellbook images (the
// original 40 plus 64 added from a second batch of reference redraws) were
// surveyed for this. Most still use a motif outside the 8 sigils and 24
// signs (faces, creatures, decorative borders, nested nonstandard geometry)
// or weren't legible enough to be confident about, so there's nothing
// honest to match against for them. Faking a match would be worse than not
// detecting them. The legible ones fall into two shapes: a sigil ringed by
// one straightOut-family sign repeated (the Light Beam / Watershot Seal
// radiant pattern, also found built from fire, crystal, and wind
// underfoot), and a sigil ringed by alternating wavy-family signs
// (Levitation/Float/Bird), which reads as a holding or sustaining effect
// rather than a directional one.
const SPELL_SIGNATURES = [
  {
    name: "Grasping Wind",
    sigilId: "wind",
    requiredFamilies: ["straightIn"],
    allowedFamilies: ["straightIn"],
  },
  {
    name: "Sylph Shoes Seal",
    sigilId: "wind-underfoot",
    requiredFamilies: ["wideIn", "wavy"],
    allowedFamilies: ["wideIn", "wavy"],
  },
  {
    name: "Light Beam",
    sigilId: "light",
    requiredFamilies: ["straightOut"],
    allowedFamilies: ["straightOut"],
    minSigns: 3,
  },
  {
    name: "Watershot Seal",
    sigilId: "water",
    requiredFamilies: ["straightOut"],
    allowedFamilies: ["straightOut", "straightIn"],
    minSigns: 5,
  },
  {
    name: "Rising Wave",
    sigilId: "water",
    requiredFamilies: ["straightOut"],
    allowedFamilies: ["straightOut", "straightIn"],
    minSigns: 5,
  },
  {
    name: "Pyreball Seal",
    sigilId: "fire",
    requiredFamilies: ["straightOut"],
    allowedFamilies: ["straightOut"],
    minSigns: 3,
  },
  {
    name: "Warmth Retention Seal",
    sigilId: "fire",
    requiredFamilies: ["straightIn"],
    allowedFamilies: ["straightIn"],
    minSigns: 3,
  },
  {
    name: "Crystal Shard Seal",
    sigilId: "crystal",
    requiredFamilies: ["straightOut"],
    allowedFamilies: ["straightOut"],
    minSigns: 3,
  },
  {
    name: "River Ferry Seal",
    sigilId: "wind-underfoot",
    requiredFamilies: ["straightOut"],
    allowedFamilies: ["straightOut"],
    minSigns: 6,
  },
  {
    name: "Saltwater Bolt Seal",
    sigilId: "water",
    requiredFamilies: ["straightOut"],
    allowedFamilies: ["straightOut"],
    minSigns: 3,
  },
  {
    name: "Floating Drops",
    sigilId: "light",
    requiredFamilies: ["wavy"],
    allowedFamilies: ["wavy"],
    minSigns: 6,
  },
  {
    name: "Floatglow Lamp",
    sigilId: "light",
    requiredFamilies: ["wavy"],
    allowedFamilies: ["wavy"],
    minSigns: 6,
  },
  {
    name: "Torrential Flow Seal",
    sigilId: "water",
    requiredFamilies: ["wavy"],
    allowedFamilies: ["wavy"],
    minSigns: 6,
  },
  {
    name: "Vapor Bubble",
    sigilId: "water",
    requiredFamilies: ["wavy"],
    allowedFamilies: ["wavy"],
    minSigns: 6,
  },
  {
    name: "Carousel of Lights",
    sigilId: "light",
    requiredFamilies: ["straightOut", "wavy"],
    allowedFamilies: ["straightOut", "wavy"],
    minSigns: 6,
  },
  {
    name: "Rising Platform of Water",
    sigilId: "water",
    requiredFamilies: ["straightOut", "wavy"],
    allowedFamilies: ["straightOut", "wavy"],
    minSigns: 6,
  },
];

function matchSpell(state) {
  if (!state.sigilId || state.signs.length === 0) return null;
  const families = state.signs.map((s) => familyKeyOf(s.archetypeId));
  const matches = [];
  for (const sig of SPELL_SIGNATURES) {
    if (sig.sigilId !== state.sigilId) continue;
    if (state.signs.length < (sig.minSigns || 1)) continue;
    const allAllowed = families.every((f) => sig.allowedFamilies.includes(f));
    const allRequiredPresent = sig.requiredFamilies.every((req) => families.includes(req));
    if (allAllowed && allRequiredPresent) matches.push(sig.name);
  }
  // Watershot Seal and Rising Wave share an identical detectable signature
  // (there's no shape difference between them in the reference art either,
  // the same ambiguity the sign-family dropdown already handles elsewhere),
  // so both are offered rather than silently picking one.
  return matches.length ? matches.join(" or ") : null;
}
