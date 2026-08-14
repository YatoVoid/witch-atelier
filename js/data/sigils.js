// Element definitions. Adding a new element (once canon reveals more) means
// adding one entry here — nothing in engine/ needs to change.
const SIGILS = [
  {
    id: "fire",
    name: "Fire",
    glyph: "sigil-fire",
    substance: "heat",
    particle: { shape: "spark", jitter: 0.6, trail: 0.15 },
    describe(params) {
      if (params.spreadRatio > 0.6 && params.magnitude > 0.4) {
        return "a sudden, radiating release of heat";
      }
      if (params.sustainRatio > 0.5) {
        return "a held, burning flame";
      }
      return "a directed jet of flame";
    },
  },
  {
    id: "water",
    name: "Water",
    glyph: "sigil-water",
    substance: "flow",
    particle: { shape: "droplet", jitter: 0.2, trail: 0.4 },
    describe(params) {
      if (params.sustainRatio > 0.5) return "a steady, flowing current";
      if (params.spreadRatio > 0.6) return "a wide splash of water";
      return "a directed stream of water";
    },
  },
  {
    id: "wind",
    name: "Wind",
    glyph: "sigil-wind",
    substance: "pressure",
    particle: { shape: "wisp", jitter: 0.35, trail: 0.3 },
    describe(params) {
      if (params.magnitude < 0.15 && params.spreadRatio > 0.5) {
        return "a lifting cushion of air";
      }
      return "a current of moving air";
    },
  },
  {
    id: "earth",
    name: "Earth",
    glyph: "sigil-earth",
    substance: "mass",
    particle: { shape: "shard", jitter: 0.1, trail: 0.05 },
    describe(params) {
      if (params.sustainRatio > 0.5) return "a standing wall of stone";
      return "a thrown mass of stone";
    },
  },
  {
    id: "light",
    name: "Light",
    glyph: "sigil-light",
    substance: "radiance",
    particle: { shape: "beam", jitter: 0.05, trail: 0.5 },
    describe(params) {
      if (params.spreadRatio > 0.6) return "a wide wash of light";
      return "a focused beam of light";
    },
  },
];

function getSigil(id) {
  return SIGILS.find((s) => s.id === id) || null;
}
