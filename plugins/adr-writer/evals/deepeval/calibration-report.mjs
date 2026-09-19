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

export function renderCalibrationReport(report) {
  const s = report.summary;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>DeepEval 판정기 보정 세트</title><style>
*{box-sizing:border-box}body{font:16px/1.8 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif;background:#f3f6fa;color:#19384c;margin:0}main{max-width:1180px;padding:28px;margin:auto}header,section{background:white;padding:28px;border:1px solid #d9e2eb;border-radius:12px;margin:20px 0}h1{font-size:32px}h2{font-size:24px}h3{font-size:20px}a{color:#245b9d}.note{border-left:4px solid #bc8b3c;padding:16px;background:#fff6e6}.stats{display:flex;gap:20px;flex-wrap:wrap}.stats b{font-size:25px;display:block}.meta{color:#607385;font-size:12px;overflow-wrap:anywhere}pre{background:#172d40;color:#edf4fb;padding:18px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}details{margin:12px 0}summary{cursor:pointer;overflow-wrap:anywhere}.diagram{overflow:auto}img{width:100%;min-width:700px}.bad{color:#a43b32}.good{color:#206246}li{margin:10px 0}@media(max-width:700px){main{padding:14px}header,section{padding:20px}h1{font-size:26px}}@media print{body{background:white}main{padding:0}.diagram{overflow:visible}img{min-width:0}}
</style></head><body><main><header><h1>DeepEval 판정기 보정 세트</h1><p>고정된 정상 산출물과 통제된 반례를 GEval에 주고 기대 판정과 비교합니다. GEval은 언어 모델이 증거를 평가 의무와 대조하는 DeepEval 평가 방식입니다. 스킬을 새로 실행한 결과나 프롬프트 회귀 성공률과 구분합니다.</p>
<p class="note"><b>기대 판정은 계약을 근거로 AI가 작성한 초안입니다. 사람이 검수한 라벨이 아닙니다.</b> 여기의 일치율을 사람 정답에 대한 정확도로 해석하지 않습니다. development와 holdout은 출력 예시의 분할이며 독립적인 제품 사례 분할은 아닙니다.</p>
<div class="stats"><div><b>${s.matched}/${s.scored}</b>초안 기대 판정과 일치</div><div><b>${s.falseAcceptances}</b>반례 오통과</div><div><b>${s.falseRejections}</b>정상 예 오거절</div><div><b>${s.errors}</b>평가 오류</div><div><b>${s.humanReviewed}/${s.requested}</b>사람 검수 라벨</div></div>
<p>미채점 ${s.notRun}건 · 요청 ${s.requested}건 · 모델 ${esc(report.judge.model)} · AWS ${esc(report.judge.profile)} / ${esc(report.judge.region)}</p>
<p><a href="results.json">전체 입력 정의·판정 결과 JSON</a></p><p class="meta">dataset ${report.datasetHash} · rubric ${report.rubricHash} · ${esc(report.generatedAt)}</p></header>
<section><h2>판정기 검증 흐름</h2><div class="diagram"><img alt="기준 산출물과 반례를 라벨 없이 판정기에 보내고 기대 판정과 비교하는 흐름" src="data:image/svg+xml;base64,${Buffer.from(report.diagram.svg).toString("base64")}"></div><details><summary>Mermaid 원문</summary><pre>${esc(report.diagram.source)}</pre></details>
<p>각 반례는 한 가지 변경을 중심으로 작성했습니다. 같은 변경이 여러 의무에 영향을 줄 수 있어 아래에는 주된 대상 의무를 표시합니다. <code>early-write</code>의 시간 정보는 승인 전 쓰기를 재현하도록 바꾼 합성 기록입니다. 실제 에이전트 로그로 제시하지 않습니다.</p></section>
${report.runs
  .map((run) => {
    const definition = report.definitions.find((d) => d.entry.id === run.id);
    const metric = run.testResult?.metricsData?.[0];
    const observed = run.actualScore ?? run.verdict;
    const match =
      run.actualScore === run.expectedScore && ["PASS", "NOT_PROVEN"].includes(run.verdict);
    return `<section><p class="meta">${esc(run.caseId)} · ${esc(run.split)} · 반복 ${run.repeat}</p><h2>${esc(run.id)}</h2><p class="${match ? "good" : "bad"}">기대 ${run.expectedScore} / 관찰 ${esc(observed)} · ${run.verdict === "NOT_RUN" ? "미채점" : match ? "초안과 일치" : "이유 검토 필요"}</p><p>주된 대상 의무: ${esc(run.targetObligation ?? "정상 예: 모든 의무")} · 라벨 상태: 사람 검수 전</p>
${metric?.reason ? `<p>${esc(metric.reason)}</p>` : ""}${run.error ? `<pre>${esc(run.error)}</pre>` : ""}
<details><summary>기대 판정의 기준 — 원래 사례의 의무</summary><ul>${definition.obligations.map((o) => `<li><b>${esc(o.id)}</b>: ${esc(o.text)}</li>`).join("")}</ul></details>
<p><a href="${esc(run.artifactDirectory)}/evidence.json">작성된 기준·반례 증거 전체</a> · <a href="${esc(run.artifactDirectory)}/test-case.json">실제 GEval 입력</a>${run.verdict !== "NOT_RUN" ? ` · <a href="${esc(run.artifactDirectory)}/deepeval-result-${run.repeat}.json">DeepEval 원본</a>` : ""}</p>
<p class="meta">원본 fixture ${definition.fixtureHash} · 의무 ${definition.obligationHash}</p></section>`;
  })
  .join("")}
</main></body></html>`;
}
