// Mobile-only section tabs. Above the 900px breakpoint (see style.css)
// .mobile-tabs is hidden and every panel is forced visible, so this only
// matters on small screens where the three workbench panels would
// otherwise stack into one long scroll.
(function () {
  const tabs = document.querySelectorAll(".mobile-tab");
  const panels = document.querySelectorAll("[data-tab-panel]");
  if (!tabs.length) return;

  function activate(target) {
    tabs.forEach((tab) => {
      const active = tab.dataset.tabTarget === target;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.tabPanel !== target;
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.tabTarget));
  });

  activate("circle");
})();

// Collapsible section headings (currently just the Shape guide). The list
// itself is capped and independently scrollable (see .shape-guide in
// style.css) so reaching the spellbook below it no longer depends on this
// being collapsed -- this toggle is just for hiding it outright if it's in
// the way. Remembered across reloads the same way the grimoire already
// persists to localStorage.
(function () {
  const toggles = document.querySelectorAll(".collapsible-heading");
  toggles.forEach((toggle) => {
    const key = "atelier-collapsed-" + toggle.id;
    const collapsed = localStorage.getItem(key) === "true";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      localStorage.setItem(key, String(expanded));
    });
  });
})();
