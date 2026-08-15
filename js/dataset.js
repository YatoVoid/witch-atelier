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

  // Returns true/false rather than throwing: localStorage.setItem throws
  // when the browser's storage quota is full, which -- uncaught, as this
  // used to be -- aborted the calibration flow silently mid-function,
  // before the rep that was just drawn ever advanced or got a chance to
  // be reported as unsaved. Hundreds of calibration drawings, each
  // storing full raw (unnormalized) point data, can plausibly hit that
  // quota; the caller needs to know it happened, not just stop responding.
  add(signId, familyKey, paths) {
    const entries = CalibrationDataset.list();
    entries.push({ signId, familyKey, paths, drawnAt: Date.now() });
    try {
      localStorage.setItem(DATASET_KEY, JSON.stringify(entries));
      return true;
    } catch {
      return false;
    }
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
