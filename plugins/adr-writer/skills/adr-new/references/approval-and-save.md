# ADR approval and save

Step numbers refer to the [parent workflow](../SKILL.md). Read this module only
when that workflow selects it.

### 7. User confirmation

Show a verified **Decision Digest** and ask for approval. The digest is an ephemeral reading view over the ADR, not a second artifact or source of truth; the complete ADR body and `.mapping.json` remain authoritative. Show the full ADR body or detailed Alternatives only when the user asks or when the digest cannot expose a material ambiguity:

Before showing the digest, read
`${CLAUDE_PLUGIN_ROOT}/references/comprehension-load.md` completely and apply
its advisory score.

Only when the user asks to split, offer up to three candidates. Split into
separate ADRs only for independent decisions. Keep one inherently difficult
decision in one ADR and offer implementation steps instead; never split by
technical layer.

```
## Decision Digest — ADR <NNNN>: <title>

**Decision intent**: <the verified problem, pressure, and result this decision exists to protect>
**Decision question**: <the architectural question this ADR answers>
**Current decision**: <2-3 sentences stating the final state>
**Category**: <category key — e.g. identity/login (context: identity, subdomain: core)>
**Comprehension load**: <N>/10
**Decision Drivers**: <real discriminators; usually 3-5>
**Decision-changing assumptions**: <assumption → what decision is reconsidered if false; omit when none>
**Requirement contract**:
- Required guarantees: <verbatim values and rules with their basis, or omit this row>
- Prohibitions: <forbidden states, transitions, actions, or visibility, or omit this row>
- Failure guarantees: <what remains guaranteed on rejection or failure, or omit this row>
- Observable evidence: <one implementation-independent result per obligation; no test or code details>
<write "none" only when the complete contract is empty>
**Why this decision**: <the discriminating rationale against the realistic alternatives>
**Main risks**: <the negative consequences or material uncertainties>
**Regeneration checklist**: <each contract rebuilt code must honor and the observable result used to review it, marked present; unresolved items are explicit questions>
**Alternatives considered**: <N realistic options; expand only on request or when one affects approval>
**Prerequisites**: <dependency ADRs, or none>
**Verification**: <harness: pass | n warnings> · R1-R20 checked · independent read: <used|not needed>

Does this current-state decision, any decision-changing assumptions, complete contract, rationale, risks, and complete regeneration checklist match your intent? If approved, save the full ADR as `Proposed` and move on to implementation (`/adr-impl`). This is the routine intent/spec-fitness confirmation; implementation review does not ask the same questions again unless the ADR changes or a genuine contract ambiguity is discovered.
```

> Show the context/subdomain information on the category line only when step 2 item 6 was asked and answered — otherwise print the category key alone.

Do not start changing code, repository ADR bodies, or the repository mapping
before approval. If the user requests changes, revise and verify the disposable
candidates and confirm the changed decision or contract. Reuse an explicit
approval already covering the same candidate decision, contract, and scope;
validation alone does not require another confirmation.

Before applying, recheck the target path, existing decision owners, and affected
mapping records against the drafting baseline. Preserve intervening edits and
revalidate affected candidates; if a path is occupied or ownership changed,
resolve it before writing. Ask again only for a changed decision, contract, or
approval scope. Apply the approved ADR as `Proposed` and its mapping change to
the final paths, together with any approved supporting-document changes. Do not
replace the entire live tree or overwrite unrelated mapping records from the
draft snapshot. Verify the final document structure, links, and mapping agreement
from the repository root. Preserve the approved ADR as the implementation
baseline; after code and review pass, `/adr-impl` promotes it without another
routine confirmation. If approval is withheld, leave live ADR bodies and mapping
unchanged and report the pending decision.
