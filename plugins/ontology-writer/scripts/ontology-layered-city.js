// A structural map of authored membership, shared participation and realization.
// Camera, selection, membership and lifecycle belong to the shared navigator.
(() => {
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const mix = (a, b, amount) => a.map((v, i) => v + (b[i] - v) * amount);
  const rgb = (c, alpha = 1) => `rgba(${c.map(Math.round).join(",")},${alpha})`;
  const NIGHT = [10, 20, 39],
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

  /** Static structure and a separate, cancellable overlay for recorded event flow. */
  window.createOntologyCity = (canvas, labels, flowCanvas, onMotion = () => {}) => {
    const g = canvas.getContext?.("2d");
    if (!g) return null;
    const flow = flowCanvas?.getContext?.("2d");
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
      faces = [],
      regions = [],
      ancestors = [],
      places = [],
      occupiedLabels = [],
      flowPaths = [],
      ports = [],
      textMasks = [];
    let motionEnabled = false,
      pauseReason = "paused",
      inView = true,
      pendingFrame = 0,
      lastTick = null,
      elapsed = 0,
      flowFrames = 0,
      samples = [],
      lastMotion = "";
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

    // Allocate stable addresses from scope membership, not the current search/page
    // or event order. Only scene.nodes will receive geometry or hit targets.
    function districts(groups) {
      const ordered = [...groups].sort((a, b) => a.id.localeCompare(b.id));
      const columns = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(ordered.length))));
      const sizes = ordered.map((group) => {
        const cols = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(group.ids.length))));
        return {
          cols,
          w: cols * 3.4 + 1.6,
          d: Math.max(1, Math.ceil(group.ids.length / cols)) * 3.1 + 4.0,
        };
      });
      const colWidths = Array.from({ length: columns }, (_, col) =>
        Math.max(0, ...sizes.filter((_, i) => i % columns === col).map((size) => size.w)),
      );
      const rowDepths = Array.from({ length: Math.ceil(ordered.length / columns) }, (_, row) =>
        Math.max(...sizes.slice(row * columns, (row + 1) * columns).map((size) => size.d)),
      );
      const sum = (values) => values.reduce((a, b) => a + b, 0);
      const totalW = sum(colWidths) + Math.max(0, columns - 1) * 2.8;
      const totalD = sum(rowDepths) + Math.max(0, rowDepths.length - 1) * 2.8;
      const positions = new Map();
      const plots = ordered.map((group, i) => {
        const col = i % columns,
          row = Math.floor(i / columns),
          size = sizes[i];
        const x0 = sum(colWidths.slice(0, col)) + col * 2.8 - totalW / 2;
        const z0 = sum(rowDepths.slice(0, row)) + row * 2.8 - totalD / 2;
        [...group.ids].sort().forEach((id, j) =>
          positions.set(id, {
            id,
            group: group.id,
            x: x0 + 2.5 + (j % size.cols) * 3.4,
            z: z0 + 4.2 + Math.floor(j / size.cols) * 3.1,
          }),
        );
        return { ...group, x0, x1: x0 + size.w, z0, z1: z0 + size.d };
      });
      return { plots, positions, width: totalW || 8, depth: totalD || 8 };
    }
    function layout() {
      const structure = scene.structure;
      const plan = districts(structure.groups);
      const y = structure.ancestors.length * 0.42;
      regions = plan.plots.map((plot) => ({
        ...plot,
        y,
        colour: colourFor({ id: plot.id }),
        visible: plot.ids.filter((id) => scene.nodes.some((node) => node.id === id)),
      }));
      ancestors = structure.ancestors.map((parent, i) => {
        const pad = (structure.ancestors.length - i) * 1.3;
        return {
          ...parent,
          x0: -plan.width / 2 - pad,
          x1: plan.width / 2 + pad,
          z0: -plan.depth / 2 - pad,
          z1: plan.depth / 2 + pad,
          y: i * 0.42,
          colour: colourFor({ id: parent.id }),
        };
      });
      places = [...plan.positions.values()];
      return scene.nodes.map((node) => {
        const position = plan.positions.get(node.id);
        const h = node.kind === "BoundedContext" ? 1.05 : node.kind === "ADR" ? 0.65 : 0.85;
        const floor = y + 0.16;
        return {
          ...node,
          ...position,
          h: floor + h,
          floor,
          number: structure.numbers[node.id],
          colour: colourFor(node),
          box: {
            x0: position.x - 0.85,
            x1: position.x + 0.85,
            y0: floor,
            y1: floor + h,
            z0: position.z - 0.68,
            z1: position.z + 0.68,
          },
        };
      });
    }
    function drawGround() {
      for (const region of [...ancestors, ...regions]) {
        addBox(
          {
            x0: region.x0,
            x1: region.x1,
            z0: region.z0,
            z1: region.z1,
            y0: region.y - 0.13,
            y1: region.y,
          },
          null,
          { plot: true, region },
        );
      }
    }
    function geometry(items) {
      for (const item of items) {
        const { x, z, h, floor } = item;
        addBox(
          {
            x0: x - 1.23,
            x1: x + 1.23,
            z0: z - 1.03,
            z1: z + 1.03,
            y0: floor - 0.13,
            y1: floor - 0.04,
          },
          item,
          { plot: true },
        );
        addBox(item.box, item, { windows: item.kind === "BoundedContext" ? 3 : 2 });
        addBox({ x0: x - 0.9, x1: x + 0.9, z0: z - 0.73, z1: z + 0.73, y0: h, y1: h + 0.1 }, item, {
          roof: true,
        });
      }
    }

    function drawFace(face, focusSet) {
      const { p, node, shade, plot, roof, windows, top } = face;
      const dim = node && focusSet && !focusSet.has(node.id);
      const colour = node?.colour ?? face.region?.colour ?? [83, 139, 184];
      let body = plot
        ? mix([16, 33, 54], colour, face.region ? 0.1 : 0.05)
        : mix([28, 43, 69], colour, roof ? 0.4 : 0.1);
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
    function drawConnections(items, chosen) {
      const byId = new Map(items.map((node) => [node.id, node]));
      const groups = new Map();
      flowPaths = [];
      ports = [];
      renderedRelations = [];
      if (!showLinks) return;
      const touches = (edge) => byId.has(edge.from) || byId.has(edge.to);
      const add = (edge, index) => {
        const key = JSON.stringify([edge.kind, edge.from, edge.to]);
        if (!groups.has(key)) groups.set(key, { ...edge, indexes: [] });
        groups.get(key).indexes.push(index);
      };
      scene.relations.forEach((edge, index) => {
        if (edge.kind === "reaction" && touches(edge)) add(edge, index);
      });
      scene.relations.forEach((edge, index) => {
        if (edge.kind !== "collaboration" || !touches(edge)) return;
        const related = [...groups.values()].find(
          (route) =>
            (route.from === edge.from && route.to === edge.to) ||
            (route.from === edge.to && route.to === edge.from),
        );
        // The collaboration remains in the evidence; its line need not duplicate
        // a recorded directed route between the same two business boundaries.
        if (related) related.indexes.push(index);
        else add(edge, index);
      });
      const outside = new Map();
      for (const route of groups.values())
        for (const id of [route.from, route.to]) {
          if (!byId.has(id) && !outside.has(id))
            outside.set(id, { id, incoming: route.from === id });
        }
      const incoming = [...outside.values()]
        .filter((port) => port.incoming)
        .sort((a, b) => a.id.localeCompare(b.id));
      const outgoing = [...outside.values()]
        .filter((port) => !port.incoming)
        .sort((a, b) => a.id.localeCompare(b.id));
      for (const list of [incoming, outgoing])
        list.forEach((port, i) => {
          port.point = [
            port.incoming ? 22 : width - 22,
            100 + ((i + 0.5) * (height - 160)) / Math.max(1, list.length),
          ];
          port.number = `E${ports.length + 1}`;
          ports.push(port);
        });
      const endpoint = (id) =>
        byId.has(id)
          ? project(byId.get(id).x, byId.get(id).h + 0.18, byId.get(id).z)
          : outside.get(id)?.point;
      for (const [ordinal, route] of [...groups.values()].entries()) {
        const a = byId.get(route.from),
          b = byId.get(route.to);
        const first = endpoint(route.from),
          last = endpoint(route.to);
        if (!first || !last) continue;
        const points = [];
        for (let i = 0; i <= 48; i++) {
          const u = i / 48,
            v = 1 - u;
          if (a && b) {
            const lift =
              Math.max(a.h, b.h) +
              1.0 +
              Math.hypot(b.x - a.x, b.z - a.z) * 0.15 +
              (ordinal % 3) * 0.2;
            const point = project(
              a.x * v + b.x * u,
              v * v * (a.h + 0.18) + 2 * v * u * lift + u * u * (b.h + 0.18),
              a.z * v + b.z * u,
            );
            if (point) points.push(point.slice(0, 2));
          } else {
            points.push([
              first[0] * v + last[0] * u,
              first[1] * v + last[1] * u - Math.sin(u * Math.PI) * (38 + (ordinal % 3) * 12),
            ]);
          }
        }
        if (points.length < 2) continue;
        const emphasized = !chosen || route.from === chosen || route.to === chosen;
        const directed = route.kind === "reaction";
        g.beginPath();
        g.moveTo(...points[0]);
        for (const point of points.slice(1)) g.lineTo(...point);
        g.strokeStyle = directed
          ? `rgba(235,190,112,${emphasized ? 0.5 : 0.18})`
          : `rgba(148,186,219,${emphasized ? 0.4 : 0.14})`;
        g.lineWidth = emphasized ? 1.4 : 1;
        g.stroke();
        if (directed) {
          const destination = points.at(-1),
            prev = points.at(-3),
            angle = Math.atan2(destination[1] - prev[1], destination[0] - prev[0]),
            // Stop the arrow outside the numbered endpoint instead of hiding it below the marker.
            end = [destination[0] - 15 * Math.cos(angle), destination[1] - 15 * Math.sin(angle)];
          path([
            end,
            [end[0] - 9 * Math.cos(angle - 0.45), end[1] - 9 * Math.sin(angle - 0.45)],
            [end[0] - 9 * Math.cos(angle + 0.45), end[1] - 9 * Math.sin(angle + 0.45)],
          ]);
          g.fillStyle = emphasized ? "#f8d99a" : "#b59b70";
          g.fill();
        }
        const visible = points.some(([x, y]) => x >= 0 && x <= width && y >= 0 && y <= height);
        flowPaths.push({ ...route, points, emphasized, visible, directed });
        renderedRelations.push(...route.indexes);
      }
    }
    function drawPorts() {
      for (const port of ports) {
        const [x, y] = port.point,
          info = scene.endpoints[port.id];
        g.beginPath();
        g.arc(x, y, 11, 0, Math.PI * 2);
        g.fillStyle = "#173952";
        g.fill();
        g.strokeStyle = "#82cbd5";
        g.lineWidth = 1.2;
        g.stroke();
        g.font = "600 9px system-ui";
        g.textAlign = "center";
        g.fillStyle = "#e6f7f6";
        g.fillText(port.number, x, y + 3);
        textMasks.push({ x: x - 12, y: y - 12, w: 24, h: 24 });
        caption(
          info?.name ?? port.id,
          port.incoming ? 40 : width - 170,
          y - 24,
          Math.min(155, width * 0.43),
          [130, 203, 213],
          {
            align: "left",
            avoid: true,
            anchor: port.point,
            note: info?.inScope
              ? scene.structure.language === "ko"
                ? "다른 페이지"
                : "Another page"
              : scene.structure.language === "ko"
                ? "이 범위 밖의 업무"
                : "Work outside this scope",
          },
        );
      }
    }
    const pointAt = (route, fraction) => {
      const n = fraction * (route.points.length - 1),
        i = Math.min(route.points.length - 2, Math.floor(n));
      return route.points[i].map(
        (value, axis) => value + (route.points[i + 1][axis] - value) * (n - i),
      );
    };
    function motionReason() {
      if (!active) return "inactive";
      if (document.hidden) return "hidden";
      if (!inView) return "outside";
      if (!showLinks) return "links-hidden";
      if (!flow) return "unavailable";
      if (!motionEnabled) return pauseReason;
      if (!flowPaths.some((route) => route.directed && route.visible)) return "no-flow";
      return "playing";
    }
    function clearFlow() {
      if (flow && !document.hidden) flow.clearRect(0, 0, width, height);
      samples = [];
    }
    function paintFlow() {
      if (!flow || document.hidden) return;
      flow.clearRect(0, 0, width, height);
      samples = [];
      for (const [index, route] of flowPaths.entries()) {
        if (!route.directed || !route.visible) continue;
        for (let particle = 0; particle < 2; particle++) {
          const fraction = (elapsed / 4800 + index * 0.173 + particle * 0.5) % 1;
          for (let trail = 7; trail >= 0; trail--) {
            const u = fraction - trail * 0.012;
            if (u < 0) continue;
            const point = pointAt(route, u);
            if (
              point[0] < 0 ||
              point[0] > width ||
              point[1] < 0 ||
              point[1] > height ||
              textMasks.some(
                (box) =>
                  point[0] >= box.x - 3 &&
                  point[0] <= box.x + box.w + 3 &&
                  point[1] >= box.y - 3 &&
                  point[1] <= box.y + box.h + 3,
              )
            )
              continue;
            const alpha = (1 - trail / 8) * (route.emphasized ? 1 : 0.45);
            flow.beginPath();
            flow.arc(...point, trail ? 1.7 : 3.1, 0, Math.PI * 2);
            flow.fillStyle = trail
              ? `rgba(251,192,88,${alpha * 0.55})`
              : `rgba(255,245,204,${alpha})`;
            flow.shadowColor = "#ffd28a";
            flow.shadowBlur = trail ? 0 : 8;
            flow.fill();
            if (!trail) samples.push({ from: route.from, to: route.to, fraction, position: point });
          }
        }
      }
      flow.shadowBlur = 0;
    }
    function tick(now) {
      pendingFrame = 0;
      if (motionReason() !== "playing") {
        syncMotion();
        return;
      }
      if (lastTick === null) lastTick = now;
      if (now - lastTick >= 32) {
        elapsed += Math.min(100, now - lastTick);
        lastTick = now;
        paintFlow();
        flowFrames++;
      }
      pendingFrame = requestAnimationFrame(tick);
    }
    function syncMotion() {
      const reason = motionReason();
      if (reason === "playing") {
        if (!pendingFrame) pendingFrame = requestAnimationFrame(tick);
      } else {
        if (pendingFrame) cancelAnimationFrame(pendingFrame);
        pendingFrame = 0;
        lastTick = null;
        clearFlow();
      }
      const count = flowPaths.filter((route) => route.directed && route.visible).length;
      const key = `${reason}|${count}`;
      if (key !== lastMotion) {
        lastMotion = key;
        onMotion({ reason, count });
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncMotion();
    });
    observer.observe(canvas);
    function lines(text, maxWidth, limit = 2) {
      const words = String(text).split(/\s+/),
        result = [];
      let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (g.measureText(next).width > maxWidth && line) {
          result.push(line);
          line = word;
        } else line = next;
      }
      if (line) result.push(line);
      const output = result.slice(0, limit);
      if (result.length > limit) output[limit - 1] += "…";
      return output;
    }
    function caption(
      text,
      x,
      y,
      maxWidth,
      colour,
      { note = "", align = "center", limit = 2, avoid = false, anchor = null } = {},
    ) {
      g.font = "600 12px system-ui";
      const textLines = lines(text, maxWidth - 18, limit);
      const w = Math.min(
        maxWidth,
        Math.max(36, ...textLines.map((line) => g.measureText(line).width)) + 18,
      );
      const h = textLines.length * 16 + (note ? 15 : 0) + 12;
      let box = {
        x: clamp(align === "left" ? x : x - w / 2, 6, width - w - 6),
        y: clamp(y, 72, height - h - 6),
        w,
        h,
      };
      if (avoid && occupiedLabels.some((other) => overlaps(box, other))) {
        const candidates = [];
        for (let y = 76; y + h < height - 6; y += 14)
          for (let x = 6; x + w <= width - 6; x += 14) candidates.push({ x, y, w, h });
        candidates.sort(
          (a, b) => Math.hypot(a.x - box.x, a.y - box.y) - Math.hypot(b.x - box.x, b.y - box.y),
        );
        box =
          candidates.find(
            (candidate) => !occupiedLabels.some((other) => overlaps(candidate, other)),
          ) ?? box;
      }
      if (anchor) {
        g.beginPath();
        g.moveTo(anchor[0], anchor[1]);
        g.lineTo(clamp(anchor[0], box.x + 4, box.x + box.w - 4), box.y + box.h);
        g.strokeStyle = rgb(colour, 0.4);
        g.lineWidth = 1;
        g.stroke();
      }
      g.fillStyle = "rgba(8,22,37,.9)";
      g.fillRect(box.x, box.y, w, h);
      g.fillStyle = rgb(colour);
      g.fillRect(box.x, box.y, 2, h);
      g.fillStyle = "#e0eaf3";
      g.textAlign = "left";
      textLines.forEach((line, i) => g.fillText(line, box.x + 9, box.y + 19 + i * 16, w - 18));
      if (note) {
        g.font = "10px system-ui";
        g.fillStyle = "#a7b9ca";
        g.fillText(note, box.x + 9, box.y + h - 8, w - 18);
      }
      occupiedLabels.push(box);
      textMasks.push(box);
      return box;
    }
    function drawRegionNames(items) {
      occupiedLabels = [{ x: 0, y: 0, w: width, h: 70 }];
      textMasks = [...occupiedLabels];
      for (const port of ports)
        occupiedLabels.push({ x: port.point[0] - 14, y: port.point[1] - 14, w: 28, h: 28 });
      // Territory names must not cover building markers, even on a narrow map.
      for (const item of items) {
        const points = cubePoints(item.box)
          .map((point) => project(...point))
          .filter(Boolean);
        if (!points.length) continue;
        const b = bounds(points);
        occupiedLabels.push({
          x: b.left - 12,
          y: b.top - 13,
          w: b.right - b.left + 24,
          h: b.bottom - b.top + 25,
        });
      }
      if (ancestors.length) {
        occupiedLabels.push({
          x: 10,
          y: 76,
          w: Math.min(265, width - 20),
          h: ancestors.length * 31 + 6,
        });
        occupiedLabels.push({ x: 12, y: height - 105, w: 154, h: 93 });
      }
      const ko = scene.structure.language === "ko";
      for (const region of regions) {
        const floor = bounds(
          [
            project(region.x0, region.y, region.z0),
            project(region.x1, region.y, region.z0),
            project(region.x1, region.y, region.z1),
            project(region.x0, region.y, region.z1),
          ].filter(Boolean),
        );
        if (floor.right < 0 || floor.left > width || floor.bottom < 0 || floor.top > height)
          continue;
        const p = project((region.x0 + region.x1) / 2, region.y, region.z0 + 0.4);
        if (!p) continue;
        const badge =
          region.kind === "shared-domains"
            ? ko
              ? "복수 소속"
              : "Multiple memberships"
            : region.kind === "shared"
              ? ko
                ? "공유 범위"
                : "Shared scope"
              : "";
        region.labelBox = caption(
          region.label,
          p[0],
          p[1] - 36,
          Math.min(210, width * 0.45),
          region.colour,
          {
            avoid: true,
            anchor: p,
            note: [
              badge,
              `${region.visible.length}/${region.ids.length} ${scene.layer === "contexts" ? "BC" : ko ? "항목" : "items"}`,
              region.note,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        );
      }
      if (ancestors.length) {
        let y = 78;
        for (const [i, ancestor] of ancestors.entries()) {
          const kind =
            ancestor.kind === "BoundedContext"
              ? "BC"
              : ancestor.kind === "Process"
                ? ko
                  ? "업무"
                  : "Process"
                : ko
                  ? "영역"
                  : "Domain";
          const box = caption(
            `${kind} · ${ancestor.label}`,
            12 + i * 8,
            y,
            Math.min(245, width - 28),
            ancestor.colour,
            { align: "left", limit: 1 },
          );
          y += box.h + 3;
        }
      }
    }
    function drawLocator() {
      if (!scene.structure.context) return;
      const plan = districts(scene.structure.landscape);
      const box = { x: 12, y: height - 105, w: 154, h: 93 };
      occupiedLabels.push(box);
      textMasks.push(box);
      g.fillStyle = "rgba(8,22,37,.9)";
      g.fillRect(box.x, box.y, box.w, box.h);
      g.font = "10px system-ui";
      g.textAlign = "left";
      g.fillStyle = "#acc2d2";
      g.fillText(
        scene.structure.language === "ko" ? "전체에서의 위치" : "Location in the whole",
        box.x + 9,
        box.y + 15,
      );
      const scale = Math.min((box.w - 22) / plan.width, (box.h - 34) / plan.depth);
      const origin = { x: box.x + box.w / 2, y: box.y + 25 + (box.h - 30) / 2 };
      for (const region of plan.plots) {
        g.strokeStyle = "#426077";
        g.strokeRect(
          origin.x + region.x0 * scale,
          origin.y + region.z0 * scale,
          (region.x1 - region.x0) * scale,
          (region.z1 - region.z0) * scale,
        );
      }
      for (const place of plan.positions.values()) {
        const selected = place.id === scene.structure.context;
        g.fillStyle = selected ? "#8be5d6" : "#506b7d";
        g.beginPath();
        g.arc(
          origin.x + place.x * scale,
          origin.y + place.z * scale,
          selected ? 4 : 1.6,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
    }
    function drawLabels(items, chosen) {
      const elements = new Map(
        [...labels.querySelectorAll("[data-layer-node]")].map((node) => [
          node.dataset.layerNode,
          node,
        ]),
      );
      labelIds = [];
      projected = [];
      const ordered = [...items].sort(
        (a, b) =>
          Number(b.id === chosen) - Number(a.id === chosen) ||
          project(a.x, a.h, a.z)[2] - project(b.x, b.h, b.z)[2],
      );
      for (const item of ordered) {
        const node = elements.get(item.id),
          roof = project(item.x, item.h + 0.1, item.z);
        const points = cubePoints({ ...item.box, y1: item.h + 0.1 })
          .map((p) => project(...p))
          .filter(Boolean);
        if (!node || !roof || points.length < 8) continue;
        const box = bounds(points),
          onScreen = box.right >= 0 && box.left <= width && box.bottom >= 0 && box.top <= height;
        const important = item.id === chosen;
        const detail = important || box.right - box.left > 90;
        if (onScreen) {
          g.beginPath();
          g.arc(roof[0], roof[1], important ? 12 : 10, 0, Math.PI * 2);
          g.fillStyle = important ? "#b9f0d8" : "#11283ee8";
          g.fill();
          g.strokeStyle = rgb(item.colour, 0.9);
          g.lineWidth = 1;
          g.stroke();
          g.font = "600 10px system-ui";
          g.textAlign = "center";
          g.fillStyle = important ? "#173c31" : "#eef5f8";
          g.fillText(String(item.number), roof[0], roof[1] + 3.5);
          textMasks.push({ x: roof[0] - 13, y: roof[1] - 13, w: 26, h: 26 });
        }
        g.font = "600 12px system-ui";
        const w = Math.min(205, (width - 24) / 2),
          textLines = lines(item.name, w - 18);
        const h = textLines.length * 16 + 12;
        let label = { x: clamp(roof[0] - w / 2, 8, width - w - 8), y: roof[1] - h - 18, w, h };
        const canShow = onScreen && (important || labelMode === "all" || box.right - box.left > 85);
        if (canShow && (labelMode === "all" || important)) {
          const candidates = [label];
          for (let y = 78; y + h < height - 8; y += h + 9)
            for (let x = 8; x + w <= width - 8; x += w + 10) candidates.push({ x, y, w, h });
          candidates.sort(
            (a, b) =>
              Math.hypot(a.x + w / 2 - roof[0], a.y + h - roof[1]) -
              Math.hypot(b.x + w / 2 - roof[0], b.y + h - roof[1]),
          );
          label =
            candidates.find(
              (candidate) =>
                candidate.y >= 72 && !occupiedLabels.some((other) => overlaps(candidate, other)),
            ) ?? label;
        }
        const shown =
          canShow &&
          label.y >= 72 &&
          label.y + h <= height - 8 &&
          (important ||
            labelMode === "all" ||
            !occupiedLabels.some((other) => overlaps(label, other)));
        node.dataset.cityLabel = shown ? "shown" : "hidden";
        node.dataset.cityDetail = detail ? "true" : "false";
        node.dataset.cityFocus = important ? "true" : "false";
        if (shown) {
          const labelBox = caption(item.name, label.x, label.y, w, item.colour, { align: "left" });
          labelIds.push(item.id);
          g.beginPath();
          g.moveTo(roof[0], roof[1] - 12);
          g.lineTo(
            clamp(roof[0], labelBox.x + 5, labelBox.x + labelBox.w - 5),
            labelBox.y + labelBox.h,
          );
          g.strokeStyle = rgb(item.colour, important ? 0.8 : 0.3);
          g.lineWidth = 1;
          g.stroke();
        }
        projected.push({
          id: item.id,
          kind: item.kind,
          roof: roof.slice(0, 2),
          bounds: box,
          onScreen,
          label: shown,
          detail,
          group: item.group,
        });
      }
    }

    function draw() {
      if (!active || !scene || document.hidden || !canvas.checkVisibility()) return;
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (!width || !height) return;
      const rect = canvas.getBoundingClientRect();
      inView =
        rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (flow) {
        if (flowCanvas.width !== canvas.width || flowCanvas.height !== canvas.height) {
          flowCanvas.width = canvas.width;
          flowCanvas.height = canvas.height;
        }
        flow.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
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
      const items = layout();
      const floors = [...ancestors, ...regions];
      const span =
          Math.max(
            6,
            ...floors.flatMap((floor) => [
              Math.abs(floor.x0),
              Math.abs(floor.x1),
              Math.abs(floor.z0),
              Math.abs(floor.z1),
            ]),
          ) * 1.4,
        distance = span * 1.5 + 5;
      const home = projector(0.756, (38 * Math.PI) / 180, distance);
      const points = floors
        .flatMap((floor) =>
          cubePoints({
            x0: floor.x0 - 0.3,
            x1: floor.x1 + 0.3,
            z0: floor.z0 - 0.3,
            z1: floor.z1 + 0.3,
            y0: -0.15,
            y1: floor.y + 1.65,
          }).map((p) => home.point(...p)),
        )
        .filter(Boolean);
      const b = points.length ? bounds(points) : { left: -0.2, right: 0.2, top: -0.2, bottom: 0.2 };
      const focal = Math.min(
        (width - 70) / Math.max(0.01, b.right - b.left),
        (height - 180) / Math.max(0.01, b.bottom - b.top),
      );
      const camera = scene.camera;
      const flatFit = clamp((scene.cameraWidth - 28) / scene.flatWidth, 0.45, 1);
      const flatX = (scene.cameraWidth - scene.flatWidth * flatFit) / 2;
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
      drawGround();
      geometry(items);
      // Ground plates sit below every building. Sorting a whole floor by its
      // midpoint depth would paint it over the farther buildings in a large BC.
      faces.sort((a, b) => Number(Boolean(b.plot)) - Number(Boolean(a.plot)) || b.depth - a.depth);
      for (const face of faces) drawFace(face, focusSet);
      drawConnections(items, chosen);
      drawRegionNames(items);
      drawLocator();
      drawLabels(items, chosen);
      drawPorts();
      if (motionReason() === "playing") paintFlow();
      syncMotion();
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
        else syncMotion();
      },
      motion({ enabled, reason = "paused" }) {
        motionEnabled = enabled;
        pauseReason = reason;
        syncMotion();
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
        regions: structuredClone(regions),
        ancestors: structuredClone(ancestors),
        places: structuredClone(places),
        locator: scene?.structure.context ?? null,
        labelIds: [...labelIds],
        drawn: structuredClone(projected),
        relations: [...renderedRelations],
        routes: flowPaths.map(({ from, to, kind, indexes, directed, visible }) => ({
          from,
          to,
          kind,
          indexes,
          directed,
          visible,
        })),
        ports: ports.map(({ id, point, number }) => ({ id, point: [...point], number })),
        flow: {
          reason: motionReason(),
          running: Boolean(pendingFrame),
          frames: flowFrames,
          elapsed,
          samples: structuredClone(samples),
        },
        frames,
        active,
        labels: labelMode,
        links: showLinks,
      }),
    };
  };
})();
