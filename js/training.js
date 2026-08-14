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
  // (app.js keeps these as instance.basePaths). label: one of the shape
  // categories classify.js's template matcher understands (straight,
  // bend, bolt, wavy). Normalizing here rather than at match time means a
  // saved example is stored the same way the shipped templates are
  // cached, and match time doesn't repeat the work on every classify.
  save(paths, label) {
    const points = normalizeForMatching(paths.flat());
    const entries = Training.list();
    entries.push({ label, points, savedAt: Date.now() });
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
