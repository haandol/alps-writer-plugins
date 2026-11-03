// A transient camera over readable HTML: no diagram fact depends on pointer input.
(() => {
  const ko = document.documentElement.lang === "ko";
  for (const host of document.querySelectorAll(".event-timeline")) {
    const viewport = host.querySelector(".story-viewport");
    const world = host.querySelector(".story-world");
    const svg = host.querySelector(".story-connections");
    const flow = createEventSignals(host.querySelector(".story-projection"), viewport, svg, {
      selector: ".story-signal",
      scale: () => camera.zoom,
      owner: host,
    });
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
    const routes = [...host.querySelectorAll("[data-story-from]")].map((link, index) => ({
      link,
      index,
      from: link.dataset.storyFrom,
      to: link.dataset.storyTo,
      sequence: link.dataset.storyRelation === "sequence",
      sourceIndex: Number(link.dataset.storySourceIndex),
    }));
    const labels = host.querySelector(".story-trace-labels");
    const clearTrace = host.querySelector(".story-trace-clear");
    for (const route of routes) {
      const label = document.createElement("button");
      label.type = "button";
      label.className = `story-trace-label${route.sequence ? " sequence" : ""}`;
      label.dataset.storyTrace = String(route.index);
      const uncertain =
        route.link.querySelector(".story-verdict") ||
        (!route.sequence && originals.get(route.from).dataset.eventKnown !== "true");
      label.textContent =
        (ko ? (route.sequence ? "순서" : "반응") : route.sequence ? "Sequence" : "Reaction") +
        (uncertain ? " ?" : "");
      label.title = route.link.textContent.trim();
      label.setAttribute(
        "aria-label",
        `${label.textContent}: ${stageName(route.from, route.sequence)} → ${stageName(route.to, route.sequence)}`,
      );
      label.setAttribute("aria-pressed", "false");
      labels.append(label);
      route.label = label;
    }
    const camera = { x: 0, y: 0, zoom: 1 };
    let initialized = false,
      drag = null,
      moved = false,
      selected = null,
      selectedRoute = null,
      frame = 0;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    viewport.dataset.enhanced = "true";
    function paint() {
      world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`;
      host.querySelector(".story-scale").textContent = `${Math.round(camera.zoom * 100)}%`;
      flow.size();
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
    function boxOf(element) {
      const b = element.getBoundingClientRect(),
        w = world.getBoundingClientRect();
      return {
        left: (b.left - w.left) / camera.zoom,
        right: (b.right - w.left) / camera.zoom,
        top: (b.top - w.top) / camera.zoom,
        bottom: (b.bottom - w.top) / camera.zoom,
        y: (b.top + b.height / 2 - w.top) / camera.zoom,
      };
    }
    // Project the same stage links onto their event cards. A checkpoint denotes a
    // recorded action without an event; sequence edges retain their action-order meaning.
    function draw() {
      frame = 0;
      if (!viewport.checkVisibility()) return;
      if (!initialized) fit();
      svg.replaceChildren();
      svg.setAttribute("viewBox", `0 0 ${world.offsetWidth} ${world.offsetHeight}`);
      for (const route of routes) {
        const { from, to, sequence, index } = route;
        const source = nodes.get(from),
          target = nodes.get(to);
        const first = boxOf(source.querySelector(".story-fact"));
        const last = boxOf(target.querySelector(".story-fact"));
        const a = { x: first.right, y: first.y },
          b = { x: last.left, y: last.y };
        const peers = routes.filter((r) => r.from === from && r.to === to);
        const lane = peers.indexOf(route) - (peers.length - 1) / 2;
        const returning = Number(target.dataset.storyColumn) <= Number(source.dataset.storyColumn);
        const skipping =
          source.dataset.storyRow === target.dataset.storyRow &&
          Number(target.dataset.storyColumn) > Number(source.dataset.storyColumn) + 1;
        let d, control;
        if (from === to) {
          const offset = Math.min(22, (first.bottom - first.top) / 4);
          a.y -= offset;
          b.x = first.right;
          b.y += offset;
          control = { x: b.x + 46, y: b.y + 16 };
          d = `M${a.x},${a.y} C${a.x + 46},${a.y - 16} ${control.x},${control.y} ${b.x},${b.y}`;
        } else if (returning || skipping) {
          if (returning) b.x = last.right;
          const rail = Math.max(first.bottom, last.bottom) + 28 + lane * 14;
          const near = b.x + (returning ? 28 : -28);
          control = { x: b.x + (returning ? 14 : -14), y: b.y };
          d = `M${a.x},${a.y} C${a.x + 16},${a.y} ${a.x + 16},${rail} ${a.x + 28},${rail} L${near},${rail} C${control.x},${rail} ${control.x},${control.y} ${b.x},${b.y}`;
        } else {
          const bend = (a.x + b.x) / 2;
          control = { x: bend, y: b.y + lane * 32 };
          d = `M${a.x},${a.y} C${bend},${a.y + lane * 32} ${control.x},${control.y} ${b.x},${b.y}`;
        }
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", d);
        path.classList.add("story-route");
        path.dataset.from = from;
        path.dataset.to = to;
        path.dataset.relation = sequence ? "sequence" : "causal";
        path.dataset.storyTrace = String(index);
        path.dataset.traceEndpoint =
          originals.get(to).dataset.eventKnown === "true" ? "event" : "action";
        if (sequence) path.classList.add("sequence");
        if (skipping) path.classList.add("story-route-skip");
        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        const dx = b.x - control.x,
          dy = b.y - control.y,
          length = Math.hypot(dx, dy) || 1;
        const ux = dx / length,
          uy = dy / length,
          tx = b.x - ux * 8,
          ty = b.y - uy * 8;
        arrow.setAttribute(
          "points",
          `${b.x},${b.y} ${tx - uy * 3.5},${ty + ux * 3.5} ${tx + uy * 3.5},${ty - ux * 3.5}`,
        );
        arrow.dataset.storyTrace = String(index);
        if (sequence) arrow.classList.add("sequence");
        svg.append(path, arrow);
        const middle = path.getPointAtLength(path.getTotalLength() / 2);
        route.label.style.left = `${middle.x}px`;
        route.label.style.top = `${middle.y - 14}px`;
        if (!sequence && source.querySelector(".story-fact:not(.story-fact-missing)")) {
          const signal = path.cloneNode(false);
          signal.classList.remove("story-route", "story-route-skip");
          signal.classList.add("story-signal");
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
    function perspective(mode) {
      host.querySelector(".story-projection").hidden = mode !== "story";
      host.querySelector(".event-landscape").hidden = mode !== "landscape";
      host.querySelectorAll("[data-event-perspective]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.eventPerspective === mode));
      });
      host.dispatchEvent(new CustomEvent("eventstorming-perspective", { detail: { mode } }));
    }
    function reveal(id) {
      if (!nodes.has(id)) return;
      perspective("story");
      if (!initialized) fit();
      const rect = nodes.get(id).getBoundingClientRect(),
        view = viewport.getBoundingClientRect();
      camera.x += view.left + 28 - rect.left;
      camera.y += view.top + 24 - rect.top;
      paint();
      select(id);
    }
    host
      .querySelectorAll("[data-event-perspective]")
      .forEach((button) =>
        button.addEventListener("click", () => perspective(button.dataset.eventPerspective)),
      );
    function select(id) {
      const original = originals.get(id);
      if (!original) return;
      selected = id;
      selectedRoute = null;
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
      highlight();
      host.querySelector(".story-close").focus({ preventScroll: true });
    }
    function stageName(id, action = false) {
      const source = originals.get(id);
      return source
        .querySelector(
          !action && source.dataset.eventKnown === "true"
            ? ".domain-event strong"
            : ".command strong",
        )
        .textContent.trim();
    }
    /** Trace declared predecessors and successors independently, so sibling branches
     * are not selected merely because they share an ancestor. Cycles visit once. */
    function highlight() {
      const activeNodes = new Set(),
        activeRoutes = new Set();
      const walk = (seed, reverse) => {
        const visited = new Set(),
          queue = [seed];
        while (queue.length) {
          const id = queue.pop();
          if (visited.has(id)) continue;
          visited.add(id);
          activeNodes.add(id);
          for (const route of routes)
            if ((reverse ? route.to : route.from) === id) {
              activeRoutes.add(route.index);
              queue.push(reverse ? route.from : route.to);
            }
        }
      };
      if (selected !== null) {
        walk(selected, true);
        walk(selected, false);
      }
      if (selectedRoute !== null) {
        const route = routes[selectedRoute];
        walk(route.from, true);
        walk(route.to, false);
        activeRoutes.add(route.index);
      }
      const active = selected !== null || selectedRoute !== null;
      clearTrace.disabled = !active;
      for (const [id, node] of nodes)
        node.classList.toggle("story-trace-muted", active && !activeNodes.has(id));
      for (const el of host.querySelectorAll("[data-story-trace]")) {
        el.classList.toggle(
          "story-trace-muted",
          active && !activeRoutes.has(Number(el.dataset.storyTrace)),
        );
        el.classList.toggle(
          "story-trace-active",
          active && activeRoutes.has(Number(el.dataset.storyTrace)),
        );
        if (el.tagName === "BUTTON")
          el.setAttribute("aria-pressed", String(Number(el.dataset.storyTrace) === selectedRoute));
      }
      for (const button of host.querySelectorAll("[data-story-select]"))
        button.setAttribute("aria-pressed", String(button.dataset.storySelect === selected));
    }
    function inspectRoute(index) {
      const route = routes[index];
      if (!route) return;
      selected = null;
      selectedRoute = index;
      detail.replaceChildren();
      const heading = document.createElement("h3");
      heading.textContent = `${ko ? (route.sequence ? "업무 순서" : "반응 경로") : route.sequence ? "Action order" : "Reaction path"}: ${stageName(route.from, route.sequence)} → ${stageName(route.to, route.sequence)}`;
      const explanation = document.createElement("p");
      explanation.className = "story-trace-explanation";
      const hasEvent = originals.get(route.to).dataset.eventKnown === "true";
      explanation.textContent = ko
        ? route.sequence
          ? "이 연결은 원문에 기록된 행동의 진행 순서입니다. 사건의 인과나 도착 시간을 뜻하지 않습니다."
          : hasEvent
            ? "정책의 조건이 맞으면 후속 행동이 시작됩니다. 도착 사건은 그 행동이 만드는 사건이며 실제 실행 완료를 뜻하지 않습니다."
            : "정책의 조건이 맞으면 후속 행동이 시작됩니다. 이 단계의 발생 사건은 기록되지 않아 중간 행동으로 표시합니다."
        : route.sequence
          ? "This is the recorded order of actions, not event causation or arrival time."
          : hasEvent
            ? "When the policy condition holds, the next action starts. Its emitted event is the destination; this does not report a completed execution."
            : "When the policy condition holds, the next action starts. No emitted event is recorded for this step, so it is shown as an intermediate action.";
      const relationship = route.link.cloneNode(true);
      relationship.removeAttribute("data-story-from");
      relationship.removeAttribute("data-story-to");
      relationship.classList.add("story-trace-contract");
      const target = originals.get(route.to),
        action = document.createElement("p"),
        event = document.createElement("p");
      action.textContent = `${ko ? "도착 행동" : "Destination action"}: ${target.querySelector(".command strong").textContent}`;
      event.textContent = `${ko ? "발생 사건" : "Emitted event"}: ${target.dataset.eventKnown === "true" ? target.querySelector(".domain-event strong").textContent : ko ? "미기록 · 중간 행동으로 표시" : "Unrecorded · shown as an intermediate action"}`;
      const navigation = document.createElement("div");
      navigation.className = "story-trace-navigation";
      for (const [id, label] of [
        [route.from, ko ? "출발 항목 보기" : "Inspect source"],
        [route.to, ko ? "도착 항목 보기" : "Inspect destination"],
      ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => select(id));
        navigation.append(button);
      }
      detail.append(heading, explanation, relationship, action, event, navigation);
      inspector.hidden = false;
      highlight();
      host.querySelector(".story-close").focus({ preventScroll: true });
    }
    function close() {
      inspector.hidden = true;
      const target =
        selectedRoute !== null
          ? routes[selectedRoute].label
          : nodes.get(selected)?.querySelector(".story-fact");
      target?.focus({ preventScroll: true });
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
            perspective("story");
            const node = nodes.get(id),
              rect = node.getBoundingClientRect(),
              view = viewport.getBoundingClientRect();
            camera.x += view.left + 28 - rect.left;
            camera.y += view.top + 24 - rect.top;
            paint();
          }
          select(id);
        }
        const route = e.target.closest("[data-story-trace]");
        if (route) {
          e.preventDefault();
          inspectRoute(Number(route.dataset.storyTrace));
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
    clearTrace.addEventListener("click", () => {
      selected = null;
      selectedRoute = null;
      inspector.hidden = true;
      highlight();
      viewport.focus({ preventScroll: true });
    });
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
    host.addEventListener("eventstorming-perspective", schedule);
    host.timeline = {
      camera: () => ({ ...camera }),
      selected: () => selected,
      selectedRoute: () => selectedRoute,
      flow: flow.state,
      reveal,
      inspectLink: (index) => {
        const route = routes.find((r) => r.sourceIndex === index);
        if (!route) return;
        perspective("story");
        inspectRoute(route.index);
      },
    };
    schedule();
  }
})();
