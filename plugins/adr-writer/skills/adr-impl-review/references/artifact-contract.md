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
separate change scope, `review-baseline.md` when full mode produced one, any
available optional explanation plus necessity/sufficiency artifacts, normalized Notable
implementation choices, and verified findings and test results. Save the result
as `implementation-review.md`.

The filename must be exactly `implementation-review.md`. Alternatives such as
`final-review.md` or `review.md` are not allowed. Whichever execution path writes
it, read and follow
`${CLAUDE_PLUGIN_ROOT}/agents/adr-impl-review-report-writer.md`.

Before writing the report, read
`${CLAUDE_PLUGIN_ROOT}/references/review-report-writing.md` and
`${CLAUDE_PLUGIN_ROOT}/references/reader-first-writing.md` completely.

Use progressive disclosure and a paper-shaped reading order: title, abstract,
related ADRs and context, core implementation methods and algorithms,
self-validation methods and results, results and limitations, conclusion and
future work, and evidence appendix. The body is continuous essay prose. Do not
show structured field labels such as `Claim`, `Worked example`,
`Counterexample`, `Assessment`, `Responsibility`, `Interactions`, or
`Outcome`. Do not use verdict stamps, status pills, count chips, task cards, or
tables in the default body. Keep the structured fields for validation and
compose them into paragraphs. The evidence appendix keeps mode, scope, contract
coverage, implementation choices, detailed findings, code, tests, residual
risks, and the optional comprehension check.
Include detailed repair guidance only for `FIX_REQUIRED`, `BLOCK`, or
when the user asks for it.

Under the generated `Abstract`, `ADR contract coverage`, `Notable implementation
choices`, and `Comprehension check`, write only:

```html
<!-- generated from findings.json -->
```

The report is the narrative source. The deterministic materializer writes the
Context, Container, Component, Code, each Hill's contract evidence cards, and
the global coverage summary from `findings.json`.

The human-facing order is prose first, evidence second. Related context and each
implementation section read as connected paragraphs that explain trigger or
starting condition, the important action and branch, the system response or
state change, the observable result, and the verification. The validation
section explains which test case covered which behavior and what was observed.
The results and limitations section discusses contract gaps, test gaps, excess
scope, residual risk, and evidence-backed future work. Structured fields and
coverage rows remain complete in JSON and collapsed evidence.

The Context → Container/Hill → Component → Code tree is the report map. Do not
create a global Trail map or visualization metadata. A Component may include a
small Mermaid diagram only when its request, state, failure, or data relationship
cannot be understood clearly from prose and Code evidence. Add one `Notice:`
sentence per diagram and keep every node and edge grounded in reviewed evidence.

- Overall change structure: `flowchart`
- Core request/event flow: `sequenceDiagram`
- State transitions, if there is state: `stateDiagram-v2`
- Relationships, if the data model changed: `erDiagram`
- A separate `flowchart` when the failure, retry, and rollback flow is complex

Diagrams explain a Component relationship, not the whole report tree. Tie each
node to confirmed code or ADR evidence and add one `Notice:` sentence naming the
review point.
Point clearly in the prose to where a finding occurs and the expected flow after
the fix. Never guess at an edge you could not confirm in the actual code. Never
use ASCII or box-drawing diagrams.

Render findings immediately after the narrative, before detailed evidence.
Group them as `fix`, `decide`, `verify`, and `note` tasks; preserve the
reader-facing synthesis order inside each group. Give every finding a
`contractIds` array linking it to the affected coverage rows; use an empty array
only for a genuinely decision-neutral item.

Every finding has two layers. The model must provide category, perspective,
summary, confidence, exact code/evidence, test result, and contract links.
`whyItMatters`, `expectedBehavior`, `observedBehavior`, `requestedChange`,
`editTargets`, and `completionCriteria` are optional precision fields; when
absent, the renderer derives concise defaults from the core evidence. The technical layer keeps category, confidence,
perspective, ADR quote, exact code fragment, evidence, test command, and current
result. Show the action layer by default and collapse the technical layer.

