/**
 * Projects the navigation owner's BC route and current search page into a disposable
 * space. Only BCs exist at the top level; internal nodes are created on entry.
 * Cameras and cancellable effects never change model facts or navigation history.
 */
window.createOntologyKnowledgeSpace = (options) => {
  "use strict";
  const { data, contexts, elements, openContext, openElement } = options;
  const $ = (id) => document.getElementById(id);
  const stage = $("kw-space"),
    viewport = $("ks-viewport"),
    world = $("ks-world"),
    toggle = $("kw-presentation"),
    T = data.text;
  if (!CSS.supports("transform-style", "preserve-3d")) return null;
  const types = new Map(data.types);
  const islands = new Map(),
    positions = new Map(),
    cameras = new Map();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const colors = {
    Process: "#586ed3",
    Step: "#428bae",
    BusinessEvent: "#ca8548",
    Policy: "#9971c2",
    BusinessConcept: "#489a80",
    BusinessRule: "#b3834c",
    Actor: "#749951",
    ObservationCriterion: "#568ba0",
  };
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const node = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  let route = null,
    routeKey = null,
    contentKey = null,
    camera = null,
    preset = null,
    visible = true,
    spatial = true,
    effects = true,
    dragMode = "pan",
    drag = null,
    suppressClickUntil = 0,
    animation = null,
    revision = 0,
    size = "";
  const columnCount = Math.max(1, Math.ceil(Math.sqrt(contexts.size)));
  const rowCount = Math.ceil(contexts.size / columnCount);
  let ordinal = 0;
  for (const c of contexts.values()) {
    const col = ordinal % columnCount,
      row = Math.floor(ordinal / columnCount);
    const position = {
      x: (col - (columnCount - 1) / 2) * 480,
      y: (row - (rowCount - 1) / 2) * 360,
    };
    positions.set(c.id, position);
    const island = node("div", null, "ks-island");
    island.dataset.spaceIsland = c.id;
    island.style.transform = `translate3d(${position.x}px,${position.y}px,0)`;
    const plate = node("div", null, "ks-plate");
    const button = node("button", null, "ks-context-node ks-billboard");
    button.type = "button";
    button.dataset.spaceContext = c.id;
    button.append(node("span", c.id, "ks-identity"), node("strong", c.name));
    button.append(node("span", c.coreLogic ?? T.missing, "ks-node-summary"));
    button.setAttribute("aria-label", `${c.name} (${c.id}) · ${T.open}`);
    if (!c.complete) button.append(node("span", T.incomplete, "ks-warning"));
    const inside = node("div", null, "ks-inside");
    island.append(plate, button, inside);
    world.append(island);
    islands.set(c.id, { island, plate, button, inside });
    ordinal++;
  }
  // Collaboration is an undirected authored relationship, not an execution path.
  const svgNS = "http://www.w3.org/2000/svg";
  const links = document.createElementNS(svgNS, "svg");
  links.classList.add("ks-collaborations");
  const extent = Math.max(columnCount * 480, rowCount * 360, 1000);
  links.setAttribute("viewBox", `${-extent} ${-extent} ${extent * 2} ${extent * 2}`);
  links.style.cssText = `width:${extent * 2}px;height:${extent * 2}px;left:${-extent}px;top:${-extent}px`;
  links.setAttribute("aria-hidden", "true");
  for (const [a, b] of data.collaborations) {
    const p = positions.get(a),
      q = positions.get(b);
    if (!p || !q) continue;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", p.x);
    line.setAttribute("y1", p.y);
    line.setAttribute("x2", q.x);
    line.setAttribute("y2", q.y);
    line.dataset.from = a;
    line.dataset.to = b;
    links.append(line);
  }
  world.prepend(links);

  function transform(c) {
    return `translate3d(${c.panX}px,${c.panY}px,${c.depth}px) rotateX(${c.tilt}deg) rotateZ(${c.spin}deg) scale(${c.zoom}) translate3d(${-c.x}px,${-c.y}px,0)`;
  }
  /** Cancel only the presentation effect: the current route's final transform is already set. */
  function settle() {
    revision++;
    animation?.cancel();
    animation = null;
    for (const a of world.getAnimations({ subtree: true })) a.cancel();
    stage.dataset.transitioning = "false";
  }
  function move(next, animate = false) {
    const from = getComputedStyle(world).transform;
    settle();
    camera = { ...next };
    world.style.setProperty("--ks-tilt", `${camera.tilt}deg`);
    world.style.setProperty("--ks-spin", `${camera.spin}deg`);
    world.style.setProperty(
      "--ks-label-scale",
      Math.max(1, Math.min(2, (viewport.clientWidth < 500 ? 0.38 : 0.5) / camera.zoom)),
    );
    world.style.transform = transform(camera);
    if (routeKey) cameras.set(routeKey, { ...camera });
    if (!animate || !effects || reduced.matches || !visible || !spatial || document.hidden) return;
    stage.dataset.transitioning = "true";
    const ticket = revision;
    animation = world.animate(
      [{ transform: from === "none" ? transform(camera) : from }, { transform: transform(camera) }],
      { duration: 850, easing: "cubic-bezier(.22,.8,.22,1)" },
    );
    animation.finished.then(
      () => {
        if (ticket !== revision) return;
        animation = null;
        stage.dataset.transitioning = "false";
      },
      () => {},
    );
  }
  function fit(width, height, focus = { x: 0, y: 0 }, detailed = false) {
    const w = viewport.clientWidth || 800,
      h = viewport.clientHeight || 640;
    return {
      ...focus,
      panX: 0,
      panY: detailed ? 20 : 38,
      depth: detailed ? 80 : 0,
      tilt: detailed ? 12 : 18,
      spin: 0,
      zoom: clamp(
        Math.min((w - 70) / width, (h - (w < 500 ? 90 : 170)) / (height * 0.8 + 160)) * 0.8,
        0.08,
        1.15,
      ),
    };
  }
  /** Internal tiles use the list's current page; an explicitly selected off-page item may join it. */
  function layOutInside(id, keys, selected) {
    const group = islands.get(id),
      shown = [...new Set(keys.filter((k) => elements.has(k)))];
    if (selected && elements.has(selected) && elements.get(selected).t !== "BoundedContext") {
      if (!shown.includes(selected)) shown.push(selected);
    }
    const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(shown.length))));
    const rows = Math.max(1, Math.ceil(shown.length / cols));
    const width = Math.max(420, cols * 260 + 100),
      height = Math.max(270, rows * 175 + 100);
    group.plate.style.width = `${width}px`;
    group.plate.style.height = `${height}px`;
    const labelY = -height / 2 - 65;
    group.button.style.setProperty("--node-y", `${labelY}px`);
    group.inside.replaceChildren();
    let selectedPoint = null;
    shown.forEach((key, i) => {
      const e = elements.get(key),
        x = ((i % cols) - (cols - 1) / 2) * 260,
        y = (Math.floor(i / cols) - (rows - 1) / 2) * 175;
      const item = node("button", null, "ks-element-node ks-billboard");
      item.type = "button";
      item.dataset.spaceElement = key;
      item.style.setProperty("--node-x", `${x}px`);
      item.style.setProperty("--node-y", `${y}px`);
      item.style.setProperty("--node-z", key === selected ? "100px" : "42px");
      item.style.setProperty("--node-color", colors[e.t] ?? "#627fa7");
      item.append(node("span", types.get(e.t) ?? e.t, "ks-node-type"), node("strong", e.n));
      item.append(node("code", key, "ks-identity"));
      const ownership =
        !e.contexts.length || (e.contexts.length > 1 && !e.shared)
          ? T.unknownOwner
          : e.shared
            ? T.shared
            : !e.contexts.includes(id)
              ? T.external
              : null;
      if (ownership) item.append(node("span", ownership, "ks-ownership"));
      if (e.m & 4) item.append(node("span", T.modelIssues, "ks-warning"));
      if (key === selected) {
        item.setAttribute("aria-current", "true");
        selectedPoint = { x: positions.get(id).x + x, y: positions.get(id).y + y };
      }
      group.inside.append(item);
    });
    if (!shown.length) {
      const empty = node("p", T.noMatches, "ks-empty ks-billboard");
      group.inside.append(empty);
    }
    return { width, height: height + 160, selectedPoint, labelY: positions.get(id).y + labelY };
  }
  function show(next) {
    const key = next.level === "contexts" ? "contexts" : JSON.stringify([next.id, next.selected]);
    const signature = JSON.stringify(next);
    if (signature === contentKey) return;
    const changedLevel = routeKey !== key;
    const previous = route;
    const dimensions = new Map();
    for (const id of [previous?.id, next.id]) {
      const plate = islands.get(id)?.plate;
      if (plate)
        dimensions.set(id, {
          width: getComputedStyle(plate).width,
          height: getComputedStyle(plate).height,
        });
    }
    if (camera && routeKey) cameras.set(routeKey, { ...camera });
    const first = routeKey === null;
    route = next;
    routeKey = key;
    contentKey = signature;
    const overview = next.level === "contexts";
    const matches = new Set(next.matches ?? []);
    stage.dataset.scope = overview ? "contexts" : next.id;
    stage.dataset.depth = overview ? "0" : next.selected ? "2" : "1";
    for (const [id, group] of islands) {
      const active = !overview && id === next.id;
      const shown = overview ? matches.has(id) : active;
      group.island.classList.toggle("ks-away", !shown);
      group.island.classList.toggle("ks-expanded", active);
      group.island.inert = !shown;
      group.island.setAttribute("aria-hidden", String(!shown));
      if (!active) {
        group.inside.replaceChildren();
        group.plate.style.width = "360px";
        group.plate.style.height = "250px";
        group.button.style.setProperty("--node-y", "0px");
      }
    }
    links.style.display = overview ? "" : "none";
    for (const line of links.children)
      line.style.display =
        matches.has(line.dataset.from) && matches.has(line.dataset.to) ? "" : "none";
    if (overview) {
      $("ks-level").textContent = `${T.home} · ${matches.size}`;
      $("ks-title").textContent = T.spaceHome;
      $("ks-description").textContent = T.spaceHomeHint;
      preset = fit(columnCount * 480, rowCount * 360);
    } else {
      const c = contexts.get(next.id);
      if (!c) return;
      const layout = layOutInside(next.id, next.keys, next.selected);
      $("ks-level").textContent = next.selected ? T.spaceDetail : T.spaceBC;
      $("ks-title").textContent = next.selected
        ? (elements.get(next.selected)?.n ?? c.name)
        : c.name;
      $("ks-description").textContent = next.selected
        ? `${c.name} · ${next.selected}`
        : T.spaceBCHint;
      preset = fit(layout.width, layout.height, positions.get(next.id), true);
      if (layout.selectedPoint) {
        preset = { ...fit(700, 620, layout.selectedPoint, true), tilt: 0, depth: 130 };
        // A selected tile in a lower row would push the BC label above the plate up
        // into the heading. Center on the tile only as far as the label stays below it.
        const heading = (viewport.clientWidth < 500 ? 90 : 170) + 60;
        const room = (viewport.clientHeight || 640) / 2 + preset.panY - heading;
        preset.y = Math.min(preset.y, layout.labelY + room / preset.zoom);
      }
    }
    move(cameras.get(key) ?? preset, changedLevel && !first);
    // The first observer callback may arrive only after a resize. Remember
    // the viewport that produced the initial camera so it is then invalidated.
    if (!size) size = `${viewport.clientWidth}:${viewport.clientHeight}`;
    if (stage.dataset.transitioning === "true") {
      for (const [id, from] of dimensions) {
        const plate = islands.get(id).plate;
        plate.animate([from, { width: plate.style.width, height: plate.style.height }], {
          duration: 780,
          easing: "cubic-bezier(.22,.8,.22,1)",
        });
      }
      if (!overview) {
        const entering = previous?.level === "contexts" || previous?.id !== next.id;
        for (const item of islands.get(next.id).inside.querySelectorAll("button")) {
          if (!entering && !item.hasAttribute("aria-current")) continue;
          const x = item.style.getPropertyValue("--node-x"),
            y = item.style.getPropertyValue("--node-y");
          const pose = (z) =>
            `translate3d(${x},${y},${z}) rotateZ(calc(-1 * var(--ks-spin))) rotateX(calc(-1 * var(--ks-tilt))) translate(-50%,-50%)`;
          item.animate(
            [
              { opacity: entering ? 0 : 1, transform: pose(entering ? "-25px" : "42px") },
              { opacity: 1, transform: pose(item.style.getPropertyValue("--node-z")) },
            ],
            { duration: 720, easing: "cubic-bezier(.22,.8,.22,1)" },
          );
        }
      }
    }
  }
  function setVisible(next) {
    visible = next;
    stage.hidden = !next || !spatial;
    toggle.hidden = !next;
    if (!next) settle();
  }
  function updateMotion() {
    $("ks-motion").textContent = reduced.matches
      ? T.reducedMotion
      : effects
        ? T.motionOn
        : T.motionOff;
    $("ks-motion").setAttribute("aria-pressed", String(effects && !reduced.matches));
    stage.dataset.motion = String(effects && !reduced.matches);
    if (reduced.matches || !effects) settle();
  }
  toggle.hidden = false;
  toggle.setAttribute("aria-controls", "knowledge-workspace");
  document.body.dataset.knowledgePresentation = "space";
  toggle.addEventListener("click", () => {
    spatial = !spatial;
    document.body.dataset.knowledgePresentation = spatial ? "space" : "list";
    toggle.textContent = spatial ? T.list : T.space;
    stage.hidden = !visible || !spatial;
    settle();
  });
  $("ks-motion").addEventListener("click", () => {
    effects = !effects;
    updateMotion();
  });
  reduced.addEventListener("change", updateMotion);
  updateMotion();
  stage.addEventListener("click", (event) => {
    if (
      event.detail > 0 &&
      viewport.contains(event.target) &&
      performance.now() < suppressClickUntil
    )
      return;
    const context = event.target.closest("[data-space-context]");
    if (context) return openContext(context.dataset.spaceContext);
    const element = event.target.closest("[data-space-element]");
    if (element) return openElement(element.dataset.spaceElement);
    const action = event.target.closest("[data-space-action]")?.dataset.spaceAction;
    if (!action || !camera) return;
    if (action === "pan" || action === "rotate") {
      dragMode = action;
      for (const b of stage.querySelectorAll(
        '[data-space-action="pan"], [data-space-action="rotate"]',
      ))
        b.setAttribute("aria-pressed", String(b.dataset.spaceAction === action));
      return;
    }
    if (action === "reset") return move(preset, true);
    move(
      { ...camera, zoom: clamp(camera.zoom * (action === "in" ? 1.2 : 1 / 1.2), 0.06, 2.8) },
      true,
    );
  });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !camera) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera: { ...camera },
      moved: false,
    };
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x,
      dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) viewport.setPointerCapture(event.pointerId);
    drag.moved = true;
    const c = drag.camera;
    move(
      dragMode === "rotate" || event.shiftKey
        ? { ...c, tilt: clamp(c.tilt - dy * 0.18, 0, 65), spin: c.spin + dx * 0.2 }
        : { ...c, panX: c.panX + dx, panY: c.panY + dy },
    );
    event.preventDefault();
  });
  function release(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) suppressClickUntil = performance.now() + 120;
    if (viewport.hasPointerCapture(event.pointerId))
      viewport.releasePointerCapture(event.pointerId);
    drag = null;
  }
  viewport.addEventListener("pointerup", release);
  viewport.addEventListener("pointercancel", release);
  viewport.addEventListener("lostpointercapture", () => {
    drag = null;
  });
  viewport.addEventListener(
    "wheel",
    (event) => {
      if (!camera) return;
      event.preventDefault();
      move({ ...camera, zoom: clamp(camera.zoom * Math.exp(-event.deltaY * 0.0015), 0.06, 2.8) });
    },
    { passive: false },
  );
  viewport.addEventListener("keydown", (event) => {
    if (event.target !== viewport || !camera) return;
    const step = 34;
    if (event.key === "Home") move(preset, true);
    else if (["+", "="].includes(event.key))
      move({ ...camera, zoom: clamp(camera.zoom * 1.2, 0.06, 2.8) });
    else if (event.key === "-") move({ ...camera, zoom: clamp(camera.zoom / 1.2, 0.06, 2.8) });
    else if (event.key.startsWith("Arrow")) {
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      move(
        dragMode === "rotate"
          ? { ...camera, spin: camera.spin + dx * 0.2, tilt: clamp(camera.tilt - dy * 0.2, 0, 65) }
          : { ...camera, panX: camera.panX + dx, panY: camera.panY + dy },
      );
    } else return;
    event.preventDefault();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) settle();
  });
  new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) settle();
  }).observe(stage);
  new ResizeObserver(() => {
    if (!visible || !spatial || !route) return;
    const next = `${viewport.clientWidth}:${viewport.clientHeight}`;
    if (size === next || !viewport.clientWidth) return;
    if (size) cameras.delete(routeKey);
    size = next;
    contentKey = null;
    // A viewport change refits the current scope; it never changes route or selection.
    camera = null;
    show(route);
  }).observe(viewport);
  return { show, setVisible };
};
