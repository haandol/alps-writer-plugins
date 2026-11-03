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