Keep ADR contract coverage in structured JSON with `Contract ID`, `Requirement`,
`Status`, `ADR basis`, `How the implementation meets it`, `Evidence`, and
`Tests`. Keep the ADR wording recognizable and never merge several obligations
into one row. `reviewHike.hills[].contractIds` assigns every row to exactly one
Hill. The materializer writes the complete requirement, status, implementation,
evidence, and tests together inside that Hill and writes only contract id,
status, Hill, and requirement in the global coverage summary. The remaining
audit fields stay in JSON and the HTML's collapsed technical evidence.

Treat Context, Container, Component, and Code as report zoom levels. Context contains intent,
preconditions, core contracts, and scope/risk. Each Hill is the Container zoom
and contains responsibility, interactions, and outcome. Components contain
detailed implementation and verification. Code evidence is collapsed by default
and contains focused `diff` or `excerpt` content, location, explanation, and
tests. A non-empty change scope requires at least one `diff` evidence item in the
complete report.

Keep Notable implementation choices in structured JSON with `Selected value or
behavior`, `Code evidence`, `Why it fits the ADR intent`, and `Why it matters`.
The materializer writes the read-only Markdown table. These rows are below ADR
resolution and do not amend the ADR. If a row would alter the ADR contract or
durable boundary, it must be an `Undecided behavior` finding instead.

Concise means the default human view answers what to do next. Preserve all seven
coverage fields in JSON, but do not force them into seven visible columns or
repeat the same detailed evidence outside its Hill.
Never replace the four-column implementation-choice table with prose.

When comprehension support is selected, end the evidence appendix with a
generated `Comprehension check`. Keep one to five medium-difficulty,
four-option single-answer questions in the structured check. Ask only material
application questions about the before/after behavior, causal path, ADR
contract, failure or boundary case, test condition, or excess scope. Do not use
filler, trick wording, symbol-name trivia, or line-number recall.

For each question, keep:

- `id` — `Q1` through `Q5` in order
- `question` — the visible application prompt
- `options` — exactly four `{ "id": "A".."D", "text": "...", "feedback": "..." }` objects
- `correctOptionId` — the one correct option id
- `explanation` — why the correct option follows from the contract and evidence
- `evidence` — the ADR, code, or test evidence used to grade it

State explicitly in `prGuidance`:

- the code verdict and comprehension readiness are separate;
- a `PASS` verdict does not prove the reader understands the implementation;
- the PR must not be opened or sent until every question is answered correctly
  without reading the answer criteria.

Do not manually put hidden feedback, the correct option, explanation, or
evidence in Markdown. The materializer writes only the visible prompts and four
options. The HTML keeps the whole check collapsed. It may reveal the selected
option's feedback, correct explanation, and evidence only after the reader
selects one option and explicitly clicks self-check. Use neutral feedback only:
no score, grade, celebration, praise, ability judgment, or gamification. It
never sets comprehension readiness.

