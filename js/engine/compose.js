// Resolves a placed sigil + signs into effect parameters. Pure function,
// no rendering or storage here — this is the part that has to be honest.
const EPSILON = 1e-6;

function composeSpell({ sigilId, signs, ringComplete }) {
  const warnings = [];
  const sigil = getSigil(sigilId);
  if (!sigil) warnings.push("No sigil chosen — nothing to give the effect substance.");
  if (!ringComplete) warnings.push("Ring is not closed — the spell will not activate.");

  const acc = {
    forceX: 0,
    forceY: 0,
    rawColumnLength: 0,
    sustain: 0,
    spread: 0,
    rawIntensity: 0,
  };

  for (const instance of signs) {
    const archetype = getArchetype(instance.archetypeId);
    if (!archetype) continue;
    archetype.contribute(acc, instance);
  }

  const netMagnitude = Vector.magnitude(acc.forceX, acc.forceY);
  const direction = Vector.angle(acc.forceX, acc.forceY);
  const totalWeight = acc.rawColumnLength + acc.spread + acc.sustain + EPSILON;

  const magnitude = acc.rawColumnLength > EPSILON ? netMagnitude / acc.rawColumnLength : 0;
  const spreadRatio = acc.spread / totalWeight;
  const sustainRatio = acc.sustain / totalWeight;
  const intensity = acc.rawIntensity + acc.rawColumnLength * 0.5 + acc.spread * 0.3 + acc.sustain * 0.2;

  // Columns were placed but their vectors cancel out — distinct from "no
  // columns were placed at all", which is a legitimate omnidirectional design.
  const columnsCancel = acc.rawColumnLength > EPSILON && magnitude < 0.15;

  if (signs.length === 0) {
    warnings.push("No signs placed — effect will be faint and unfocused.");
  } else if (columnsCancel) {
    warnings.push("Column signs are pulling against each other — net force is near zero, spell will likely misfire.");
  }

  const params = {
    direction,
    magnitude,
    spreadRatio,
    sustainRatio,
    intensity,
    hasDirection: acc.rawColumnLength > EPSILON && !columnsCancel,
  };

  const label = !sigil
    ? "nothing — no element chosen"
    : columnsCancel
    ? `a sputtering, unfocused surge of ${sigil.substance} that fails to commit to a direction`
    : sigil.describe(params);

  return {
    ok: warnings.length === 0,
    warnings,
    params,
    label,
    sigil,
  };
}
