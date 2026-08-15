// Personal shape-template corrections, saved to localStorage and layered
// on top of the shipped SHAPE_TEMPLATES in js/data/templates.js (see
// classify.js's matchShapeTemplate) rather than editing that file.
const TRAINING_KEY = "witch-atelier:training";

const Training = {
  list() {
    try {
      return JSON.parse(localStorage.getItem(TRAINING_KEY) || "[]");
    } catch {
      return [];
    }
  },

  // paths: the raw multi-stroke points a sign was drawn with. label: a
  // shape category classify.js's matcher understands (straight, bend,
  // bolt, wavy). A crosshair-style hub is saved one arm per entry instead
  // of flattened into one polyline, since concatenating arms that don't
  // share an exact pixel would read as a false corner.
  // Returns true/false rather than throwing -- see CalibrationDataset.add's
  // comment in js/dataset.js for why an uncaught quota error here is worse
  // than just losing this one save.
  save(paths, label) {
    const entries = Training.list();
    const groups = paths.length >= 3 && radiatesFromSharedHub(paths) ? paths.map((p) => [p]) : [paths];
    for (const group of groups) {
      entries.push({ label, points: normalizeForMatching(group.flat()), savedAt: Date.now() });
    }
    try {
      localStorage.setItem(TRAINING_KEY, JSON.stringify(entries));
      return true;
    } catch {
      return false;
    }
  },

  removeAt(index) {
    const entries = Training.list();
    entries.splice(index, 1);
    localStorage.setItem(TRAINING_KEY, JSON.stringify(entries));
  },

  clear() {
    localStorage.removeItem(TRAINING_KEY);
  },

  // Grouped by label, matching matchShapeTemplate's extraTemplates shape.
  asTemplatePool() {
    const pool = {};
    for (const entry of Training.list()) {
      if (!pool[entry.label]) pool[entry.label] = [];
      pool[entry.label].push(entry.points);
    }
    return pool;
  },
};
