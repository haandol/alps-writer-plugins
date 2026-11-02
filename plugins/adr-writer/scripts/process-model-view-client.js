// process-model-view-client.js — the explorer and the 3D business city of the process view.
// Everything it shows comes from the data the page embeds, the same reading the diagrams, lists
// and details are drawn from. It never fetches, stores or edits anything, and moves the page
// only through the URL fragment, as the diagram links do.
(() => {
  "use strict";
  const source = document.getElementById("view-data");
  if (!source) return;
  const data = JSON.parse(source.textContent);
  const T = data.text;
  const els = data.elements;
  const typeName = new Map(data.types);
  const at = new Map(els.map((e, i) => [e.h, i]));
  // A process is reached at its flow and at its details alike.
  els.forEach((e, i) => e.t === "Process" && at.set(e.h.replace(/^process-/, ""), i));
  const say = (template, values) => template.replace(/\{(\w+)\}/g, (_, k) => String(values[k]));
  const fragment = () => {
    try {
      return decodeURIComponent(location.hash.slice(1));
    } catch {
      return "";
    }
  };

  /** Show element `i` in the document: the fragment scrolls to it, then it takes the focus. */
  function go(i) {
    const id = els[i].h;
    const target = document.getElementById(id);
    if (fragment() === id) target?.scrollIntoView({ block: "start" });
    else location.hash = id;
    target?.focus({ preventScroll: true });
    // The tree follows at once; the fragment's own event repeats it.
    reveal();
  }

  // ── Explorer: find by name or identifier, filter by type, follow the context tree ──
  const find = document.getElementById("find");
  const results = document.getElementById("find-results");
  const status = document.getElementById("find-status");
  const tree = document.getElementById("tree");
  const hiddenTypes = new Set();
  const LIMIT = 60;
  const fold = (s) => String(s).toLocaleLowerCase();
  const folded = els.map((e) => [fold(e.n), fold(e.k)]);
  // Exact matches first, then those starting with the term, then the rest, each in page order.
  const rank = (i, term) => {
    const [n, k] = folded[i];
    if (n === term || k === term) return 0;
    if (n.startsWith(term) || k.startsWith(term)) return 1;
    return n.includes(term) || k.includes(term) ? 2 : -1;
  };
  function resultItem(i) {
    const e = els[i];
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${e.h}`;
    const glyph = document.createElement("span");
    glyph.className = `glyph t-${e.t}`;
    glyph.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = e.n;
    const kind = document.createElement("span");
    kind.className = "kind";
    kind.textContent = typeName.get(e.t) ?? e.t;
    const id = document.createElement("code");
    id.textContent = e.k;
    a.append(glyph, label, kind, id);
    li.append(a);
    return li;
  }
  function search() {
    if (!find || !results || !tree) return;
    const term = fold(find.value.trim());
    results.replaceChildren();
    results.hidden = !term;
    tree.hidden = Boolean(term);
    if (!term) {
      status.textContent = "";
      return;
    }
    const hits = [];
    for (let i = 0; i < els.length; i++) {
      if (hiddenTypes.has(els[i].t)) continue;
      const r = rank(i, term);
      if (r >= 0) hits.push([r, i]);
    }
    hits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    status.textContent = hits.length
      ? say(hits.length > LIMIT ? T.foundSome : T.found, { n: hits.length, m: LIMIT })
      : T.noneFound;
    for (const [, i] of hits.slice(0, LIMIT)) results.append(resultItem(i));
  }
  find?.addEventListener("input", search);
  find?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const first = results.querySelector("a");
      const i = first && at.get(first.getAttribute("href").slice(1));
      if (i !== undefined && i !== null) {
        event.preventDefault();
        go(i);
      }
    } else if (event.key === "Escape" && find.value) {
      find.value = "";
      search();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest?.("input, textarea, select, [contenteditable]")) return;
    event.preventDefault();
    find?.focus();
  });
  for (const chip of document.querySelectorAll(".chips button[data-type]")) {
    chip.addEventListener("click", () => {
      const type = chip.dataset.type;
      const show = hiddenTypes.has(type);
      if (show) hiddenTypes.delete(type);
      else hiddenTypes.add(type);
      chip.setAttribute("aria-pressed", String(show));
      tree?.classList.toggle(`hide-${type}`, !show);
      search();
    });
  }
  // Links to an element, in the explorer or the document, focus it, as the diagram nodes do.
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey) return;
    const a = event.target.closest?.('.explorer a[href^="#"], .document a[href^="#"]');
    const i = a && at.get(a.getAttribute("href").slice(1));
    if (i === undefined || i === null) return;
    event.preventDefault();
    go(i);
  });
  // The element the fragment names is marked in the tree, with its groups opened.
  const wide = matchMedia("(min-width: 1101px)");
  function reveal() {
    if (!tree) return;
    for (const a of tree.querySelectorAll("a[aria-current]")) a.removeAttribute("aria-current");
    const id = fragment();
    if (!at.has(id)) return;
    const shown = `#${els[at.get(id)].h}`;
    let first = null;
    for (const a of tree.querySelectorAll("a[href]")) {
      if (a.getAttribute("href") !== shown) continue;
      a.setAttribute("aria-current", "location");
      for (let d = a.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true;
      first ??= a;
    }
    if (first && wide.matches && !tree.hidden) first.scrollIntoView({ block: "nearest" });
  }
  addEventListener("hashchange", reveal);
  reveal();

  // ── Diagrams: zoom and pan the landscape and the flows in the document ──
  // Each figure shows its SVG through a window whose viewBox moves and scales, so the text
  // stays sharp and the nodes stay the links the navigation script made of them.
  const rendered = (figure) =>
    figure.dataset.renderState === "rendered" && figure.querySelector(".diagram__viewport svg");
  document.addEventListener("report-diagram-rendered", (event) => {
    if (event.target.matches?.("figure[data-targets]") && rendered(event.target))
      zoomable(event.target);
  });
  for (const figure of document.querySelectorAll("figure[data-targets][data-mermaid]"))
    if (rendered(figure)) zoomable(figure);
  // A figure drawn on request: its button draws it, then the first node takes the focus.
  for (const button of document.querySelectorAll("figure[data-draw='on-request'] .diagram-draw"))
    button.addEventListener("click", () => {
      const figure = button.closest("figure");
      if (!window.reportDiagramRender || button.disabled) return;
      button.disabled = true;
      button.textContent = T.drawing;
      window
        .reportDiagramRender(figure)
        .then(() => figure.querySelector('g.node[role="link"]')?.focus({ preventScroll: true }));
    });

  function zoomable(figure) {
    if (figure.classList.contains("zoomable")) return;
    const viewport = figure.querySelector(".diagram__viewport");
    const svg = viewport.querySelector("svg");
    const box = svg.viewBox.baseVal;
    if (!box || !box.width || !box.height) return;
    const [X0, Y0, BW, BH] = [box.x, box.y, box.width, box.height];
    const limit = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    figure.classList.add("zoomable");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.maxWidth = "none";
    let scale = 1;
    let fitScale = 1;
    let x = X0;
    let y = Y0;
    const size = () => [viewport.clientWidth || 1, viewport.clientHeight || 1];
    function apply() {
      const [vw, vh] = size();
      const w = vw / scale;
      const h = vh / scale;
      // Part of the diagram always stays in the window.
      x = limit(x, X0 - w * 0.8, X0 + BW - w * 0.2);
      y = limit(y, Y0 - h * 0.8, Y0 + BH - h * 0.2);
      svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
    }
    /**
     * The whole diagram, centred: at its own size when it fits, smaller when it does not. A
     * diagram drawn while its section is still out of view has no size yet; it fits once it has.
     */
    let fitted = false;
    function fit() {
      const expanded = figure.classList.contains("expanded");
      const vw = viewport.clientWidth;
      if (!vw) return;
      fitted = true;
      if (!expanded) {
        fitScale = Math.min(1, vw / BW, (innerHeight * 0.72) / BH);
        viewport.style.height = `${Math.round(Math.max(BH * fitScale, 120))}px`;
      }
      const vh = viewport.clientHeight || 1;
      if (expanded) fitScale = Math.min(1, vw / BW, vh / BH);
      scale = fitScale;
      x = X0 - (vw / scale - BW) / 2;
      y = Y0 - (vh / scale - BH) / 2;
      apply();
    }
    function zoomAt(k, clientX, clientY) {
      const r = viewport.getBoundingClientRect();
      const [px, py] = [clientX - r.left, clientY - r.top];
      const [dx, dy] = [x + px / scale, y + py / scale];
      scale = limit(scale * k, fitScale * 0.5, Math.max(4, fitScale * 2));
      x = dx - px / scale;
      y = dy - py / scale;
      apply();
    }
    const zoomCentre = (k) => {
      const r = viewport.getBoundingClientRect();
      zoomAt(k, r.left + r.width / 2, r.top + r.height / 2);
    };

    // The controls come after the diagram, so Tab reaches its nodes first.
    const bar = document.createElement("div");
    bar.className = "diagram-zoom";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", T.zoom);
    const hint = document.createElement("span");
    hint.className = "zoom-hint";
    hint.textContent = T.zoomHint;
    const button = (text, label, action) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      if (label) b.setAttribute("aria-label", label);
      b.title = label ?? text;
      b.addEventListener("click", action);
      return b;
    };
    const enlarge = button(T.enlarge, null, () =>
      setExpanded(!figure.classList.contains("expanded")),
    );
    enlarge.dataset.zoom = "enlarge";
    enlarge.setAttribute("aria-pressed", "false");
    const controls = [
      button("−", T.zoomOut, () => zoomCentre(1 / 1.4)),
      button(T.fit, null, fit),
      button("+", T.zoomIn, () => zoomCentre(1.4)),
    ];
    ["out", "fit", "in"].forEach((name, k) => (controls[k].dataset.zoom = name));
    bar.append(hint, ...controls, enlarge);
    viewport.after(bar);
    function setExpanded(on) {
      figure.classList.toggle("expanded", on);
      enlarge.textContent = on ? T.close : T.enlarge;
      enlarge.title = enlarge.textContent;
      enlarge.setAttribute("aria-pressed", String(on));
      if (!on) viewport.style.height = "";
      fit();
      enlarge.focus();
    }

    viewport.addEventListener(
      "wheel",
      (event) => {
        // A plain scroll moves the document; with Ctrl or ⌘, or a pinch, it zooms.
        if (!event.ctrlKey && !event.metaKey && !figure.classList.contains("expanded")) return;
        event.preventDefault();
        zoomAt(Math.exp(-event.deltaY * 0.002), event.clientX, event.clientY);
      },
      { passive: false },
    );
    let drag = null;
    let dragged = false;
    viewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      drag = { id: event.pointerId, cx: event.clientX, cy: event.clientY, x, y, moved: false };
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.cx;
      const dy = event.clientY - drag.cy;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < 5) return;
        drag.moved = true;
        viewport.setPointerCapture?.(drag.id);
        viewport.classList.add("panning");
      }
      x = drag.x - dx / scale;
      y = drag.y - dy / scale;
      apply();
    });
    const release = () => {
      if (drag?.moved) {
        dragged = true;
        setTimeout(() => (dragged = false), 0);
      }
      drag = null;
      viewport.classList.remove("panning");
    };
    viewport.addEventListener("pointerup", release);
    viewport.addEventListener("pointercancel", release);
    // A drag never follows the node it started on.
    viewport.addEventListener(
      "click",
      (event) => {
        if (!dragged) return;
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
    // A node reached by keyboard comes into the window.
    viewport.addEventListener("focusin", (event) => {
      const r = viewport.getBoundingClientRect();
      const b = event.target.getBoundingClientRect?.();
      viewport.scrollLeft = viewport.scrollTop = 0;
      if (!b || (b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom))
        return;
      x += ((b.left + b.right) / 2 - r.left - r.width / 2) / scale;
      y += ((b.top + b.bottom) / 2 - r.top - r.height / 2) / scale;
      apply();
    });
    figure.addEventListener("keydown", (event) => {
      const key = event.key;
      if (key === "+" || key === "=") zoomCentre(1.4);
      else if (key === "-" || key === "_") zoomCentre(1 / 1.4);
      else if (key === "0") fit();
      else if (key === "Escape" && figure.classList.contains("expanded")) setExpanded(false);
      else return;
      event.preventDefault();
    });
    if (typeof ResizeObserver === "function")
      new ResizeObserver(() => (fitted ? apply() : fit())).observe(viewport);
    fit();
  }

  const stage = document.getElementById("city");
  const canvas = document.getElementById("city-canvas");
  const context = canvas?.getContext?.("2d") ?? null;
  if (!stage || !canvas || !context) {
    stage?.classList.add("no-canvas");
    return;
  }
  businessCity(stage, canvas, context);

  // ── The 3D business city ──
  // Districts are bounded contexts, towers are processes with one floor per step from the
  // bottom in flow order, and a floor's lights are its step's realization. Events float beside
  // the floors that emit them, policies beside the floors they start, and an arc runs from each
  // event to each policy it triggers.
  function businessCity(stage, canvas, g) {
    const C = data.city;
    const TAU = Math.PI * 2;
    const TILE = 0.16;
    const W = 1.3;
    const FLOOR = 0.46;
    const GAP = 0.08;
    const ROOF = 0.18;
    const S = 3.1;
    const PAD = 1.6;
    const DGAP = 2.8;
    const FONT =
      '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif';
    const GOLD = [255, 207, 110];
    const AMBER = [255, 159, 67];
    const SIGNAL = [255, 107, 107];
    const GLASS = [143, 211, 255];
    const EMBER = [255, 138, 61];
    const VIOLET = [167, 139, 250];
    const TEAL = [79, 209, 197];
    const ROSE = [251, 113, 133];
    const SUN = [250, 204, 21];
    const STEEL = [170, 180, 200];
    const FROST = [230, 237, 249];
    const CYAN = [94, 230, 255];
    const BODY = {
      implemented: [30, 44, 72],
      notImplemented: [34, 40, 60],
      unrealized: [72, 26, 40],
      unknown: [56, 62, 78],
    };
    const LIGHT = { implemented: GOLD, notImplemented: AMBER, unrealized: SIGNAL, unknown: STEEL };
    const RETIRED_LIGHT = [96, 102, 118];
    const RETIRED_BODY = [64, 70, 86];
    const LIGHT_DIR = norm([0.55, 0.9, 0.35]);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, u) => a + (b - a) * u;
    const ease = (u) => 1 - (1 - u) ** 3;
    // A canvas parses every colour string it is given, so each colour and alpha step is
    // written once. Alpha runs in steps of 1/40.
    const colours = new Map();
    function css(r, gr, b, a) {
      const [ri, gi, bi] = [r | 0, gr | 0, b | 0];
      const q = Math.round(clamp(a, 0, 1) * 40);
      const key = ((ri * 256 + gi) * 256 + bi) * 64 + q;
      let text = colours.get(key);
      if (text === undefined) {
        text = `rgba(${ri},${gi},${bi},${q / 40})`;
        colours.set(key, text);
      }
      return text;
    }
    const rgba = (c, a) => css(c[0], c[1], c[2], a);
    const mix = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
    /** A floor's colour from afar, where its windows are too small to tell apart. */
    const FAR = Object.fromEntries(
      Object.entries(BODY).map(([state, body]) => [state, mix(body, LIGHT[state], 0.5)]),
    );
    const RETIRED_FAR = mix(RETIRED_BODY, RETIRED_LIGHT, 0.5);
    function norm(v) {
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / l, v[1] / l, v[2] / l];
    }

    // Layout: districts sized by their towers and packed in rows, largest first.
    const districts = C.districts.map((d) => ({ ...d, towers: [], top: TILE }));
    const towers = C.towers.map((tw, ti) => ({ ...tw, ti }));
    for (const tw of towers) districts[tw.d].towers.push(tw);
    for (const d of districts) {
      // The taller towers stand at the back of their district.
      d.towers.sort((a, b) => b.f.length - a.f.length || a.ti - b.ti);
      const n = Math.max(d.towers.length, 1);
      d.cols = Math.ceil(Math.sqrt(n));
      d.rows = Math.ceil(n / d.cols);
      d.w = PAD * 2 + (d.cols - 1) * S + W;
      d.h = PAD * 2 + (d.rows - 1) * S + W;
    }
    const order = districts
      .map((_, i) => i)
      .sort((a, b) => districts[b].w * districts[b].h - districts[a].w * districts[a].h || a - b);
    const area = districts.reduce((sum, d) => sum + (d.w + DGAP) * (d.h + DGAP), 0);
    const rowWidth = Math.max(Math.sqrt(area) * 1.2, ...districts.map((d) => d.w), 1);
    let px = 0;
    let pz = 0;
    let depth = 0;
    for (const i of order) {
      const d = districts[i];
      if (px > 0 && px + d.w > rowWidth) {
        px = 0;
        pz += depth + DGAP;
        depth = 0;
      }
      d.x = px;
      d.z = pz;
      px += d.w + DGAP;
      depth = Math.max(depth, d.h);
    }
    const bounds = districts.reduce(
      (b, d) => [
        Math.min(b[0], d.x),
        Math.max(b[1], d.x + d.w),
        Math.min(b[2], d.z),
        Math.max(b[3], d.z + d.h),
      ],
      [0, 0, 0, 0],
    );
    const ox = (bounds[0] + bounds[1]) / 2;
    const oz = (bounds[2] + bounds[3]) / 2;
    for (const d of districts) {
      d.x -= ox;
      d.z -= oz;
    }
    const span = Math.max(bounds[1] - bounds[0], bounds[3] - bounds[2], 10);
    for (const d of districts) {
      d.centre = { x: d.x + d.w / 2, y: 0, z: d.z + d.h / 2 };
      // What pointing at the district picks: one object, so moving over it is no change.
      d.hit = { kind: "district", el: d.e };
      // Where a district's name may stand: the middle of each edge, just outside it.
      d.edges = [
        [d.x + d.w / 2, d.z + d.h + 0.7],
        [d.x + d.w + 0.7, d.z + d.h / 2],
        [d.x + d.w / 2, d.z - 0.7],
        [d.x - 0.7, d.z + d.h / 2],
      ];
    }

    const floorOf = new Map();
    const towerOf = new Map();
    let tallest = TILE;
    for (const d of districts)
      d.towers.forEach((tw, j) => {
        tw.x = d.x + PAD + (j % d.cols) * S + W / 2;
        tw.z = d.z + PAD + Math.floor(j / d.cols) * S + W / 2;
        tw.floors = tw.f.map((el, level) => {
          const y0 = TILE + level * (FLOOR + GAP);
          const f = { kind: "floor", el, tower: tw, x: tw.x, z: tw.z, y0, y1: y0 + FLOOR };
          f.y = y0 + FLOOR / 2;
          if (!floorOf.has(el)) floorOf.set(el, f);
          return f;
        });
        tw.top = TILE + tw.f.length * (FLOOR + GAP);
        tw.roof = { kind: "roof", el: tw.i, tower: tw, x: tw.x, z: tw.z, y0: tw.top };
        tw.roof.y1 = tw.top + ROOF;
        tw.roof.y = tw.top + ROOF / 2;
        towerOf.set(tw.i, tw);
        // How brightly the tower glows from afar: its implemented floors and, by half, the
        // floors whose features are not implemented yet. A retired process does not glow.
        const states = tw.f.map((el) => els[el].s);
        const implemented = states.filter((st) => st === "implemented").length;
        const pending = states.filter((st) => st === "notImplemented").length;
        tw.lit = (els[tw.i].m ?? 0) & 1 ? 0 : implemented + pending / 2;
        tw.litColour = implemented >= pending ? GOLD : AMBER;
        tallest = Math.max(tallest, tw.roof.y1);
        d.top = Math.max(d.top, tw.roof.y1);
      });

    // Events and policies beside their floors; those without one float over their district.
    const orbs = [];
    const orbOf = new Map();
    const slots = new Map();
    const loose = new Map();
    function beside(f, side) {
      const used = slots.get(f) ?? { event: 0, policy: 0 };
      slots.set(f, used);
      const n = used[side]++;
      const angle = (side === "event" ? -0.75 : 2.4) + (n % 5) * 0.62;
      const r = W * 0.98 + Math.floor(n / 5) * 0.55;
      return { x: f.x + Math.cos(angle) * r, y: f.y, z: f.z + Math.sin(angle) * r };
    }
    function over(d) {
      const k = loose.get(d) ?? 0;
      loose.set(d, k + 1);
      const dd = districts[d];
      const angle = k * 2.39996;
      const r = Math.min(dd.w, dd.h) * 0.34 * Math.sqrt(((k % 9) + 1) / 9);
      return {
        x: dd.x + dd.w / 2 + Math.cos(angle) * r,
        y: dd.top + 1.4 + (k % 3) * 0.5,
        z: dd.z + dd.h / 2 + Math.sin(angle) * r,
      };
    }
    function addOrb(o) {
      orbs.push(o);
      if (!orbOf.has(o.el)) orbOf.set(o.el, o);
    }
    for (const e of C.events) {
      const f = e.at >= 0 ? floorOf.get(e.at) : null;
      addOrb({ kind: "event", el: e.i, ends: e.from, ...(f ? beside(f, "event") : over(e.d)) });
    }
    for (const p of C.policies) {
      const f = p.at >= 0 ? floorOf.get(p.at) : null;
      addOrb({ kind: "policy", el: p.i, ends: p.to, ...(f ? beside(f, "policy") : over(p.d)) });
    }
    // The other layers: concepts over their district, rules over the city, actors around it,
    // and criteria as flags on their process's roof.
    const byDistrict = new Map();
    for (const c of C.concepts) byDistrict.set(c.d, [...(byDistrict.get(c.d) ?? []), c]);
    for (const [d, list] of byDistrict) {
      const dd = districts[d];
      list.forEach((c, k) => {
        const angle = (k / list.length) * TAU;
        const r = Math.max(Math.min(dd.w, dd.h) * 0.4, 0.9);
        addOrb({
          kind: "BusinessConcept",
          el: c.i,
          x: dd.x + dd.w / 2 + Math.cos(angle) * r,
          y: dd.top + 2.6,
          z: dd.z + dd.h / 2 + Math.sin(angle) * r,
        });
      });
    }
    C.rules.forEach((i, k) => {
      const angle = k * 2.39996;
      const r = span * 0.2 * Math.sqrt((k + 0.5) / C.rules.length);
      const y = tallest + 4.2 + (k % 4) * 0.35;
      addOrb({ kind: "BusinessRule", el: i, x: Math.cos(angle) * r, y, z: Math.sin(angle) * r });
    });
    C.actors.forEach((i, k) => {
      const angle = (k / Math.max(C.actors.length, 1)) * TAU + 0.3;
      const r = span * 0.62 + 2;
      addOrb({ kind: "Actor", el: i, x: Math.cos(angle) * r, y: 0.7, z: Math.sin(angle) * r });
    });
    const flags = new Map();
    C.criteria.forEach((c, k) => {
      const tw = towers[c.p];
      if (tw) {
        const n = flags.get(tw) ?? 0;
        flags.set(tw, n + 1);
        addOrb({
          kind: "ObservationCriterion",
          el: c.i,
          x: tw.x + 0.45,
          y: tw.roof.y1 + 0.55 + n * 0.5,
          z: tw.z + 0.45,
        });
      } else {
        const angle = k * 2.39996 + 1;
        const r = span * 0.12;
        addOrb({
          kind: "ObservationCriterion",
          el: c.i,
          x: Math.cos(angle) * r,
          y: tallest + 2.6,
          z: Math.sin(angle) * r,
        });
      }
    });
    const LAYERED = new Set(["BusinessConcept", "BusinessRule", "Actor", "ObservationCriterion"]);
    const layers = new Set();

    // Each trigger as an arc that rises with the distance it covers.
    const arcs = [];
    C.links.forEach(([e, p, kind], k) => {
      const a = orbOf.get(e);
      const b = orbOf.get(p);
      if (!a || !b) return;
      const lift = Math.max(a.y, b.y) + 0.8 + Math.hypot(b.x - a.x, b.z - a.z) * 0.24;
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const pts = [];
      for (let s = 0; s <= 20; s++) {
        const u = s / 20;
        const v = 1 - u;
        pts.push([
          v * v * a.x + 2 * v * u * mx + u * u * b.x,
          v * v * a.y + 2 * v * u * lift + u * u * b.y,
          v * v * a.z + 2 * v * u * mz + u * u * b.z,
        ]);
      }
      arcs.push({ e, p, kind, pts, phase: (k * 0.618) % 1 });
    });
    const neighbours = new Map();
    for (const [a, b] of data.relations) {
      if (!neighbours.has(a)) neighbours.set(a, new Set());
      if (!neighbours.has(b)) neighbours.set(b, new Set());
      neighbours.get(a).add(b);
      neighbours.get(b).add(a);
    }
    const districtOf = new Map(districts.filter((d) => d.e >= 0).map((d) => [d.e, d]));
    /** Where element `i` stands in the city, or null when the city does not draw it. */
    function positionOf(i) {
      const tw = towerOf.get(i);
      if (tw) return { x: tw.x, y: tw.roof.y1, z: tw.z };
      const f = floorOf.get(i);
      if (f) return f;
      const o = orbOf.get(i);
      if (o) return o;
      const d = districtOf.get(i);
      return d ? { x: d.x + d.w / 2, y: TILE, z: d.z + d.h / 2 } : null;
    }

    // Stars on the sky, the same for every opening of the same model.
    let seed = (els.length * 2654435761) >>> 0 || 1;
    const random = () => {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
    const stars = Array.from({ length: 170 }, () => [random(), random() ** 1.6, random()]);

    // Camera: it circles a target point on the ground.
    const MIN = 4;
    const MAX = span * 4 + 40;
    const home = {
      tx: 0,
      ty: Math.min(tallest * 0.2, 2.5),
      tz: 0,
      yaw: 0.78,
      pitch: 0.62,
      dist: 0,
    };
    /** The distance at which the city's footprint fits the narrower field of view. */
    function fitDistance(aspect) {
      const half = Math.atan(Math.tan((50 * Math.PI) / 360) * Math.min(aspect, 1));
      return (span * 0.56) / Math.sin(half) + 4;
    }
    home.dist = fitDistance(1.4);
    const cam = { ...home };
    let eye = [0, 0, 0];
    let fw = [0, 0, -1];
    let rt = [1, 0, 0];
    let up = [0, 1, 0];
    let focal = 1;
    let cx = 0;
    let cy = 0;
    let dpr = 1;
    function setCamera(w, h) {
      const cp = Math.cos(cam.pitch);
      const sp = Math.sin(cam.pitch);
      const cyaw = Math.cos(cam.yaw);
      const syaw = Math.sin(cam.yaw);
      eye = [cam.tx + cam.dist * cp * syaw, cam.ty + cam.dist * sp, cam.tz + cam.dist * cp * cyaw];
      fw = [-cp * syaw, -sp, -cp * cyaw];
      const l = Math.hypot(fw[0], fw[2]) || 1;
      rt = [-fw[2] / l, 0, fw[0] / l];
      up = [
        rt[1] * fw[2] - rt[2] * fw[1],
        rt[2] * fw[0] - rt[0] * fw[2],
        rt[0] * fw[1] - rt[1] * fw[0],
      ];
      focal = h / 2 / Math.tan((50 * Math.PI) / 360);
      cx = w / 2;
      cy = h / 2;
    }
    /** Screen x, y, depth and pixels per world unit of a point, or null behind the camera. */
    function project(x, y, z) {
      const dx = x - eye[0];
      const dy = y - eye[1];
      const dz = z - eye[2];
      const zc = dx * fw[0] + dy * fw[1] + dz * fw[2];
      if (zc < 0.4) return null;
      const s = focal / zc;
      return [
        cx + (dx * rt[0] + dy * rt[1] + dz * rt[2]) * s,
        cy - (dx * up[0] + dy * up[1] + dz * up[2]) * s,
        zc,
        s,
      ];
    }
    const distance2 = (p) => (p.x - eye[0]) ** 2 + (p.y - eye[1]) ** 2 + (p.z - eye[2]) ** 2;

    // Sprites: soft round glows, drawn once per colour.
    const sprites = new Map();
    function sprite(c) {
      const key = ((c[0] | 0) * 256 + (c[1] | 0)) * 256 + (c[2] | 0);
      let s = sprites.get(key);
      if (!s) {
        s = document.createElement("canvas");
        s.width = s.height = 64;
        const x = s.getContext("2d");
        const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, rgba(c, 1));
        gr.addColorStop(0.28, rgba(c, 0.5));
        gr.addColorStop(1, rgba(c, 0));
        x.fillStyle = gr;
        x.fillRect(0, 0, 64, 64);
        sprites.set(key, s);
      }
      return s;
    }
    function glow(c, x, y, r, alpha) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = clamp(alpha, 0, 1);
      g.drawImage(sprite(c), x - r, y - r, r * 2, r * 2);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    function poly(pts) {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
    }

    // Faces of an axis-aligned box that face the eye. A side runs bottom-left, bottom-right,
    // top-right, top-left as seen from outside, so windows can be laid on it. Corner k has
    // x, y and z at the high end where bits 1, 2 and 4 of CORNER[k] are set.
    const CORNER = [0, 1, 5, 4, 2, 3, 7, 6];
    const FACES = [
      { n: [0, 1, 0], side: false, c: [4, 5, 6, 7] },
      { n: [1, 0, 0], side: true, c: [2, 1, 5, 6] },
      { n: [-1, 0, 0], side: true, c: [0, 3, 7, 4] },
      { n: [0, 0, 1], side: true, c: [3, 2, 6, 7] },
      { n: [0, 0, -1], side: true, c: [1, 0, 4, 5] },
    ];
    function boxFaces(x0, y0, z0, x1, y1, z1) {
      const seen = [];
      if (eye[1] > y1) seen.push(FACES[0]);
      if (eye[0] > x1) seen.push(FACES[1]);
      else if (eye[0] < x0) seen.push(FACES[2]);
      if (eye[2] > z1) seen.push(FACES[3]);
      else if (eye[2] < z0) seen.push(FACES[4]);
      const at = new Array(8);
      const corner = (k) => {
        if (at[k] === undefined) {
          const bits = CORNER[k];
          at[k] = project(bits & 1 ? x1 : x0, bits & 2 ? y1 : y0, bits & 4 ? z1 : z0);
        }
        return at[k];
      };
      const faces = [];
      for (const face of seen) {
        const p = [corner(face.c[0]), corner(face.c[1]), corner(face.c[2]), corner(face.c[3])];
        if (p[0] && p[1] && p[2] && p[3]) faces.push({ n: face.n, side: face.side, p });
      }
      return faces;
    }
    const shade = (n) =>
      0.48 + 0.52 * Math.max(0, n[0] * LIGHT_DIR[0] + n[1] * LIGHT_DIR[1] + n[2] * LIGHT_DIR[2]);
    /** A quad on a projected side face, by fractions along its width (u) and height (v). */
    function quadOn(p, u0, u1, v0, v1) {
      const pt = (u, v) => {
        const bx = lerp(p[0][0], p[1][0], u);
        const by = lerp(p[0][1], p[1][1], u);
        return [lerp(bx, lerp(p[3][0], p[2][0], u), v), lerp(by, lerp(p[3][1], p[2][1], u), v)];
      };
      return [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)];
    }

    // Each drawn shape is recorded for pointing, in drawing order.
    const hits = [];
    let hovered = null;
    let selected = -1;
    let focusSet = null;
    const alphaOf = (el) => (focusSet && !focusSet.has(el) ? 0.26 : 1);
    function fog(p) {
      const d = Math.sqrt(distance2(p));
      return clamp(1.3 - (d - cam.dist) / (span * 1.5), 0.42, 1);
    }
    const HAZE = [24, 42, 82];
    const NIGHT = [9, 16, 32];
    /** How clear a shape at `p` is, in sixteen steps: far shapes fade into the haze. */
    const clearness = (p) => Math.round(fog(p) * 16) / 16;
    /** A colour seen with light `k` and clearness `f`: dimmed shapes also darken. */
    function tone(c, k, f, dim) {
      const d = dim ? 0.62 : 0;
      const at = (i) => (lerp(c[i], HAZE[i], 1 - f) * (1 - d) + NIGHT[i] * d) * k;
      return css(at(0), at(1), at(2), 1);
    }

    const TILE_TOP = mix([18, 32, 62], [40, 66, 112], 0.35);
    const TILE_SIDE = [18, 32, 62];
    function drawTile(d) {
      const faces = boxFaces(d.x, 0, d.z, d.x + d.w, TILE, d.z + d.h);
      const lit = d.e >= 0 && d.e === selected;
      for (const f of faces) {
        poly(f.p);
        g.fillStyle = tone(f.n[1] ? TILE_TOP : TILE_SIDE, shade(f.n), 1, false);
        g.fill();
        g.setLineDash(d.e < 0 ? [5 * dpr, 4 * dpr] : []);
        g.strokeStyle = rgba(lit ? CYAN : [120, 170, 255], lit ? 0.8 : 0.32);
        g.lineWidth = dpr;
        g.stroke();
        g.setLineDash([]);
        if (f.n[1] && d.e >= 0) hits.push({ item: d.hit, poly: f.p });
      }
    }

    function drawFloor(f) {
      const e = els[f.el];
      const clear = clearness(f);
      const dim = Boolean(focusSet && !focusSet.has(f.el));
      const alpha = (dim ? 0.26 : 1) * clear;
      const lightAlpha = dim ? 0.3 : clear;
      const retired = ((e.m ?? 0) | (els[f.tower.i].m ?? 0)) & 1;
      const state = e.s;
      const hl = hovered === f || selected === f.el;
      const faces = boxFaces(f.x - W / 2, f.y0, f.z - W / 2, f.x + W / 2, f.y1, f.z + W / 2);
      const near = faces.length && faces[0].p[0][3] * W > 16 * dpr;
      const glass = state === "outside" && !retired;
      // Far away the windows are too small to read, so the face carries their colour.
      const base = retired
        ? near
          ? RETIRED_BODY
          : RETIRED_FAR
        : near
          ? (BODY[state] ?? BODY.unknown)
          : (FAR[state] ?? FAR.unknown);
      g.lineWidth = (hl ? 1.6 : 0.8) * dpr;
      for (const face of faces) {
        poly(face.p);
        if (glass) {
          g.fillStyle = rgba(GLASS, 0.09 * alpha);
          g.strokeStyle = rgba(GLASS, (hl ? 0.95 : 0.55) * alpha);
        } else {
          g.fillStyle = tone(base, shade(face.n), clear, dim);
          g.strokeStyle = rgba(hl ? CYAN : FROST, (hl ? 0.9 : 0.14) * alpha);
        }
        g.fill();
        g.stroke();
        if (!glass && near && face.side && !retired) lights(face.p, state, lightAlpha);
        hits.push({ item: f, poly: face.p });
      }
      if (near && !retired && (state === "implemented" || state === "notImplemented")) {
        const q = project(f.x, f.y, f.z);
        if (q)
          glow(
            LIGHT[state],
            q[0],
            q[1],
            q[3] * W * 1.6,
            (state === "implemented" ? 0.2 : 0.1) * lightAlpha,
          );
      }
      if (e.m & 6 && faces.length) {
        // A validation error on the step: a red rim; changed since the last commit or the last
        // Accepted: a cyan one.
        g.strokeStyle = rgba(e.m & 4 ? SIGNAL : CYAN, 0.85 * alpha);
        g.lineWidth = 2 * dpr;
        for (const face of faces) {
          poly(face.p);
          g.stroke();
        }
      }
    }
    // Implemented floors show three lit windows, not yet implemented ones two, a floor with no
    // realizing feature a red band, an undeterminable one a hatch; outside-system floors are glass.
    function lights(p, state, alpha) {
      if (state === "implemented" || state === "notImplemented") {
        const color = LIGHT[state];
        for (let k = 0; k < 3; k++) {
          const u0 = 0.12 + k * 0.28;
          poly(quadOn(p, u0, u0 + 0.18, 0.26, 0.74));
          g.fillStyle =
            state === "implemented" || k !== 1
              ? rgba(color, 0.95 * alpha)
              : rgba([16, 22, 38], alpha);
          g.fill();
        }
      } else if (state === "unrealized") {
        poly(quadOn(p, 0.06, 0.94, 0.42, 0.58));
        g.fillStyle = rgba(SIGNAL, 0.92 * alpha);
        g.fill();
      } else {
        g.strokeStyle = rgba(STEEL, 0.75 * alpha);
        g.lineWidth = dpr;
        for (const u of [0.3, 0.65, 1]) {
          const q = quadOn(p, u - 0.3, u, 0.12, 0.88);
          g.beginPath();
          g.moveTo(q[0][0], q[0][1]);
          g.lineTo(q[2][0], q[2][1]);
          g.stroke();
        }
      }
    }

    const ROOF_COLOUR = {
      retired: [100, 106, 122],
      accepted: [214, 226, 250],
      proposed: [116, 134, 180],
    };
    function drawRoof(r) {
      const e = els[r.el];
      const marks = e.m ?? 0;
      const clear = clearness(r);
      const dim = Boolean(focusSet && !focusSet.has(r.el));
      const alpha = (dim ? 0.26 : 1) * clear;
      const hl = hovered === r || selected === r.el;
      const color =
        marks & 1
          ? ROOF_COLOUR.retired
          : /^Accepted/.test(e.st ?? "")
            ? ROOF_COLOUR.accepted
            : ROOF_COLOUR.proposed;
      const faces = boxFaces(
        r.x - W / 2 - 0.12,
        r.y0,
        r.z - W / 2 - 0.12,
        r.x + W / 2 + 0.12,
        r.y1,
        r.z + W / 2 + 0.12,
      );
      // Seen from afar a tower glows once, by how many of its floors are lit; up close each lit
      // floor glows of its own.
      const tw = r.tower;
      if (tw.lit && faces.length && faces[0].p[0][3] * W <= 16 * dpr) {
        const q = project(tw.x, (TILE + tw.top) / 2, tw.z);
        if (q)
          glow(
            tw.litColour,
            q[0],
            q[1],
            q[3] * (W * 1.4 + (tw.top - TILE) * 0.45),
            Math.min(0.55, 0.06 + 0.08 * tw.lit) * (dim ? 0.3 : clear),
          );
      }
      for (const face of faces) {
        poly(face.p);
        g.fillStyle = tone(color, shade(face.n), clear, dim);
        g.fill();
        const rim = marks & 8 ? SIGNAL : marks & 18 ? CYAN : hl ? CYAN : FROST;
        g.setLineDash(marks & 16 ? [4 * dpr, 3 * dpr] : []);
        g.strokeStyle = rgba(rim, (marks & 26 || hl ? 0.95 : 0.3) * alpha);
        g.lineWidth = (marks & 8 || hl ? 2 : 1) * dpr;
        g.stroke();
        g.setLineDash([]);
        hits.push({ item: r, poly: face.p });
      }
      if (marks & 8) {
        // Validation errors reach this process: a warning light above the roof.
        const q = project(r.x, r.y1 + 0.5, r.z);
        if (q) {
          glow(SIGNAL, q[0], q[1], Math.max(6 * dpr, q[3] * 0.7), 0.9 * alpha);
          g.fillStyle = rgba([255, 240, 240], alpha);
          g.font = `700 ${Math.round(clamp(q[3] * 0.5, 9 * dpr, 16 * dpr))}px ${FONT}`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText("!", q[0], q[1]);
        }
      }
    }

    const ORB = {
      event: EMBER,
      policy: VIOLET,
      BusinessConcept: TEAL,
      BusinessRule: ROSE,
      Actor: SUN,
      ObservationCriterion: STEEL,
    };
    const whiter = (u) =>
      Object.fromEntries(Object.entries(ORB).map(([k, c]) => [k, mix(c, [255, 255, 255], u)]));
    const ORB_CORE = whiter(0.15);
    const ORB_LIT = whiter(0.45);
    function drawOrb(o) {
      const q = project(o.x, o.y, o.z);
      if (!q) return;
      const alpha = alphaOf(o.el) * fog(o);
      const hl = hovered === o || selected === o.el;
      const r = clamp(q[3] * 0.2, 2.6 * dpr, 8 * dpr);
      const color = ORB[o.kind];
      glow(color, q[0], q[1], r * 2.6, (hl ? 0.9 : 0.5) * alpha);
      g.fillStyle = rgba(hl ? ORB_LIT[o.kind] : ORB_CORE[o.kind], alpha);
      g.beginPath();
      if (o.kind === "event" || o.kind === "Actor") g.arc(q[0], q[1], r, 0, TAU);
      else if (o.kind === "policy") {
        g.moveTo(q[0], q[1] - r * 1.25);
        g.lineTo(q[0] + r, q[1]);
        g.lineTo(q[0], q[1] + r * 1.25);
        g.lineTo(q[0] - r, q[1]);
      } else if (o.kind === "BusinessConcept")
        for (let k = 0; k < 6; k++)
          g.lineTo(q[0] + r * Math.cos((k * TAU) / 6), q[1] + r * Math.sin((k * TAU) / 6));
      else if (o.kind === "BusinessRule") {
        g.moveTo(q[0], q[1] - r * 1.2);
        g.lineTo(q[0] + r * 1.1, q[1] + r * 0.8);
        g.lineTo(q[0] - r * 1.1, q[1] + r * 0.8);
      } else {
        g.moveTo(q[0] - r * 0.8, q[1] + r * 1.3);
        g.lineTo(q[0] - r * 0.8, q[1] - r * 1.1);
        g.lineTo(q[0] + r * 1.1, q[1] - r * 0.6);
        g.lineTo(q[0] - r * 0.8, q[1] - r * 0.1);
      }
      g.closePath();
      g.fill();
      if (els[o.el].m & 6) {
        g.strokeStyle = rgba(els[o.el].m & 4 ? SIGNAL : CYAN, alpha);
        g.lineWidth = 2 * dpr;
        g.stroke();
      }
      hits.push({ item: o, x: q[0], y: q[1], r: r * 1.8 });
    }

    function segment(a, b, color, alpha, width = 1) {
      const p = project(a.x, a.y, a.z);
      const q = project(b.x, b.y, b.z);
      if (!p || !q) return;
      g.strokeStyle = rgba(color, alpha);
      g.lineWidth = width * dpr;
      g.beginPath();
      g.moveTo(p[0], p[1]);
      g.lineTo(q[0], q[1]);
      g.stroke();
    }
    function along(P, u) {
      const x = u * (P.length - 1);
      const i = Math.min(Math.floor(x), P.length - 2);
      const v = x - i;
      return [
        lerp(P[i][0], P[i + 1][0], v),
        lerp(P[i][1], P[i + 1][1], v),
        lerp(P[i][3], P[i + 1][3], v),
      ];
    }
    /**
     * Every trigger arc, in a few strokes: each arc's first half in ember and its second half
     * in violet, so the colour still runs from the event to the policy. Arcs are batched by
     * kind and by whether they belong to the selection; broken ones are dashed red.
     */
    function drawArcs() {
      const batches = new Map();
      const batch = (key) => {
        let b = batches.get(key);
        if (!b) batches.set(key, (b = { first: [], second: [], heads: [] }));
        return b;
      };
      for (const arc of arcs) {
        arc.P = null;
        const P = arc.pts.map(([x, y, z]) => project(x, y, z));
        if (P.some((p) => !p)) continue;
        const lit = !focusSet || (focusSet.has(arc.e) && focusSet.has(arc.p));
        const b = batch(`${arc.kind}${lit ? "+" : "-"}`);
        const middle = P.length >> 1;
        b.first.push(P.slice(0, middle + 1));
        b.second.push(P.slice(middle));
        b.heads.push(P);
        if (arc.kind !== 2 && lit && (focusSet || arc.kind === 1)) arc.P = P;
      }
      const stroke = (lines, colour, width, dash) => {
        if (!lines.length) return;
        g.beginPath();
        for (const line of lines) {
          g.moveTo(line[0][0], line[0][1]);
          for (let k = 1; k < line.length; k++) g.lineTo(line[k][0], line[k][1]);
        }
        g.strokeStyle = colour;
        g.lineWidth = width * dpr;
        g.setLineDash(dash);
        g.stroke();
        g.setLineDash([]);
      };
      for (const [key, b] of batches) {
        const kind = Number(key[0]);
        const lit = key[1] === "+";
        const alpha = lit ? 1 : 0.1;
        const width = kind === 1 ? 2.2 : 1.2;
        if (kind === 2) {
          stroke([...b.first, ...b.second], rgba(SIGNAL, 0.85 * alpha), width, [5 * dpr, 4 * dpr]);
        } else {
          // Hand-offs between processes stand out; triggers inside one process stay faint.
          const strong = (focusSet ? 0.9 : kind === 1 ? 0.42 : 0.14) * alpha;
          stroke(b.first, rgba(EMBER, strong), width, []);
          stroke(b.second, rgba(VIOLET, strong), width, []);
        }
        // The direction: an arrowhead three quarters of the way, toward the policy.
        const size = (kind === 1 ? 7 : 5) * dpr;
        g.beginPath();
        for (const P of b.heads) {
          const [hx, hy] = along(P, 0.78);
          const [bx, by] = along(P, 0.74);
          const angle = Math.atan2(hy - by, hx - bx);
          g.moveTo(hx + Math.cos(angle) * size, hy + Math.sin(angle) * size);
          g.lineTo(hx + Math.cos(angle + 2.5) * size, hy + Math.sin(angle + 2.5) * size);
          g.lineTo(hx + Math.cos(angle - 2.5) * size, hy + Math.sin(angle - 2.5) * size);
          g.closePath();
        }
        g.fillStyle = rgba(
          kind === 2 ? SIGNAL : VIOLET,
          (focusSet || kind !== 0 ? 0.9 : 0.25) * alpha,
        );
        g.fill();
      }
    }
    const SPARK = Array.from({ length: 8 }, (_, k) => mix(EMBER, VIOLET, (k + 0.5) / 8));
    /** The hand-offs' moving lights, over the scene: along each arc toward its policy. */
    function sparks(now) {
      for (const arc of arcs) {
        if (!arc.P) continue;
        const n = focusSet ? 3 : 1;
        for (let k = 0; k < n; k++) {
          const u = (now / 4500 + arc.phase + k / n) % 1;
          const [x, y, s] = along(arc.P, u);
          const r = Math.max(3 * dpr, s * 0.22);
          glow(SPARK[Math.min(7, (u * 8) | 0)], x, y, r, focusSet ? 0.95 : 0.6);
        }
      }
    }

    const INK = [7, 14, 30];
    function label(text, x, y, size, alpha, strong = false) {
      g.font = `${strong ? 700 : 600} ${Math.round(size)}px ${FONT}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      if (strong) {
        const w = g.measureText(text).width;
        g.fillStyle = rgba(INK, 0.82 * alpha);
        const pad = size * 0.4;
        g.beginPath();
        g.roundRect(x - w / 2 - pad, y - size * 0.75, w + pad * 2, size * 1.5, size * 0.4);
        g.fill();
      } else {
        // A dark outline keeps the name legible over lit towers.
        g.strokeStyle = rgba(INK, 0.85 * alpha);
        g.lineWidth = 3 * dpr;
        g.lineJoin = "round";
        g.strokeText(text, x, y);
      }
      g.fillStyle = rgba(FROST, alpha);
      g.fillText(text, x, y);
    }

    let sky = null;
    function draw(now) {
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) return;
      setCamera(w, h);
      hits.length = 0;
      focusSet = selected >= 0 ? new Set([selected, ...(neighbours.get(selected) ?? [])]) : null;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      // The night sky, with stars that drift as the city turns.
      if (!sky || sky.h !== h || sky.g !== g) {
        const gradient = g.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, "#050b18");
        gradient.addColorStop(0.62, "#12244a");
        gradient.addColorStop(1, "#1b3160");
        sky = { h, g, gradient };
      }
      g.fillStyle = sky.gradient;
      g.fillRect(0, 0, w, h);
      for (const [u, v, a] of stars) {
        const x = ((((u + cam.yaw * 0.05) % 1) + 1) % 1) * w;
        g.fillStyle = rgba(FROST, 0.15 + a * 0.55);
        g.fillRect(x, v * h * 0.55, (0.6 + a) * dpr, (0.6 + a) * dpr);
      }
      // The ground grid around the city.
      g.strokeStyle = rgba([110, 150, 230], 0.08);
      g.lineWidth = dpr;
      const reach = span * 0.75 + 12;
      g.beginPath();
      const line = (ax, az, bx, bz) => {
        const p = project(ax, 0, az);
        const q = project(bx, 0, bz);
        if (!p || !q) return;
        g.moveTo(p[0], p[1]);
        g.lineTo(q[0], q[1]);
      };
      for (let k = -reach; k <= reach; k += 4) {
        line(k, -reach, k, reach);
        line(-reach, k, reach, k);
      }
      g.stroke();
      for (const d of districts) d.depth = distance2(d.centre);
      const tiles = [...districts].sort((a, b) => b.depth - a.depth);
      for (const d of tiles) drawTile(d);
      // Buildings and orbs from the farthest to the nearest.
      const items = [];
      for (const tw of towers) items.push(...tw.floors, tw.roof);
      for (const o of orbs)
        if (!LAYERED.has(o.kind) || layers.has(o.kind) || o.el === selected) items.push(o);
      for (const it of items) it.depth = distance2(it);
      items.sort((a, b) => b.depth - a.depth);
      for (const it of items)
        if (it.kind === "floor") drawFloor(it);
        else if (it.kind === "roof") drawRoof(it);
        else drawOrb(it);
      // Light: who emits and starts what, the triggers, and the selection.
      g.globalCompositeOperation = "lighter";
      const faint = new Map();
      for (const o of orbs) {
        if (o.kind !== "event" && o.kind !== "policy") continue;
        const alpha = focusSet ? (focusSet.has(o.el) ? 0.5 : 0.02) : 0.1;
        const colour = rgba(o.kind === "event" ? EMBER : VIOLET, alpha);
        const q = project(o.x, o.y, o.z);
        if (!q) continue;
        for (const s of o.ends) {
          const f = floorOf.get(s);
          const p = f && project(f.x, f.y, f.z);
          if (!p) continue;
          if (!faint.has(colour)) faint.set(colour, []);
          faint.get(colour).push(p[0], p[1], q[0], q[1]);
        }
      }
      g.lineWidth = dpr;
      for (const [colour, xy] of faint) {
        g.beginPath();
        for (let k = 0; k < xy.length; k += 4) {
          g.moveTo(xy[k], xy[k + 1]);
          g.lineTo(xy[k + 2], xy[k + 3]);
        }
        g.strokeStyle = colour;
        g.stroke();
      }
      drawArcs();
      const sel = selected >= 0 ? positionOf(selected) : null;
      if (sel) {
        const base = project(sel.x, 0, sel.z);
        const top = project(sel.x, sel.y + 9, sel.z);
        if (base && top) {
          const beam = g.createLinearGradient(base[0], base[1], top[0], top[1]);
          beam.addColorStop(0, rgba(CYAN, 0.75));
          beam.addColorStop(1, rgba(CYAN, 0));
          g.strokeStyle = beam;
          g.lineWidth = 3 * dpr;
          g.beginPath();
          g.moveTo(base[0], base[1]);
          g.lineTo(top[0], top[1]);
          g.stroke();
        }
        for (const j of neighbours.get(selected) ?? []) {
          const p = positionOf(j);
          if (p && (!LAYERED.has(els[j].t) || layers.has(els[j].t)))
            segment(sel, p, CYAN, 0.7, 1.4);
        }
      }
      g.globalCompositeOperation = "source-over";
      // Names: every district at its near edge, and the towers in view up close.
      for (const d of districts) {
        let [ex, ez] = d.edges[0];
        let best = Infinity;
        for (const [x, z] of d.edges) {
          const far = (x - eye[0]) ** 2 + (z - eye[2]) ** 2;
          if (far < best) [best, ex, ez] = [far, x, z];
        }
        const q = project(ex, TILE, ez);
        if (q)
          label(
            d.n,
            q[0],
            q[1],
            clamp(q[3] * 0.6, 11 * dpr, 19 * dpr),
            d.e < 0 || alphaOf(d.e) === 1 ? 0.92 : 0.4,
          );
      }
      const named = new Set();
      if (hovered?.tower) named.add(hovered.tower);
      const own = towerOf.get(selected) ?? floorOf.get(selected)?.tower;
      if (own) named.add(own);
      if (cam.dist < span * 0.55)
        for (const tw of [...towers]
          .sort((a, b) => distance2(a.roof) - distance2(b.roof))
          .slice(0, 10))
          named.add(tw);
      for (const tw of named) {
        const q = project(tw.x, tw.roof.y1 + 0.5, tw.z);
        if (q) label(els[tw.i].n, q[0], q[1], clamp(q[3] * 0.34, 10 * dpr, 14 * dpr), 1, true);
      }
    }

    /** The shape drawn last under a canvas point, so the nearest one wins. */
    function pick(x, y) {
      for (let k = hits.length - 1; k >= 0; k--) {
        const h = hits[k];
        if (h.r !== undefined ? (x - h.x) ** 2 + (y - h.y) ** 2 <= h.r * h.r : inside(h.poly, x, y))
          return h.item;
      }
      return null;
    }
    function inside(pts, x, y) {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    }

    // The tooltip names what the pointer is over; every fact in it is also in the document.
    const tip = document.getElementById("city-tip");
    function showTip(item, clientX, clientY) {
      if (!tip) return;
      if (!item) {
        tip.hidden = true;
        return;
      }
      const e = els[item.el];
      const line = (text, cls) => {
        const s = document.createElement(cls ? "span" : "strong");
        if (cls) s.className = cls;
        s.textContent = text;
        return s;
      };
      tip.replaceChildren(line(typeName.get(e.t) ?? e.t, "kind"), line(e.n));
      if (item.kind === "floor")
        tip.append(line(`${typeName.get("Process")}: ${els[item.tower.i].n}`, "kind"));
      const facts = [
        e.t === "Step" ? T.short[e.s] : e.t === "Process" ? e.st : "",
        e.m & 4 ? T.error : "",
        e.m & 8 ? T.incomplete : "",
        e.m & 2 ? T.changed : "",
        e.m & 1 ? T.retired : "",
      ].filter(Boolean);
      if (facts.length) tip.append(line(facts.join(", "), "kind"));
      tip.hidden = false;
      const box = stage.getBoundingClientRect();
      tip.style.left = `${clamp(clientX - box.left + 14, 4, box.width - tip.offsetWidth - 4)}px`;
      tip.style.top = `${clamp(clientY - box.top + 14, 4, box.height - tip.offsetHeight - 4)}px`;
    }

    let tween = null;
    let raf = 0;
    let last = 0;
    let lastInput = 0;
    let visible = true;
    let dragging = null;
    const pointers = new Map();
    const touch = () => (lastInput = performance.now());
    // The scene is drawn again only when something in it changes: the camera, the selection,
    // what the pointer is over, the layers or the size. The moving lights are drawn over it.
    // The moving lights have a layer of their own over the scene, so the scene stays on its
    // canvas until something in it changes; each frame clears the layer in one call.
    const screen = g;
    const overlay = document.createElement("canvas");
    overlay.className = "city-sparks";
    overlay.setAttribute("aria-hidden", "true");
    canvas.after(overlay);
    const sparkContext = overlay.getContext("2d");
    let sparked = false;
    let dirty = true;
    let sparkling = false;
    let lastPaint = 0;
    let cost = 0;
    let maxDpr = 2;
    const REST = 12000;
    const invalidate = () => {
      dirty = true;
      schedule();
    };
    function paint(now, full) {
      if (full) {
        const started = performance.now();
        draw(now);
        // A device that cannot keep up draws fewer pixels.
        cost = cost * 0.8 + (performance.now() - started) * 0.2;
        if (cost > 22 && maxDpr > 1 && dpr > 1) {
          maxDpr = Math.max(1, dpr - 0.5);
          cost = 0;
          setTimeout(resize, 0);
        }
      }
      if (!sparked && !sparkling) return;
      sparkContext.setTransform(1, 0, 0, 1, 0, 0);
      sparkContext.clearRect(0, 0, overlay.width, overlay.height);
      sparked = sparkling;
      if (sparkling) {
        g = sparkContext;
        sparks(now);
        g = screen;
      }
    }

    // Motion: the opening flight, slow turning while idle and the hand-offs' moving lights.
    // It pauses on request and never starts when the reader prefers reduced motion.
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let motion = !reduced.matches;
    const motionButton = document.getElementById("city-motion");
    function setMotion(on) {
      motion = on;
      if (motionButton) motionButton.textContent = on ? T.pause : T.play;
      if (!on) tween = tween && { ...tween, ms: 0 };
      touch();
      invalidate();
    }
    motionButton?.addEventListener("click", () => setMotion(!motion));
    reduced.addEventListener?.("change", (event) => setMotion(!event.matches));
    setMotion(motion);

    function schedule() {
      if (!raf && visible) raf = requestAnimationFrame(frame);
    }
    // Ambient motion, the turning and the moving lights, lasts until the reader has been away
    // for REST milliseconds and runs at about 30 frames a second; what answers the reader runs
    // at full rate. At rest the city draws nothing.
    function frame(now) {
      raf = 0;
      const awake = motion && !dragging && now - lastInput < REST;
      const turning = awake && !tween && selected < 0 && now - lastInput > 3500;
      const lights = awake && arcs.length > 0;
      const urgent = dirty || tween !== null;
      if (!urgent && (turning || lights) && now - lastPaint < 31) {
        later(31 - (now - lastPaint));
        return;
      }
      const dt = last ? Math.min(now - last, 64) : 16;
      last = now;
      if (tween) {
        const u = tween.ms > 0 ? Math.min((now - tween.start) / tween.ms, 1) : 1;
        const k = ease(u);
        for (const key of Object.keys(tween.to)) cam[key] = lerp(tween.from[key], tween.to[key], k);
        if (u >= 1) tween = null;
      }
      if (turning) cam.yaw += dt * 0.00004;
      sparkling = lights;
      paint(now, urgent || turning);
      dirty = false;
      lastPaint = now;
      // An animation frame makes the browser update the whole page, so ambient motion waits
      // for its next frame instead of asking for every display refresh.
      if (tween) schedule();
      else if (turning || lights) later(31);
      else {
        last = 0;
        // With no lights to keep the frames coming, the city wakes up when turning begins.
        if (awake && selected < 0) later(3500 - (now - lastInput));
      }
    }
    let timer = 0;
    function later(ms) {
      if (!timer)
        timer = setTimeout(() => {
          timer = 0;
          schedule();
        }, ms);
    }
    function flyTo(to, ms = 900) {
      const target = { ...cam, ...to };
      // Turn the short way round.
      target.yaw = cam.yaw + ((((target.yaw - cam.yaw + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
      tween = { from: { ...cam }, to: target, start: performance.now(), ms: motion ? ms : 0 };
      schedule();
    }
    function focusOn(i) {
      selected = i;
      const p = positionOf(i);
      if (p) {
        const tw = towerOf.get(i);
        const close = tw ? Math.max(12, tw.roof.y1 * 2.6) : 13;
        flyTo({
          tx: p.x,
          ty: Math.min(p.y, 6),
          tz: p.z,
          dist: Math.min(Math.max(cam.dist, 8), close),
        });
      } else invalidate();
    }
    addEventListener("hashchange", () => {
      // Choosing an element brings its details back.
      if (document.body.classList.contains("city-wide")) setWide(false);
      const i = at.get(fragment());
      touch();
      if (i === undefined) {
        selected = -1;
        invalidate();
      } else focusOn(i);
    });
    const wideButton = document.getElementById("city-wide");
    function setWide(on) {
      document.body.classList.toggle("city-wide", on);
      wideButton?.setAttribute("aria-pressed", String(on));
      resize();
    }
    wideButton?.addEventListener("click", () =>
      setWide(!document.body.classList.contains("city-wide")),
    );
    document.getElementById("city-reset")?.addEventListener("click", () => {
      selected = -1;
      flyTo(home);
    });
    for (const button of stage.querySelectorAll(".layers button[data-layer]"))
      button.addEventListener("click", () => {
        const on = !layers.has(button.dataset.layer);
        if (on) layers.add(button.dataset.layer);
        else layers.delete(button.dataset.layer);
        button.setAttribute("aria-pressed", String(on));
        invalidate();
      });

    // Pointing, turning, moving and zooming.
    const deviceOf = (event) => {
      const r = canvas.getBoundingClientRect();
      return [(event.clientX - r.left) * dpr, (event.clientY - r.top) * dpr];
    };
    const spread = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    };
    function pan(dx, dy) {
      const k = cam.dist * 0.0016;
      const [fx, fz] = [-Math.sin(cam.yaw), -Math.cos(cam.yaw)];
      const [rx, rz] = [Math.cos(cam.yaw), -Math.sin(cam.yaw)];
      const limit = span * 0.75 + 10;
      cam.tx = clamp(cam.tx - (rx * dx - fx * dy) * k, -limit, limit);
      cam.tz = clamp(cam.tz - (rz * dx - fz * dy) * k, -limit, limit);
    }
    canvas.addEventListener("pointerdown", (event) => {
      canvas.setPointerCapture?.(event.pointerId);
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      dragging = {
        x: event.clientX,
        y: event.clientY,
        moved: false,
        pan: event.shiftKey || event.button === 2,
        spread: pointers.size === 2 ? spread() : 0,
      };
      touch();
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!dragging) {
        const [x, y] = deviceOf(event);
        const item = pick(x, y);
        // A pointer over the city wakes it.
        touch();
        if (item !== hovered) {
          hovered = item;
          canvas.classList.toggle("pointing", Boolean(item));
          invalidate();
        } else schedule();
        showTip(item, event.clientX, event.clientY);
        return;
      }
      pointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (pointers.size === 2) {
        const s = spread();
        if (dragging.spread) cam.dist = clamp((cam.dist * dragging.spread) / s, MIN, MAX);
        dragging.spread = s;
        dragging.moved = true;
      } else {
        const dx = event.clientX - dragging.x;
        const dy = event.clientY - dragging.y;
        if (!dragging.moved && Math.hypot(dx, dy) < 4) return;
        dragging.moved = true;
        canvas.classList.add("dragging");
        dragging.x = event.clientX;
        dragging.y = event.clientY;
        if (dragging.pan) pan(dx, dy);
        else {
          cam.yaw -= dx * 0.006;
          cam.pitch = clamp(cam.pitch + dy * 0.005, 0.1, 1.45);
        }
      }
      tween = null;
      showTip(null);
      touch();
      invalidate();
    });
    const release = (event) => {
      pointers.delete(event.pointerId);
      if (dragging && !dragging.moved && event.type === "pointerup") {
        const [x, y] = deviceOf(event);
        const item = pick(x, y);
        if (item) go(item.el);
      }
      if (!pointers.size) {
        dragging = null;
        canvas.classList.remove("dragging");
      }
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", () => {
      if (dragging) return;
      hovered = null;
      showTip(null);
      invalidate();
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        cam.dist = clamp(cam.dist * Math.exp(event.deltaY * 0.0012), MIN, MAX);
        tween = null;
        touch();
        invalidate();
      },
      { passive: false },
    );
    canvas.addEventListener("keydown", (event) => {
      const key = event.key;
      if (key === "ArrowLeft") cam.yaw += 0.12;
      else if (key === "ArrowRight") cam.yaw -= 0.12;
      else if (key === "ArrowUp") cam.pitch = clamp(cam.pitch + 0.08, 0.1, 1.45);
      else if (key === "ArrowDown") cam.pitch = clamp(cam.pitch - 0.08, 0.1, 1.45);
      else if (key === "+" || key === "=") cam.dist = clamp(cam.dist * 0.85, MIN, MAX);
      else if (key === "-" || key === "_") cam.dist = clamp(cam.dist / 0.85, MIN, MAX);
      else if (key === "Home" || key === "0") {
        event.preventDefault();
        selected = -1;
        flyTo(home);
        return;
      } else return;
      event.preventDefault();
      tween = null;
      touch();
      invalidate();
    });

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const r = canvas.getBoundingClientRect();
      canvas.width = overlay.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = overlay.height = Math.max(1, Math.round(r.height * dpr));
      sparked = false;
      if (r.width && r.height) {
        // When the stage changes shape the camera moves in or out with it, keeping the framing.
        const fit = fitDistance(r.width / r.height);
        const k = fit / home.dist;
        cam.dist = clamp(cam.dist * k, MIN, MAX);
        if (tween) {
          tween.from.dist *= k;
          tween.to.dist *= k;
        }
        home.dist = fit;
      }
      invalidate();
    }
    if (typeof ResizeObserver === "function") new ResizeObserver(resize).observe(canvas);
    else addEventListener("resize", resize);
    if (typeof IntersectionObserver === "function")
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        invalidate();
      }).observe(canvas);
    resize();
    Object.assign(cam, home);

    // The page's one orchestrated moment: the camera settles over the city. A fragment that
    // names an element goes straight to it.
    const opening = { ...home, dist: home.dist * 1.7, pitch: 1.18, yaw: home.yaw - 0.85 };
    if (motion && !at.has(fragment())) Object.assign(cam, opening);
    const begin = () => {
      const i = at.get(fragment());
      if (i !== undefined) focusOn(i);
      else flyTo(home, 2200);
    };
    begin();

    // For the browser tests: where an element can be pointed at on the canvas, and whether
    // anything still moves. Reading only; the city has no other entry point.
    window.processViewCity = {
      locate(id) {
        const i = at.get(id);
        if (i === undefined) return null;
        // A camera move still under way ends first, so the point stays where it is measured.
        if (tween) {
          Object.assign(cam, tween.to);
          tween = null;
        }
        paint(performance.now(), true);
        const r = canvas.getBoundingClientRect();
        // A point of one of its shapes that nothing nearer covers.
        for (const h of hits) {
          if (h.item.el !== i) continue;
          const c = h.r !== undefined ? [h.x, h.y] : centroid(h.poly);
          const points =
            h.r !== undefined
              ? [c]
              : [c, ...h.poly.map((p) => [lerp(c[0], p[0], 0.6), lerp(c[1], p[1], 0.6)])];
          for (const [x, y] of points)
            if (pick(x, y)?.el === i) return { x: r.left + x / dpr, y: r.top + y / dpr };
        }
        return null;
      },
      moving: () => raf !== 0 || timer !== 0 || tween !== null,
    };
    function centroid(pts) {
      let x = 0;
      let y = 0;
      for (const p of pts) {
        x += p[0];
        y += p[1];
      }
      return [x / pts.length, y / pts.length];
    }
  }
})();
