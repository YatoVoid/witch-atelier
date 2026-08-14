// Personal shape-template corrections, saved to localStorage so a
// correction sticks around across reloads instead of being forgotten the
// moment the page closes. Layered on top of the shipped SHAPE_TEMPLATES
// in js/data/templates.js (see classify.js's matchShapeTemplate) rather
// than editing that file, the same way a saved spell in the grimoire
// doesn't touch the canon spellbook.
const TRAINING_KEY = "witch-atelier:training";

const Training = {
  list() {
    try {
      return JSON.parse(localStorage.getItem(TRAINING_KEY) || "[]");
    } catch {
      return [];
    }
  },

  // paths: the raw multi-stroke points a sign was actually drawn with
  // (app.js keeps these as instance.basePaths). label: a shape category
  // classify.js's template matcher understands (straight, bend, bolt,
  // wavy). A crosshair-style hub (radiatesFromSharedHub, same check
  // classify.js uses at match time) is saved one arm per entry instead
  // of flattened into one polyline: concatenating arms that don't share
  // an exact pixel bakes the same jump-reads-as-a-corner problem into
  // the saved template that matching already avoids for live input.
  save(paths, label) {
    const entries = Training.list();
    const groups = paths.length >= 3 && radiatesFromSharedHub(paths) ? paths.map((p) => [p]) : [paths];
    for (const group of groups) {
      entries.push({ label, points: normalizeForMatching(group.flat()), savedAt: Date.now() });
    }
    localStorage.setItem(TRAINING_KEY, JSON.stringify(entries));
  },

  removeAt(index) {
    const entries = Training.list();
    entries.splice(index, 1);
    localStorage.setItem(TRAINING_KEY, JSON.stringify(entries));
  },

  clear() {
    localStorage.removeItem(TRAINING_KEY);
  },

  // Grouped by label, the shape matchShapeTemplate's extraTemplates
  // argument expects, so this can be passed straight through.
  asTemplatePool() {
    const pool = {};
    for (const entry of Training.list()) {
      if (!pool[entry.label]) pool[entry.label] = [];
      pool[entry.label].push(entry.points);
    }
    return pool;
  },
};
