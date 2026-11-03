// Mobile-only section tabs.
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

// Collapsible section headings (currently just the Shape guide).
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
