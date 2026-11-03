// Cards stay readable without JavaScript. Connect only supplied causal links;
// scrolling, navigation and resize never write model or review state.
(() => {
  for (const board of document.querySelectorAll(".event-board")) {
    const svg = board.querySelector(".event-connections");
    let queued = false;
    function draw() {
      queued = false;
      svg.replaceChildren();
      svg.setAttribute("width", board.scrollWidth);
      svg.setAttribute("height", board.scrollHeight);
      const rect = board.getBoundingClientRect();
      for (const link of board.querySelectorAll(".event-next")) {
        const target = [...board.querySelectorAll(".event-stage")].find(
          (s) => s.dataset.stage === link.dataset.to,
        );
        if (!target) continue;
        const a = link.getBoundingClientRect();
        const b = target.querySelector(".command").getBoundingClientRect();
        const x1 = a.right - rect.left + board.scrollLeft,
          y1 = a.top + a.height / 2 - rect.top + board.scrollTop;
        const x2 = b.left - rect.left + board.scrollLeft,
          y2 = b.top + b.height / 2 - rect.top + board.scrollTop;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} C ${x1 + 32} ${y1}, ${x2 - 32} ${y2}, ${x2} ${y2}`);
        if (link.dataset.relation === "sequence") path.setAttribute("class", "event-sequence");
        svg.append(path);
        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        arrow.setAttribute("points", `${x2},${y2} ${x2 - 8},${y2 - 5} ${x2 - 8},${y2 + 5}`);
        svg.append(arrow);
      }
    }
    function schedule() {
      if (!queued) {
        queued = true;
        requestAnimationFrame(draw);
      }
    }
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(schedule).observe(board);
    board.addEventListener("toggle", schedule, true);
    window.addEventListener("resize", schedule);
    board.addEventListener("click", (e) => {
      const link = e.target.closest(".event-next");
      if (!link) return;
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      target?.focus({ preventScroll: true });
    });
    const section = board.closest(".event-workbench");
    const expand = section.querySelector(".event-expand");
    function toggle(expanded) {
      section.classList.toggle("event-expanded", expanded);
      expand.setAttribute("aria-pressed", String(expanded));
      expand.textContent = expanded ? expand.dataset.close : expand.dataset.expand;
      schedule();
    }
    expand.addEventListener("click", () => toggle(!section.classList.contains("event-expanded")));
    section.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && section.classList.contains("event-expanded")) {
        toggle(false);
        expand.focus();
      }
    });
    schedule();
  }
})();
