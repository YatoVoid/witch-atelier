// Resolves a placed sigil + signs into effect parameters. Pure function,
// no rendering or storage here — this is the part that has to be honest.
const EPSILON = 1e-6;

function composeSpell({ sigilId, signs, ringComplete }) {
  const warnings = [];
  const sigil = getSigil(sigilId);
  if (!sigil) warnings.push("No sigil chosen.");
  if (!ringComplete) warnings.push("Ring is open — spell won't activate.");

  const acc = {
    forceX: 0,
    forceY: 0,
    directional: 0,
    sustain: 0,
    spread: 0,
    focus: 0,
    rawIntensity: 0,
    stability: 0,
    burst: 0,
    totalLength: 0,
  };

  for (const instance of signs) {
    const archetype = getArchetype(instance.archetypeId);
    if (!archetype) continue;
    archetype.contribute(acc, instance);
    acc.totalLength += instance.length;
  }

  const netMagnitude = Vector.magnitude(acc.forceX, acc.forceY);
  const direction = Vector.angle(acc.forceX, acc.forceY);
  const totalWeight = acc.totalLength + EPSILON;

  const magnitude = acc.directional > EPSILON ? netMagnitude / acc.directional : 0;
  const netSpread = Math.max(0, acc.spread - acc.focus * 0.7);
  const netSustain = Math.max(0, acc.sustain - acc.burst * 0.7);
  const spreadRatio = netSpread / totalWeight;
  const sustainRatio = netSustain / totalWeight;
  const intensity = acc.rawIntensity + acc.directional * 0.5 + acc.spread * 0.3 + acc.sustain * 0.2 + acc.burst * 0.5;

  // More Diamond signs make the ring more forgiving of a near-canceled push.
  const instabilityThreshold = Math.max(0.05, 0.15 - acc.stability * 0.04);
  const columnsCancel = acc.directional > EPSILON && magnitude < instabilityThreshold;

  if (signs.length === 0) {
    warnings.push("No signs placed — effect will be weak.");
  } else if (columnsCancel) {
    warnings.push("Directional signs cancel out — net force near zero, likely misfires.");
  }

  const params = {
    direction,
    magnitude,
    spreadRatio,
    sustainRatio,
    intensity,
    hasDirection: acc.directional > EPSILON && !columnsCancel,
  };

  const label = buildLabel(sigil, params, columnsCancel);

  return {
    ok: warnings.length === 0,
    warnings,
    params,
    label,
    sigil,
  };
}

// Plain, factual description — no narrative flourish. Same params every
// sigil × sign combination produces, so nothing here is hardcoded per-combo.
function buildLabel(sigil, params, columnsCancel) {
  if (!sigil) return "no element chosen";
  if (columnsCancel) return `${sigil.name.toLowerCase()}, no net direction — signs cancel out`;

  const parts = [sigil.name.toLowerCase()];
  parts.push(params.hasDirection ? `${Vector.compassLabel(params.direction)} direction` : "no directional bias");
  if (params.spreadRatio > 0.5) parts.push("wide spread");
  if (params.sustainRatio > 0.5) parts.push("sustained");
  if (params.intensity > 1.2) parts.push("high intensity");
  return parts.join(", ");
}
