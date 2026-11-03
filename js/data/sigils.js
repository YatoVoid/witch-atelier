// Element definitions.
const SIGILS = [
  { id: "fire", name: "Fire", substance: "heat", image: "assets/sigils/fire.webp", color: "196, 74, 20", particle: { shape: "spark" } },
  { id: "water", name: "Water", substance: "flow", image: "assets/sigils/water.webp", color: "31, 97, 141", particle: { shape: "droplet" } },
  { id: "earth", name: "Earth", substance: "mass", image: "assets/sigils/earth.webp", color: "92, 74, 38", particle: { shape: "shard" } },
  { id: "light", name: "Light", substance: "radiance", image: "assets/sigils/light.webp", color: "180, 138, 46", particle: { shape: "beam" } },
  { id: "wind", name: "Wind", substance: "pressure", image: "assets/sigils/wind.webp", color: "110, 138, 132", particle: { shape: "wisp" } },
  {
    id: "wind-underfoot",
    name: "Wind Underfoot",
    substance: "lift",
    image: "assets/sigils/wind-underfoot.webp",
    color: "102, 142, 126",
    particle: { shape: "wisp" },
  },
  {
    id: "aeriforms",
    name: "Aeriforms",
    substance: "breath",
    image: "assets/sigils/aeriforms-maintain-air.webp",
    color: "132, 118, 148",
    particle: { shape: "wisp" },
  },
  {
    id: "crystal",
    name: "Crystal",
    substance: "structure",
    image: "assets/sigils/crystal.webp",
    color: "78, 150, 168",
    particle: { shape: "shard" },
  },
];

function getSigil(id) {
  return SIGILS.find((s) => s.id === id) || null;
}
