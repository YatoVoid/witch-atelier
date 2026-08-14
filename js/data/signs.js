// Sign archetypes. A placed instance is {archetypeId, angle, length, path, inverted}.
// angle: radians, where the stroke sits relative to the ring's center
// length: arc length of the drawn stroke, normalized to the ring radius
// path: the raw points the user drew, kept for rendering — not reinterpreted
// inverted: for "column", whether the stroke was drawn inward instead of outward
//
// contribute(acc, instance) mutates a shared accumulator that compose.js reduces
// into final effect parameters. New archetypes only need an entry here plus a
// case in engine/render.js's drawSign() for how the stroke gets rendered.
const SIGN_ARCHETYPES = [
  {
    id: "column",
    name: "Column",
    short: "directional force, follows how you drew it",
    contribute(acc, instance) {
      const sign = instance.inverted ? -1 : 1;
      acc.forceX += Math.cos(instance.angle) * instance.length * sign;
      acc.forceY += Math.sin(instance.angle) * instance.length * sign;
      acc.directional += instance.length;
    },
  },
  {
    id: "pulling",
    name: "Pulling",
    short: "always draws inward, toward the ring's center",
    contribute(acc, instance) {
      acc.forceX += Math.cos(instance.angle) * instance.length * -1;
      acc.forceY += Math.sin(instance.angle) * instance.length * -1;
      acc.directional += instance.length;
    },
  },
  {
    id: "levitation",
    name: "Levitation",
    short: "holds the effect in place, longer strokes hold it longer",
    contribute(acc, instance) {
      acc.sustain += instance.length;
    },
  },
  {
    id: "dispersion",
    name: "Dispersion",
    short: "widens the effect outward instead of one direction",
    contribute(acc, instance) {
      acc.spread += instance.length;
    },
  },
  {
    id: "convergence",
    name: "Convergence",
    short: "narrows the effect back down, counters dispersion",
    contribute(acc, instance) {
      acc.focus += instance.length;
    },
  },
  {
    id: "crushing",
    name: "Crushing",
    short: "adds raw power, no change to direction or spread",
    contribute(acc, instance) {
      acc.rawIntensity += instance.length;
    },
  },
  {
    id: "diamond",
    name: "Diamond",
    short: "stabilizes the ring, makes it more forgiving of imbalance",
    contribute(acc, instance) {
      acc.stability += instance.length;
    },
  },
  {
    id: "bolt",
    name: "Bolt",
    short: "sudden burst of power, cuts against sustain",
    contribute(acc, instance) {
      acc.burst += instance.length;
      acc.rawIntensity += instance.length * 0.6;
    },
  },
];

function getArchetype(id) {
  return SIGN_ARCHETYPES.find((a) => a.id === id) || null;
}
