// Element definitions. image points at the user's own drawn reconstruction
// of the canon glyph (assets/sigils/), rendered on the canvas via drawImage
// in engine/render.js. Adding a new element means adding one entry here and
// an image at that path, nothing else changes.
const SIGILS = [
  { id: "fire", name: "Fire", substance: "heat", image: "assets/sigils/fire.webp", particle: { shape: "spark" } },
  { id: "water", name: "Water", substance: "flow", image: "assets/sigils/water.webp", particle: { shape: "droplet" } },
  { id: "earth", name: "Earth", substance: "mass", image: "assets/sigils/earth.webp", particle: { shape: "shard" } },
  { id: "light", name: "Light", substance: "radiance", image: "assets/sigils/light.webp", particle: { shape: "beam" } },
  { id: "wind", name: "Wind", substance: "pressure", image: "assets/sigils/wind.webp", particle: { shape: "wisp" } },
  {
    id: "wind-underfoot",
    name: "Wind Underfoot",
    substance: "lift",
    image: "assets/sigils/wind-underfoot.webp",
    particle: { shape: "wisp" },
  },
  {
    id: "aeriforms",
    name: "Aeriforms",
    substance: "breath",
    image: "assets/sigils/aeriforms-maintain-air.webp",
    particle: { shape: "wisp" },
  },
  { id: "crystal", name: "Crystal", substance: "structure", image: "assets/sigils/crystal.webp", particle: { shape: "shard" } },
];

function getSigil(id) {
  return SIGILS.find((s) => s.id === id) || null;
}
