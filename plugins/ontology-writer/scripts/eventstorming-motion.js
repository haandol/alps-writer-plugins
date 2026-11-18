/**
 * Explain recorded directions with a visible, screen-sized trail. No model data
 * or camera is advanced. Reduced motion needs an explicit play; hidden views stop.
 */
const createEventSignals = (
  host,
  viewport,
  svg,
  { selector, scale = () => 1, owner = host } = {},
) => {
  const ko = document.documentElement.lang === "ko";
  const button = host.querySelector(".event-flow-toggle");
  const status = host.querySelector(".event-flow-status");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let enabled = !reduced.matches,
    pauseReason = reduced.matches ? "reduced" : null,
    inView = false,
    raf = 0,
    elapsed = 0,
    last = null,
    frames = 0,
    signals = [];
  const reason = () =>
    !signals.length
      ? "empty"
      : !enabled
        ? pauseReason
        : document.hidden || !viewport.checkVisibility()
          ? "hidden"
          : !inView
            ? "offscreen"
            : "playing";
  const running = () => reason() === "playing";
  const progress = (i) => (elapsed / 5200 + i * 0.37) % 1;
  const messages = ko
    ? {
        playing: "방향 흐름 재생 중 · 설명용",
        paused: "사용자가 흐름 효과를 멈췄습니다",
        reduced: "기기의 모션 감소 설정으로 정지 · 원하면 흐름 효과를 켤 수 있습니다",
        hidden: "보이지 않는 화면에서 일시 정지",
        offscreen: "캔버스가 화면 밖에 있어 일시 정지",
        empty: "재생할 사건 반응 연결이 없습니다 · 진행 순서는 정적인 선으로 표시합니다",
      }
    : {
        playing: "Direction flow playing · explanatory",
        paused: "Flow paused by you",
        reduced: "Paused for reduced motion · you can choose to play",
        hidden: "Paused while this view is hidden",
        offscreen: "Paused while the canvas is offscreen",
        empty: "No event reaction to animate · action order remains static",
      };
  function size() {
    for (const signal of signals) {
      const length = signal.getTotalLength() * scale();
      // Preserve a readable tail after zoom without filling most of a short link.
      const tail = Math.min(0.32, Math.max(0.012, 18 / Math.max(length, 1)));
      signal.style.strokeDasharray = `${tail} ${1 - tail}`;
      signal.dataset.trailPixels = String(tail * length);
    }
  }
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
    signals = [...svg.querySelectorAll(selector)];
    size();
    const state = reason();
    button.disabled = signals.length === 0;
    button.setAttribute("aria-pressed", String(enabled));
    button.textContent = !signals.length
      ? ko
        ? "재생할 연결 없음"
        : "No reactions"
      : ko
        ? enabled
          ? "흐름 효과 멈추기"
          : "흐름 효과 켜기"
        : enabled
          ? "Pause flow"
          : "Play flow";
    if (status.dataset.flowState !== state) {
      status.dataset.flowState = state;
      status.textContent = messages[state];
    }
    signals.forEach((signal, i) => {
      signal.style.visibility = running() ? "visible" : "hidden";
      signal.style.strokeDashoffset = String(-progress(i));
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
    owner.dispatchEvent(
      new CustomEvent("eventstorming-motion", { detail: { enabled: !enabled, reason: "paused" } }),
    );
  });
  owner.addEventListener("eventstorming-motion", (event) => {
    enabled = event.detail.enabled;
    pauseReason = enabled ? null : event.detail.reason;
    refresh();
  });
  reduced.addEventListener("change", (event) => {
    if (event.matches)
      owner.dispatchEvent(
        new CustomEvent("eventstorming-motion", { detail: { enabled: false, reason: "reduced" } }),
      );
    else refresh();
  });
  document.addEventListener("visibilitychange", refresh);
  document.addEventListener("ontology-view-change", refresh);
  owner.addEventListener("eventstorming-perspective", refresh);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    refresh();
  }).observe(viewport);
  return {
    refresh,
    size,
    state: () => ({
      enabled,
      running: running(),
      reason: reason(),
      elapsed,
      frames,
      paths: signals.map((p, i) => ({ from: p.dataset.from, to: p.dataset.to, t: progress(i) })),
    }),
  };
};

/**
 * Pan and zoom a board canvas the same way everywhere: the camera buttons named by the
 * `button` attribute (`in`, `out`, `fit`), pointer drag, wheel, + - 0 and the arrow keys
 * on the canvas, Escape to close an open inspector, and a focused card panned into view.
 * A drag sets `gesture.moved`, so the caller's click handler can tell it from a selection.
 */
const attachCanvasCamera = (
  host,
  viewport,
  { camera, button, zoom, fit, paint, inspector, close },
) => {
  const gesture = { drag: null, moved: false };
  host.querySelectorAll(`[${button}]`).forEach((control) =>
    control.addEventListener("click", () => {
      const action = control.getAttribute(button);
      if (action === "fit") fit();
      else zoom(action === "in" ? 1.2 : 1 / 1.2);
    }),
  );
  viewport.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("summary, a")) return;
    gesture.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y };
    gesture.moved = false;
  });
  viewport.addEventListener("pointermove", (e) => {
    const drag = gesture.drag;
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
    gesture.moved = true;
    viewport.dataset.dragging = "true";
    viewport.setPointerCapture(e.pointerId);
    camera.x = drag.cx + dx;
    camera.y = drag.cy + dy;
    e.preventDefault();
    paint();
  });
  const end = (e) => {
    if (gesture.drag?.id !== e.pointerId) return;
    gesture.drag = null;
    delete viewport.dataset.dragging;
    if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
  };
  viewport.addEventListener("pointerup", end);
  viewport.addEventListener("pointercancel", (e) => {
    end(e);
    gesture.moved = false;
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
  // Tab focus keeps a card reachable after panning without selecting or mutating it.
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
  return gesture;
};
