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

The CLI defaults to HTML and writes the output without opening a browser.
Include useful diagrams whenever evidence and format support them. For an
overview-first walkthrough, prefer an overview in the first top-level node,
after the brief background and answer. Diagram presence is never a validation
or delivery requirement; reports without figures remain valid. Editorial review
checks whether feasible figures would help, the meaning of any supplied figure,
and the relationships and limitations preserved in prose when figures are absent.

After final verification, follow [final delivery](format-and-layout.md#final-delivery)
to open the HTML once in the default browser and return its absolute path.

## Document fields

- `title`, `language` (`en` or `ko`), `background`, and `summary`.
  Newly authored reports put the confirmed problem and intended reading outcome
  in `background` (one or more paragraphs): why this document is useful and what
  the reader should be able to distinguish, decide, explain or do with it.
  A request recap or product aspiration alone is insufficient; apply the
  [opening meaning checks](editorial-review.md#check-the-openings-intended-use).
  Put the answer, implication, and material limitations
  in `summary` (one or more paragraphs). The renderer gives only `background`
  the localized "Background and goals" heading, then presents the answer in a
  separate area before navigation. An optional `summaryTitle` supplies an
  authored answer heading; no default title is imposed. Do not repeat headings
  as paragraph labels or invent missing context. Legacy inputs may omit
  `background`: their summary remains intact without being relabeled or split
  by a guessed meaning. These presentation fields do not alter a caller's
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

A domain node names a known responsibility or explicitly identified editorial
scope. Nesting alone does not establish a lower abstraction level: paragraphs
should connect a child to the parent object or relationship it expands and
explain the newly visible internals. Peer cases and evidence remain distinguishable
from that descent. Use existing paragraphs for a familiar analogy, its mapping
to actual terms, and relevant limits; no reader-profile or depth fields are needed.
Paragraphs contain plain text with blank lines for semantic breaks.
Use these existing paragraphs to connect the user's intent and scope to material
autonomous choices and their evidenced result. This explains how unspecified
details stayed within the original purpose; no intent registry or new fields
are required.
Do not embed extra headings or lists to bypass the child limit.
Make its title and opening paragraph useful together: name the responsibility
and state the outcome or finding before mechanism and evidence. Use `scope` to
bound that claim, not to repeat a generic domain label.

Use `preview` for a short statement of what a branch adds. HTML
shows it with the title even if the reader collapses the branch; older nodes fall back to their existing
`scope`. Markdown includes it below the title. Do not duplicate a whole paragraph
or hide a material limitation only in the preview. Substantive parents explain
their children's relationship; structural validity alone cannot verify this,
and simple source lists need no artificial summary.

An evidence item has `id`, `label`, `source`, optional `excerpt`, optional `kind`, and optional
boolean `expanded`. Evidence defaults to collapsed. Set `expanded: true` when the
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

## Code diffs

Evidence `kind` is `excerpt` (the default) or `diff`. With `kind: "diff"`, `excerpt`
must contain actual unified patch hunks, including file and hunk headers. The
renderer uses bundled diff2html to produce static HTML with old/new line numbers,
addition/deletion markers and highlighted changes. No browser JavaScript, CDN or
package installation is needed to display the diff. Markdown retains the exact
patch in a `diff` fence. Plain excerpts remain literal text.

```json
{
  "id": "retry-diff",
  "label": "Retry guard · src/retry.ts",
  "source": "changes.patch",
  "kind": "diff",
  "excerpt": "diff --git a/src/retry.ts b/src/retry.ts\n--- a/src/retry.ts\n+++ b/src/retry.ts\n@@ -1 +1 @@\n-if (retry) send();\n+if (retry && !completed) send();\n",
  "expanded": true
}
```

This is a format example, not an observed code change. Obtain the real patch
from the review's selected comparison, preserve complete selected hunks, and
explain their baseline, behavior and related verification in the owning node.
Keep the full patch at `source` when the inline view is selective. For a printable
review, mark key hunks needed to understand the finding as `expanded: true` so
they remain included even if the reader folds them before printing. Other source
material keeps the existing optional-evidence behavior. See
[code evidence](code-evidence.md) for selection and review boundaries.

## Diagrams

`diagram` has `source` (Mermaid), `explanation`, and optional `required`.
Every node, including a nested leaf, can carry a diagram. Its optional shape is
not a reason to omit a figure that materially helps explain that node. The
one-diagram field is not a figure budget for its domain or the whole report;
when several focused views need different explanations, use meaningfully scoped
child nodes with their own figures, not empty image-holder sections. Preserve the
four-child explanation limit and do not force a figure into a simple node.
The renderer validates syntax with the bundled official Mermaid parser, without
an additional type allowlist. It accepts class, sequence, state, ER, C4 and other
syntax supported by that version. No package installation or network is needed.
`required` controls invalid syntax, not whether a diagram must exist: the default
rejects invalid syntax before writing output; `required: false` retains the full
source and a visible warning. Markdown preserves valid source unchanged.

HTML embeds the official Mermaid engine and renders each diagram in the reader's
browser. Until SVG creation succeeds, the figure is visibly pending with its
source available; failures retain that source and an error. `data-rendered` only
becomes `true` after actual SVG creation. A syntax check or HTML write is not proof
of rendered appearance. Keep actual rendering and semantic review distinct.
Source remains inspectable after success, and authored scripts/callbacks are
inert. Choose syntax for the explanation, not to work around a local subset.

## Compatibility with specialized reports

The caller's original findings, coverage identifiers, tests, lifecycle verdict,
and raw files remain intact. If its renderer cannot express the new hierarchy,
use it as an audit source and create the final report through this skill.

Place specialized interactions and source material in the owning domain.
When including questions, use [comprehension support](comprehension.md). Preserve
an implementation review's native question data and its distinction between
code verdict and comprehension readiness. Its renderer can use the shared
quiz controls while retaining the review's evidence schema.

## Quiz data and output

When including the strongly recommended quiz, add
`comprehensionCheck: { "questions": [...] }`. Each
question contains:

- `id`: `Q1` through `Q5` in order; `sectionId`: the existing domain node after
  whose explanation the question belongs; `question`: its visible prompt.
- `options`: exactly four objects with `id` (`A` through `D` in order), `text`,
  and neutral `feedback`; `correctOptionId`: exactly one of those option ids.
- `explanation`: why that choice follows from the document; `evidence`: the
  document passage or original source that supports the answer.
- `revisit`: boolean; one or two questions are true, or the sole question is true.

There are one to five questions across the whole report, independent of the
four-child explanation limit. Group by meaningful subject when necessary.
The renderer rejects unknown
section references, ambiguous choice structure, excess questions, and missing
answer evidence; it does not judge whether a question is central or of medium
difficulty.

HTML and Markdown place child explanations before their parent's questions and
source evidence. Parent support material in Markdown names its owning scope.
HTML provides links back to child explanations when a parent has a quiz, and supplies staged
choice/answer disclosure. Print excludes answers, feedback, controls and
selection marks. Markdown places the questions and choices first, then a
clearly separated answer and explanation block. Omit `comprehensionCheck` when no quiz is selected; its absence is valid
for new reports as well as older inputs, without an omission record.
No model call occurs in the renderer: the author generates and reviews the
questions before rendering.

## Example

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
  "comprehensionCheck": {
    "questions": [
      {
        "id": "Q1",
        "sectionId": "settlement",
        "question": "A completed payment is retried with the same key. What should happen?",
        "options": [
          {
            "id": "A",
            "text": "Create a second charge.",
            "feedback": "The key already identifies a completed payment."
          },
          {
            "id": "B",
            "text": "Return the recorded result.",
            "feedback": "The completion is reused without another charge."
          },
          {
            "id": "C",
            "text": "Delete the previous result.",
            "feedback": "Deleting completion would lose the retry boundary."
          },
          {
            "id": "D",
            "text": "Always report failure.",
            "feedback": "The successful result is still available."
          }
        ],
        "correctOptionId": "B",
        "explanation": "A completed key returns its recorded result without charging again.",
        "evidence": "The settlement paragraph and duplicate-request test.",
        "revisit": true
      }
    ]
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
      "diagram": {
        "source": "sequenceDiagram\nparticipant U as Caller\nparticipant P as Payment service\nparticipant S as Stored result\nU->>P: Retry with the same key\nP->>S: Read existing result\nS-->>P: Recorded completion\nP-->>U: Return the same result",
        "explanation": "The retry returns through the stored-result path."
      },
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
