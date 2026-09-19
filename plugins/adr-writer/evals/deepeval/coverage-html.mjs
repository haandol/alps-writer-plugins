import { CASE_CODES, coverageDiagrams, coverageFor, coverageNames } from "./coverage.mjs";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

function caseSummary(report, id) {
  return ["baseline", "candidate"]
    .map((variant) => {
      const runs = report.runs.filter((run) => run.caseId === id && run.variant === variant);
      if (!runs.length) return `${variant === "baseline" ? "기준" : "후보"} 미채점`;
      const passed = runs.filter((run) => run.verdict === "PASS").length;
      return `${variant === "baseline" ? "기준" : "후보"} ${passed}/${runs.length} 충족`;
    })
    .join(" · ");
}

export function renderCoverage(report) {
  const coverage = coverageFor(report);
  const diagrams = coverageDiagrams(report);
  const figures = diagrams
    .map((diagram) => {
      const rendered = report.coverageVisuals?.find(
        (item) =>
          item.id === diagram.id && item.source === diagram.source && item.svg?.includes("<svg"),
      );
      // SVGs are embedded as images, not executable inline markup. This also
      // keeps the delivered HTML self-contained when copied away from its folder.
      const image = rendered
        ? `data:image/svg+xml;base64,${Buffer.from(rendered.svg).toString("base64")}`
        : null;
      return `<figure class="coverage-figure" id="${esc(diagram.id)}">
<h3>${esc(diagram.title)}</h3>
${image ? `<div class="diagram-controls"><button type="button" data-diagram-zoom="out">축소</button><button type="button" data-diagram-zoom="reset">기본 크기</button><button type="button" data-diagram-zoom="in">확대</button><span class="meta">가로·세로로 스크롤할 수 있습니다.</span></div><div class="diagram-viewport"><img class="coverage-svg" src="${image}" alt="${esc(diagram.title)}. 단계 코드와 연결된 eval은 아래 단계별 표에서 확인할 수 있습니다."></div>` : '<p class="note">도표가 아직 렌더링되지 않았습니다. 아래 Mermaid 원문과 단계 표를 확인하고 리포트 렌더링을 다시 실행하세요.</p>'}
<figcaption>${diagram.id === "eval-overview" ? "P 단계는 평가 실행기의 처리 흐름입니다. 스킬 자체의 평가 범위는 아래 RU·SY 단계에서 확인합니다." : "업무 흐름을 설명하는 논리적 순서입니다. 내부 추론·하위 에이전트 수·정확한 도구 호출 순서를 강제하지 않습니다."}</figcaption>
<details><summary>Mermaid 원문</summary><pre>${esc(diagram.source)}</pre></details>
</figure>`;
    })
    .join("");
  const stages = coverage.stages
    .map(
      (entry) => `<tr id="coverage-${esc(entry.id)}">
<td><b>${esc(entry.code)} · ${esc(entry.title)}</b><br><span class="coverage-badge ${esc(entry.effective)}">${esc(coverageNames[entry.effective])}</span></td>
<td>${entry.references.map((link) => `<p><a href="#${esc(link.caseId)}">${esc(link.code)}</a> · <code>${esc(link.obligations.join(", "))}</code><br><small>${esc(caseSummary(report, link.caseId))}</small></p>`).join("") || "연결된 명시적 평가 의무 없음"}</td>
<td>${esc(entry.boundary)}</td>
</tr>`,
    )
    .join("");
  const index = report.cases
    .map(
      (item) =>
        `<tr><td><a href="#${esc(item.id)}">${esc(CASE_CODES[item.id] ?? "미연결")}</a></td><td>${esc(item.title)}<br><small>${esc(item.id)}</small></td><td>${esc(caseSummary(report, item.id))}</td></tr>`,
    )
    .join("");
  return `<section class="coverage-section" id="process-coverage">
<h2>전체 프로세스와 eval 커버 범위</h2>
<p>전체 평가 흐름 1장과 스킬별 세부 흐름 2장으로 나눴습니다. 도표의 <b>R1–R4 / S1–S4</b>는 eval 사례, <b>RU / SY</b>는 업무 단계 코드입니다. 단계별 표의 사례 링크를 누르면 실제 DeepEval 결과와 증거로 이동합니다.</p>
<div class="coverage-legend"><span class="coverage-badge direct">명시 의무 연결</span><span class="coverage-badge partial">일부 조건만 평가</span><span class="coverage-badge gap">별도 eval 없음</span><span class="coverage-badge not-selected">이번 선택에 없음</span></div>
<p class="note"><b>색은 평가 설계의 범위이며 PASS/FAIL 색이 아닙니다.</b> GEval은 케이스 전체에 한 점수를 주므로, 연결된 케이스가 PASS여도 각 노드를 독립적으로 채점했다고 보지 않습니다. P 단계의 실행기 처리와 도구 단위 테스트도 스킬의 LLM 행동 커버리지와 구분합니다.</p>
<nav class="coverage-nav" aria-label="커버리지 지도 이동"><a href="#eval-overview">전체 흐름</a><a href="#rollup-process">rollup 흐름</a><a href="#sync-process">sync 흐름</a><a href="#coverage-matrix">단계별 연결표</a><a href="#case-code-index">eval 코드 색인</a></nav>
${coverage.invalid.length || coverage.unmapped.length ? `<p class="note"><b>연결 검토 필요:</b> ${esc([...coverage.invalid, ...coverage.unmapped.map((id) => `${id}: 단계 맵 미연결`)].join(" / "))}</p>` : ""}
${figures}
<h3 id="coverage-matrix">단계별 평가 의무와 남은 범위</h3>
<div class="table"><table class="coverage-matrix"><thead><tr><th>단계와 설계 범위</th><th>연결된 사례 · 의무 ID<br>아래 수치는 케이스 전체 판정</th><th>확인하는 조건과 아직 확인하지 않는 조건</th></tr></thead><tbody>${stages}</tbody></table></div>
<h3 id="case-code-index">eval 코드 색인</h3><div class="table"><table><thead><tr><th>코드</th><th>평가 사례</th><th>케이스 전체 결과</th></tr></thead><tbody>${index}</tbody></table></div>
<p class="meta">이 연결표는 리포트용 파생 정보이며 평가 기준이나 ADR의 새 원본이 아닙니다. 실제 평가 의무는 각 사례의 고정 기준이 소유합니다. 실제 클라우드 접근과 원본 EncBird·Pixelbank 앱 검증은 이 도구의 의도적 범위 밖입니다.</p>
</section>`;
}

