// Recognizes a drawn spell as one of the named spells in the spellbook, but
// only for the spells whose actual composition has been confirmed, either
// documented on the wiki (Grasping Wind, Sylph Shoes Seal) or read directly
// off the reference art (Light Beam: a light sigil surrounded by four
// Column signs at north/east/south/west, see spellbook.js). The other 37
// entries are image and name only, their sign makeup was never confirmed,
// so there's nothing honest to match against. Faking a match for those
// would be worse than not detecting them.
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
];

function matchSpell(state) {
  if (!state.sigilId || state.signs.length === 0) return null;
  const families = state.signs.map((s) => familyKeyOf(s.archetypeId));
  for (const sig of SPELL_SIGNATURES) {
    if (sig.sigilId !== state.sigilId) continue;
    if (state.signs.length < (sig.minSigns || 1)) continue;
    const allAllowed = families.every((f) => sig.allowedFamilies.includes(f));
    const allRequiredPresent = sig.requiredFamilies.every((req) => families.includes(req));
    if (allAllowed && allRequiredPresent) return sig.name;
  }
  return null;
}
