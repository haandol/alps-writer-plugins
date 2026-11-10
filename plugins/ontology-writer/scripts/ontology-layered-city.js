// The night-city visual language projected from the navigator's current page only.
// Camera, selection, membership and lifecycle belong to the shared navigator.
(() => {
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const mix = (a, b, amount) => a.map((v, i) => v + (b[i] - v) * amount);
  const rgb = (c, alpha = 1) => `rgba(${c.map(Math.round).join(",")},${alpha})`;
  const NIGHT = [10, 20, 39],
    CYAN = [109, 226, 235],
    GOLD = [255, 207, 110];
  const PALETTE = [
    [116, 188, 218],
    [153, 177, 231],
    [123, 201, 179],
    [191, 170, 225],
    [212, 190, 137],
    [149, 193, 203],
  ];
  const colourFor = (node) => {
    if (node.marks & 12 || node.state === "unrealized") return [238, 128, 130];
    if (node.marks & 1 || /^(Deprecated|Superseded)/.test(node.status ?? ""))
      return [124, 143, 158];
    if (node.state === "implemented" || /^Accepted/.test(node.status ?? "")) return GOLD;
    if (node.state === "notImplemented" || /^Proposed/.test(node.status ?? ""))
      return [247, 178, 95];
    if (node.state === "unknown") return [173, 181, 200];
    let hash = 0;
    for (const c of node.id) hash = (hash * 31 + c.codePointAt(0)) >>> 0;
    return PALETTE[hash % PALETTE.length];
  };
  const inside = (x, y, polygon) => {
    let hit = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i],
        b = polygon[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
        hit = !hit;
    }
    return hit;
  };
  const overlaps = (a, b) =>
    a.x < b.x + b.w + 8 && a.x + a.w + 8 > b.x && a.y < b.y + b.h + 8 && a.y + a.h + 8 > b.y;
  const bounds = (points) => ({
    left: Math.min(...points.map((p) => p[0])),
    right: Math.max(...points.map((p) => p[0])),
    top: Math.min(...points.map((p) => p[1])),
    bottom: Math.max(...points.map((p) => p[1])),
  });

  /** A read-only scene; render is lazy and performs no timer, fetch or storage work. */
  window.createOntologyCity = (canvas, labels) => {
    const g = canvas.getContext?.("2d");
    if (!g) return null;
    let active = false,
      scene = null,
      hover = null,
      focused = null,
      labelMode = "auto",
      showLinks = true;
    let frames = 0,
      hits = [],
      projected = [],
      labelIds = [],
      renderedRelations = [],
      faces = [];
    let project = () => null,
      eye = [0, 0, 0],
      width = 0,
      height = 0;
    const path = (points) => {
      g.beginPath();
      g.moveTo(points[0][0], points[0][1]);
      for (const p of points.slice(1)) g.lineTo(p[0], p[1]);
      g.closePath();
    };
    // The same orbit projection as the original city. Zoom changes the lens;
    // screen-space pan shares the navigator's camera with the event board.
    function projector(yaw, pitch, distance) {
      const cp = Math.cos(pitch),
        sp = Math.sin(pitch),
        sy = Math.sin(yaw),
        cy = Math.cos(yaw);
      const eye = [distance * cp * sy, 0.65 + distance * sp, distance * cp * cy];
      const right = [cy, 0, -sy],
        up = [-sp * sy, cp, -sp * cy],
        forward = [-cp * sy, -sp, -cp * cy];
      return {
        eye,
        point: (x, y, z) => {
          const p = [x - eye[0], y - eye[1], z - eye[2]];
          const depth = p.reduce((sum, v, i) => sum + v * forward[i], 0);
          if (depth < 0.1) return null;
          return [
            p.reduce((sum, v, i) => sum + v * right[i], 0) / depth,
            -p.reduce((sum, v, i) => sum + v * up[i], 0) / depth,
            depth,
          ];
        },
      };
    }
    const cubePoints = (box) => [
      [box.x0, box.y0, box.z0],
      [box.x1, box.y0, box.z0],
      [box.x1, box.y0, box.z1],
      [box.x0, box.y0, box.z1],
      [box.x0, box.y1, box.z0],
      [box.x1, box.y1, box.z0],
      [box.x1, box.y1, box.z1],
      [box.x0, box.y1, box.z1],
    ];
    function addBox(box, node, options = {}) {
      const points = cubePoints(box).map((p) => project(...p));
      const visible = [[4, 5, 6, 7, 1]];
      if (eye[0] > box.x1) visible.push([2, 1, 5, 6, 0.72]);
      else if (eye[0] < box.x0) visible.push([0, 3, 7, 4, 0.57]);
      if (eye[2] > box.z1) visible.push([3, 2, 6, 7, 0.9]);
      else if (eye[2] < box.z0) visible.push([1, 0, 4, 5, 0.62]);
      for (const face of visible) {
        const p = face.slice(0, 4).map((i) => points[i]);
        if (p.some((point) => !point)) continue;
        faces.push({
          p,
          node,
          shade: face[4],
          top: face[0] === 4,
          depth: p.reduce((n, q) => n + q[2], 0) / 4,
          ...options,
        });
      }
    }
    function quad(points, u0, u1, v0, v1) {
      const at = (u, v) => {
        const bottom = points[0].map((n, i) => n + (points[1][i] - n) * u);
        const top = points[3].map((n, i) => n + (points[2][i] - n) * u);
        return bottom.map((n, i) => n + (top[i] - n) * v);
      };
      return [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)];
    }

    /** Uniform architectural shapes indicate the current resolution, never business quantity. */
    function layout(nodes) {
      const columns = Math.min(nodes.length || 1, width < 600 ? 2 : 3);
      const rows = Math.ceil(nodes.length / columns) || 1;
      return nodes.map((node, i) => {
        const x = ((i % columns) - (columns - 1) / 2) * 4.3;
        const z = (Math.floor(i / columns) - (rows - 1) / 2) * 4.0;
        const h =
          node.kind === "BoundedContext"
            ? 1.6
            : node.kind === "Process"
              ? 2.7
              : node.kind === "ADR"
                ? 1.55
                : 1.0;
        return {
          ...node,
          x,
          z,
          h,
          colour: colourFor(node),
          box: { x0: x - 1, x1: x + 1, y0: 0.2, y1: h, z0: z - 0.8, z1: z + 0.8 },
        };
      });
    }
    function drawGround(items) {
      const span = Math.max(6, Math.ceil(Math.sqrt(items.length || 1)) * 4.3);
      g.strokeStyle = "rgba(107,152,206,.1)";
      g.lineWidth = 1;
      for (let k = -span; k <= span; k += 2.15) {
        for (const pair of [
          [
            [-span, -0.2, k],
            [span, -0.2, k],
          ],
          [
            [k, -0.2, -span],
            [k, -0.2, span],
          ],
        ]) {
          const a = project(...pair[0]),
            b = project(...pair[1]);
          if (!a || !b) continue;
          g.beginPath();
          g.moveTo(a[0], a[1]);
          g.lineTo(b[0], b[1]);
          g.stroke();
        }
      }
      if (scene.layer !== "contexts" && items.length) {
        const xs = items.map((n) => n.x),
          zs = items.map((n) => n.z);
        addBox(
          {
            x0: Math.min(...xs) - 2,
            x1: Math.max(...xs) + 2,
            z0: Math.min(...zs) - 1.8,
            z1: Math.max(...zs) + 1.8,
            y0: -0.25,
            y1: -0.1,
          },
          null,
          { plot: true },
        );
      }
    }
    function geometry(items) {
      for (const item of items) {
        const { x, z, h } = item;
        addBox(
          { x0: x - 1.65, x1: x + 1.65, z0: z - 1.5, z1: z + 1.5, y0: -0.06, y1: 0.13 },
          item,
          { plot: true },
        );
        if (item.kind === "BoundedContext") {
          addBox({ ...item.box, x0: x - 0.45, x1: x + 0.45, z0: z - 0.5, z1: z + 0.5 }, item, {
            windows: 3,
          });
          addBox(
            { x0: x - 1.2, x1: x - 0.48, z0: z - 0.65, z1: z + 0.65, y0: 0.18, y1: 0.82 },
            item,
            { windows: 2 },
          );
          addBox(
            { x0: x + 0.48, x1: x + 1.2, z0: z - 0.65, z1: z + 0.65, y0: 0.18, y1: 0.82 },
            item,
            { windows: 2 },
          );
          addBox(
            { x0: x - 0.52, x1: x + 0.52, z0: z - 0.57, z1: z + 0.57, y0: h, y1: h + 0.13 },
            item,
            { roof: true },
          );
        } else {
          addBox(item.box, item, { windows: item.kind === "Process" ? 5 : 3 });
          addBox(
            { x0: x - 1.1, x1: x + 1.1, z0: z - 0.9, z1: z + 0.9, y0: h, y1: h + 0.17 },
            item,
            { roof: true },
          );
          if (item.kind === "Process")
            addBox(
              { x0: x + 0.65, x1: x + 1.35, z0: z + 0.5, z1: z + 1.2, y0: 0.18, y1: 0.95 },
              item,
              { windows: 2 },
            );
        }
      }
    }
    function drawFace(face, focusSet) {
      const { p, node, shade, plot, roof, windows, top } = face;
      const dim = node && focusSet && !focusSet.has(node.id);
      const colour = node?.colour ?? [83, 139, 184];
      let body = plot ? [22, 40, 66] : mix([28, 43, 69], colour, roof ? 0.4 : 0.1);
      body = body.map((v) => v * shade);
      if (dim) body = mix(body, NIGHT, 0.65);
      path(p);
      g.fillStyle = rgb(body);
      g.fill();
      g.strokeStyle = rgb(mix(colour, [190, 216, 245], 0.15), dim ? 0.15 : plot ? 0.42 : 0.6);
      g.lineWidth = plot ? 1.2 : 0.85;
      g.stroke();
      if (node) hits.push({ id: node.id, poly: p });
      if (!top && windows) {
        const faceWidth = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]);
        if (faceWidth > 16) {
          for (let row = 0; row < windows; row++)
            for (let col = 0; col < 3; col++) {
              path(
                quad(
                  p,
                  0.12 + col * 0.27,
                  0.27 + col * 0.27,
                  0.13 + (row * 0.75) / windows,
                  0.13 + ((row + 0.65) * 0.75) / windows,
                ),
              );
              g.fillStyle = rgb(colour, dim ? 0.14 : (row + col) % 4 === 0 ? 0.36 : 0.83);
              g.fill();
            }
        }
      }
    }
    function drawConnections(items, focusSet) {
      const byId = new Map(items.map((n) => [n.id, n]));
      renderedRelations = [];
      if (!showLinks) return;
      for (const [index, edge] of scene.relations.entries()) {
        const a = byId.get(edge.from),
          b = byId.get(edge.to);
        if (!a || !b) continue;
        const points = [];
        for (let i = 0; i <= 24; i++) {
          const u = i / 24,
            v = 1 - u,
            lift = Math.max(a.h, b.h) + 0.7 + Math.hypot(b.x - a.x, b.z - a.z) * 0.12;
          const point = project(
            a.x * v + b.x * u,
            v * v * (a.h + 0.18) + 2 * v * u * lift + u * u * (b.h + 0.18),
            a.z * v + b.z * u,
          );
          if (point) points.push(point);
        }
        if (points.length < 2) continue;
        const relevant = !focusSet || (focusSet.has(a.id) && focusSet.has(b.id));
        g.beginPath();
        g.moveTo(points[0][0], points[0][1]);
        for (const p of points.slice(1)) g.lineTo(p[0], p[1]);
        g.strokeStyle =
          edge.kind === "reaction"
            ? `rgba(241,171,111,${relevant ? 0.78 : 0.13})`
            : `rgba(149,189,232,${relevant ? 0.62 : 0.12})`;
        g.lineWidth = relevant ? 1.6 : 1;
        g.stroke();
        if (edge.kind === "reaction") {
          const last = points.at(-1),
            prior = points.at(-2),
            angle = Math.atan2(last[1] - prior[1], last[0] - prior[0]);
          path([
            last,
            [last[0] - 7 * Math.cos(angle - 0.42), last[1] - 7 * Math.sin(angle - 0.42)],
            [last[0] - 7 * Math.cos(angle + 0.42), last[1] - 7 * Math.sin(angle + 0.42)],
          ]);
          g.fillStyle = g.strokeStyle;
          g.fill();
        }
        renderedRelations.push(index);
      }
    }
    function drawLabels(items, focusSet) {
      const elements = new Map(
        [...labels.querySelectorAll("[data-layer-node]")].map((n) => [n.dataset.layerNode, n]),
      );
      const hud = { x: 12, y: 10, w: Math.min(430, width - 24), h: 62 };
      const occupied = [hud];
      labelIds = [];
      projected = [];
      const ordered = [...items].sort((a, b) => {
        const priority = (n) =>
          n.id === focused
            ? 4
            : n.id === hover
              ? 3
              : n.id === scene.selected
                ? 2
                : focusSet?.has(n.id)
                  ? 1
                  : 0;
        return priority(b) - priority(a) || project(a.x, a.h, a.z)[2] - project(b.x, b.h, b.z)[2];
      });
      for (const item of ordered) {
        const node = elements.get(item.id);
        if (!node) continue;
        const top = project(item.x, item.h + 0.28, item.z);
        const screen = cubePoints({ ...item.box, y1: item.h + 0.2 })
          .map((p) => project(...p))
          .filter(Boolean);
        if (!top || screen.length < 8) continue;
        const box = bounds(screen),
          onScreen = box.right >= 0 && box.left <= width && box.bottom >= 0 && box.top <= height;
        const important = item.id === focused || item.id === hover || item.id === scene.selected;
        const detail = important || (item.kind !== "BoundedContext" && box.right - box.left >= 100);
        const w = clamp(width * 0.24, Math.min(142, (width - 24) / 2), 232),
          h = item.kind === "BoundedContext" ? (detail ? 94 : 72) : detail ? 74 : 54;
        const edges = [
          [item.x - 1.75, 0.14, item.z],
          [item.x + 1.75, 0.14, item.z],
          [item.x, 0.14, item.z - 1.6],
          [item.x, 0.14, item.z + 1.6],
        ];
        edges.sort(
          (a, b) =>
            a.reduce((n, v, i) => n + (v - eye[i]) ** 2, 0) -
            b.reduce((n, v, i) => n + (v - eye[i]) ** 2, 0),
        );
        const anchor = item.kind === "BoundedContext" ? project(...edges[0]) : top;
        let label = {
          x: anchor[0] - w / 2,
          y: item.kind === "BoundedContext" ? anchor[1] + 8 : anchor[1] - h - 9,
          w,
          h,
        };
        const canShow =
          onScreen && (labelMode === "all" || important || box.right - box.left >= 30);
        if (canShow) {
          // Nearer/selected labels win. When all names are requested, use leader
          // lines to move colliding labels without moving any business object.
          label.x = clamp(label.x, 8, Math.max(8, width - w - 8));
          label.y = clamp(label.y, 8, Math.max(8, height - h - 12));
          if (overlaps(label, hud)) label.y = hud.y + hud.h + 8;
          if (labelMode === "all" && occupied.some((other) => overlaps(label, other))) {
            const candidates = [];
            for (let y = 82; y + h < height - 8; y += h + 10)
              for (let x = 8; x + w <= width - 8; x += w + 10) candidates.push({ x, y, w, h });
            candidates.sort(
              (a, b) =>
                (a.x - label.x) ** 2 +
                (a.y - label.y) ** 2 -
                ((b.x - label.x) ** 2 + (b.y - label.y) ** 2),
            );
            label =
              candidates.find(
                (candidate) => !occupied.some((other) => overlaps(candidate, other)),
              ) ?? label;
          }
        }
        const shown =
          canShow &&
          (important || labelMode === "all" || !occupied.some((other) => overlaps(label, other))) &&
          label.y + h < height - 8;
        node.style.left = `${shown ? label.x : top[0] - w / 2}px`;
        node.style.top = `${shown ? label.y : top[1] - h - 9}px`;
        node.style.width = `${w}px`;
        node.style.height = `${h}px`;
        node.dataset.cityLabel = shown ? "shown" : "hidden";
        node.dataset.cityDetail = detail ? "true" : "false";
        node.dataset.cityFocus = important ? "true" : "false";
        if (shown) {
          occupied.push(label);
          labelIds.push(item.id);
          g.strokeStyle = rgb(item.colour, important ? 0.72 : 0.25);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(top[0], top[1]);
          g.lineTo(clamp(top[0], label.x + 8, label.x + w - 8), label.y + label.h);
          g.stroke();
        }
        const roof = project(
          item.x,
          item.h + (item.kind === "BoundedContext" ? 0.13 : 0.17),
          item.z,
        );
        projected.push({
          id: item.id,
          kind: item.kind,
          roof: [roof[0], roof[1]],
          bounds: box,
          onScreen,
          label: shown,
          detail,
        });
      }
    }

    function draw() {
      if (!active || !scene || document.hidden || !canvas.checkVisibility()) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (!width || !height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      hits = [];
      faces = [];
      const gradient = g.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#071120");
      gradient.addColorStop(0.62, "#132846");
      gradient.addColorStop(1, "#1a3455");
      g.fillStyle = gradient;
      g.fillRect(0, 0, width, height);
      for (let i = 0; i < 65; i++) {
        const x = (((i * 137.507) % 997) / 997) * width,
          y = (((i * 53.93) % 389) / 389) * height * 0.5;
        g.fillStyle = `rgba(191,218,245,${0.1 + (i % 4) * 0.06})`;
        g.fillRect(x, y, 1, 1);
      }
      const items = layout(scene.nodes);
      const span = Math.max(6, Math.ceil(Math.sqrt(items.length || 1)) * 4.3),
        distance = span * 1.5 + 5;
      const home = projector(0.756, (38 * Math.PI) / 180, distance);
      const points = items
        .flatMap((n) =>
          cubePoints({
            x0: n.x - 1.8,
            x1: n.x + 1.8,
            y0: -0.2,
            y1: n.h + 0.5,
            z0: n.z - 1.65,
            z1: n.z + 1.65,
          }).map((p) => home.point(...p)),
        )
        .filter(Boolean);
      const b = points.length ? bounds(points) : { left: -0.2, right: 0.2, top: -0.2, bottom: 0.2 };
      const focal = Math.min(
        (width - 70) / Math.max(0.01, b.right - b.left),
        (height - 135) / Math.max(0.01, b.bottom - b.top),
      );
      const camera = scene.camera;
      const flatFit = clamp((width - 28) / scene.flatWidth, 0.45, 1);
      const flatX = (width - scene.flatWidth * flatFit) / 2;
      const zoom = camera.zoom / flatFit;
      const current = projector(
        1 + (camera.yaw * Math.PI) / 180,
        (camera.pitch * Math.PI) / 180,
        distance,
      );
      eye = current.eye;
      const cx = width / 2 - ((b.left + b.right) / 2) * focal * zoom + camera.x - flatX;
      const cy = height / 2 + 35 - ((b.top + b.bottom) / 2) * focal * zoom + camera.y - 25;
      project = (x, y, z) => {
        const p = current.point(x, y, z);
        return p ? [cx + p[0] * focal * zoom, cy + p[1] * focal * zoom, p[2]] : null;
      };
      const candidate = focused || hover || scene.selected;
      const chosen = items.some((item) => item.id === candidate) ? candidate : null;
      const focusSet = chosen
        ? new Set([
            chosen,
            ...scene.relations.flatMap((edge) =>
              edge.from === chosen ? [edge.to] : edge.to === chosen ? [edge.from] : [],
            ),
          ])
        : null;
      drawGround(items);
      geometry(items);
      // Ground plates sit below every building. Sorting a whole floor by its
      // midpoint depth would paint it over the farther buildings in a large BC.
      faces.sort((a, b) => Number(Boolean(b.plot)) - Number(Boolean(a.plot)) || b.depth - a.depth);
      for (const face of faces) drawFace(face, focusSet);
      drawConnections(items, focusSet);
      const selected = items.find((n) => n.id === chosen);
      if (selected) {
        const low = project(selected.x, 0.15, selected.z),
          high = project(selected.x, selected.h + 1.6, selected.z);
        if (low && high) {
          const beam = g.createLinearGradient(low[0], low[1], high[0], high[1]);
          beam.addColorStop(0, rgb(CYAN, 0.48));
          beam.addColorStop(1, rgb(CYAN, 0));
          g.strokeStyle = beam;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(...low.slice(0, 2));
          g.lineTo(...high.slice(0, 2));
          g.stroke();
        }
      }
      drawLabels(items, focusSet);
      frames++;
    }
    return {
      render(input) {
        scene = input;
        active = true;
        if (!scene.nodes.some((n) => n.id === hover)) hover = null;
        if (!scene.nodes.some((n) => n.id === focused)) focused = null;
        draw();
      },
      setActive(value) {
        active = value;
        if (value) draw();
      },
      hover(id) {
        if (hover !== id) {
          hover = id;
          draw();
        }
      },
      focus(id) {
        if (focused !== id) {
          focused = id;
          draw();
        }
      },
      visibility({ labels: mode, links }) {
        labelMode = mode;
        showLinks = links;
        draw();
      },
      pick(x, y) {
        for (let i = hits.length - 1; i >= 0; i--)
          if (inside(x, y, hits[i].poly)) return hits[i].id;
        return null;
      },
      snapshot: () => ({
        layer: scene?.layer ?? null,
        nodeIds: scene?.nodes.map((n) => n.id) ?? [],
        labelIds: [...labelIds],
        drawn: structuredClone(projected),
        relations: [...renderedRelations],
        frames,
        active,
        labels: labelMode,
        links: showLinks,
      }),
    };
  };
})();
