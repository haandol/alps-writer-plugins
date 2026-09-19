import { writeFileSync } from "node:fs";
import path from "node:path";
import { CASE_CODES } from "./coverage.mjs";
import { renderCoverage, coverageStyles, coverageScript } from "./coverage-html.mjs";

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
const labels = {
  PASS: "충족",
  NOT_PROVEN: "미충족·미검증",
  ERROR: "평가 오류",
  NOT_EVALUABLE: "실행 증거 부족",
  NOT_RUN: "미채점",
  PRESERVED: "충족 유지",
  REGRESSION_SIGNAL: "회귀 의심",
  IMPROVEMENT_OBSERVED: "개선 관찰",
  BOTH_NOT_PROVEN: "양쪽 미충족·미검증",
  INCONCLUSIVE: "비교 불충분",
  NO_BASELINE: "기준 버전 없음",
  SAME_SNAPSHOT: "동일 스냅샷 반복",
};

export function compareDeepEval(before, after) {
  if (!before) return "NO_BASELINE";
  if (![before?.verdict, after?.verdict].every((v) => ["PASS", "NOT_PROVEN"].includes(v)))
    return "INCONCLUSIVE";
  if (
    !before.models?.length ||
    !after.models?.length ||
    JSON.stringify([...before.models].sort()) !== JSON.stringify([...after.models].sort())
  )
    return "INCONCLUSIVE";
  if (
    !before.targetModels?.length ||
    !after.targetModels?.length ||
    JSON.stringify([...before.targetModels].sort()) !==
      JSON.stringify([...after.targetModels].sort())
  )
    return "INCONCLUSIVE";
  if (
    !before.referenceDate ||
    before.referenceDate !== after.referenceDate ||
    !before.pluginHash ||
    !after.pluginHash
  )
    return "INCONCLUSIVE";
  if (before.pluginHash === after.pluginHash) return "SAME_SNAPSHOT";
  if (before.verdict === "PASS" && after.verdict === "NOT_PROVEN") return "REGRESSION_SIGNAL";
  if (before.verdict === "NOT_PROVEN" && after.verdict === "PASS") return "IMPROVEMENT_OBSERVED";
  return after.verdict === "PASS" ? "PRESERVED" : "BOTH_NOT_PROVEN";
}

