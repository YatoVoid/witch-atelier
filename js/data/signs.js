// Sign archetypes. Each sign placed on the ring is {archetypeId, angle, length, inverted}.
// angle: radians, position around the ring (also the direction a directional sign pushes toward)
// length: 0..1, how far the stroke was drawn from the ring
// inverted: flipping a sign's orientation reverses its function (per canon)
//
// contribute(acc, instance) mutates a shared accumulator that compose.js reduces
// into final effect parameters. New archetypes only need to be added to this list.
const SIGN_ARCHETYPES = [
  {
    id: "column",
    name: "Column",
    kind: "directional",
    description: "Pushes force toward where it points. Flip it to pull instead.",
    contribute(acc, instance) {
      const sign = instance.inverted ? -1 : 1;
      const dx = Math.cos(instance.angle) * instance.length * sign;
      const dy = Math.sin(instance.angle) * instance.length * sign;
      acc.forceX += dx;
      acc.forceY += dy;
      acc.rawColumnLength += instance.length;
    },
  },
  {
    id: "levitation",
    name: "Levitation",
    kind: "sustain",
    description: "Holds the effect in place. Longer strokes sustain it longer.",
    contribute(acc, instance) {
      acc.sustain += instance.length;
    },
  },
  {
    id: "dispersion",
    name: "Dispersion",
    kind: "spread",
    description: "Widens the effect outward in all directions instead of one.",
    contribute(acc, instance) {
      acc.spread += instance.length;
    },
  },
  {
    id: "crushing",
    name: "Crushing",
    kind: "intensity",
    description: "Adds raw power without changing direction or spread.",
    contribute(acc, instance) {
      acc.rawIntensity += instance.length;
    },
  },
];

function getArchetype(id) {
  return SIGN_ARCHETYPES.find((a) => a.id === id) || null;
}
