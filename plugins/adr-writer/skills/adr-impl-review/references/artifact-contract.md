# Implementation review artifact contract

Read this reference completely only after the review evidence has been
synthesized and the verdict is known. It owns the common standard/full report,
JSON, validation, rendering, opening, completion-response, and optional
interactive-comprehension contract.

## 1. Generate the concise evidence report

Apply the `adr-impl-review-report-writer` role contract. This step creates no new
conclusions. The model may use a named agent, generic subagent, or write the
report directly.

Give the report-writing role the original ADR, complete implementation scope,
separate change scope, `review-baseline.md` when full mode produced one, the
available explanation/necessity/sufficiency artifacts, normalized Notable
implementation choices, and verified findings and test results. Save the result
as `implementation-review.md`.

The filename must be exactly `implementation-review.md`. Alternatives such as
`final-review.md` or `review.md` are not allowed. Whichever execution path writes
it, read and follow
`${CLAUDE_PLUGIN_ROOT}/agents/adr-impl-review-report-writer.md`.

Before writing the report, read
`${CLAUDE_PLUGIN_ROOT}/references/review-report-writing.md` and
`${CLAUDE_PLUGIN_ROOT}/references/reader-first-writing.md` completely.

Use progressive disclosure. Every report contains `At a glance`, `Review mode`,
`Scope`, `ADR intent`, at least one subject-specific narrative section,
`Findings`, `ADR contract coverage`, `Notable implementation choices`, `Tests`,
`Residual risks`, and `Comprehension check` by default. Mermaid diagrams are
required somewhere between `ADR intent` and `Findings` when
`findings.json.visualization.required` is true. The narrative headings and
order follow the reader's most important verified flow rather than a fixed
tutorial template. Include detailed repair guidance only for `FIX_REQUIRED`,
`BLOCK`, or when the user asks for it.

Under `At a glance`, `ADR contract coverage`, `Notable implementation choices`,
and `Comprehension check`, write only:

```html
<!-- generated from findings.json -->
```

The report is the narrative source. The deterministic materializer writes the
repeated data views from `findings.json`.

Classify visualization before writing. Record `required`, a non-empty `reason`,
and the smallest fitting `diagramType` in `findings.json.visualization`.
When `required` is true, include at least one Mermaid fence of the declared type
in `Visual map` or any subject-specific section, and add one non-empty `Notice:`
sentence per diagram. The validator rejects missing or mismatched diagrams. A
local one-file PASS may set `required: false` only when the whole relationship
is clear in one or two sentences; record why the diagram is unnecessary. Use as
many diagrams as materially reduce reconstruction work; do not merge different
review questions into one crowded diagram or add duplicates.

- Overall change structure: `flowchart`
- Core request/event flow: `sequenceDiagram`
- State transitions, if there is state: `stateDiagram-v2`
- Relationships, if the data model changed: `erDiagram`
- A separate `flowchart` when the failure, retry, and rollback flow is complex

Diagrams must provide a review map, not decoration. Tie each node to confirmed
code or ADR evidence, then add one `Notice:` sentence naming the review point.
Point clearly in the prose to where a finding occurs and the expected flow after
the fix. Never guess at an edge you could not confirm in the actual code. Never
use ASCII or box-drawing diagrams.

Render findings immediately after the narrative, before detailed evidence.
Group them as `fix`, `decide`, `verify`, and `note` tasks; preserve the
reader-facing synthesis order inside each group. Give every finding a
`contractIds` array linking it to the affected coverage rows; use an empty array
only for a genuinely decision-neutral item.

Every finding has two layers. The action layer requires `whyItMatters`,
`expectedBehavior`, `observedBehavior`, `requestedChange`, `editTargets`, and
`completionCriteria`. The technical layer keeps category, confidence,
perspective, ADR quote, exact code fragment, evidence, test command, and current
result. Show the action layer by default and collapse the technical layer.

