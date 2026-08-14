// The 24 signs, drawn by hand (assets/signs/) matching the named signs
// documented on the Witch Hat Atelier wiki. Where the wiki describes a
// sign's mechanical function, contribute() follows it. Where the wiki only
// lists a name with no described function (Bird, Eye, Vision, Dancing
// Puppet, Window), contribute() is a reasonable placeholder grouped with
// the closest documented sign, not a sourced fact. That's noted per entry.
//
// image points at the reference drawing, used for the shape guide and the
// placed-sign thumbnail, never as a substitute for the stroke you drew.
const SIGN_ARCHETYPES = [
  {
    id: "column",
    name: "Column",
    image: "assets/signs/column.webp",
    short: "directional force, follows how you drew it",
    contribute(acc, instance) {
      const sign = instance.inverted ? -1 : 1;
      acc.forceX += Math.cos(instance.angle) * instance.length * sign;
      acc.forceY += Math.sin(instance.angle) * instance.length * sign;
      acc.directional += instance.length;
    },
  },
  {
    id: "crosshair",
    name: "Crosshair",
    image: "assets/signs/crosshair.webp",
    short: "aims the effect at whatever it points toward",
    contribute(acc, instance) {
      acc.forceX += Math.cos(instance.angle) * instance.length;
      acc.forceY += Math.sin(instance.angle) * instance.length;
      acc.directional += instance.length;
    },
  },
  {
    id: "enlarge",
    name: "Enlarge",
    image: "assets/signs/enlarge.webp",
    short: "changes strength only, not direction",
    contribute(acc, instance) {
      acc.forceX += Math.cos(instance.angle) * instance.length;
      acc.forceY += Math.sin(instance.angle) * instance.length;
      acc.directional += instance.length;
      acc.rawIntensity += instance.length * 0.8;
    },
  },
  {
    id: "pull",
    name: "Pull",
    image: "assets/signs/pull.webp",
    short: "always draws inward, toward the seal",
    contribute(acc, instance) {
      acc.forceX += Math.cos(instance.angle) * instance.length * -1;
      acc.forceY += Math.sin(instance.angle) * instance.length * -1;
      acc.directional += instance.length;
    },
  },
  {
    id: "direction",
    name: "Direction",
    image: "assets/signs/direction.webp",
    short: "pulls whatever it points at toward the seal",
    contribute(acc, instance) {
      acc.forceX += Math.cos(instance.angle) * instance.length * -1;
      acc.forceY += Math.sin(instance.angle) * instance.length * -1;
      acc.directional += instance.length;
    },
  },
  {
    id: "dispersion",
    name: "Dispersion",
    image: "assets/signs/dispersion.webp",
    short: "widens the effect outward instead of one direction",
    contribute(acc, instance) {
      acc.spread += instance.length;
    },
  },
  {
    id: "radial",
    name: "Radial",
    image: "assets/signs/radial.webp",
    short: "spreads symmetrically in all directions",
    contribute(acc, instance) {
      acc.spread += instance.length;
    },
  },
  {
    id: "rain",
    name: "Rain",
    image: "assets/signs/rain.webp",
    short: "scatters the effect down over an area",
    contribute(acc, instance) {
      acc.spread += instance.length * 0.8;
      acc.sustain += instance.length * 0.2;
    },
  },
  {
    id: "billowing",
    name: "Billowing",
    image: "assets/signs/billowing.webp",
    short: "expands material into a soft, lasting volume",
    contribute(acc, instance) {
      acc.spread += instance.length * 0.6;
      acc.sustain += instance.length * 0.6;
    },
  },
  {
    id: "weave",
    name: "Weave",
    image: "assets/signs/weave.webp",
    short: "stretches material long and flexible",
    contribute(acc, instance) {
      acc.spread += instance.length * 0.5;
      acc.sustain += instance.length * 0.5;
    },
  },
  {
    id: "convergence",
    name: "Convergence",
    image: "assets/signs/convergence.webp",
    short: "narrows the effect back down, counters spread",
    contribute(acc, instance) {
      acc.focus += instance.length;
    },
  },
  {
    id: "window",
    name: "Window",
    image: "assets/signs/window.webp",
    short: "frames a bounded opening for the effect (undocumented, best guess)",
    contribute(acc, instance) {
      acc.focus += instance.length * 0.8;
    },
  },
  {
    id: "collection",
    name: "Collection",
    image: "assets/signs/collection.webp",
    short: "gathers material from around the seal inward",
    contribute(acc, instance) {
      acc.forceX += Math.cos(instance.angle) * instance.length * -0.6;
      acc.forceY += Math.sin(instance.angle) * instance.length * -0.6;
      acc.directional += instance.length * 0.6;
      acc.focus += instance.length * 0.4;
    },
  },
  {
    id: "crush",
    name: "Crush",
    image: "assets/signs/crush.webp",
    short: "adds raw power, no change to direction or spread",
    contribute(acc, instance) {
      acc.rawIntensity += instance.length;
    },
  },
  {
    id: "bend",
    name: "Bend",
    image: "assets/signs/bend.webp",
    short: "breaks things apart, weakly directional",
    contribute(acc, instance) {
      acc.rawIntensity += instance.length * 0.7;
      acc.forceX += Math.cos(instance.angle) * instance.length * 0.3;
      acc.forceY += Math.sin(instance.angle) * instance.length * 0.3;
      acc.directional += instance.length * 0.3;
    },
  },
  {
    id: "bolt",
    name: "Bolt",
    image: "assets/signs/bolt.webp",
    short: "sudden burst of power, cuts against sustain",
    contribute(acc, instance) {
      acc.burst += instance.length;
      acc.rawIntensity += instance.length * 0.6;
    },
  },
  {
    id: "diamond",
    name: "Diamond",
    image: "assets/signs/diamond.webp",
    short: "marks the boundary of the effect, stabilizes the ring",
    contribute(acc, instance) {
      acc.stability += instance.length;
    },
  },
  {
    id: "repetition",
    name: "Repetition",
    image: "assets/signs/repetition.webp",
    short: "restores what it touches, as if new",
    contribute(acc, instance) {
      acc.stability += instance.length * 0.8;
    },
  },
  {
    id: "levitation",
    name: "Levitation",
    image: "assets/signs/levitation.webp",
    short: "holds the effect in place, longer strokes hold it longer",
    contribute(acc, instance) {
      acc.sustain += instance.length;
    },
  },
  {
    id: "float",
    name: "Float",
    image: "assets/signs/float.webp",
    short: "gentler, steadier lift than Levitation",
    contribute(acc, instance) {
      acc.sustain += instance.length * 0.8;
    },
  },
  {
    id: "bird",
    name: "Bird",
    image: "assets/signs/bird.webp",
    short: "animates flight (undocumented, best guess)",
    contribute(acc, instance) {
      acc.sustain += instance.length * 0.6;
      acc.rawIntensity += instance.length * 0.2;
    },
  },
  {
    id: "dancing-puppet",
    name: "Dancing Puppet",
    image: "assets/signs/dancing-puppet.webp",
    short: "lets the caster control what it's drawn on directly",
    contribute(acc, instance) {
      acc.sustain += instance.length * 0.7;
    },
  },
  {
    id: "eye",
    name: "Eye",
    image: "assets/signs/eye.webp",
    short: "perception, not force (undocumented, best guess)",
    contribute(acc, instance) {
      acc.stability += instance.length * 0.5;
    },
  },
  {
    id: "vision",
    name: "Vision",
    image: "assets/signs/vision.webp",
    short: "scrying, not force (undocumented, best guess)",
    contribute(acc, instance) {
      acc.stability += instance.length * 0.5;
    },
  },
];

function getArchetype(id) {
  return SIGN_ARCHETYPES.find((a) => a.id === id) || null;
}
