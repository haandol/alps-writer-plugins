import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORT = path.join(HERE, "../scripts/adr-impl-review-report.mjs");

function render(data) {
  return spawnSync(process.execPath, [REPORT, "-", "--stdout"], {
    input: JSON.stringify(data),
    encoding: "utf8",
  });
}

test("the page leads with the document title and summary while paths stay in review details", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "adr-review-title-"));
  try {
    const adr = path.join(dir, "0001-example.md");
    writeFileSync(adr, "```md\n# Example inside code\n```\n# ADR 0001: 읽기 쉬운 구현 검토\n");
    const result = render({
      adr,
      verdict: "PASS",
      language: "ko",
      atAGlance: {
        impact: "동작을 확인했다.",
        action: "다음 변경을 진행한다.",
        risk: "남은 한계가 없다.",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /<h1 class="doc__title">읽기 쉬운 구현 검토<\/h1>/);
    assert.doesNotMatch(result.stdout, /<h1[^>]*>Example inside code/);
    const details = result.stdout.match(/<details class="review-meta">([^]*?)<\/details>/)?.[1];
    assert.ok(details.includes(adr));
    assert.ok(
      result.stdout.indexOf('<h1 class="doc__title">') < result.stdout.indexOf('id="overview"'),
    );
    assert.ok(result.stdout.indexOf('id="overview"') < result.stdout.indexOf('<nav class="toc"'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an authored headline is escaped and the exported design needs no external stylesheet", () => {
  const result = render({
    adr: "missing.md",
    title: '<img src=x onerror="alert(1)">',
    verdict: "PASS",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /<h1 class="doc__title">&lt;img/);
  assert.doesNotMatch(result.stdout, /<img src=x/);
  assert.match(result.stdout, /<style>[^]*--paper:/);
  assert.doesNotMatch(result.stdout, /<link[^>]*rel=["']stylesheet/);
});

test("comprehension is a visible main section directly after the conclusion and before evidence", () => {
  const result = render({
    adr: "example.md",
    language: "ko",
    verdict: "PASS",
    contractCoverage: [{ contractId: "D0", requirement: "Keep the result.", status: "PROVEN" }],
    comprehensionCheck: {
      prGuidance: "코드 판정과 이해도 확인은 별개입니다.",
      questions: [
        {
          id: "Q1",
          question: "어떤 결과가 계약을 지키나요?",
          revisit: true,
          options: ["A", "B", "C", "D"].map((id) => ({
            id,
            text: `선택 ${id}`,
            feedback: `근거 ${id}`,
          })),
          correctOptionId: "B",
          explanation: "정답의 숨긴 근거.",
          evidence: "숨긴 테스트 근거.",
        },
      ],
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /<section class="paper-section" id="comprehension">\s*<h2 class="section-title">이해도 확인<\/h2>/,
  );
  assert.doesNotMatch(result.stdout, /<details[^>]*id="comprehension"/);
  const conclusion = result.stdout.indexOf('<section id="conclusion">');
  const quiz = result.stdout.indexOf('id="comprehension"');
  const evidence = result.stdout.indexOf('id="evidence"');
  assert.ok(conclusion < quiz && quiz < evidence);
  assert.match(result.stdout, /class="quiz__options"[^>]*hidden/);
  assert.doesNotMatch(result.stdout, /정답의 숨긴 근거\./);
});

test("file rendering rejects a PASS report with no junior-readable narrative", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "adr-review-report-narrative-"));
  try {
    const input = path.join(dir, "findings.json");
    writeFileSync(input, JSON.stringify({ adr: "docs/adr/test.md", verdict: "PASS" }));
    const result = spawnSync(
      process.execPath,
      [REPORT, input, "--out", path.join(dir, "report.html")],
      {
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 2);
    assert.match(result.stderr, /validated report narrative is required/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("inline findings JSON cannot terminate the report script element", () => {
  const payload = "</script><script>globalThis.__injected = true</script>";
  const result = render({
    adr: payload,
    verdict: "PASS",
    findings: [{ id: "f1", category: "Refactor", summary: payload }],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /<\/script><script>globalThis\.__injected/);
  assert.match(result.stdout, /&lt;\/script&gt;&lt;script&gt;/);
  assert.equal((result.stdout.match(/<script>/g) ?? []).length, 1);
});

test("standard reviews render the same standalone HTML with separate implementation and change scopes", () => {
  const result = render({
    reviewMode: "standard",
    adr: "docs/adr/parser/0001.md",
    status: "Accepted (2026-09-03)",
    verdict: "PASS",
    scope: ["src/parser.mjs", "test/parser.test.mjs"],
    changeScope: [],
    findings: [],
    contractCoverage: [
      {
        contractId: "D0",
        requirement: "Parser compatibility",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "the parser keeps the accepted input and output behavior",
        evidence: "src/parser.mjs",
        tests: "node --test test/parser.test.mjs — PASS",
      },
    ],
    implementationChoices: [],
    comprehensionCheck: {
      prGuidance: "Do not open or send the PR until the question passes.",
      questions: [
        {
          id: "Q1",
          question: "Which behavior preserves parser compatibility?",
          options: [
            { id: "A", text: "Change the output", feedback: "That breaks compatibility." },
            {
              id: "B",
              text: "Keep inputs and outputs stable",
              feedback: "This preserves compatibility.",
            },
            { id: "C", text: "Remove validation", feedback: "Validation remains required." },
            {
              id: "D",
              text: "Require caller migration",
              feedback: "Callers must remain compatible.",
            },
          ],
          revisit: true,
          correctOptionId: "B",
          explanation: "Accepted inputs and outputs remain stable.",
          evidence: "parser compatibility tests",
        },
      ],
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Review mode · <code>standard<\/code>/);
  assert.match(result.stdout, /Complete implementation scope ·/);
  assert.match(result.stdout, /src\/parser\.mjs/);
  assert.match(result.stdout, /test\/parser\.test\.mjs/);
  assert.match(result.stdout, /Change scope · none/);
});

test("review notes appear as prose in the limitations section", () => {
  const result = render({
    language: "ko",
    adr: "docs/adr/test.md",
    verdict: "PASS",
    notes: "검토 범위에서 발견된 제한 사항입니다.",
    findings: [],
    contractCoverage: [],
    implementationChoices: [],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /검토 범위에서 발견된 제한 사항입니다/);
  assert.match(result.stdout, /결과 해석, 한계와 향후 보완/);
  assert.doesNotMatch(result.stdout, /class="section-disclosure__body notes"/);
});

test("related ADR comparisons render as context prose instead of a table or dashboard", () => {
  const result = render({
    language: "ko",
    adr: "docs/adr/review/0001.md",
    verdict: "PASS",
    findings: [],
    contractCoverage: [],
    implementationChoices: [],
    reviewHike: {
      context: {
        intent: "새 검토 흐름을 이해한다.",
        preconditions: "기존 결정 표현 ADR이 존재한다.",
        contracts: "비교는 ADR 해상도만 사용한다.",
        scopeAndRisk: "잘못된 유사성은 제외한다.",
      },
      hills: [],
    },
    relatedAdrComparisons: [
      {
        adr: "docs/adr/authoring/0001.md",
        title: "결정 표현",
        similarity: "두 결정 모두 독자의 재구성 비용을 줄인다.",
        difference: "기존 ADR은 문서 변경을, 이번 ADR은 구현 검토를 다룬다.",
        reviewImpact: "표현 원칙은 재사용하되 검증 증거는 별도로 확인한다.",
        evidence: "두 ADR의 Decision과 requirement contract",
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /class="adr-comparison"/);
  assert.match(result.stdout, /결정 표현/);
  assert.match(result.stdout, /두 결정 모두 독자의 재구성 비용을 줄인다/);
  assert.match(result.stdout, /와 비교하면/);
  assert.match(result.stdout, /반면/);
  assert.match(result.stdout, /따라서/);
  assert.match(result.stdout, /검증 증거는 별도로 확인한다/);
  assert.doesNotMatch(result.stdout, /provides the closest comparison|However,|Therefore,/);
  assert.doesNotMatch(result.stdout, /<table[^>]*class="adr-comparison/);
  assert.doesNotMatch(result.stdout, /adr-comparison-card/);
});

test("arbitrary finding IDs are not interpolated into DOM selectors", () => {
  const hostileId = 'x"] :checked, script[data-x="';
  const result = render({
    adr: "docs/adr/test.md",
    verdict: "FIX_REQUIRED",
    findings: [{ id: hostileId, category: "Decision changed in code", summary: "coverage" }],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /name="dec-0"/);
  assert.match(result.stdout, /data-finding-index="0"/);
  assert.equal(result.stdout.includes(`name="dec-${hostileId}`), false);
});

test("necessity and sufficiency evidence survives into the interactive report", () => {
  const result = render({
    adr: "docs/adr/streaming/0001-cancel.md",
    verdict: "FIX_REQUIRED",
    atAGlance: {
      impact: "A cancelled request may continue consuming upstream resources.",
      action: "Remove the unnecessary event bus and verify restart recovery.",
      risk: "Restart recovery was not exercised locally.",
    },
    explanation: "/tmp/review/explanation.md",
    report: "/tmp/review/implementation-review.md",
    metrics: {
      elapsedSeconds: 42,
      necessityFindingCount: 1,
      sufficiencyFindingCount: 1,
      unverifiedRiskCount: 1,
      testCommandCount: 1,
    },
    implementationChoices: [
      {
        choice: "retry uses a 250 ms fixed delay",
        evidence: "src/stream/client.ts:20 — retryDelayMs: 250",
        intentFit: "keeps retries bounded without changing the ADR's failure result",
        whyItMatters: "changes recovery latency and request rate",
      },
    ],
    contractCoverage: [
      {
        contractId: "D0",
        requirement: "Cancellation stops the upstream request",
        status: "PROVEN",
        adrBasis: "Requirement contract — Required guarantees",
        implementation: "the abort signal reaches the upstream client",
        evidence: "src/stream/client.ts:18 — signal passed to fetch",
        tests: "pnpm test -- cancel — PASS",
      },
      {
        contractId: "R1",
        requirement: "Restart recovery preserves queued work",
        status: "UNVERIFIED",
        adrBasis: "Requirement contract — Failure guarantees",
        implementation: "queue recovery exists but was not executed locally",
        evidence: "src/stream/queue.ts:44 — recovery branch",
        tests: "NOT RUN — no local queue",
      },
    ],
    findings: [
      {
        id: "n1",
        category: "Unnecessary change",
        perspective: "necessity",
        summary: "event bus is removable",
        whyItMatters: "the extra path increases maintenance without changing cancellation",
        expectedBehavior: "the abort signal reaches the upstream client directly",
        observedBehavior: "an additional event bus carries the same cancellation",
        requestedChange: "remove the event bus and keep the direct abort path",
        editTargets: "src/stream/event-bus.ts and cancellation wiring",
        completionCriteria: "the event bus is absent and cancellation tests pass",
        evidence: "the existing abort signal reaches the upstream client",
        test: "pnpm test -- cancel",
        testResult: "PASS",
        confidence: "high",
      },
      {
        id: "s1",
        category: "Unverified risk",
        perspective: "sufficiency",
        summary: "restart recovery was not exercised",
        whyItMatters: "queued work could be lost after restart",
        expectedBehavior: "restart recovery preserves queued work",
        observedBehavior: "the branch exists but was not executed",
        requestedChange: "run restart recovery against a queue fixture",
        editTargets: "src/stream/queue.ts and restart recovery fixture",
        completionCriteria: "the restart test passes with queued work preserved",
        testResult: "NOT RUN: no local queue",
        confidence: "low",
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /Unnecessary change/);
  assert.match(result.stdout, /Unverified risk/);
  assert.match(result.stdout, /Abstract/);
  assert.match(result.stdout, /A cancelled request may continue consuming upstream resources/);
  assert.match(result.stdout, /Remove the unnecessary event bus/);
  assert.match(result.stdout, /Restart recovery was not exercised locally/);
  assert.match(result.stdout, /the existing abort signal reaches the upstream client/);
  assert.match(result.stdout, /pnpm test -- cancel/);
  assert.match(result.stdout, /implementation-review\.md/);
  assert.match(result.stdout, /explanation\.md/);
  assert.match(result.stdout, /Review metrics/);
  assert.match(result.stdout, /42s/);
  assert.match(result.stdout, /retry uses a 250 ms fixed delay/);
  assert.match(result.stdout, /src\/stream\/client\.ts:20/);
  assert.match(result.stdout, /keeps retries bounded without changing the ADR/);
  assert.match(result.stdout, /changes recovery latency and request rate/);
  assert.match(result.stdout, /Cancellation stops the upstream request/);
  assert.match(result.stdout, /Restart recovery preserves queued work/);
  assert.match(result.stdout, /Met · D0/);
  assert.match(result.stdout, /Verification required · R1/);
  assert.match(result.stdout, /Met 1/);
  assert.match(result.stdout, /Review result/);
  assert.match(result.stdout, /Results, limitations, and future work/);
  assert.match(result.stdout, /Why it matters/);
  assert.match(result.stdout, /Where to change/);
  assert.match(result.stdout, /Done when/);
  assert.match(result.stdout, /Technical evidence/);
  assert.match(result.stdout, /Review report/);
  assert.ok(
    result.stdout.indexOf("Results, limitations, and future work") <
      result.stdout.indexOf("Contract verification"),
    "finding prose must appear before the evidence appendix",
  );
  assert.ok(
    result.stdout.indexOf("finding-s1") > result.stdout.indexOf("Contract verification"),
    "detailed finding cards must stay inside the evidence appendix",
  );
  assert.ok(
    result.stdout.indexOf("Contract verification") <
      result.stdout.indexOf("Notable implementation choices"),
    "contract coverage must remain before implementation choices inside evidence",
  );
  assert.doesNotMatch(result.stdout, /Repair guide ·/);
  assert.doesNotMatch(result.stdout, /Review this implementation choice/);
  assert.doesNotMatch(result.stdout, /choice_reviews/);
  assert.doesNotMatch(result.stdout, /name="dec-0"/);
  assert.match(result.stdout, /name="dec-1"/);
  assert.ok(
    result.stdout.indexOf('id="finding-n1"') < result.stdout.indexOf('id="finding-s1"'),
    "renderer must preserve synthesis order inside action-group order",
  );
});

test("notable implementation choice content is escaped and read-only", () => {
  const payload = "</script><script>globalThis.__choiceInjected = true</script>";
  const result = render({
    adr: "docs/adr/test.md",
    verdict: "PASS",
    findings: [],
    contractCoverage: [
      {
        contractId: "D0",
        requirement: "The response remains backward compatible",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "the public response shape is unchanged",
        evidence: "src/example.ts:1",
        tests: "node --test — PASS",
      },
    ],
    implementationChoices: [
      {
        choice: payload,
        evidence: "src/example.ts:1",
        intentFit: "preserves the ADR contract",
        whyItMatters: "different local convention",
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /<\/script><script>globalThis\.__choiceInjected/);
  assert.match(result.stdout, /src\/example\.ts:1/);
  assert.match(result.stdout, /different local convention/);
  assert.doesNotMatch(result.stdout, /name="choice-dec-/);
  assert.doesNotMatch(result.stdout, /data-choice-index=/);
});

test("comprehension questions render without exposing grading criteria", () => {
  const result = render({
    adr: "docs/adr/payments/0001.md",
    verdict: "PASS",
    findings: [],
    contractCoverage: [],
    implementationChoices: [],
    comprehensionCheck: {
      prGuidance: "Do not open or send the PR until the question is answered correctly.",
      questions: [
        {
          id: "Q1",
          question: "Why does provider failure leave the payment pending?",
          options: [
            { id: "A", text: "SECRET_OPTION_A", feedback: "SECRET_FEEDBACK_A" },
            { id: "B", text: "SECRET_OPTION_B", feedback: "SECRET_FEEDBACK_B" },
            { id: "C", text: "SECRET_OPTION_C", feedback: "SECRET_FEEDBACK_C" },
            { id: "D", text: "SECRET_OPTION_D", feedback: "SECRET_FEEDBACK_D" },
          ],
          revisit: true,
          correctOptionId: "B",
          explanation: "SECRET_ANSWER_EXPLANATION",
          evidence: "SECRET_GRADING_EVIDENCE",
        },
      ],
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Comprehension check/);
  assert.match(result.stdout, /Q1/);
  assert.match(result.stdout, /Why does provider failure leave the payment pending/);
  assert.match(result.stdout, /Do not open or send the PR/);
  assert.match(result.stdout, /Recall your answer before viewing the choices/);
  assert.match(result.stdout, /class="quiz__reveal"[^>]*>Show choices/);
  assert.match(result.stdout, /class="quiz__options"[^>]*hidden/);
  assert.match(result.stdout, /class="quiz__option"/);
  assert.match(result.stdout, /type="radio"/);
  assert.match(result.stdout, /class="quiz__teach-back"[^>]*hidden/);
  assert.match(result.stdout, /explain your choice to a teammate in one sentence/);
  assert.match(result.stdout, /class="quiz__check"[^>]*hidden/);
  assert.match(result.stdout, /options\.hidden = false/);
  assert.match(result.stdout, /teachBack\.hidden = false/);
  assert.match(result.stdout, /button\.hidden = true/);
  assert.match(result.stdout, /revisit later/);
  assert.match(result.stdout, /No schedule or progress is stored/);
  assert.match(result.stdout, /Correct/);
  assert.match(result.stdout, /Review this concept/);
  assert.doesNotMatch(result.stdout, /localStorage|sessionStorage|setTimeout\(/);
  assert.doesNotMatch(result.stdout, /Congratulations|Great job|Well done|10 points/);
  assert.doesNotMatch(result.stdout, /SECRET_ANSWER_EXPLANATION/);
  assert.doesNotMatch(result.stdout, /SECRET_FEEDBACK_A/);
  assert.doesNotMatch(result.stdout, /SECRET_GRADING_EVIDENCE/);
  assert.match(
    result.stdout,
    new RegExp(Buffer.from("SECRET_ANSWER_EXPLANATION", "utf8").toString("base64")),
  );
});

test("intent-first narrative sections render in reader-priority order", () => {
  const result = render({
    adr: "docs/adr/payments/0001.md",
    verdict: "PASS",
    findings: [],
    contractCoverage: [],
    implementationChoices: [],
    narrativeSections: [
      {
        title: "ADR intent",
        body: "Payment settlement must produce one durable completion.",
      },
      {
        title: "A duplicate request cannot charge twice",
        body: "One idempotency key admits one successful completion.",
      },
      {
        title: "Provider failure remains pending",
        body: "Failure never crosses the completion boundary.",
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  const intent = result.stdout.indexOf("Payment settlement must");
  const duplicate = result.stdout.indexOf("One idempotency key");
  const failure = result.stdout.indexOf("Failure never crosses");
  assert.ok(intent >= 0 && intent < duplicate && duplicate < failure);
});

test("narrative Markdown and supported Mermaid render as HTML instead of raw source", () => {
  const result = render({
    language: "en",
    adr: "docs/adr/payments/0001.md",
    verdict: "PASS",
    findings: [],
    contractCoverage: [],
    implementationChoices: [],
    narrativeSections: [
      {
        title: "ADR intent",
        body: `The flow keeps **one completion**.

- Reject duplicates
- Preserve pending state

\`\`\`mermaid
sequenceDiagram
  participant API
  participant Provider
  API->>Provider: request with example id 42
  Provider-->>API: success
\`\`\`

\`\`\`ts
const id = 42;
\`\`\``,
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /<strong>one completion<\/strong>/);
  assert.match(result.stdout, /<ul><li>Reject duplicates<\/li>/);
  assert.match(result.stdout, /class="diagram diagram--sequence"/);
  assert.match(result.stdout, /request with example id 42/);
  assert.match(result.stdout, /<pre><code class="language-ts">const id = 42;/);
  assert.doesNotMatch(result.stdout, /```mermaid/);
});

test("sequence diagrams preserve participant names and alt branches", () => {
  const result = render({
    language: "en",
    adr: "docs/adr/diarychat/0001.md",
    verdict: "FIX_REQUIRED",
    findings: [],
    contractCoverage: [],
    implementationChoices: [],
    narrativeSections: [
      {
        title: "Async image generation",
        body: `\`\`\`mermaid
sequenceDiagram
  participant OpenAI
  participant Worker
  alt image success
    OpenAI-->>Worker: JPEG
  else blocked or failed
    OpenAI-->>Worker: error
  end
\`\`\`
Notice: Success and failure stay separate.`,
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /class="sequence__block"/);
  assert.match(result.stdout, /image success/);
  assert.match(result.stdout, /blocked or failed/);
  assert.match(result.stdout, /data-participant="OpenAI"/);
  assert.doesNotMatch(result.stdout, /data-participant="OpenAI-"/);
  assert.equal((result.stdout.match(/data-from="OpenAI" data-to="Worker"/g) ?? []).length, 2);
});

test("a grounded flowchart renders as a visual relationship diagram", () => {
  const result = render({
    language: "ko",
    adr: "docs/adr/review/0001.md",
    verdict: "PASS",
    findings: [],
    contractCoverage: [],
    implementationChoices: [],
    narrativeSections: [
      {
        title: "주요 리뷰 흐름",
        body: `\`\`\`mermaid
flowchart LR
  Scope["구현 범위 탐색"] --> Review["증거 검토"]
  Review --> Render["HTML 렌더링"]
\`\`\`
Notice: 구현 범위에서 검증된 증거가 HTML 설명으로 이어집니다.`,
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /class="diagram diagram--flow"/);
  assert.match(result.stdout, /구현 범위 탐색/);
  assert.match(result.stdout, /HTML 렌더링/);
  assert.doesNotMatch(result.stdout, /<figure class="diagram diagram--fallback"/);
});

test("state diagrams preserve states and labeled transitions", () => {
  const result = render({
    language: "ko",
    adr: "docs/adr/review/0001.md",
    verdict: "PASS",
    findings: [],
    contractCoverage: [],
    implementationChoices: [],
    narrativeSections: [
      {
        title: "lease 상태 전이",
        body: `\`\`\`mermaid
stateDiagram-v2
  PENDING --> PROCESSING: lease 선점
  PROCESSING --> COMPLETED: claim 일치
  PROCESSING --> PENDING: 실패 후 해제
\`\`\`
Notice: 완료와 재시도 경계가 서로 다른 전이로 유지되어야 합니다.`,
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /class="diagram diagram--state"/);
  assert.match(result.stdout, /PENDING/);
  assert.match(result.stdout, /PROCESSING/);
  assert.match(result.stdout, /COMPLETED/);
  assert.match(result.stdout, /lease 선점/);
  assert.match(result.stdout, /실패 후 해제/);
  assert.doesNotMatch(result.stdout, /<figure class="diagram diagram--fallback"/);
});

function renderDiagram(source) {
  return render({
    adr: "docs/adr/review/0001.md",
    language: "en",
    verdict: "PASS",
    narrativeSections: [
      { title: "Behavior under review", body: `\`\`\`mermaid\n${source}\n\`\`\`` },
    ],
  });
}

test("unsupported or incomplete Mermaid never renders a misleading partial diagram", () => {
  for (const source of [
    "sequenceDiagram\nA->>B: start\ncritical commit\nB-->>A: done\nend",
    "sequenceDiagram\nA->>+B: start\nB-->>-A: done",
    "sequenceDiagram\nalt allowed\nA->>B: start",
    "sequenceDiagram\nloop retry\nA->>B: start\nelse wrong branch\nB-->>A: done\nend",
    "flowchart LR\nA --> B\nclick B callback",
    "flowchart LR\nsubgraph outer\nsubgraph inner\nA --> B\nend\nend",
    "stateDiagram-v2\nA --> B\nstate B {\nInner --> Done\n}",
    "erDiagram\nUSER ||--o{ ORDER : owns\nUSER {\nstring name\n}",
  ]) {
    const result = renderDiagram(source);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /<figure class="diagram diagram--fallback"/, source);
    assert.doesNotMatch(
      result.stdout,
      /<figure class="diagram diagram--(?:sequence|flow|state|er)"/,
      source,
    );
  }
});

test("state diagrams retain initial, terminal, and named states", () => {
  const result = renderDiagram(
    'stateDiagram-v2\nstate "Waiting for approval" as Pending\n[*] --> Pending\nPending --> Done: approve\nDone --> [*]',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /class="diagram diagram--state"/);
  assert.match(result.stdout, /Waiting for approval/);
  assert.match(result.stdout, /Start/);
  assert.match(result.stdout, /End/);
  assert.equal((result.stdout.match(/class="diagram-relationship"/g) ?? []).length, 3);
});

test("nested sequence branches keep their own condition, note participants, and arrow style", () => {
  const result = renderDiagram(`sequenceDiagram
participant A as Caller
participant B as Service
alt success
  par store
    A->>B: write
  and audit
    Note over A,B: request context
    B-->>A: recorded
  end
else failure
  opt retry
    A->>B: retry
  end
end`);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /<figure class="diagram diagram--fallback"/);
  assert.match(result.stdout, /class="sequence__condition"[^]*?>success<\/tspan>/);
  assert.match(result.stdout, /class="sequence__condition"[^]*?>store<\/tspan>/);
  assert.match(result.stdout, /class="sequence__condition"[^]*?>audit<\/tspan>/);
  assert.match(result.stdout, /class="sequence__condition"[^]*?>failure<\/tspan>/);
  assert.match(result.stdout, /sequence__note[^]*Caller[^]*Service[^]*request context/);
  assert.match(result.stdout, /sequence__arrow--dashed/);
});

test("the abstract includes the verdict before evidence or the conclusion", () => {
  const result = render({
    adr: "docs/adr/review/0001.md",
    verdict: "INCONCLUSIVE",
    atAGlance: {
      impact: "The failure path is not verified.",
      action: "Run the recovery check.",
      risk: "Recovery may leave work pending.",
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const overview = result.stdout.match(
    /<section class="overview" id="overview">([^]*?)<\/section>/,
  )?.[1];
  assert.match(overview, /INCONCLUSIVE/);
  assert.ok(overview.indexOf("INCONCLUSIVE") < overview.indexOf("The failure path"));
});

test("the visible Hill narrative does not repeat identical claim and responsibility text", () => {
  const sentence = "One approved request produces one stored result.";
  const result = render({
    adr: "review.md",
    verdict: "PASS",
    reviewHike: {
      hills: [
        {
          id: "H1",
          title: "One request",
          sliceName: "Request processing",
          claim: sentence,
          workedExample: "A retry reads the result.",
          counterexample: "A duplicate write is rejected.",
          container: {
            responsibility: sentence,
            interactions: "The handler reads storage.",
            outcome: "One visible result.",
          },
          assessment: "One visible result.",
          components: [],
          contractIds: [],
        },
      ],
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const narrative = result.stdout.match(/class="hill__narrative"[^>]*>([^]*?)<\/div>/)?.[1];
  assert.ok(narrative);
  assert.equal(narrative.split(sentence).length - 1, 1);
  assert.equal(narrative.split("One visible result.").length - 1, 1);
  assert.match(narrative, /A duplicate write is rejected/);
});

test("Korean diagnostic headings do not depend on the translated analysis title", () => {
  const result = render({ adr: "검토 대상", language: "ko", verdict: "PASS" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /<h3>계약 누락<\/h3>/);
  assert.match(result.stdout, /<h3>테스트 공백<\/h3>/);
  assert.match(result.stdout, /<h3>과다 변경<\/h3>/);
  assert.doesNotMatch(result.stdout, /<h3>(?:Missing contracts|Test gaps|Excess scope)<\/h3>/);
});

test("a long table of contents stays collapsed so the abstract remains the first reading task", () => {
  const result = render({
    adr: "검토 대상",
    language: "ko",
    verdict: "PASS",
    atAGlance: { impact: "변경 결과.", action: "다음 행동.", risk: "검토 한계." },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /<details class="toc__contents">\s*<summary>목차<\/summary>/);
  assert.doesNotMatch(result.stdout, /<details class="toc__contents"[^>]*\bopen\b/);
  assert.match(result.stdout, /href="#overview"/);
  assert.match(result.stdout, /href="#analysis"/);
});

test("Context diagrams render visibly and link to the Hills they explain", () => {
  const result = render({
    adr: "Review example",
    language: "en",
    verdict: "PASS",
    diagramRequirements: [{ id: "V1", section: "Context", diagramType: "flowchart" }],
    reviewHike: {
      context: {
        intent: "Shared ownership.",
        preconditions: "Two flows.",
        contracts: "Keep ownership.",
        scopeAndRisk: "Both flows.",
      },
      hills: [
        { id: "H1", title: "Submit work", diagramIds: ["V1"], components: [], contractIds: [] },
        { id: "H2", title: "Read results", diagramIds: ["V1"], components: [], contractIds: [] },
      ],
    },
    narrativeSections: [
      {
        title: "Context",
        body: "<!-- generated review context start -->\nShared ownership.\n<!-- generated review context end -->\n\n~~~mermaid\n%% requirement: V1\nflowchart LR\nCaller --> Owner --> Reader\n~~~\nNotice: Both flows share the owner.",
      },
    ],
  });
  assert.equal(result.status, 0, result.stderr);
  const context = result.stdout.match(
    /<section class="paper-section" id="review-context">([^]*?)<\/section>/,
  )?.[1];
  assert.match(context, /<svg/);
  assert.match(context, /data-node="Owner"/);
  assert.match(context, /href="#hill-h1"/);
  assert.match(context, /href="#hill-h2"/);
  assert.equal((context.match(/Shared ownership\./g) || []).length, 1);
});

test("a required diagram cannot become a source-only completed report", () => {
  const result = render({
    adr: "Review example",
    verdict: "PASS",
    diagramRequirements: [{ id: "V1", section: "Context", diagramType: "sequenceDiagram" }],
    narrativeSections: [
      {
        title: "Context",
        body: "```mermaid\n%% requirement: V1\nsequenceDiagram\nA->>B: call\ncritical commit\nB-->>A: done\nend\n```",
      },
    ],
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /required diagram V1 cannot render/);
  assert.equal(result.stdout, "");
});

test("the report uses a table of contents and progressive disclosure", () => {
  const result = render({
    language: "en",
    adr: "docs/adr/test.md",
    verdict: "PASS",
    findings: [],
    scope: ["src/a.ts"],
    changeScope: [],
    reviewHike: {
      context: {
        intent: "Preserve the caller-visible contract.",
        preconditions: "Requests cross one main path and one recovery path.",
        contracts: "Both paths preserve the caller-visible result.",
        scopeAndRisk: "Targeted tests prove the main path and expose the recovery gap.",
      },
      hills: [
        {
          id: "H1",
          title: "The decision preserves the main flow",
          sliceType: "user-flow",
          sliceName: "Main request flow",
          reviewQuestion: "Does the main flow preserve the decision?",
          container: {
            responsibility: "Preserve the main request result.",
            interactions: "The caller enters the implementation and receives a result.",
            outcome: "The caller receives the expected result.",
          },
          components: [
            {
              id: "C1",
              name: "Main request handler",
              responsibility: "Apply the decision to a valid request.",
              implementation: "The vertical request path applies the decision.",
              verification: "The targeted test returns the expected caller result.",
              codeEvidence: [
                {
                  kind: "excerpt",
                  location: "src/a.ts:1",
                  content: "return applyDecision(request);",
                  explanation: "The main path returns the contract-preserving result.",
                  tests: "node --test — PASS",
                },
              ],
            },
          ],
          contractIds: ["D0"],
        },
        {
          id: "H2",
          title: "The failure path still needs verification",
          sliceType: "user-flow",
          sliceName: "Dependency recovery flow",
          reviewQuestion: "Does failure preserve the required result?",
          container: {
            responsibility: "Preserve the failure result.",
            interactions: "The unavailable dependency routes the request to recovery.",
            outcome: "Recovery remains unverified.",
          },
          components: [
            {
              id: "C1",
              name: "Recovery branch",
              responsibility: "Attempt recovery without changing the public result.",
              implementation: "The vertical failure path attempts recovery.",
              verification: "Recovery remains unverified because the path did not run.",
              codeEvidence: [
                {
                  kind: "excerpt",
                  location: "src/a.ts:20",
                  content: "return recover(request);",
                  explanation: "The recovery branch is present but unexecuted.",
                  tests: "NOT RUN",
                },
              ],
            },
          ],
          contractIds: ["R1"],
        },
      ],
    },
    narrativeSections: [
      {
        title: "The decision preserves the main flow",
        body: "The targeted main-flow test passed.",
      },
      {
        title: "The failure path still needs verification",
        body: "The environment could not execute recovery.",
      },
    ],
    contractCoverage: [
      {
        contractId: "D0",
        requirement: "Decision",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "implemented",
        evidence: "src/a.ts",
        tests: "node --test — PASS",
      },
      {
        contractId: "R1",
        requirement: "Failure path",
        status: "UNVERIFIED",
        adrBasis: "Failure path",
        implementation: "not executed",
        evidence: "environment unavailable",
        tests: "NOT RUN",
      },
    ],
    implementationChoices: [
      {
        choice: "fixed retry",
        evidence: "src/a.ts",
        intentFit: "preserves the contract",
        whyItMatters: "latency",
      },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /<nav class="toc"/);
  assert.match(result.stdout, /<details class="review-meta">/);
  assert.match(result.stdout, /id="hill-h1"/);
  assert.match(result.stdout, /id="hill-h2"/);
  assert.match(result.stdout, /Related ADRs and change context/);
  assert.match(result.stdout, /Preserve the caller-visible contract/);
  assert.match(result.stdout, /Core implementation and algorithms/);
  assert.match(result.stdout, /Self-validation methods and results/);
  assert.match(result.stdout, /Component C1/);
  assert.match(result.stdout, /Main request handler/);
  assert.doesNotMatch(result.stdout, /class="flow-status/);
  assert.doesNotMatch(result.stdout, /Question this flow answers/);
  assert.match(result.stdout, /<details class="hill__details">/);
  assert.match(result.stdout, /<details class="hill__details" open>/);
  assert.match(result.stdout, /Implementation and evidence/);
  assert.match(result.stdout, /class="context-narrative"/);
  assert.match(result.stdout, /class="hill__narrative"/);
  assert.match(result.stdout, /class="component__narrative"/);
  assert.doesNotMatch(result.stdout, /class="hill-story"/);
  assert.doesNotMatch(result.stdout, /class="container-zoom"/);
  assert.doesNotMatch(result.stdout, /class="component__grid"/);
  assert.match(result.stdout, /class="code-evidence"/);
  assert.match(result.stdout, /return applyDecision\(request\)/);
  assert.match(result.stdout, /data-level="1"[^>]*><a href="#hill-h1"/);
  assert.match(result.stdout, /data-level="2"[^>]*><a href="#component-h1-c1"/);
  assert.match(result.stdout, /data-level="3"[^>]*><a href="#code-h1-c1-1"/);
  assert.match(result.stdout, /\.hill__tag \{ --sev: #426b4f; \}/);
  assert.match(result.stdout, /\.choice__tag \{ --sev: #217a68; \}/);
  assert.doesNotMatch(result.stdout, /class="hill__order"/);
  assert.match(result.stdout, /<details class="coverage coverage--proven" id="contract-D0">/);
  assert.match(
    result.stdout,
    /<details class="coverage coverage--unverified" id="contract-R1" open>/,
  );
  assert.equal(result.stdout.match(/id="contract-D0"/g)?.length, 1);
  assert.equal(result.stdout.match(/id="contract-R1"/g)?.length, 1);
  assert.match(result.stdout, /class="coverage-index"/);
  assert.ok(result.stdout.indexOf('id="hill-h1"') < result.stdout.indexOf('id="findings"'));
  assert.ok(
    result.stdout.indexOf("The targeted main-flow test passed.") <
      result.stdout.indexOf('id="component-h1-c1"'),
    "the authored causal narrative must appear before structured implementation evidence",
  );
  assert.match(result.stdout, /<summary>Notable implementation choices · 1<\/summary>/);
});

test("ruling controls appear only for findings that require human judgment", () => {
  const result = render({
    adr: "docs/adr/test.md",
    verdict: "FIX_REQUIRED",
    findings: [
      { id: "f1", category: "Spec violation", summary: "fix in code" },
      { id: "f2", category: "Decision changed in code", summary: "choose a direction" },
    ],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(
    result.stdout.slice(
      result.stdout.indexOf('id="finding-f1"'),
      result.stdout.indexOf('id="finding-f2"'),
    ),
    /class="ruling"/,
  );
  assert.match(result.stdout, /id="finding-f2"[\s\S]*class="ruling"/);
  assert.match(result.stdout, /id="export"/);

  const readOnly = render({
    adr: "docs/adr/test.md",
    verdict: "FIX_REQUIRED",
    findings: [{ id: "f1", category: "Spec violation", summary: "fix in code" }],
  });
  assert.equal(readOnly.status, 0, readOnly.stderr);
  assert.doesNotMatch(readOnly.stdout, /id="export"/);
});

test("HTML chrome follows the selected report language", () => {
  const result = render({
    language: "ko",
    adr: "docs/adr/test.md",
    verdict: "PASS",
    atAGlance: { impact: "영향 없음", action: "없음", risk: "없음" },
    findings: [],
    reviewHike: {
      context: {
        intent: "Lite 문서를 안전하게 재개한다.",
        preconditions: "사용자가 기존 문서를 다시 연다.",
        contracts: "문서 프로필과 순서를 보존해야 한다.",
        scopeAndRisk: "재개 흐름과 이어 쓰기 결과를 검토한다.",
      },
      hills: [
        {
          id: "H1",
          title: "문서를 안전하게 재개한다",
          sliceType: "user-flow",
          sliceName: "Lite 문서 재개",
          reviewQuestion: "올바른 문서만 다시 열리는가?",
          claim: "유효한 Lite 문서만 다시 연다.",
          workedExample: "정상 문서는 같은 위치에서 이어서 작성된다.",
          counterexample: "다른 프로필 문서를 열면 순서 계약이 깨진다.",
          assessment: "재개 테스트가 정상·거부 경로를 확인한다.",
          container: {
            responsibility: "올바른 Lite 문서를 선택한다.",
            interactions: "사용자 요청과 문서 형식 검사가 이어진다.",
            outcome: "사용자가 이어서 작성할 수 있다.",
          },
          components: [
            {
              id: "C1",
              name: "문서 재개 검사",
              responsibility: "프로필과 Section 순서를 확인한다.",
              implementation: "재개 흐름이 형식을 확인하고 올바른 문서를 선택한다.",
              verification: "재개 테스트에서 사용자가 이어서 작성할 수 있다.",
              codeEvidence: [
                {
                  kind: "excerpt",
                  location: "src/documents.ts:1",
                  content: "return loadValidLiteDocument(path);",
                  explanation: "유효한 Lite 문서만 선택한다.",
                  tests: "pnpm test — PASS",
                },
              ],
            },
          ],
          contractIds: [],
        },
      ],
    },
    contractCoverage: [],
    implementationChoices: [],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /<html lang="ko">/);
  assert.match(result.stdout, />목차</);
  assert.match(result.stdout, />초록</);
  assert.match(result.stdout, />관련 ADR과 변경 맥락</);
  assert.match(result.stdout, />핵심 구현 방법과 알고리즘</);
  assert.match(result.stdout, />자체 검증 방법과 결과</);
  assert.match(result.stdout, />결과 해석, 한계와 향후 보완</);
  assert.doesNotMatch(result.stdout, />H1 · 사용자 흐름</);
  assert.doesNotMatch(result.stdout, />이 흐름이 답해야 할 질문</);
  assert.doesNotMatch(result.stdout, />시작 조건\.</);
  assert.match(result.stdout, />코드 근거 1 · excerpt/);
  assert.doesNotMatch(result.stdout, />검토할 흐름</);
  assert.doesNotMatch(result.stdout, /class="flow-status/);
  assert.match(result.stdout, /<details class="hill__details" open>/);
  assert.match(result.stdout, />구현과 검증 근거</);
  assert.doesNotMatch(result.stdout, />PROVEN</);
});

test("At a glance content is escaped without duplicating PASS feedback data", () => {
  const payload = "</script><script>globalThis.__overviewInjected = true</script>";
  const result = render({
    adr: "docs/adr/test.md",
    verdict: "PASS",
    atAGlance: {
      impact: payload,
      action: "None.",
      risk: "None.",
    },
    findings: [],
    contractCoverage: [],
    implementationChoices: [],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /<\/script><script>globalThis\.__overviewInjected/);
  assert.match(result.stdout, /&lt;\/script&gt;&lt;script&gt;/);
  assert.doesNotMatch(result.stdout, /\\u003c\/script\\u003e/);
  assert.equal((result.stdout.match(/<script>/g) ?? []).length, 1);
});

test("a finding-free PASS uses paper prose without a verdict stamp", () => {
  const result = render({
    language: "ko",
    adr: "docs/adr/test.md",
    verdict: "PASS",
    findings: [],
    contractCoverage: [
      {
        contractId: "D0",
        requirement: "검증된 결과를 제공한다",
        status: "PROVEN",
        adrBasis: "Decision",
        implementation: "검증된 결과를 제공한다",
        evidence: "review",
        tests: "PASS",
      },
    ],
    implementationChoices: [],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /<section id="conclusion">/);
  assert.doesNotMatch(result.stdout, /class="stamp"/);
  assert.doesNotMatch(result.stdout, /class="conforms"/);
});

test("INCONCLUSIVE with no findings does not render a false conforming claim", () => {
  const result = render({
    adr: "docs/adr/streaming/0001-cancel.md",
    verdict: "INCONCLUSIVE",
    findings: [],
    contractCoverage: [
      {
        contractId: "D0",
        requirement: "Cancellation survives process restart",
        status: "UNVERIFIED",
        adrBasis: "Failure guarantees",
        implementation: "cannot determine",
        evidence: "queue unavailable",
        tests: "NOT RUN — no local queue",
      },
    ],
    implementationChoices: [],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /INCONCLUSIVE/);
  assert.doesNotMatch(result.stdout, /No unnecessary changes or counterexamples were confirmed/);
});
