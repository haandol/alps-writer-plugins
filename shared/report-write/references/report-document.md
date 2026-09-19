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
For an implementation review's comprehension check, preserve the original
questions, four choices, answer criteria, and the distinction from the code
verdict. Do not automatically start a quiz or claim PR readiness.

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