Keep ADR contract coverage in structured JSON with `Contract ID`, `Requirement`,
`Status`, `ADR basis`, `How the implementation meets it`, `Evidence`, and
`Tests`. Keep the ADR wording recognizable and never merge several obligations
into one row. The materializer writes a human summary with contract ID, an
easy-language status, requirement, and review result. The remaining audit
fields stay in JSON and the HTML's collapsed technical evidence.

Keep Notable implementation choices in structured JSON with `Selected value or
behavior`, `Code evidence`, `Why it fits the ADR intent`, and `Why it matters`.
The materializer writes the read-only Markdown table. These rows are below ADR
resolution and do not amend the ADR. If a row would alter the ADR contract or
durable boundary, it must be an `Undecided behavior` finding instead.

Concise means the default human view answers what to do next. Preserve all seven
coverage fields in JSON, but do not force them into seven visible columns.
Never replace the four-column implementation-choice table with prose.

End the report with a generated `Comprehension check`. Keep one to five
medium-difficulty free-response questions in the structured check. Ask only
material questions about the before/after behavior, causal path, ADR contract,
failure or boundary case, or important trade-off. Do not use filler, symbol-name
trivia, or line-number recall.

For each question, keep:

- `id` — `Q1` through `Q5` in order
- `question` — the visible free-response prompt
- `answerCriteria` — the concepts and causal relationship a correct answer must contain
- `evidence` — the ADR, code, or test evidence used to grade it

State explicitly in `prGuidance`:

- the code verdict and comprehension readiness are separate;
- a `PASS` verdict does not prove the reader understands the implementation;
- the PR must not be opened or sent until every question is answered correctly
  without reading the answer criteria.

Do not manually put the questions, answer criteria, or evidence in Markdown.
The materializer writes only the visible prompts. The HTML keeps the whole check
collapsed. It may reveal a question's criteria and evidence only after the
reader enters an answer and explicitly clicks the self-check action. Label this
as comparison rather than grading; it never sets comprehension readiness.

The HTML is one responsive page with a table of contents and section anchors. It
renders Markdown lists, inline code, fenced `<pre>` code blocks, and supported
Mermaid relationships. Unsupported Mermaid syntax keeps an explicit warning and
source fallback. It opens non-`PROVEN` coverage while collapsing `PROVEN`
coverage, scope, metrics, and Notable implementation choices. It uses the report
language for the document `lang` and fixed interface labels. Ruling controls and
feedback export appear only for `Decision changed in code`, admitted `Undecided
behavior`, material `Unverified risk`, and `Contradiction`.

For each actionable finding in a conditional repair guide, include:

1. What the problem is and which user or operational symptom it manifests as
2. The difference between the ADR decision and the actual code
3. The order of files and symbols to read
4. The reproduction command and the current result
5. The fix steps and the scope not to touch
6. The expected behavior after the fix
7. The tests that must pass and the completion criteria
8. The confidence level and what has not been confirmed yet

Do not add a glossary, code-reading tour, merge checklist, or extra diagram
unless it directly helps resolve a verified finding.

## 2. Generate the evidence page

Serialize the available role artifacts and synthesized result into
`findings.json`. This abbreviated example shows every field family:

