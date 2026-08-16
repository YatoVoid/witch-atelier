// Resolves a placed sigil + signs into effect parameters. Pure function.
// No rendering or storage here, this is the part that has to be honest.
const EPSILON = 1e-6;
const DIRECTIONAL_FAMILIES = ["straightOut", "straightIn"];

function composeSpell({ sigilId, signs, ringComplete }) {
  const warnings = [];
  const sigil = getSigil(sigilId);
  if (!sigil) warnings.push("No sigil chosen.");
  if (!ringComplete) warnings.push("Ring is open, spell won't activate.");

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
    byArchetype: {},
  };

  for (const instance of signs) {
    const archetype = getArchetype(instance.archetypeId);
    if (!archetype) continue;
    archetype.contribute(acc, instance);
    acc.totalLength += instance.length;
    acc.byArchetype[instance.archetypeId] = (acc.byArchetype[instance.archetypeId] || 0) + instance.length;
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

  // Raw (not net-against-each-other) ratios for the signs that don't
  // already feed spreadRatio/sustainRatio/intensity, so the cast animation
  // can react to Convergence, Diamond/Repetition/Eye/Vision, and Bolt on
  // their own terms instead of those signs only ever showing up as a
  // subtraction from something else.
  const focusRatio = acc.focus / totalWeight;
  const stabilityRatio = acc.stability / totalWeight;
  const burstRatio = acc.burst / totalWeight;

  // How much of the drawing was any one specific archetype, 0..1 of
  // totalWeight, e.g. signWeights.bird. Generic and unopinionated on
  // purpose: this file's job is composing numbers, not deciding what a
  // given sign should look like animated. That decision lives in
  // render.js, which reads whichever of these it wants for a sign it's
  // giving its own distinct motion or form (see castEffect's own
  // comments for which ones and why).
  const signWeights = {};
  for (const id in acc.byArchetype) signWeights[id] = acc.byArchetype[id] / totalWeight;

  // More Diamond signs make the ring more forgiving of a near-canceled push.
  const instabilityThreshold = Math.max(0.05, 0.15 - acc.stability * 0.04);
  const netsToZero = acc.directional > EPSILON && magnitude < instabilityThreshold;

  // Three or more directional signs spread most of the way around the ring
  // net to zero by construction (pushing outward in every direction at
  // once, like Light Beam's four Column signs). That's a beacon, not a
  // misfire, unlike two signs directly opposing each other.
  const directionalSigns = signs.filter((s) => DIRECTIONAL_FAMILIES.includes(familyKeyOf(s.archetypeId)));
  let radiantCoverage = 0;
  if (directionalSigns.length >= 3) {
    const angles = directionalSigns.map((s) => s.angle).sort((a, b) => a - b);
    let maxGap = 0;
    for (let i = 0; i < angles.length; i++) {
      const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + Math.PI * 2;
      maxGap = Math.max(maxGap, next - angles[i]);
    }
    radiantCoverage = Math.PI * 2 - maxGap;
  }
  const isRadiant = netsToZero && radiantCoverage > Math.PI * 1.3;
  const columnsCancel = netsToZero && !isRadiant;

  if (signs.length === 0) {
    warnings.push("No signs placed, effect will be weak.");
  } else if (columnsCancel) {
    warnings.push("Directional signs cancel out, net force near zero, likely misfires.");
  }

  const params = {
    direction,
    magnitude,
    spreadRatio,
    sustainRatio,
    focusRatio,
    stabilityRatio,
    burstRatio,
    signWeights,
    intensity,
    hasDirection: acc.directional > EPSILON && !netsToZero,
    isRadiant,
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

// Plain, factual description, no narrative flourish. Same params every
// sigil x sign combination produces, so nothing here is hardcoded per combo.
function buildLabel(sigil, params, columnsCancel) {
  if (!sigil) return "no element chosen";
  if (columnsCancel) return `${sigil.name.toLowerCase()}, no net direction, signs cancel out`;
  if (params.isRadiant) return `${sigil.name.toLowerCase()}, radiates outward in every direction`;

  const parts = [sigil.name.toLowerCase()];
  parts.push(params.hasDirection ? `${Vector.compassLabel(params.direction)} direction` : "no directional bias");
  if (params.spreadRatio > 0.5) parts.push("wide spread");
  if (params.focusRatio > 0.5) parts.push("tightly focused");
  if (params.sustainRatio > 0.5) parts.push("sustained");
  if (params.burstRatio > 0.5) parts.push("sudden burst");
  if (params.stabilityRatio > 0.5) parts.push("stabilized");
  if (params.intensity > 0.5) parts.push("high intensity");
  return parts.join(", ");
}
