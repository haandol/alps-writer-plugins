# Structured report document

For HTML or Markdown delivery, the included renderer checks hierarchy and
source coverage. It does not perform editorial judgment. Complete the semantic
review in `editorial-review.md` before calling the report complete.

Run from any project:

```sh
node <skill-directory>/scripts/render-report.mjs report.json --out report.html
node <skill-directory>/scripts/render-report.mjs report.json --out report.md --format markdown
```

## Document fields

- `title`, `language` (`en` or `ko`), and `summary` (one to four paragraphs).
- `sections`: one to four domain nodes. Each has `id`, `title`, `domain`, `scope`,
  optional `paragraphs`, optional `children`, optional `diagram`, and optional
  `evidence` and `expanded`. Set `expanded: true` for material non-PROVEN
  evidence or actionable findings that the caller requires visible.
  Child explanation nodes and evidence disclosures together have at most four
  peer items under their parent. Paragraph groups also have at most four items.
  Node identifiers are unique across the document and retained as anchors in
  HTML and Markdown. Report-local fragment links must name an existing node.
- `requiredEvidenceIds`: the caller's complete list of evidence or contract
  identifiers that must remain reachable. Each must occur in exactly one node's
  evidence. Do not derive this list by dropping items from the source.
- `review`: `status` is `reviewed` or `draft`; describe the actual `basis` and
  unresolved `limitations`. These are temporary report metadata, never approval
  state or a claim of independent human review.

A domain node names a known responsibility or explicitly identified editorial
scope. Paragraphs contain plain text with blank lines for semantic breaks.
Do not embed extra headings or lists to bypass the child limit.

An evidence item has `id`, `label`, `source`, and optional `excerpt`.
Use a local path, fragment, or HTTP(S) source. Full originals may remain in
companion files. Empty evidence is permitted only when the caller has no
required evidence identifiers; do not invent sources.

## Diagrams

`diagram` has `source` (Mermaid), `explanation`, and optional `required`.
The dependency-free renderer supports the common sequence, flowchart, state,
and entity relationship subset used by the plugins. Unsupported statements
are never silently discarded. A required unsupported diagram fails delivery;
an explicitly optional unsupported diagram retains a visible source warning.

## Compatibility with specialized reports

The caller's original findings, coverage identifiers, tests, lifecycle verdict,
and raw files remain intact. If its renderer cannot express the new hierarchy,
use it as an audit source and create the final report through this skill.

Place specialized interactions and source material in the owning domain.
Generate questions using [comprehension support](comprehension.md). Preserve
an implementation review's native question data and its distinction between
code verdict and comprehension readiness. Its renderer can use the shared
quiz controls while retaining the review's evidence schema.

## Quiz data and output

Add `comprehensionCheck: { "questions": [...] }` to a substantive report. Each
question contains:

- `id`: `Q1` through `Q5` in order; `sectionId`: the existing domain node after
  whose explanation the question belongs; `question`: its visible prompt.
- `options`: exactly four objects with `id` (`A` through `D` in order), `text`,
  and neutral `feedback`; `correctOptionId`: exactly one of those option ids.
- `explanation`: why that choice follows from the document; `evidence`: the
  document passage or original source that supports the answer.
- `revisit`: boolean; one or two questions are true, or the sole question is true.

There are one to five questions across the whole report. A node's questions,
children, and evidence disclosures together may not exceed four peer items.
Group by meaningful subject when necessary. The renderer rejects unknown
section references, ambiguous choice structure, excess questions, and missing
answer evidence; it does not judge whether a question is central or of medium
difficulty.

HTML places each question with its owning explanation and supplies staged
choice/answer disclosure. Print excludes answers, feedback, controls and
selection marks. Markdown places the questions and choices first, then a
clearly separated answer and explanation block. Omit `comprehensionCheck` only
for the reasons in the common workflow; older inputs without it remain readable.
No model call occurs in the renderer: the author generates and reviews the
questions before rendering.

## Example

```json
{
  "title": "Repeated requests keep one payment result",
  "language": "en",
  "summary": [
    "The duplicate-request check passed. Provider timeout recovery still needs verification."
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
      "paragraphs": [
        "A retry returns the previously recorded result instead of starting another charge."
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
