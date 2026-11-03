// A transient camera over readable HTML: no diagram fact depends on pointer input.
(() => {
  const ko = document.documentElement.lang === "ko";
  for (const host of document.querySelectorAll(".event-timeline")) {
    const viewport = host.querySelector(".story-viewport");
    const world = host.querySelector(".story-world");
    const svg = host.querySelector(".story-connections");
    const flow = createSignals(host, viewport, svg);
    const inspector = host.querySelector(".story-inspector");
    const detail = host.querySelector(".story-inspector-body");
    const originals = new Map(
      [...host.closest(".event-workbench").querySelectorAll(".event-board .event-stage")].map(
        (s) => [s.dataset.stage, s],
      ),
    );
    const nodes = new Map(
      [...host.querySelectorAll("[data-story-node]")].map((s) => [s.dataset.storyNode, s]),
    );
    const camera = { x: 0, y: 0, zoom: 1 };
    let initialized = false,
      drag = null,
      moved = false,
      selected = null,
      frame = 0;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    viewport.dataset.enhanced = "true";
    function paint() {
      world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
      host.querySelector(".story-scale").textContent = `${Math.round(camera.zoom * 100)}%`;
    }
    function fit() {
      if (!viewport.checkVisibility()) return;
      camera.zoom = clamp((viewport.clientWidth - 16) / Math.max(world.offsetWidth, 1), 0.45, 1);
      camera.x = Math.max(0, (viewport.clientWidth - world.offsetWidth * camera.zoom) / 2);
      camera.y = 0;
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
    function point(element, side) {
      const b = element.getBoundingClientRect(),
        w = world.getBoundingClientRect();
      return {
        x: ((side === "right" ? b.right : b.left) - w.left) / camera.zoom,
        y: (b.top + b.height / 2 - w.top) / camera.zoom,
      };
    }
    // Draw only supplied links. Command-only sequence never becomes an event reaction.
    function draw() {
      frame = 0;
      if (!viewport.checkVisibility()) return;
      if (!initialized) fit();
      svg.replaceChildren();
      svg.setAttribute("viewBox", `0 0 ${world.offsetWidth} ${world.offsetHeight}`);
      for (const link of host.querySelectorAll("[data-story-from]")) {
        const source = nodes.get(link.dataset.storyFrom);
        const sequence = link.dataset.storyRelation === "sequence";
        const a = point(source.querySelector(sequence ? ".story-action" : ".story-fact"), "right");
        let b = point(link, "left");
        const returning = b.x <= a.x;
        if (returning) b = point(link, "right");
        const bend = returning ? Math.max(a.x, b.x) + 48 : (a.x + b.x) / 2;
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M${a.x},${a.y} C${bend},${a.y} ${bend},${b.y} ${b.x},${b.y}`);
        path.dataset.from = link.dataset.storyFrom;
        path.dataset.to = link.dataset.storyTo;
        path.dataset.relation = link.dataset.storyRelation;
        if (sequence) path.classList.add("sequence");
        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        const tail = b.x + (returning ? 6 : -6);
        arrow.setAttribute("points", `${b.x},${b.y} ${tail},${b.y - 3} ${tail},${b.y + 3}`);
        if (sequence) arrow.classList.add("sequence");
        svg.append(path, arrow);
        if (!sequence && source.querySelector(".story-fact:not(.story-fact-missing)")) {
          const signal = path.cloneNode(false);
          signal.classList.add("story-signal");
          signal.setAttribute("pathLength", "1");
          svg.append(signal);
        }
      }
      flow.refresh();
    }
    function schedule() {
      if (!frame && viewport.checkVisibility()) frame = requestAnimationFrame(draw);
    }
    function select(id) {
      const original = originals.get(id);
      if (!original) return;
      selected = id;
      detail.replaceChildren();
      const structure = document.querySelector('[data-model-tab="structure"]');
      const destination = original.querySelector('.command a[href^="#"]');
      if (structure && destination) {
        const go = document.createElement("button");
        go.type = "button";
        go.className = "story-structure-link";
        go.textContent = ko
          ? "업무 구조에서 이 단계 보기 ↗"
          : "See this step in Business structure ↗";
        go.addEventListener("click", () => {
          structure.click();
          // Let the tab restore its scroll first, then use the existing model navigation.
          requestAnimationFrame(() => destination.click());
        });
        detail.append(go);
      }
      const clone = original.cloneNode(true);
      clone.removeAttribute("id");
      clone.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
      detail.append(clone);
      inspector.hidden = false;
      for (const button of host.querySelectorAll("[data-story-select]"))
        button.setAttribute("aria-pressed", String(button.dataset.storySelect === id));
      host.querySelector(".story-close").focus({ preventScroll: true });
    }
    function close() {
      inspector.hidden = true;
      nodes.get(selected)?.querySelector(".story-fact")?.focus({ preventScroll: true });
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
        const button = e.target.closest("[data-story-select], [data-story-reveal]");
        if (button) {
          const id = button.dataset.storySelect ?? button.dataset.storyReveal;
          if (button.dataset.storyReveal) {
            const node = nodes.get(id),
              rect = node.getBoundingClientRect(),
              view = viewport.getBoundingClientRect();
            camera.x += view.left + 28 - rect.left;
            camera.y += view.top + 24 - rect.top;
            paint();
          }
          select(id);
        }
        const next = e.target.closest(".story-inspector .event-next");
        if (next) {
          e.preventDefault();
          select(next.dataset.to);
        }
      },
      true,
    );
    host.querySelector(".story-close").addEventListener("click", close);
    host.querySelectorAll("[data-story-camera]").forEach((button) =>
      button.addEventListener("click", () => {
        if (button.dataset.storyCamera === "fit") fit();
        else zoom(button.dataset.storyCamera === "in" ? 1.2 : 1 / 1.2);
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
        const b = viewport.getBoundingClientRect();
        zoom(Math.exp(-e.deltaY * 0.0015), e.clientX - b.left, e.clientY - b.top);
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
    // Tab focus keeps a card reachable after panning without selecting or mutating it.
    viewport.addEventListener("focusin", (e) => {
      if (!e.target.matches("button, summary, a")) return;
      const rect = e.target.getBoundingClientRect(),
        view = viewport.getBoundingClientRect();
      if (
        rect.left < view.left ||
        rect.right > view.right ||
        rect.top < view.top ||
        rect.bottom > view.bottom
      ) {
        camera.x += view.left + 24 - rect.left;
        camera.y += view.top + 24 - rect.top;
        paint();
      }
    });
    new ResizeObserver(schedule).observe(world);
    new ResizeObserver(schedule).observe(viewport);
    host.addEventListener("toggle", schedule, true);
    document.addEventListener("ontology-view-change", schedule);
    host.timeline = { camera: () => ({ ...camera }), selected: () => selected, flow: flow.state };
    schedule();
  }

  /** Animate only the signal stroke on recorded event paths, never the facts or camera. */
  function createSignals(host, viewport, svg) {
    const button = host.querySelector(".event-flow-toggle");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let enabled = !reduced.matches,
      inView = false,
      raf = 0,
      elapsed = 0,
      last = null,
      frames = 0;
    let signals = [];
    const visible = () => inView && !document.hidden && viewport.checkVisibility();
    const running = () => enabled && visible() && signals.length > 0;
    const progress = (i) => (elapsed / 5200 + i * 0.37) % 1;
    function frame(now) {
      raf = 0;
      if (!running()) return;
      if (last !== null) elapsed += Math.min(now - last, 80);
      last = now;
      signals.forEach((signal, i) => {
        signal.style.strokeDashoffset = String(-progress(i));
      });
      frames++;
      raf = requestAnimationFrame(frame);
    }
    function refresh() {
      signals = [...svg.querySelectorAll(".story-signal")];
      button.disabled = signals.length === 0;
      button.setAttribute("aria-pressed", String(enabled));
      button.textContent = ko
        ? enabled
          ? "흐름 효과 멈추기"
          : "흐름 효과 켜기"
        : enabled
          ? "Pause flow"
          : "Play flow";
      signals.forEach((signal) => {
        signal.style.visibility = running() ? "visible" : "hidden";
      });
      if (running()) {
        if (!raf) raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
        last = null;
      }
    }
    button.addEventListener("click", () => {
      enabled = !enabled;
      refresh();
    });
    reduced.addEventListener("change", (event) => {
      if (event.matches) enabled = false;
      refresh();
    });
    document.addEventListener("visibilitychange", refresh);
    document.addEventListener("ontology-view-change", refresh);
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      refresh();
    }).observe(viewport);
    return {
      refresh,
      state: () => ({
        enabled,
        running: running(),
        elapsed,
        frames,
        paths: signals.map((p, i) => ({ from: p.dataset.from, to: p.dataset.to, t: progress(i) })),
      }),
    };
  }
})();
