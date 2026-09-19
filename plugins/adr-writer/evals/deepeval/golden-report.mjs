#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cases } from "../regression/cases.mjs";
import { createWorkspace, makeTools, sha } from "../regression/workspace.mjs";
import { sourceProvenance } from "../regression/provenance.mjs";
import { SEEDED_RULE_DOCS } from "../../scripts/adr-lint-lib.mjs";
import { EVALUATION_STEPS } from "./engine.mjs";
import { calibrationCases } from "./calibration-set.mjs";
import { CASE_CODES } from "./coverage.mjs";
import { prepareCoverageVisuals } from "./coverage-render.mjs";
import { renderCoverage, coverageStyles, coverageScript } from "./coverage-html.mjs";

const PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ROOT = path.resolve(PLUGIN, "../..");
const esc = (v) =>
  String(v ?? "").replace(
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
const details = (title, text) =>
  `<details><summary>${esc(title)}</summary><pre>${esc(text)}</pre></details>`;

export function renderGoldenReport(report) {
  const totalObligations = report.cases.reduce((n, c) => n + c.obligations.length, 0);
  const tests = report.checks.reduce((n, c) => n + c.testCount, 0);
  const summary = report.cases
    .map(
      (c) =>
        `<tr><td><a href="#${esc(c.id)}">${CASE_CODES[c.id]}</a></td><td>${esc(c.title)}</td><td>${c.turns.length}</td><td>${c.obligations.length}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>보완된 ADR Golden Set</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f6fa;color:#19384e;font:16px/1.85 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}main{max-width:1240px;margin:auto;padding:28px}header,section.box,article{padding:28px 32px;background:white;border:1px solid #d6e0ea;border-radius:12px;margin:22px 0}header{background:#183e53;color:white}h1{font-size:32px}h2{font-size:25px}h3{font-size:21px}a,summary{color:#245b95}header a{color:#d2e9f7}summary{cursor:pointer;overflow-wrap:anywhere}.meta{font-size:12px;color:#62758a;overflow-wrap:anywhere}.stats,.nav{display:flex;gap:22px;flex-wrap:wrap}.stats b{display:block;font-size:26px}.note{padding:15px 20px;background:#eef4fa;border-left:4px solid #658da8}.table{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:12px;vertical-align:top;text-align:left;border-bottom:1px solid #d6e0ea}th{background:#edf3f7}pre{background:#193047;color:#e9f3fc;padding:18px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:620px;overflow:auto;font:12px/1.8 ui-monospace,monospace}code{font:12px/1.8 ui-monospace,monospace;overflow-wrap:anywhere}li{margin:12px 0}details{border:1px solid #d6e0ea;border-radius:7px;padding:12px 16px;margin:12px 0}.turns li{padding:12px;background:#f1f5f9;border-radius:6px}button{padding:9px 15px;background:white;color:#265473;border:1px solid #95aabd;border-radius:6px;cursor:pointer}${coverageStyles}
@media(max-width:700px){main{padding:14px}header,section.box,article{padding:20px}h1{font-size:27px}}@media print{body{background:white}main{padding:0}header{background:white;color:#19384e}pre{max-height:none}.nav,button{display:none}}
</style></head><body><main><header><h1>보완된 ADR golden set</h1><p>테스트용으로 작게 만든 저장소(fixture), 사용자 발화, 평가 의무를 함께 고정한 스킬 행동 평가 세트입니다. 정답을 알려주지 않는 계획 발견과 계약 보존의 세부 조건을 보강했습니다.</p><div class="stats"><div><b>${report.cases.length}</b>행동 사례</div><div><b>${totalObligations}</b>평가 의무</div><div><b>${new Set(report.checks.map((c) => c.fixtureHash)).size}</b>초기 입력 종류</div><div><b>${tests}</b>로컬 정책 테스트</div></div></header>
<nav class="nav"><a href="#changes">보완 내용</a><a href="#catalog">사례 목록</a><a href="#process-coverage">Mermaid 커버 범위</a><a href="#calibration">판정기 보정</a><a href="#sources">고정 출처</a></nav>
<section class="box" id="changes"><h2>앞선 검토의 지적을 반영한 내용</h2><div class="table"><table><thead><tr><th>지적</th><th>반영</th><th>남은 한계</th></tr></thead><tbody>
<tr><td>G1 · 승인문이 정답을 알려줌</td><td>R1·R3의 첫 계획 의무 추가. 정답 경로 없는 R5·R6, 잘못된 전체 통합 제안을 거절하는 R7 추가.</td><td>고정 대화 재전달 방식이며 실제 CLI 재개·압축 평가는 아님.</td></tr>
<tr><td>G2 · 축약 구현의 빈 곳</td><td>작업별 차감·보상 기록, 실패 후 환불 재시도, 객체·메타데이터 정리 순서와 조회 제외, 크기·미접근 경계의 실행 가능한 fixture 보강.</td><td>메모리 상태로 재현하며 실제 데이터베이스 동시성·클라우드 동작은 미검증.</td></tr>
<tr><td>G3 · 세부 보존 의무 부족</td><td>S4에 metadata·tiering·archive 의무 추가. 90일 만료, 128KB·30/90일, 재접근 복귀와 복원 대기 금지를 명시.</td><td>모든 제품·원본 ADR을 평가하는 세트는 아님.</td></tr>
<tr><td>G4 · 독립적인 판정기 보정 부족</td><td>정상 표현과 통제 반례 ${report.calibration.length}개, development/holdout 분할과 별도 GEval 실행·비교 리포트 추가. 기대 점수를 모델 입력에서 제외.</td><td><b>AI가 계약에서 도출한 기대 판정 초안. 사람 검수는 아직 완료되지 않음.</b> 원래 사례를 공유하므로 독립 제품 사례 일반화도 측정하지 않음.</td></tr>
<tr><td>G5 · 참고 원본 커밋 미고정</td><td>원본 ${sourceProvenance.snapshots.length}개 파일의 커밋·전체 파일 해시·관련 구절 고정. 각 사례와 실행 결과에 출처 포함.</td><td>이번 검토 시점에 고정한 버전이며 최초 작성 당시의 원본 커밋을 소급해 주장하지 않음.</td></tr>
</tbody></table></div>
<p class="note">이 리포트 생성은 모델을 호출하지 않습니다. ${report.checks.filter((c) => c.policy.exitCode === 0 && c.structure.exitCode === 0).length}/${report.cases.length}개 초기 fixture의 로컬 검사가 통과했습니다. 같은 초기 입력을 쓰는 사례의 테스트 중복도 포함합니다. 행동 평가 결과와 판정기 보정 결과는 별도 리포트로 확인해야 합니다.</p><p><a href="golden-set.json">입력·의무·출처·검사 원본 JSON</a></p><p class="meta">dataset ${report.datasetHash} · ${esc(report.generatedAt)}</p></section>
<section class="box" id="catalog"><h2>현재 사례 목록</h2><div class="table"><table><thead><tr><th>코드</th><th>사례</th><th>발화</th><th>의무</th></tr></thead><tbody>${summary}</tbody></table></div></section>
${renderCoverage(report)}
${report.cases
  .map(
    (
      item,
    ) => `<article id="${esc(item.id)}"><p class="meta">${CASE_CODES[item.id]} · ${esc(item.id)}</p><h2>${esc(item.title)}</h2><p>${esc(item.adaptation)}</p><h3>사용자 발화 원문</h3><ol class="turns">${item.turns.map((t) => `<li>${esc(t)}</li>`).join("")}</ol><h3>평가 의무 원문</h3><ol class="obligations">${item.obligations.map((o) => `<li><code>${esc(o.id)}</code><p>${esc(o.text)}</p></li>`).join("")}</ol>
<details><summary>초기 파일 원문 전체 (${Object.keys(item.files).length}개)</summary>${Object.entries(
      item.files,
    )
      .map(([file, text]) => details(file, text))
      .join("")}</details>
${details("expectedOutput — 고정 의무 JSON", JSON.stringify({ obligations: item.obligations }, null, 2))}
<details><summary>이 사례의 고정 출처</summary>${item.provenance.map((p) => `<p><code>${esc(p.source)}</code><br><span class="meta">${p.commit} · ${p.sha256}</span></p>`).join("")}</details></article>`,
  )
  .join("")}
<section class="box" id="calibration"><h2>판정기 보정 세트 — 사람 검수 전</h2><p>정상 기대 1, 위반 기대 0의 초안입니다. 아래 대상 의무는 각 반례의 주된 검토 지점이며 한 변경이 여러 의무에 영향을 줄 수 있습니다. 작성된 기준 행동·합성 시간 기록을 실제 에이전트의 실행 로그라고 제시하지 않습니다.</p><div class="table"><table><thead><tr><th>예시</th><th>원 사례</th><th>기대</th><th>대상 의무</th><th>분할</th></tr></thead><tbody>${report.calibration.map((e) => `<tr><td>${esc(e.id)}</td><td>${esc(CASE_CODES[e.caseId])}</td><td>${e.expectedScore}</td><td>${esc(e.targetObligation ?? "정상 표현")}</td><td>${esc(e.split)}</td></tr>`).join("")}</tbody></table></div><pre>pnpm eval:calibration --prepare
pnpm eval:calibration --live --jobs 2</pre><p>같은 기준 출력에서 실패 조건 하나를 바꾸는 반례와 정상 동의 표현을 포함합니다. 초안 일치율을 사람 정답 정확도로 표시하지 않습니다.</p></section>
<section class="box" id="sources"><h2>고정한 출처와 공통 지침</h2><p>원본 저장소가 없어도 fixture를 재생성하고 평가할 수 있습니다. 아래 커밋과 구절은 새로 고정한 출처이며, 생성 당시 원본과 현재 원본을 혼동하지 않습니다.</p>${sourceProvenance.snapshots.map((p) => `<details><summary>${esc(p.source)}</summary><p class="meta">commit ${p.commit} · SHA-256 ${p.sha256}</p>${p.excerpts.map((ex) => details(`${ex.start}–${ex.end}행`, ex.text)).join("")}</details>`).join("")}
${details("GEval 고정 평가 지시", EVALUATION_STEPS.join("\n\n"))}<details><summary>모든 fixture의 공통 ADR 규칙</summary>${Object.entries(
    report.sharedRules,
  )
    .map(([name, text]) => details(name, text))
    .join("")}</details>
<p>fixture는 작게 만든 테스트 저장소, ADR은 아키텍처 결정 기록입니다. GEval은 대규모 언어 모델(LLM)이 실제 증거를 의무와 대조하는 DeepEval 평가 방식입니다. 사례가 PASS여도 도표의 각 단계를 독립적으로 채점했다고 보지 않습니다.</p>
<button onclick="window.print()">인쇄 / PDF 저장</button></section></main><script>${coverageScript}</script></body></html>`;
}

export async function generateGoldenReport(output) {
  const directory = path.resolve(output);
  if (existsSync(directory) && readdirSync(directory).length)
    throw new Error("--out must be new or empty");
  mkdirSync(directory, { recursive: true });
  const records = cases.map(({ build, ...item }) => ({ ...item, files: build() }));
  const report = {
    generatedAt: new Date().toISOString(),
    cases: records,
    runs: [],
    datasetHash: sha(records),
    calibration: calibrationCases,
    checks: [],
    sharedRules: Object.fromEntries(
      SEEDED_RULE_DOCS.map((name) => [
        name,
        readFileSync(path.join(PLUGIN, "templates/adr", name), "utf8"),
      ]),
    ),
  };
  for (const item of cases) {
    const root = path.join(directory, "fixtures", item.id);
    createWorkspace(root, item.build(), PLUGIN);
    const tools = makeTools({
      root,
      pluginRoot: PLUGIN,
      logPath: path.join(directory, `${item.id}-checks.jsonl`),
      turn: 0,
    });
    const policy = tools.call("run_check", { kind: "policy-tests" });
    const structure = tools.call("run_check", { kind: "structure" });
    report.checks.push({
      caseId: item.id,
      fixtureHash: sha(item.build()),
      testCount: Number(policy.stdout.match(/\btests (\d+)/)?.[1] ?? 0),
      policy,
      structure,
    });
  }
  await prepareCoverageVisuals(report, directory);
  writeFileSync(path.join(directory, "golden-set.json"), JSON.stringify(report, null, 2));
  writeFileSync(path.join(directory, "index.html"), renderGoldenReport(report));
  if (report.checks.some((c) => c.policy.exitCode !== 0 || c.structure.exitCode !== 0))
    throw new Error("Golden fixture validation failed; inspect the report");
  return path.join(directory, "index.html");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--out")) {
    process.stderr.write("pnpm eval:golden [--out new-directory]\n");
    process.exitCode = 2;
  } else
    generateGoldenReport(args[1] ?? path.join(ROOT, ".codex/reports", `golden-${Date.now()}`))
      .then((file) => process.stdout.write(file + "\n"))
      .catch((error) => {
        process.stderr.write(error.message + "\n");
        process.exitCode = 2;
      });
}
