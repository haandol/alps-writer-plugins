# Code evidence in review reports

Use this reference when a selected report explains code changes or an existing
implementation. The reviewing workflow determines scope, findings, severity and
verification; presentation does not reopen those decisions.

## Select the change that explains the result

Explain the trigger, before/after behavior and impact in the owning domain before
showing code. Include the actual unified diff for the important changed logic,
with enough unchanged context to understand the condition, branch or boundary.
Prefer a few relevant hunks over a whole repository patch. Keep each selected
hunk intact, including its header and context; select other complete hunks or
link the full patch instead of silently cutting lines inside one.

Use the comparison range already selected by the review. Identify its base and
head or working-tree scope near the evidence; do not guess a different baseline.
Preserve file paths, hunk locations, literal code and the relation to the finding.
Link to the full patch or source artifact when the displayed hunks are selected.
An explanation of the change is not a replacement for actual changed lines.

For a review with changes, show the key diffs needed to assess the findings and
main behavior changes. Preserve any stronger coverage rule from the caller:
implementation review requires at least one diff when its change scope is
nonempty. A review of existing code without a change range uses a source excerpt.
If a diff cannot be obtained, state that limitation and retain the available
code; never invent a before version or label an excerpt as an observed diff.

## Place evidence with its explanation

Keep the selected diff, source location, explanation and actual verification
under the domain or component they support. State which test or reproduction
checks the changed behavior and whether it ran; rendering code is not evidence
that the behavior passed. A fix proposed by the reviewer stays visibly distinct
from the reviewed change and is never presented as an applied or tested patch.

Code evidence defaults to collapsed. When a key hunk is needed to understand a
result or required action, it may be expanded through the existing evidence
controls. Keep the material finding visible in prose either way. Additional
diffs are supporting evidence, not additional explanation branches.

## Render without changing the evidence

For the shared structured renderer, use an evidence item with `kind: "diff"`,
the exact selected unified patch in `excerpt`, and its artifact path in `source`.
Use `label` to identify the file or behavior; explain the baseline, significance
and related checks in the owning node's paragraphs. Evidence `kind` is `excerpt`
(the default) or `diff`; diff excerpts include the file and hunk headers.

The shared renderer uses bundled diff2html to generate the HTML before delivery.
Use its single-column view with old/new line numbers for reading and printing;
do not substitute a raw patch viewer or fetch a runtime library from a CDN.
The HTML view distinguishes additions, deletions and hunk headers, preserving
the `+`/`-` markers so color is not the only cue. Wide lines scroll inside the
code region on screen and wrap for print. Markdown uses a `diff` fence. Plain
excerpts keep their existing rendering. Keep the complete native findings and
code-evidence schema as supporting artifacts when adapting a specialized review.
Mark key hunks needed for the printed explanation as `expanded: true`; optional
raw source does not need to become a printed appendix. Check page breaks, line
number alignment, long paths and code wrapping in the supported output, and
distinguish static print styles from an actual rendered print check.

## Diff data example

This is an illustrative format example, not an observed change. Replace it with
actual hunks and an accessible source from the review's selected comparison.
The renderer needs no browser JavaScript or package installation to display it.

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
