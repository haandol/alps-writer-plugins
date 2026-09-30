# Resolve the current decision from evidence

Use this reference when sync, rollup, or an existing-project import finds
different accounts of the same decision. It selects the current meaning; it
does not expand the caller's write permissions or replace the ADR admission
gate, requirement gate, code-readthrough test, or regeneration test.

## Compare the same obligation

First identify the decision owner, affected user or system, and the conditions
under which each rule applies. Different contexts, tenants, plans, or failure
conditions may legitimately have different rules. Keep distinct decisions and
different scopes separate. A later statement replaces only the obligation it
actually changes; retain every unaffected requirement and still-valid reason.

Prefer the later recorded or committed **semantic change** to the same
obligation. Read the original passages and the relevant local change history,
not just a file's latest commit date. Useful evidence includes an explicit
replacement, a decision-log entry, and the diff that introduced the new meaning.
Follow renames when locating that change. Do not use file modification time,
ADR number, formatting commits, file moves, or a stricter value as a substitute
for semantic history.

Use commit ancestry to establish ordering when history is available. Divergent
branches, equal or contradictory recorded dates, incomplete history, and a
record date that disagrees with the introducing commit's sequence can leave
ordering uncertain. State that limit and recommend a candidate with its basis;
do not manufacture a total order from timestamps. An uncommitted edit with no
known provenance is not automatically the latest intentional decision.

The user's current explicit intent or conflict resolution overrides this default.
Reuse an answer already supplied for the same obligation and scope. Preserve a
deliberate reversal as the current decision, even when it reinstates an older
alternative.

## Separate recency from authority

A known later **adopted decision** may restore a stale account without another
routine question, within the caller's authorized scope. Report the old meaning,
current meaning, and evidence for selecting it. A Proposed status does not by
itself prove either adoption or rejection: it records incomplete implementation
or review, not the user's approval.

If newer code differs from the ADR and intent is unestablished, recommend the
newer behavior as the default candidate but ask whether it is an intended
contract change or an implementation violation. Do not silently change a
requirement merely because code or tests are newer. A commit can show what
changed without establishing why it should remain a requirement. The existing
contract stays authoritative until the change is confirmed.

Keep unresolved intent, conflicting evidence, and uncertain ordering with the
affected decision for the caller's consolidated question report. Prepare
independent decisions meanwhile. Do not ask for facts that local inspection can
settle, or infer missing historical motives from plausible benefits.

## Apply within the owning workflow

After confirmation, update the existing decision owner and its summary, retain
exact values and non-numeric rules, and record major transitions from original
evidence. Keep the current rationale in the body even when it also explains a
transition in the log. Respect the Status completion gate; recency cannot make
an incomplete decision Accepted.

Rollup still selects the survivor and merge scope under its own rules. Before
deleting an original, account for each obligation as retained, explicitly
replaced, retired, or unresolved. An unresolved residual obligation keeps its
source from deletion. The latest content is not permission to merge unrelated
features, delete files, rename paths, or overwrite concurrent edits.

Recheck affected sources before applying a prepared candidate. Preserve changes
made while questions were pending; rebase the candidate and revalidate it.
Reconfirm only a new material conflict, changed contract, or expanded approval
scope. Comparison notes, source excerpts and answer routing are disposable
review evidence, never an approval registry or another contract authority.
