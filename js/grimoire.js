const GRIMOIRE_KEY = "witch-atelier:grimoire";

const Grimoire = {
  list() {
    try {
      return JSON.parse(localStorage.getItem(GRIMOIRE_KEY) || "[]");
    } catch {
      return [];
    }
  },

  save(name, state) {
    const entries = Grimoire.list();
    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      sigilId: state.sigilId,
      signs: state.signs,
      savedAt: Date.now(),
    };
    entries.unshift(entry);
    localStorage.setItem(GRIMOIRE_KEY, JSON.stringify(entries));
    return entry;
  },

  remove(id) {
    const entries = Grimoire.list().filter((e) => e.id !== id);
    localStorage.setItem(GRIMOIRE_KEY, JSON.stringify(entries));
  },

  encode(name, state) {
    const payload = { n: name, s: state.sigilId, g: state.signs };
    return btoa(encodeURIComponent(JSON.stringify(payload)));
  },

  decode(code) {
    try {
      const payload = JSON.parse(decodeURIComponent(atob(code.trim())));
      if (!payload.g || !Array.isArray(payload.g)) return null;
      return { name: payload.n || "Unnamed spell", sigilId: payload.s || null, signs: payload.g };
    } catch {
      return null;
    }
  },
};
