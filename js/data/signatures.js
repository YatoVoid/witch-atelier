// Recognizes a drawn spell as one of the named spells in the spellbook, but
// only for the spells whose actual composition has been confirmed, either
// documented on the wiki (Grasping Wind, Sylph Shoes Seal) or read directly
// off the reference art (see spellbook.js): Light Beam is a light sigil
// with four Column signs at north/east/south/west; Watershot Seal and
// Rising Wave are both a water sigil with eight Column-family signs spaced
// evenly around the ring, the same radiant pattern Light Beam uses with
// four. Every other spellbook entry was surveyed and either uses a unique
// motif outside the 8 sigils and 24 signs (faces, eyes, elaborate borders)
// or wasn't legible enough to be confident about, so there's nothing
// honest to match against. Faking a match would be worse than not
// detecting them.
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