The HTML is one responsive page with a table of contents and section anchors. It
renders Markdown lists, inline code, fenced `<pre>` code blocks, and supported
Mermaid relationships. Unsupported Mermaid syntax keeps an explicit warning and
source fallback. Each Hill leads with its real flow title and aggregate contract
status; C4/Hiking vocabulary remains secondary metadata. A fully `PROVEN` Hill
keeps its Component, Code, and contract evidence collapsed, while a Hill with
`VIOLATED`, `UNVERIFIED`, or `CONTRADICTED` coverage opens that evidence by
default. Individual non-`PROVEN` coverage stays open and `PROVEN` coverage stays
collapsed. Scope, metrics, and Notable implementation choices also stay
collapsed. It uses the report language for the document `lang` and fixed
interface labels. Ruling controls and feedback export appear only for `Decision
changed in code`, admitted `Undecided behavior`, material `Unverified risk`, and
`Contradiction`.

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
    "diagramType": "flowchart",
    "readingGuide": "Read nodes as request participants or outcomes, arrows as request and cancellation paths, and the abort branch as the route reviewed in H2."
  },
  "reviewHike": {
    "context": {
      "intent": "Payment settlement creates one durable result.",
      "preconditions": "Settlement receives retries and provider outcomes.",
      "contracts": "One completion boundary preserves idempotency and pending state.",
      "scopeAndRisk": "Retry and provider-failure paths determine the verdict."
    },
    "hills": [
      {
        "id": "H1",
        "title": "A duplicate request reuses the completed payment",
        "sliceType": "user-flow",
        "sliceName": "Duplicate payment settlement",
        "reviewQuestion": "Can the same payment request complete more than once?",
        "container": {
          "responsibility": "Reuse one durable settlement for a retry.",
          "interactions": "The request reaches the completion boundary and stored result.",
          "outcome": "The customer is charged at most once."
        },
        "components": [
          {
            "id": "C1",
            "name": "Idempotent completion boundary",
            "responsibility": "Separate new work from retries.",
            "implementation": "Return the stored result for a completed key.",
            "verification": "The duplicate-settlement test observes one completion.",
            "codeEvidence": [
              {
                "kind": "diff",
                "location": "src/payments/settle.ts:42",
                "content": "- write(result)\n+ return existing ?? write(result)",
                "explanation": "The retry path no longer writes twice.",
                "tests": "pnpm test -- settlement — PASS"
              }
            ]
          }
        ],
        "contractIds": ["D0", "R1"]
      }
    ]
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
        "question": "Which result preserves the completion boundary after provider failure?",
        "options": [
          {
            "id": "A",
            "text": "Mark the payment completed",
            "feedback": "Failure has not crossed the completion boundary."
          },
          {
            "id": "B",
            "text": "Keep the payment pending",
            "feedback": "This preserves the completion contract."
          },
          {
            "id": "C",
            "text": "Delete the payment",
            "feedback": "Deletion is not the recorded failure result."
          },
          {
            "id": "D",
            "text": "Retry forever",
            "feedback": "The contract does not allow unbounded retry."
          }
        ],
        "correctOptionId": "B",
        "explanation": "Provider success is required before completion is recorded.",
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

`language`, `reviewMode`, `atAGlance`, `reviewHike`, `contractCoverage`,
`implementationChoices` are mandatory
even for `PASS` with zero findings or zero choices. `atAGlance` contains
non-empty `impact`, `action`, and `risk`; use `None` only when that axis was
checked and is empty. When present, `comprehensionCheck.questions` contains one
to five questions with non-empty `id`, `question`, exactly four `options`, one
`correctOptionId`, `explanation`, and `evidence`.
`contractCoverage` is non-empty because `D0` always represents the ADR Decision
even when there is no explicit requirement-contract subsection.

`explanation` is optional. When present it points to a temporary
`explanation.md` whose structure the validator checks; the final
`implementation-review.md` remains responsible for the complete human-facing
narrative.

`reviewHike.context` contains non-empty `intent`, `preconditions`, `contracts`,
and `scopeAndRisk` fields. `reviewHike.hills` is non-empty.
Hill ids are sequential `H1..Hn`; titles are unique and match the corresponding
Markdown `##` headings exactly. Every Hill has one allowed `sliceType`
(`user-flow`, `logical-capability`, or `bounded-context`), one non-empty
`sliceName`, one non-empty `reviewQuestion`, a complete `container`, one or more
sequential Components, and one or more contract ids. Every Component has
non-empty responsibility, implementation, verification, and Code evidence.
Code evidence kinds are `diff` or `excerpt`; a non-empty change scope requires
at least one `diff`. Across all Hills, every `contractCoverage.contractId` appears
exactly once. Technical layers, file groups, modules, and review lifecycle
phases do not define Hill boundaries. `Context` contains
`<!-- generated review context from findings.json -->`; each Hill contains
`<!-- generated container zoom from findings.json -->`,
`<!-- generated component zoom from findings.json -->`, and
`<!-- generated hill evidence from findings.json -->` before materialization.

`metrics` and expanded action wording are optional derived views. When supplied,
the validator checks them; when absent, deterministic tooling and coverage/test
evidence provide the display values.

The artifact validator reads the ADR, derives `D0/R1..Rn`, rejects missing or
duplicate IDs, validates an optional explanation artifact when supplied, rejects
missing or reordered report/check sections, rejects
a missing or inconsistent Hill assignment, rejects invalid question counts or exposed answer criteria,
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
correct option, option feedback, explanation, grading evidence, or answer
request into that response. A
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
prepared artifact and ask one primary question at a time with all four choices.
Do not reveal the correct option, feedback, explanation, or evidence first.

- On a correct selection, state the supporting concept and ask the next question
  without praise, celebration, scoring, grading, or ability judgment.
- On an incorrect selection, state that the PR is not
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
