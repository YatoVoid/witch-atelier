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
