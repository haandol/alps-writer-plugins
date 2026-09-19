import { writeFileSync } from "node:fs";
import path from "node:path";
import { compareRuns } from "./judge.mjs";

const escape = (value) =>
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
const code = (value) =>
  `<pre>${escape(typeof value === "string" ? value : JSON.stringify(value, null, 2))}</pre>`;
const labels = {
  PASS: "PASS",
  FAIL: "FAIL",
  UNVERIFIED: "미검증",
  ERROR: "실행 오류",
  GRADER_ERROR: "판정 오류",
  NOT_RUN: "미실행",
  UNSCORED: "실행 증거 수집 완료·미채점",
  PRESERVED: "정상 유지",
  REGRESSION: "회귀",
  IMPROVED: "개선",
  EXISTING_FAILURE: "기존 실패",
  INCONCLUSIVE: "비교 불충분",
  NO_BASELINE: "기준 버전 없음",
  SAME_SNAPSHOT: "동일 스냅샷 반복",
};

export function renderReport(report) {
  const candidate = report.runs.filter((run) => run.variant === "candidate");
  const scored = candidate.filter((run) => ["PASS", "FAIL", "UNVERIFIED"].includes(run.verdict));
  const pass = candidate.filter((run) => run.verdict === "PASS").length;
  const expected = report.cases.length * report.runsPerCase;
  const sourceNames = [
    ...new Set(report.cases.flatMap((item) => item.sources.map((source) => source.split("/")[0]))),
  ];
  const cards = report.cases
    .map((item) => {
      const runs = report.runs.filter((run) => run.caseId === item.id);
      const status = runs.some((run) => run.verdict === "FAIL")
        ? "FAIL"
        : runs.some((run) => ["ERROR", "GRADER_ERROR", "UNVERIFIED"].includes(run.verdict))
          ? "UNVERIFIED"
          : runs.some((run) => run.verdict === "PASS")
            ? "PASS"
            : "NOT_RUN";
      const body = runs
        .map((run) => {
          const baseline = runs.find((r) => r.variant === "baseline" && r.repeat === run.repeat);
          const comparison = run.variant === "candidate" ? compareRuns(baseline, run) : null;
          return `<section class="run">
<h4>${escape(run.variant)} · ${run.repeat}회차 <span class="${escape(run.verdict)}">${escape(labels[run.verdict])}</span>${comparison ? ` · ${escape(labels[comparison])}` : ""}</h4>
${run.error ? `<p class="error">${escape(run.error)}</p>` : ""}
${run.gradingNote ? `<p class="note">${escape(run.gradingNote)}</p>` : ""}
${run.originalJudgment ? `<details><summary>보관한 최초 판정 — 기대 기준 수정 전</summary>${code(run.originalJudgment)}</details>` : ""}
${run.judgeAttempts?.some((attempt) => attempt.error) ? `<details><summary>판정 출력 형식 검증과 보정 기록</summary>${code(run.judgeAttempts)}</details>` : ""}
<p class="muted">${escape(run.elapsedMs ?? 0)} ms · ${run.changes?.length ?? 0}개 파일 변경 · 모델 ${escape(run.models?.join(", ") || "미측정")}</p>
${run.judgment ? `<table><thead><tr><th>검증 의무</th><th>판정</th><th>의미와 증거</th></tr></thead><tbody>${run.judgment.obligations.map((o) => `<tr><td>${escape(o.id)}</td><td class="${escape(o.verdict)}">${escape(labels[o.verdict])}</td><td>${escape(o.reason)}${o.evidence.map((ev) => `<blockquote><small>${escape(ev.source)}</small><br>${escape(ev.quote)}</blockquote>`).join("")}</td></tr>`).join("")}</tbody></table>` : ""}
<p><a href="${escape(run.artifactDirectory)}/evidence.json">실행 증거 JSON</a> · <a href="${escape(run.artifactDirectory)}/result.json">실행 결과 JSON</a></p>
<details><summary>변경 전후 파일</summary>${(run.changes ?? []).map((change) => `<h5>${escape(change.change)} · ${escape(change.path)}</h5><div class="diff"><div><strong>변경 전</strong>${code(change.before ?? "(없음)")}</div><div><strong>변경 후</strong>${code(change.after ?? "(삭제)")}</div></div>`).join("") || "<p>파일 변경 없음</p>"}</details>
<details><summary>실행 에이전트의 최종 응답</summary>${(run.replies ?? []).map((reply, index) => `<h5>${index + 1}번째 발화 응답</h5>${code(reply)}`).join("")}</details>
</section>`;
        })
        .join("");
      return `<article data-status="${status}" id="${escape(item.id)}">
<div class="eyebrow">${escape(item.skill)} · ${escape(item.id)}</div><h3>${escape(item.title)}</h3>
<p>${escape(item.adaptation)}</p>
<details><summary>기대 동작과 참고 출처</summary><ul>${item.obligations.map((o) => `<li><strong>${escape(o.id)}</strong>: ${escape(o.text)}</li>`).join("")}</ul><h4>참고한 실제 저장소</h4><ul>${item.sources.map((s) => `<li><code>${escape(s)}</code></li>`).join("")}</ul></details>
${body || '<p class="pending">아직 LLM을 실행하지 않았습니다. fixture와 기대 동작을 준비한 상태입니다.</p>'}
</article>`;
    })
    .join("");
  const knownCost = report.runs
    .flatMap((run) => run.calls ?? [])
    .reduce((total, call) => total + (call.costUSD ?? 0), 0);
  const calibration = (report.calibration ?? [])
    .map(
      (item) => `<tr>
<td>${escape(item.title)}</td><td>${escape(item.expected)}</td><td>${escape(item.observed)}</td>
<td>${escape(item.note)} <a href="${escape(item.artifact)}">판정 증거</a></td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>ADR 프롬프트 회귀 평가 결과</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#193047;font:15px/1.8 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}main{max-width:1200px;margin:auto;padding:32px 25px 70px}header{background:#163c47;color:white;padding:36px;border-radius:16px}h1{font-size:34px;line-height:1.4;word-break:keep-all;margin:12px 0}h2{font-size:25px;margin-top:40px}h3{font-size:22px;line-height:1.5}h4{margin-top:22px}a{color:#2456a4}article,.box{background:white;border:1px solid #d8e1ec;border-radius:12px;padding:25px 28px;margin:20px 0}.eyebrow,small,.muted{font-size:12px;color:#687a8b}header .eyebrow{color:#b9d7df}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.stat{padding:18px;background:white;border:1px solid #d8e1ec;border-radius:10px}.stat strong{display:block;font-size:28px}.stat span{font-size:12px;color:#687a8b}.PASS{color:#126950}.FAIL,.REGRESSION,.error{color:#a72d3c}.UNVERIFIED,.GRADER_ERROR,.ERROR{color:#94621c}.run{border-top:1px solid #dae2ec;padding-top:8px;margin-top:22px}table{border-collapse:collapse;width:100%;font-size:13px;table-layout:fixed}th,td{border-bottom:1px solid #d8e1ec;text-align:left;vertical-align:top;padding:12px;overflow-wrap:anywhere}th{background:#edf3f8}th:first-child{width:22%}th:nth-child(2){width:13%}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#14263a;color:#e2ecf5;padding:17px;border-radius:8px;font:12px/1.7 ui-monospace,SFMono-Regular,monospace}code{font-size:.88em;overflow-wrap:anywhere}blockquote{border-left:3px solid #9cafc3;margin:12px 0;padding:8px 13px;background:#f4f7fb}.diff{display:grid;grid-template-columns:1fr 1fr;gap:14px}.diff>div{min-width:0}summary{cursor:pointer;color:#2456a4;padding:7px 0}.pending{background:#edf3f8;padding:16px;border-radius:8px}.toolbar{display:flex;gap:10px;flex-wrap:wrap}button{border:1px solid #bdcada;background:white;color:#27465d;border-radius:7px;padding:8px 13px;cursor:pointer}button[aria-pressed=true]{background:#194e60;color:white}.note{border-left:4px solid #558599;padding:14px 20px;background:#e8f1f6}ul{padding-left:22px}li{margin:8px 0}.meta{overflow-wrap:anywhere}.error{white-space:pre-wrap;overflow-wrap:anywhere}[hidden]{display:none!important}@media(max-width:700px){main{padding:15px}header,article,.box{padding:22px}.stats{grid-template-columns:1fr 1fr}h1{font-size:27px}.diff{grid-template-columns:1fr}table{font-size:12px}td,th{padding:8px}}@media print{body{background:white}main{padding:0}header{background:white;color:#193047;padding:12px 0}.toolbar{display:none}article[hidden]{display:block!important}article{break-inside:avoid}.diff{display:block}pre{background:#f1f3f6;color:#193047}details:not([open]){display:none}}
</style></head><body><main><header><div class="eyebrow">ADR-ROLLUP / ADR-SYNC · LOCAL REGRESSION REPORT</div><h1>스킬 프롬프트 회귀 평가 결과</h1><p>고정 사례의 실제 파일 변경·사용자 대화·도구 사건을 LLM이 의미 기준으로 판정합니다.</p><p class="meta">${escape(report.generatedAt)} · ${escape(report.mode)} · ${escape(sourceNames.join(" + "))} 참고</p></header>
<div class="stats"><div class="stat"><strong>${report.cases.length}</strong><span>선택한 기본 사례</span></div><div class="stat"><strong>${candidate.length}/${expected}</strong><span>후보 실행 / 요청</span></div><div class="stat"><strong>${pass}/${scored.length}</strong><span>후보 PASS / 의미 채점 완료</span></div><div class="stat"><strong>${candidate.filter((r) => ["ERROR", "GRADER_ERROR"].includes(r.verdict)).length}</strong><span>후보 실행·판정 오류</span></div></div>
<p class="note">준비만 한 사례는 미실행이며 PASS가 아닙니다. 기준 버전이 없으면 회귀를 주장하지 않습니다. FAIL→FAIL은 기존 실패, PASS→FAIL은 회귀입니다. 미검증·오류는 정상 유지로 취급하지 않습니다. LLM 판정은 관찰한 사례의 증거이며 모든 입력의 정상 동작을 보장하지 않습니다.</p>
<section class="box"><h2>실행 조건</h2><p>기준일: ${escape(report.referenceDate ?? "미기록")} · 반복 수: ${report.runsPerCase} · 동시 사례: ${report.jobs ?? 1} · 대화 방식: 매 발화의 사용자·응답·도구 사건을 재전달하는 replay · 결과 요약 tail 강제 없음</p><p>기록된 스킬 실행·재채점의 CLI 보고 비용 합계: $${knownCost.toFixed(4)}. 비용을 반환하지 않은 호출은 미측정이며 이 합계에 포함되지 않습니다. 별도 합성 반례의 채점 비용은 반례 JSON에 기록합니다.</p><p class="muted meta">데이터 ${escape(report.datasetHash)}<br>최초 판정기 ${escape(report.judgeHash)}${report.repairJudgeHash ? `<br>인용 형식 보정 판정기 ${escape(report.repairJudgeHash)}` : ""}<br>후보 지침 ${escape(report.variants.candidate?.hash)}<br>기준 지침 ${escape(report.variants.baseline?.hash ?? "없음")}</p><p><a href="results.json">전체 결과 JSON</a></p></section>
${calibration ? `<section class="box"><h2>판정기 반례 확인</h2><p>별도로 만든 합성 산출물을 채점한 결과이며, 위 스킬 실행 횟수에는 포함하지 않습니다. 판정기 자체의 독립적인 대규모 보정 결과는 아닙니다.</p><table><thead><tr><th>반례</th><th>기대</th><th>관찰</th><th>설명</th></tr></thead><tbody>${calibration}</tbody></table></section>` : ""}
<h2>기능별 결과</h2><div class="toolbar"><button data-filter="all" aria-pressed="true">전체</button><button data-filter="FAIL" aria-pressed="false">실패 포함</button><button data-filter="UNVERIFIED" aria-pressed="false">미결·오류</button><button data-filter="NOT_RUN" aria-pressed="false">미실행</button><button onclick="window.print()">인쇄 / PDF 저장</button></div>${cards}
<section class="box"><h2>이 테스트 세트의 경계</h2><p>EncBird와 Pixelbank의 계약을 참고해 축소·변형한 합성 fixture입니다. 일부 역사 문서를 다시 분리했고 명시적으로 결함을 심었습니다. 결과는 원본 저장소의 결함 판정이 아닙니다. 원본 소스나 고객 데이터·인증 정보는 실행 환경에 연결하지 않습니다.</p><p>대상 에이전트의 변경은 기록되는 fixture 도구를 통해서만 가능합니다. 원격 검사 도구는 시도만 기록하고 실제 접속하지 않습니다. native CLI 세션 재개·압축이나 모든 호스트 도구 환경까지 검증한 것은 아닙니다.</p><p>DeepEval 같은 프레임워크는 필수 의존성이 아닙니다. 고정 기준의 LLM 판정과 로컬 HTML/JSON 결과를 직접 제공합니다. 대규모 평가 운영·공유 대시보드가 필요해지면 실행 결과 형식을 유지한 채 별도 어댑터를 붙일 수 있습니다.</p></section>
</main><script>document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));document.querySelectorAll('article[data-status]').forEach(x=>x.hidden=b.dataset.filter!=='all'&&x.dataset.status!==b.dataset.filter)}));</script></body></html>`;
}

export function saveReport(directory, report) {
  writeFileSync(path.join(directory, "results.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(path.join(directory, "index.html"), renderReport(report));
}
