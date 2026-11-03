// Switch projections of one read-only model, preserving each renderer's in-page state.
(() => {
  const tabs = [...document.querySelectorAll("[data-model-tab]")];
  if (tabs.length < 2) return;
  const workbench = document.getElementById("eventstorming");
  const documentPanel = document.getElementById("document");
  const scroll = {};
  let structureWide = false;
  function select(value, focus = false) {
    const previous = document.body.dataset.modelView;
    if (documentPanel) {
      scroll[previous] = documentPanel.scrollTop;
      documentPanel.style.overflowAnchor = "none";
    }
    if (previous === "structure") structureWide = document.body.classList.contains("city-wide");
    document.body.dataset.modelView = value;
    if (workbench) workbench.hidden = value === "structure";
    document.body.classList.toggle("city-wide", value === "structure" && structureWide);
    for (const tab of tabs) {
      const on = tab.dataset.modelTab === value;
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus({ preventScroll: true });
    }
    if (documentPanel) {
      documentPanel.scrollTop = scroll[value] ?? 0;
      requestAnimationFrame(() => {
        if (document.body.dataset.modelView === value) {
          documentPanel.scrollTop = scroll[value] ?? 0;
          documentPanel.style.overflowAnchor = "";
        }
      });
    }
    document.dispatchEvent(new Event("ontology-view-change"));
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(tab.dataset.modelTab));
    tab.addEventListener("keydown", (e) => {
      let next;
      if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      else if (e.key === "ArrowLeft") next = tabs[(i + tabs.length - 1) % tabs.length];
      else if (e.key === "Home") next = tabs[0];
      else if (e.key === "End") next = tabs.at(-1);
      else return;
      e.preventDefault();
      select(next.dataset.modelTab, true);
    });
  });
})();