export function renderDeepEvalReport(report) {
  const settings = report.evaluationSettings ?? {};
  const bedrock = settings.judgeProvider === "bedrock";
  const judgeDescription = bedrock
    ? `Bedrock Converse · 모델 ${settings.judgeModel} · AWS 프로필 ${settings.awsProfile} · 리전 ${settings.awsRegion}`
    : "Claude Code 어댑터 · 기존 제공자 설정";
  const unpricedCalls = report.runs
    .flatMap((run) => run.calls ?? [])
    .filter((call) => call.costUSD == null).length;
  const candidate = report.runs.filter((r) => r.variant === "candidate");
  const before = report.runs.filter((r) => r.variant === "baseline");
  const count = (runs) => runs.filter((r) => r.verdict === "PASS").length;
  const cost =
    report.runs.flatMap((r) => r.calls ?? []).reduce((sum, call) => sum + (call.costUSD ?? 0), 0) +
    (report.controls ?? []).reduce((sum, control) => sum + (control.costUSD ?? 0), 0);
  const cards = report.cases
    .map((item) => {
      const runs = report.runs.filter((r) => r.caseId === item.id);
      return `<article id="${esc(item.id)}"><small>${esc(CASE_CODES[item.id] ?? "미연결")} · ${esc(item.skill)} · ${esc(item.id)}</small><h3>${esc(item.title)}</h3><p>${esc(item.adaptation)}</p>
<details><summary>고정 평가 기준과 참고 출처</summary><ul>${item.obligations.map((o) => `<li><b>${esc(o.id)}</b>: ${esc(o.text)}</li>`).join("")}</ul><ul>${item.sources.map((s) => `<li><code>${esc(s)}</code></li>`).join("")}</ul></details>
${
  runs
    .map((run) => {
      const metric = run.testResult?.metricsData?.[0];
      const baseline = runs.find((r) => r.variant === "baseline" && r.repeat === run.repeat);
      const comparison = run.variant === "candidate" ? compareDeepEval(baseline, run) : null;
      return `<section class="run"><h4>${esc(run.variant)} · ${run.repeat}회 · <span class="${esc(run.verdict)}">${esc(labels[run.verdict])}</span>${comparison ? ` · ${esc(labels[comparison])}` : ""}</h4>
<p><b>GEval 점수:</b> ${metric?.score ?? "없음"} / 1 · 기준 ${metric?.threshold ?? 1} · strict mode</p>
${metric?.reason ? `<p class="reason">${esc(metric.reason)}</p>` : ""}
${run.error || metric?.error ? `<pre>${esc(run.error ?? metric.error)}</pre>` : ""}
<p class="meta">판정 모델: ${esc(run.models?.join(", ") || "미측정")} · ${run.elapsedMs ?? 0} ms</p>
<p><a href="${esc(run.artifactDirectory)}/evidence.json">실제 스킬 실행 증거</a> · <a href="${esc(run.artifactDirectory)}/deepeval-result.json">DeepEval 원본 결과</a></p></section>`;
    })
    .join("") || "<p>미채점</p>"
}</article>`;
    })
    .join("");
  const comparisons = report.cases.flatMap((item) =>
    Array.from({ length: report.runsPerCase }, (_, index) => {
      const a = report.runs.find(
        (r) => r.caseId === item.id && r.variant === "baseline" && r.repeat === index + 1,
      );
      const b = report.runs.find(
        (r) => r.caseId === item.id && r.variant === "candidate" && r.repeat === index + 1,
      );
      return { item, a, b, result: b ? compareDeepEval(a, b) : "INCONCLUSIVE" };
    }),
  );
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>DeepEval · ADR 프롬프트 회귀 결과</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#183046;font:15px/1.85 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}main{max-width:1240px;margin:auto;padding:30px 25px 70px}header{background:#193b50;color:white;padding:36px;border-radius:16px}h1{font-size:34px;line-height:1.4;word-break:keep-all}h2{margin-top:38px}h3{font-size:22px;line-height:1.5}small,.meta{font-size:12px;color:#607387;overflow-wrap:anywhere}header small{color:#bfd7e2}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.stat{background:white;border:1px solid #d6e0ed;padding:20px;border-radius:10px}.stat strong{display:block;font-size:28px}.stat span{font-size:12px}.box,article{border:1px solid #d6e0ed;border-radius:12px;padding:25px 28px;margin:22px 0;background:white}.note{padding:18px 23px;border-left:4px solid #497d9c;background:#e7f0f8}.run{border-top:1px solid #d6e0ed;margin-top:18px;padding-top:10px}.reason{white-space:pre-wrap}.PASS{color:#176747}.NOT_PROVEN,.ERROR,.NOT_EVALUABLE{color:#a12d3c}.table{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}td,th{text-align:left;vertical-align:top;border-bottom:1px solid #d6e0ed;padding:13px}th{background:#eaf0f7}td:first-child{min-width:250px}a,summary{color:#2655a3}summary{cursor:pointer}code,pre{font-family:ui-monospace,SFMono-Regular,monospace}code{font-size:.88em;overflow-wrap:anywhere}pre{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;background:#17283e;color:#e4eef9;padding:18px;border-radius:8px}li{margin:8px 0}button{padding:8px 14px;border:1px solid #9bb1c7;border-radius:7px;background:white;color:#25445a;cursor:pointer}footer{margin-top:35px;font-size:12px;color:#607387}@media(max-width:700px){main{padding:15px}header,.box,article{padding:22px}h1{font-size:27px}.stats{grid-template-columns:1fr 1fr}.stat{padding:16px}}@media print{body{background:white}header{background:white;color:#183046}main{padding:0}.table{overflow:visible}td:first-child{min-width:0}table{font-size:10px}button{display:none}details:not([open]){display:none}article{break-inside:avoid}}
${coverageStyles}
</style></head><body><main><header><small>DEEPEVAL ${esc(report.frameworkVersion)} · GEVAL · LOCAL REPORT</small><h1>ADR 프롬프트 회귀 평가<br>DeepEval 판정 결과</h1><p>DeepEval의 GEval이 실제 실행 증거를 고정 기준으로 판정했습니다. 기존 자체 판정 점수는 입력으로 사용하지 않았습니다.</p><p>${esc(report.baselineLabel ?? "기준 없음")} → ${esc(report.candidateLabel ?? "현재 스냅샷")} · 기준일 ${esc(report.referenceDate)} · ${esc(report.generatedAt)}</p></header>
<div class="stats"><div class="stat"><strong>${report.cases.length}</strong><span>고정 사례</span></div><div class="stat"><strong>${count(before)}/${before.length}</strong><span>기준 버전 GEval 충족</span></div><div class="stat"><strong>${count(candidate)}/${candidate.length}</strong><span>후보 버전 GEval 충족</span></div><div class="stat"><strong>${report.runs.filter((r) => ["ERROR", "NOT_EVALUABLE"].includes(r.verdict)).length}</strong><span>오류·증거 부족</span></div></div>
<p class="note">strict GEval은 모든 의무가 증명되면 1, 하나라도 미충족 또는 근거 부족이면 0입니다. 점수 0을 곧바로 실제 기능 위반으로 단정하지 않고 이유를 함께 확인합니다. 동일 사례를 버전별 ${report.runsPerCase}회 평가한 관찰이며 인과관계나 모든 입력의 정상 동작을 보장하지 않습니다.</p>
${report.comparisonNote ? `<section class="box"><h2>비교한 변경</h2><p>${esc(report.comparisonNote)}</p></section>` : ""}
${renderCoverage(report)}
<section class="box"><h2>평가 구성</h2><ul><li>스킬 실행·파일·도구 기록 수집: 격리된 기존 실행 어댑터.</li><li>평가 프롬프트·점수·기준 판정: 실제 <code>deepeval.GEval</code>와 <code>evaluate()</code>.</li><li>LLM 연결: <code>DeepEvalBaseLLM</code> · ${esc(judgeDescription)}.</li>${bedrock ? "<li>Bedrock에 JSON 형식을 지시하고 반환값을 스키마로 검증합니다. 네이티브 강제 출력 기능을 사용했다고 가정하지 않습니다.</li>" : ""}<li>이 리포트는 ${report.reusedEvidence ? "이미 수집된 실행 증거를 재사용해 두 버전을 모두 DeepEval로 새로 채점" : "새로 수집한 실행 증거를 DeepEval로 채점"}했습니다.</li><li>Confident AI 업로드·자동 dotenv 로드·텔레메트리·추적 전송을 비활성화했습니다. LLM 판정 호출은 설정된 제공자로 전송됩니다.</li></ul><p>DeepEval 채점 호출 중 금액이 보고된 합계: $${cost.toFixed(4)}. 금액 미측정 호출 ${unpricedCalls}건은 합계에 포함하지 않습니다. Bedrock 응답은 토큰 사용량만 기록하며 금액 0을 뜻하지 않습니다. 대상 스킬 실행 비용도 제외합니다.</p><p><a href="deepeval-results.json">DeepEval 전체 원본 JSON</a> · <a href="results.json">사례·버전별 결과 JSON</a> · <button onclick="window.print()">인쇄 / PDF 저장</button></p></section>
<h2>버전별 비교</h2><div class="table box"><table><thead><tr><th>사례</th><th>기준</th><th>후보</th><th>해석</th><th>근거</th></tr></thead><tbody>${comparisons.map(({ item, a, b, result }) => `<tr><td>${esc(item.title)}</td><td>${esc(labels[a?.verdict] ?? "미채점")}</td><td>${esc(labels[b?.verdict] ?? "미채점")}</td><td>${esc(labels[result])}</td><td><a href="#${esc(item.id)}">상세</a></td></tr>`).join("")}</tbody></table></div>
${report.controls?.length ? `<section class="box"><h2>판정기 대조 사례</h2>${report.controls.map((control) => `<p>${esc(control.title)} · 기대 ${control.expectedScore} · 관찰 ${control.score} · <a href="${esc(control.artifact)}">원본 결과</a></p>`).join("")}<p>합성 반례를 따로 채점한 확인이며 위 버전 비교 횟수에는 포함하지 않습니다.</p></section>` : ""}
<h2>사례별 DeepEval 이유와 증거</h2>${cards}
<footer>EncBird·Pixelbank를 참고해 축소한 합성 fixture입니다. 원본 앱이나 운영 환경을 평가·변경한 결과가 아닙니다. 점수와 이유의 프레임워크 판정은 실제 증거와 함께 검토해야 합니다.</footer></main><script>${coverageScript}</script></body></html>`;
}

export function saveDeepEvalReport(directory, report) {
  writeFileSync(path.join(directory, "results.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(
    path.join(directory, "deepeval-results.json"),
    JSON.stringify(
      {
        framework: "deepeval",
        version: report.frameworkVersion,
        testResults: report.runs.flatMap((run) => run.frameworkResult?.testResults ?? []),
        confidentLink: null,
        testRunId: null,
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(path.join(directory, "index.html"), renderDeepEvalReport(report));
}