```json
{
  "language": "en",
  "reviewMode": "full",
  "adr": "docs/adr/ordering/checkout/0001-checkout.md",
  "status": "Accepted (2026-07-10)",
  "verdict": "FIX_REQUIRED",
  "atAGlance": {
    "impact": "A cancelled checkout can still leave an upstream request running.",
    "action": "Pass the cancellation signal through the upstream client and rerun the cancellation test.",
    "risk": "Restart recovery remains unverified because no local queue was available."
  },
  "visualization": {
    "required": true,
    "reason": "Checkout cancellation crosses the handler and upstream client and has success and abort branches.",
    "diagramType": "flowchart"
  },
  "explanation": "/tmp/.../explanation.md",
  "report": "/tmp/.../implementation-review.md",
  "scope": ["src/checkout/handler.ts", "src/checkout/client.ts", "test/checkout.test.ts"],
  "changeScope": ["src/checkout/handler.ts"],
  "conventions": "AGENTS.md",
  "metrics": {
    "startedAt": "2026-08-15T06:30:00.000Z",
    "completedAt": "2026-08-15T06:35:42.000Z",
    "elapsedSeconds": 342,
    "necessityFindingCount": 1,
    "sufficiencyFindingCount": 0,
    "unverifiedRiskCount": 0,
    "testCommandCount": 2
  },
  "implementationChoices": [
    {
      "choice": "retry uses a 250 ms fixed delay",
      "evidence": "src/checkout/client.ts:42 — retryDelayMs: 250",
      "intentFit": "keeps retries bounded and preserves the ADR's explicit failure result",
      "whyItMatters": "changes recovery latency and upstream request rate"
    }
  ],
  "comprehensionCheck": {
    "prGuidance": "Do not open or send the PR until every comprehension question is answered correctly without reading the answer criteria.",
    "questions": [
      {
        "id": "Q1",
        "question": "Why does provider failure leave the payment pending rather than completed?",
        "answerCriteria": "The provider result is required before the idempotent completion boundary records success.",
        "evidence": "ADR R2; src/payments/settle.ts:42; provider failure test"
      }
    ]
  },
  "contractCoverage": [
    {
      "contractId": "R1",
      "requirement": "a payment is completed at most once",
      "status": "PROVEN",
      "adrBasis": "Requirement contract — Prohibitions",
      "implementation": "the settlement path rejects an existing idempotency key",
      "evidence": "src/payments/settle.ts:42 — exact code or execution evidence",
      "tests": "pnpm test -- settlement — PASS"
    }
  ],
  "findings": [
    {
      "category": "Unnecessary change",
      "perspective": "necessity",
      "summary": "the new event bus is not needed for this ADR",
      "whyItMatters": "the extra path increases maintenance and failure surface without changing the required behavior",
      "expectedBehavior": "cancellation reaches the upstream request through the existing signal path",
      "observedBehavior": "the same cancellation is routed through an additional event bus",
      "requestedChange": "remove the event bus and keep the direct cancellation path",
      "editTargets": "src/events/bus.ts and its checkout wiring",
      "completionCriteria": "the event bus is absent and the cancellation test still passes",
      "confidence": "high",
      "adrQuote": "on cancellation, abort the upstream call",
      "code": "src/events/bus.ts:18 — the actual code fragment",
      "evidence": "the existing abort-signal path meets the same goal",
      "test": "pnpm test -- cancel",
      "testResult": "pass after excluding the new bus path",
      "fix": "remove the new event bus and its wiring",
      "contractIds": ["D0"]
    }
  ],
  "notes": "review limits or contradictions"
}
```

