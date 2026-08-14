// Recognizes a drawn spell as one of the named spells in the spellbook,
// but only for the two whose actual composition is documented on the wiki
// (Grasping Wind, Sylph Shoes Seal, see the research notes in spellbook.js
// and the README). The other 38 spellbook entries are image and name only,
// their sign makeup was never confirmed, so there's nothing honest to match
// against. Faking a match for those would be worse than not detecting them.
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
];

function matchSpell(state) {
  if (!state.sigilId || state.signs.length === 0) return null;
  const families = state.signs.map((s) => familyKeyOf(s.archetypeId));
  for (const sig of SPELL_SIGNATURES) {
    if (sig.sigilId !== state.sigilId) continue;
    const allAllowed = families.every((f) => sig.allowedFamilies.includes(f));
    const allRequiredPresent = sig.requiredFamilies.every((req) => families.includes(req));
    if (allAllowed && allRequiredPresent) return sig.name;
  }
  return null;
}
