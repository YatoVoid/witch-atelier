// Element definitions. Adding a new element means adding one entry here —
// the readout label is assembled generically in compose.js from whatever
// direction/spread/sustain/intensity the placed signs resolve to, so no
// per-element description text needs to be written by hand.
const SIGILS = [
  { id: "fire", name: "Fire", substance: "heat", particle: { shape: "spark" } },
  { id: "water", name: "Water", substance: "flow", particle: { shape: "droplet" } },
  { id: "wind", name: "Wind", substance: "pressure", particle: { shape: "wisp" } },
  { id: "earth", name: "Earth", substance: "mass", particle: { shape: "shard" } },
  { id: "light", name: "Light", substance: "radiance", particle: { shape: "beam" } },
];

function getSigil(id) {
  return SIGILS.find((s) => s.id === id) || null;
}
