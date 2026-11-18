# Reviewing ADRs before the first model

Start with any code-conformance evidence already supplied for the selected ADRs.
Check which contracts and implementation revision it covered, which findings
remain open, and whether those inputs have changed. Reuse current findings
within that scope. If they settle the requested check, go straight to the
ADRs; revisit only changed or uncovered obligations, or an explicitly requested review.

When there is an outstanding review choice, read `show adr-review`
through [project preferences](preferences.md). A current instruction takes
priority. Otherwise use `review-first` or `build-direct` without repeating the
question. Only when undecided, ask in their language: “Would you like to review
the existing ADRs and address any findings first, or build with the current
documents?” Wait for the choice. Remember an explicit answer unless it applies
only this time. Do not record a route when there are no ADRs.
Choosing to build immediately takes the current documents into EventStorming.

Follow the requested review purpose. For document quality, run `/adr-review`.
For “does the code implement these ADRs?”, use `/adr-impl-review` on the
relevant ADRs if conformance has not already been verified. `/adr-sync`
is the route for a requested reconciliation of proven drift. A saved review
preference grants no editing permission. If the needed reviewer is unavailable,
let the user enable ADR Writer or choose to proceed with the current documents.

The review reports findings. If there are none, resume the requested build.
Otherwise show the findings and ask which to address or whether to proceed
as-is. Apply only approved edits to the ADR that owns the decision through
ADR Writer's authoring workflow. Re-read the resulting ADRs before drafting the model. Carry any
unresolved conflicts as open questions. The user approves model saving after
reviewing the candidates.
