// Raw, per-sign-labeled calibration drawings, separate from js/training.js's
// Training store (which only keeps 4 shape-category labels -- straight,
// bend, bolt, wavy -- for the live $1 recognizer). This keeps every stroke
// group labeled with the exact sign it was drawn for, unnormalized, meant
// for export and offline model training, not runtime matching.
const DATASET_KEY = "witch-atelier:ml-dataset";

const CalibrationDataset = {
  list() {
    try {
      return JSON.parse(localStorage.getItem(DATASET_KEY) || "[]");
    } catch {
      return [];
    }
  },

  add(signId, familyKey, paths) {
    const entries = CalibrationDataset.list();
    entries.push({ signId, familyKey, paths, drawnAt: Date.now() });
    localStorage.setItem(DATASET_KEY, JSON.stringify(entries));
  },

  countBySign() {
    const counts = {};
    for (const entry of CalibrationDataset.list()) {
      counts[entry.signId] = (counts[entry.signId] || 0) + 1;
    }
    return counts;
  },

  clear() {
    localStorage.removeItem(DATASET_KEY);
  },

  // Triggers a browser download of everything collected so far, as one
  // JSON file. Client-side only (a Blob + a throwaway <a download>), no
  // server involved -- consistent with the rest of this app.
  download() {
    const payload = {
      exportedAt: new Date().toISOString(),
      count: CalibrationDataset.list().length,
      entries: CalibrationDataset.list(),
    };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `witch-atelier-training-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
