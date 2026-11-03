// The same event map at context resolution. All selection and camera state is transient.
(() => {
  for (const host of document.querySelectorAll(".event-landscape")) {
    const owner = host.closest(".event-timeline"),
      viewport = host.querySelector(".land-viewport"),
      world = host.querySelector(".land-world"),
      svg = host.querySelector(".land-connections"),
      inspector = host.querySelector(".land-inspector"),
      detail = host.querySelector(".land-inspector-body");
    const nodes = new Map(
      [...host.querySelectorAll("[data-land-context]")].map((c) => [c.dataset.landContext, c]),
    );
    const routes = [...host.querySelectorAll(".land-link-label")].map((label, index) => ({
      label,
      index,
      from: label.dataset.landFrom,
      to: label.dataset.landTo,
      sequence: label.dataset.landRelation === "sequence",
      animated: label.dataset.landAnimated === "true",
    }));
    const camera = { x: 0, y: 0, zoom: 1 };
    const flow = createEventSignals(host, viewport, svg, {
      selector: ".land-signal",
      scale: () => camera.zoom,
      owner,
    });
    let initialized = false,
      frame = 0,
      drag = null,
      moved = false,
      selected = null,
      selectedRoute = null;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    viewport.dataset.enhanced = "true";
    function paint() {
      world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
      host.querySelector(".land-scale").textContent = `${Math.round(camera.zoom * 100)}%`;
      flow.size();
    }
    function fit() {
      if (!viewport.checkVisibility()) return;
      camera.zoom = clamp(
        Math.min(
          (viewport.clientWidth - 16) / world.offsetWidth,
          (viewport.clientHeight - 16) / world.offsetHeight,
        ),
        0.45,
        1,
      );
      camera.x = Math.max(8, (viewport.clientWidth - world.offsetWidth * camera.zoom) / 2);
      camera.y = 8;
      initialized = true;
      paint();
    }
    function zoom(factor, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
      const prior = camera.zoom;
      camera.zoom = clamp(prior * factor, 0.35, 1.8);
      camera.x = x - ((x - camera.x) * camera.zoom) / prior;
      camera.y = y - ((y - camera.y) * camera.zoom) / prior;
      paint();
    }
    function box(element) {
      const r = element.getBoundingClientRect(),
        w = world.getBoundingClientRect();
      return {
        left: (r.left - w.left) / camera.zoom,
        right: (r.right - w.left) / camera.zoom,
        top: (r.top - w.top) / camera.zoom,
        bottom: (r.bottom - w.top) / camera.zoom,
        y: (r.top + r.height / 2 - w.top) / camera.zoom,
      };
    }
    function highlight() {
      const adjacent = new Set(selected ? [selected] : []);
      const active = new Set();
      routes.forEach((r) => {
        if (selectedRoute === r.index || (selected && (r.from === selected || r.to === selected))) {
          active.add(r.index);
          adjacent.add(r.from);
          adjacent.add(r.to);
        }
      });
      const focused = selected !== null || selectedRoute !== null;
      for (const [id, node] of nodes) {
        node.classList.toggle("land-selected", id === selected);
        node.classList.toggle("land-muted", focused && !adjacent.has(id));
      }
      for (const el of host.querySelectorAll("[data-land-route]"))
        el.classList.toggle("land-muted", focused && !active.has(Number(el.dataset.landRoute)));
    }
    function draw() {
      frame = 0;
      if (!viewport.checkVisibility()) return;
      if (!initialized) fit();
      svg.replaceChildren();
      svg.setAttribute("viewBox", `0 0 ${world.offsetWidth} ${world.offsetHeight}`);
      for (const route of routes) {
        const first = box(nodes.get(route.from)),
          last = box(nodes.get(route.to));
        const peers = routes.filter(
          (r) =>
            (r.from === route.from && r.to === route.to) ||
            (r.from === route.to && r.to === route.from),
        );
        const lane = (peers.indexOf(route) - (peers.length - 1) / 2) * 38;
        const forward = last.left > first.right;
        const across = forward || first.left > last.right;
        const a = { x: forward || !across ? first.right : first.left, y: first.y + lane },
          b = { x: forward ? last.left : last.right, y: last.y + lane };
        const bend = across ? (a.x + b.x) / 2 : Math.max(a.x, b.x) + 40 + Math.abs(lane);
        const d = `M${a.x},${a.y} C${bend},${a.y} ${bend},${b.y} ${b.x},${b.y}`;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.classList.add("land-route");
        if (route.sequence) path.classList.add("sequence");
        path.dataset.landRoute = String(route.index);
        path.dataset.from = route.from;
        path.dataset.to = route.to;
        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        const direction = b.x > bend ? 1 : -1;
        arrow.setAttribute(
          "points",
          `${b.x},${b.y} ${b.x - direction * 8},${b.y - 3.5} ${b.x - direction * 8},${b.y + 3.5}`,
        );
        arrow.dataset.landRoute = String(route.index);
        svg.append(path, arrow);
        const mid = path.getPointAtLength(path.getTotalLength() / 2);
        route.label.style.left = `${mid.x}px`;
        route.label.style.top = `${mid.y - 16}px`;
        if (route.animated) {
          const signal = path.cloneNode(false);
          signal.classList.remove("land-route");
          signal.classList.add("land-signal");
          signal.setAttribute("pathLength", "1");
          svg.append(signal);
        }
      }
      highlight();
      flow.refresh();
    }
    function schedule() {
      if (!frame && viewport.checkVisibility()) frame = requestAnimationFrame(draw);
    }
    function inspect(template) {
      detail.replaceChildren(template.content.cloneNode(true));
      inspector.hidden = false;
      highlight();
      host.querySelector(".land-close").focus({ preventScroll: true });
    }
    function close() {
      inspector.hidden = true;
      const control =
        selectedRoute !== null
          ? routes[selectedRoute].label
          : nodes.get(selected)?.querySelector(".land-context-title");
      control?.focus({ preventScroll: true });
    }
    host.addEventListener(
      "click",
      (e) => {
        if (moved && viewport.contains(e.target)) {
          e.preventDefault();
          e.stopPropagation();
          moved = false;
          return;
        }
        const stage = e.target.closest("[data-land-stage]");
        if (stage) owner.timeline.reveal(stage.dataset.landStage);
        const link = e.target.closest("[data-land-link-index]");
        if (link) owner.timeline.inspectLink(Number(link.dataset.landLinkIndex));
        const context = e.target.closest("[data-land-inspect]");
        if (context) {
          selected = context.dataset.landInspect;
          selectedRoute = null;
          inspect(nodes.get(selected).querySelector("template"));
        }
        const route = e.target.closest("[data-land-route]");
        if (route) {
          selected = null;
          selectedRoute = Number(route.dataset.landRoute);
          inspect(routes[selectedRoute].label.querySelector("template"));
        }
      },
      true,
    );
    host.querySelector(".land-close").addEventListener("click", close);
    host.querySelectorAll("[data-land-camera]").forEach((button) =>
      button.addEventListener("click", () => {
        if (button.dataset.landCamera === "fit") fit();
        else zoom(button.dataset.landCamera === "in" ? 1.2 : 1 / 1.2);
      }),
    );
    viewport.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("summary, a")) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y };
      moved = false;
    });
    viewport.addEventListener("pointermove", (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      if (!moved && Math.hypot(dx, dy) < 5) return;
      moved = true;
      viewport.dataset.dragging = "true";
      viewport.setPointerCapture(e.pointerId);
      camera.x = drag.cx + dx;
      camera.y = drag.cy + dy;
      e.preventDefault();
      paint();
    });
    const end = (e) => {
      if (drag?.id !== e.pointerId) return;
      drag = null;
      delete viewport.dataset.dragging;
      if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
    };
    viewport.addEventListener("pointerup", end);
    viewport.addEventListener("pointercancel", (e) => {
      end(e);
      moved = false;
    });
    viewport.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const r = viewport.getBoundingClientRect();
        zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
      },
      { passive: false },
    );
    host.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !inspector.hidden) {
        e.preventDefault();
        close();
        return;
      }
      if (e.target !== viewport) return;
      if (["+", "="].includes(e.key)) zoom(1.2);
      else if (e.key === "-") zoom(1 / 1.2);
      else if (e.key === "0") fit();
      else if (e.key.startsWith("Arrow")) {
        if (e.key === "ArrowLeft") camera.x += 40;
        if (e.key === "ArrowRight") camera.x -= 40;
        if (e.key === "ArrowUp") camera.y += 40;
        if (e.key === "ArrowDown") camera.y -= 40;
        paint();
      } else return;
      e.preventDefault();
    });
    viewport.addEventListener("focusin", (e) => {
      if (!e.target.matches("button, summary, a")) return;
      const r = e.target.getBoundingClientRect(),
        v = viewport.getBoundingClientRect();
      if (r.left < v.left || r.right > v.right || r.top < v.top || r.bottom > v.bottom) {
        camera.x += v.left + 24 - r.left;
        camera.y += v.top + 24 - r.top;
        paint();
      }
    });
    new ResizeObserver(schedule).observe(world);
    new ResizeObserver(schedule).observe(viewport);
    host.addEventListener("toggle", schedule, true);
    owner.addEventListener("eventstorming-perspective", schedule);
    document.addEventListener("ontology-view-change", schedule);
    host.landscape = { camera: () => ({ ...camera }), selected: () => selected, flow: flow.state };
  }
})();
