# Recommended review after saving

Read after the approved ADR and mapping are saved and their structure is valid.

Normally continue with `/adr-review <saved-adr-path>` as the recommended
document review, without another routine permission question. Target the saved
ADR, not every ADR in its category or repository. Carry its approved intent and
requirement sources and any reusable current document-check evidence; the review
derives its verdict from those sources rather than the author's self-check.

Honor an explicit request to skip or defer this recommended review. Reuse a
completed document review when the saved decision, contract, relevant sources
and checks are unchanged. A pre-save authoring self-check alone is not that
follow-up review. Do not review an unsaved/unapproved candidate through this
path, and do not force a particular agent topology.

The review is code-free and report-only. Keep the saved ADR `Proposed`; neither
document PASS nor skipping the recommendation proves implementation completion.
Return the review verdict and any unresolved criteria, or the actual skip/reuse
reason. If the review cannot run, report that limit without claiming PASS or
undoing the approved save. The recommendation is not another save/approval gate.

Route findings to authoring with their source basis. The reviewer never rewrites
the approved contract to make a finding disappear; a new or changed contract
still follows the existing approval boundary. Preserve valid prior approvals.

Then continue implementation when the user already requested it and required
contracts/prerequisites are settled. Otherwise name `/adr-impl <saved-adr-path>`
as the next available action, without starting unrequested code changes or
asking whether to repeat the completed review.