`language`, `reviewMode`, `atAGlance`, `visualization`, `metrics`, `contractCoverage`,
`implementationChoices`, `comprehensionCheck`, and `explanation` are mandatory
even for `PASS` with zero findings or zero choices. `atAGlance` contains
non-empty `impact`, `action`, and `risk`; use `None` only when that axis was
checked and is empty. `visualization` always contains a boolean `required` and a
non-empty evidence-based `reason`; a required visualization also contains one
of `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, or `erDiagram` as
`diagramType`. `comprehensionCheck.questions` contains one to five
questions with non-empty `id`, `question`, `answerCriteria`, and `evidence`.
`contractCoverage` is non-empty because `D0` always represents the ADR Decision
even when there is no explicit requirement-contract subsection.

The artifact validator reads the ADR, derives `D0/R1..Rn`, rejects missing or
duplicate IDs, rejects missing or reordered explanation/check sections, rejects
a required Mermaid when the declared diagram type or per-diagram `Notice:` is
absent from the narrative, rejects invalid question counts or exposed answer criteria,
and rejects `PASS` when tests were not executed, a coverage row is not `PROVEN`,
an unverified risk remains, or a blocking finding remains. Count the raw findings each independent
perspective produced before deduplication, count `Unverified risk` entries after
synthesis, and count distinct test or reproduction commands actually executed.
In standard mode the necessity count is zero by definition.

Allowed categories:

- Necessity: `Unnecessary change`, `Simpler alternative`
- Sufficiency: `Spec violation`, `Decision changed in code`, `Undecided behavior`, `Impl-fact mismatch`, `Test gap`
- Shared quality: `Best practice`, `Refactor`
- Verification state: `Unverified risk`, `Contradiction`

Validate and build the HTML in both modes:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-impl-review-materialize.mjs <artifact-dir>
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-impl-review-validate.mjs <artifact-dir>
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-impl-review-report.mjs <findings.json> --out <artifact-dir>/adr-impl-review-report.html
node ${CLAUDE_PLUGIN_ROOT}/scripts/adr-impl-review-open.mjs <artifact-dir>/adr-impl-review-report.html
```

If materialization or validation fails, do not report completion or generate the
HTML. Fill the omissions it names in the narrative source or `findings.json` and
re-run until both exit 0. In particular, fill `perspective`, `code`, `evidence`,
`test`, and `testResult` for every finding, and where a test could not be run,
write `NOT RUN — <reason>` rather than leaving it blank. If HTML rendering fails
or produces an empty file, the review is also incomplete.

In both modes, run `adr-impl-review-open.mjs` immediately after the non-empty
check. The helper attempts the host's default browser exactly once and prints
`OPENED <path>` or `NOT_OPENED <path> — <reason>`. Do not silently skip the
command based on an assumption that the environment is headless. A
`NOT_OPENED` result for a valid artifact does not invalidate the review; state
the reason and provide the exact path.

## 3. Completion response and comprehension interaction

The ordinary main-session completion response contains only the verdict, key
impact/action/risk, applied fixes, tests, lifecycle result, and the HTML path
plus `OPENED` or `NOT_OPENED` result. Do not copy any comprehension question,
`answerCriteria`, grading evidence, or answer request into that response. A
pre-promotion invocation by `/adr-impl` must not ask the user to rule
`apply / skip / defer` on `PROVEN` coverage rows, implementation choices, or
ordinary evidence-backed repairs; the caller owns remediation. Contract
coverage and Notable implementation choices are read-only context, not
individual approval items.

The standalone HTML must likewise omit ruling controls and feedback export when
no finding requires human judgment. A local self-check may reveal stored
comprehension criteria after answer entry, but only an explicitly requested
interactive comprehension check may semantically grade the answer or call the
PR comprehension-ready.

Do not automatically begin the comprehension check after the report or
lifecycle result. Keep the prepared questions and hidden grading data inside the
HTML/JSON artifacts. When the user does not explicitly request an interactive
comprehension check, leave PR comprehension readiness unverified and complete
the main-session response without a question.

Only when the user explicitly asks to run the comprehension check, load the
prepared artifact and ask one primary question at a time without revealing its
`answerCriteria` or `evidence` first. Grade meaning and causal understanding,
not exact wording.

- On a correct answer, briefly state why it is correct and ask the next question.
- On an incomplete or incorrect answer, state that the PR is not
  comprehension-ready, explain the missing concept with the stored evidence,
  and let the reader retry the same question. A retry does not create a sixth
  primary question.
- If a question is skipped or the session ends before all questions pass, keep
  PR comprehension readiness unverified.
- Only after every prepared question passes may the response say the PR is
  comprehension-ready.

This interactive check does not reopen the implementation verdict, block
evidence-backed remediation, or delay an otherwise valid ADR Status transition.
Do not persist quiz progress or pass/fail state in the ADR, mapping, repository,
or another registry.