export const coverageStyles = `
.coverage-section{background:white;border:1px solid #d6e0ed;border-radius:12px;padding:25px 28px;margin:22px 0}
.coverage-legend,.coverage-nav,.diagram-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:15px 0}
.coverage-badge{display:inline-block;font-size:12px;padding:3px 8px;border-radius:5px}
.coverage-badge.direct{background:#e7f2ff;color:#173c59}.coverage-badge.partial{background:#f0eafb;color:#4c3567}.coverage-badge.gap{background:#fff2dc;color:#705018}.coverage-badge.not-selected{background:#f1f3f6;color:#657183}.coverage-badge.mapping-error{background:#ffedf0;color:#7c2d3c}
.coverage-figure{border:1px solid #d6e0ed;border-radius:10px;margin:25px 0;padding:19px}
.coverage-figure h3{margin:0 0 12px}.coverage-figure figcaption{font-size:13px;color:#607387;margin:12px 0}
.diagram-viewport{overflow:auto;max-height:1000px;background:#fbfcfe;border:1px solid #e3e9f0;border-radius:8px;padding:12px}
.coverage-svg{display:block;width:100%;min-width:850px;height:auto;max-width:none}
.coverage-matrix th:nth-child(1){width:29%}.coverage-matrix th:nth-child(2){width:30%}.coverage-matrix td{min-width:190px}.coverage-matrix p{margin:0 0 10px}
.coverage-nav a{font-size:13px}.coverage-section code{font-size:12px}
@media(max-width:700px){.coverage-section{padding:18px}.coverage-figure{padding:12px}.diagram-viewport{max-height:700px}.coverage-svg{min-width:800px}}
@media print{.coverage-section{border:0;padding:0}.diagram-controls,.coverage-nav{display:none}.diagram-viewport{max-height:none;overflow:visible;border:0;padding:0}.coverage-svg{width:100%!important;min-width:0;max-width:100%}.coverage-figure{break-inside:avoid}.coverage-matrix td{min-width:0}.coverage-matrix{font-size:9px}}
`;

export const coverageScript = `
document.querySelectorAll('[data-diagram-zoom]').forEach(button=>{
  button.addEventListener('click',()=>{
    const figure=button.closest('.coverage-figure');
    const image=figure.querySelector('.coverage-svg');
    let zoom=Number(figure.dataset.zoom||1);
    zoom=button.dataset.diagramZoom==='reset'?1:Math.max(.75,Math.min(2.5,zoom+(button.dataset.diagramZoom==='in'?.25:-.25)));
    figure.dataset.zoom=String(zoom);
    image.style.width=(zoom*100)+'%';
    image.style.minWidth=(850*zoom)+'px';
  });
});
`;
