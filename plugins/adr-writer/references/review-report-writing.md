# Human-facing review reports

Use this guide only when writing the report or chat summary a person will read.
Before composing the final presentation, read and apply
`${CLAUDE_PLUGIN_ROOT}/skills/report-write/SKILL.md` and its relevant references.
That skill owns domain hierarchy, maximum four peer units, paragraph layout,
worked examples, and editorial completion checks. Internal reviewer artifacts
keep their evidence-complete formats; a flat audit export is not the final
human-facing report.

Read `${CLAUDE_PLUGIN_ROOT}/references/reader-first-writing.md` completely and
apply it with this report-specific guide.

The reader is a junior developer seeing the subject for the first time. Explain it
like a new teammate, not like a child: preserve exact contracts and evidence, but
remove the reconstruction work.

## Choose the report language

Use the language the user explicitly requests or currently uses. If the
conversation does not establish a language, use the target ADR's dominant
language. For a multi-ADR report, use the dominant language across the reviewed
scope.

Apply the selected language to human-facing prose and subject-specific headings.
Keep stable artifact anchors and established technical terms in their original
form when translation would reduce precision. Do not switch languages merely
because the harness prompt is written in English.

## Start with the answer

Lead with a short answer before detailed domain explanations or evidence. The
following are summary facts, not mandatory separate top-level sections:

- **Verdict** — what the review concluded.
- **Impact** — what a user, operator, or maintainer can observe.
- **Action** — what must happen next, or `None`.
- **Risk** — what remains uncertain or costly, or `None`.

Keep each item to one or two sentences. A reader should understand the outcome
without knowing the rule IDs, file layout, or internal symbol names.

After this summary, organize the complete evidence by its owning domain and
responsibility using report-write. Preserve the complete evidence required by
the owning skill.
Easy wording never permits dropping a requirement value, allowed set, state rule,
permission, mandatory field, ordering rule, unit, finding, unverified axis, test
result, or residual risk.

When a related ADR supplies a genuine analogy, compare at most two. Select by a
shared architectural question, contract, state/failure rule, or durable
boundary—not keywords, technologies, files, or functions. Write one short prose
paragraph per comparison: what is similar, what differs, and how that difference
changes the implementation or tests to inspect. If no analogy helps, omit the
paragraph and preserve the structured omission reason.

## Use plain, exact language

- Name the actor and observable behavior: `The checkout API rejects a second
settlement`, not `idempotency is handled`.
- Explain an unavoidable domain or technical term on first use in one short clause.
- Put the user or operational symptom before an internal category or symbol name.
- Use paths, symbols, rule IDs, commands, and quotations in the evidence section,
  not as the first explanation of the result.
- Keep one idea per sentence and one finding per paragraph or list item.

## Visualize relationships the reader would reconstruct

Classify the visual map from the confirmed implementation scope. Mark it
required when any trigger applies:

- three or more participants, processing steps, states, components, or ADRs;
- a system boundary, dependency, or contradiction;
- an asynchronous or cross-system request or event flow;
- a state transition, failure, retry, rollback, or fallback;
- a changed data relationship; or
- a refactor spanning multiple call sites or changing how work moves between them.

Choose the diagram by the review question. Prefer a component view using
`flowchart` for responsibility and dependency questions; state diagrams serve
lifecycle questions that sequence or component views do not explain:

| Question                                                            | Mermaid           |
| ------------------------------------------------------------------- | ----------------- |
| Who calls whom, and in what order?                                  | `sequenceDiagram` |
| Which lifecycle transitions are allowed or forbidden?               | `stateDiagram-v2` |
| Where does the flow branch, fail, retry, or depend on another item? | `flowchart`       |
| Which changed data relationships matter?                            | `erDiagram`       |

Draw only relationships established by the ADR, code, diff, or executed evidence.
Use short behavior labels instead of implementation trivia. After the diagram,
write one sentence beginning with `Notice:` that states the review point.

For implementation-review artifacts, apply
`${CLAUDE_PLUGIN_ROOT}/skills/adr-impl-review/references/visualization.md`. Assign question-level
`diagramRequirements` to each Hill through `diagramIds`, or record that Hill's
concrete `diagramOmissionReason`. Prefer sequence views for request/response
order and component views for roles and boundaries. State values alone do not
justify a state diagram. Check every important relationship and inspect the
rendered HTML; source fallback is not a completed required visualization.

The prose must remain independently reviewable when Mermaid does not render.
Other review skills keep their own artifact format; do not create an
implementation-review JSON package just to use this writing guide.

## Remove mechanical writing patterns

Every sentence must contribute a verdict, contract, evidence, impact, action, or
risk. Delete:

- praise, reassurance, and conversational applause;
- scene-setting, throat-clearing, and restating the user's request;
- repeated conclusions, findings, evidence, or diagram narration;
- generic best-practice advice without a project rule, code location, and concrete
  failure or maintenance cost;
- speculative future extensibility and hypothetical work outside the review scope;
- vague instructions such as `improve this`, `handle appropriately`, or `add
necessary tests`;
- empty headings and sections whose only content is `none`, unless the owning
  artifact schema requires the section.

Also rewrite repeated contrast templates, one-off ornamental English labels,
forced numbered symmetry, filler bridges, and visual elements that repeat
adjacent prose. Never invent a user story, project result, measurement, or
causal relationship to make a report feel more narrative.

Prefer the shortest wording that preserves the full contract. Concision is not a
reason to hide evidence or merge independent obligations.

## Review-specific visual emphasis

- **ADR document review** — visualize cross-ADR contradictions, duplication,
  dependencies, or repeated leaks. A single ADR style finding rarely needs a
  diagram.
- **ADR sync** — visualize a changed decision flow, dependency/category movement,
  or unresolved ADR-versus-code branch. Keep semantic diffs in text.
- **Implementation review** — organize the final report by evidenced domain,
  bounded context, or vertical capability. Present purpose and the important
  behavior before implementation details. Keep claims, examples, verification,
  findings, and limitations with their owning domain. Group more than four peers
  semantically rather than truncating them or enforcing a flat paper outline.
  Preserve Component, Code, contract coverage, scope, metrics, implementation
  choices, and raw evidence as appropriate drill-down material.
  Keep required comprehension questions and ruling controls intact. Place the
  `Comprehension check` after the relevant domain's conclusion and before detailed
  evidence; preserve the existing question count, four options, answer hiding,
  neutral feedback, and separation from the code verdict. Do not start a quiz
  without a request or invent a comprehension-ready status.

For the default reading path, use connected prose before structured evidence.
Each domain should read as a concise tutorial or senior review comment, using
continuous essay paragraphs before the supporting structured fields.
Context gives intent, contracts, and scope; each Container/Hill owns a vertical
capability, Component explains its implementation, and Code supplies focused
evidence. Keep these reading levels distinct inside the owning domain.
Use the caller's canonical Markdown/JSON as audit input when a fixed schema is
required. Compose the final human view with report-write; native schemas are
not permission to deliver a flat or unreviewed human report.

- **Implementation refactor** — visualize before/after work flow only when several
  call sites or processing stages are involved. A local rename or extraction does
  not need one.

For printed handouts, use a white background and readable page margins. Print
questions with their choices, without answer keys, feedback, selected-option
marks, or screen controls. Preserve detailed evidence in the HTML report.
