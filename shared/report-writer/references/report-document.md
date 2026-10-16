# Structured report document

HTML is the default delivery format unless the user requests otherwise. For
HTML or Markdown delivery, the included renderer checks hierarchy and
source coverage. It does not perform editorial judgment. Complete the semantic
review in `editorial-review.md` before calling the report complete.

Run from any project with explicit input and output paths. For a review, use
the run directory prepared through [review artifact storage](review-artifacts.md)
for both the source document and rendered output:

```sh
node <skill-directory>/scripts/render-report.mjs <run-directory>/report.json --out <run-directory>/report.html
node <skill-directory>/scripts/render-report.mjs <run-directory>/report.json --out <run-directory>/report.md --format markdown
```

The CLI defaults to HTML and never opens a browser itself. After verification,
follow [final delivery](format-and-layout.md#final-delivery).

## Document fields

- `title`, `language` (`en` or `ko`), `purpose`, `background`, and `summary`.
  Newly authored reports put the intended reading outcome in `purpose`:
  what this report should enable the reader to understand, distinguish, decide,
  explain or do. Put the confirmed problem, situation and request trigger in
  `background`, including relevant scope and priorities. Each is one or more paragraphs.
  A request recap or product aspiration alone is insufficient; apply the
  [opening meaning checks](editorial-review.md#check-the-openings-intended-use).
  Put the answer, implication, and material limitations
  in `summary` (one or more paragraphs). The renderer presents `purpose` under
  "Purpose" ("목표"), then `background` under a separate "Context" ("배경")
  heading, followed by the answer in its own area before navigation.
  An optional `summaryTitle` supplies an
  authored answer heading; no default title is imposed. Do not repeat headings
  as paragraph labels or invent missing context. Legacy inputs may omit
  `purpose` or `background`: existing text remains intact without being split,
  moved between fields or supplemented by a guessed meaning. Omitted fields
  produce no empty sections. These presentation fields do not alter a caller's
  original audit schema or store approval state.
- `sections`: one to four domain nodes. Each has `id`, `title`, `domain`, `scope`,
  optional `preview`, optional `paragraphs`, optional `children`, optional `diagram`, and optional
  `evidence` and `expanded`. Omitting `expanded` defaults to an open subsection;
  `true` also opens it. Use `false` only for an explicitly requested collapsed
  screen view, never automatically for successful findings or routine detail.
  Required visible findings stay open. Evidence uses its separate item-level
  `expanded` flag below; printing always includes the explanatory subsections.
  Each parent has at most four child explanation nodes. Supporting evidence
  and quizzes are counted separately, so adding a source or question does not
  force another explanation level. Paragraph groups have no numeric limit; use semantic breaks without
  inventing child nodes to accommodate paragraphs.
  Authors choose node titles and organization for the subject and reader's
  questions; there is no prescribed set of body section names. Preserve the
  owning workflow's mandatory content without adding empty template sections.
  Node identifiers are unique across the document and retained as anchors in
  HTML and Markdown. Report-local fragment links must name an existing node.
- `requiredEvidenceIds`: the report's complete evidence-ID inventory, preserving
  every identifier required by the caller. Include IDs for any additional source
  items the report cites. Every listed ID must occur in exactly one node's
  `evidence`, and every evidence item's ID must be listed. If the caller supplies
  no IDs, assign IDs to the actual sources you use and list them here; do not
  leave `[]` while adding evidence items below. Use `[]` only when the report has
  no evidence items and the caller has no required IDs. Do not drop required
  evidence or invent source content to make the sets match.
- `review`: `status` is `reviewed` or `draft`; describe the actual `basis` and
  unresolved `limitations`. These are temporary report metadata, never approval
  state or a claim of independent human review.

Follow [explanation design](explanation-design.md) for domain scope, intent and
meaningful descent. Encode explanations as plain-text `paragraphs`, with blank
lines for semantic breaks; do not embed headings or lists to bypass the child
limit. No reader-profile, intent registry or depth fields are needed.

Use `preview` for a short statement of what a branch adds. HTML
shows it with the title even if the reader collapses the branch; older nodes fall back to their existing
`scope`. Markdown includes it below the title. Do not duplicate a whole paragraph
or hide a material limitation only in the preview. Substantive parents explain
their children's relationship; structural validity alone cannot verify this,
and simple source lists need no artificial summary.

An evidence item has `id`, `label`, `source`, optional `excerpt`, optional `kind`, and optional
boolean `expanded`. `kind` accepts only `excerpt` (the default) and `diff`; omit it
or use `excerpt` for ordinary sources.
Evidence defaults to collapsed. Set `expanded: true` when the
reader needs that item to understand the result, limitation, or next action, or
explicitly requests it open. Its enclosing group also opens, while sibling items
remain collapsed unless independently marked. Printing includes marked evidence
even if the reader later collapses it; other evidence is included only when both
the item and its group are open. Do not use requiredEvidenceIds as an expansion
list, and keep conclusion-changing facts in the body as well.
Use a local path, fragment, or HTTP(S) source. Full originals may remain in
companion files. Empty evidence is permitted only when the caller has no
required evidence identifiers; do not invent sources.
Keep section descriptions and line information in `label` or the excerpt;
`source` is an actual resolvable target relative to the delivered report, or an
absolute path/URL. A label such as `source.md (Section 1)` is not a file path.
Sources appear in an evidence group after the owning explanation and its quiz.
There is no source-count quota; preserve every required source and group by the
claim it supports rather than inventing explanation nodes to fit a count.

## Optional content

Read the relevant module only when authoring or checking that content:

- **Figures:** [diagrams](diagrams.md#structured-renderer) owns the `diagram`
  fields, syntax validation and honest rendering status. Omission is valid.
- **Code diffs:** [code evidence](code-evidence.md#diff-data-example) owns
  `kind: "diff"`, complete patch hunks and their presentation.
- **Quizzes:** [comprehension support](comprehension.md#structured-quiz-data)
  owns `comprehensionCheck`, question rules and staged disclosure. Omission is valid.

## Compatibility with specialized reports

Keep the caller's findings, coverage identifiers, tests, lifecycle verdict, raw
files and required interactions intact. If its renderer cannot express the
hierarchy, retain its output as audit input and compose the human view here.
Use existing fields and content modules without changing a caller's native audit
schema or conflating code verdict with comprehension readiness.

## Minimal example

This illustrative input omits figures and quizzes. Replace its facts, review
status and source path with actual report content and verification.

```json
{
  "title": "Repeated requests keep one payment result",
  "language": "en",
  "background": [
    "A repeated payment request may have a recorded completion or an unknown provider outcome. This review helps the developer distinguish which retry behavior the evidence supports and which recovery path still needs verification before relying on the no-duplicate-charge guarantee."
  ],
  "summary": [
    "Payment retries must not create a second charge. The completed-payment retry check passed: the same key returned the recorded result. Provider timeout recovery still needs verification, so this result does not establish safety for every retry path."
  ],
  "requiredEvidenceIds": ["R1"],
  "review": {
    "status": "reviewed",
    "basis": "The author checked the source contract, the recorded test and the final report.",
    "limitations": "Provider timeout recovery was not executed."
  },
  "sections": [
    {
      "id": "settlement",
      "title": "Payment settlement",
      "domain": "Payments",
      "scope": "One result for repeated requests with the same key",
      "preview": "Why completed retries reuse one result and what remains unverified.",
      "paragraphs": [
        "For an already completed payment, a retry with the same key returns the recorded result and creates no second charge. This check covers completed payments; it leaves the provider-timeout path unresolved."
      ],
      "evidence": [
        {
          "id": "R1",
          "label": "Duplicate-request test",
          "source": "test-result.txt",
          "excerpt": "One charge and one stored result were observed."
        }
      ]
    }
  ]
}
```
