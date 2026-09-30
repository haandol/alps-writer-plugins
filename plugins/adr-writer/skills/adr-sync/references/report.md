# Sync result presentation

Read when presenting the sync result or a pending decision report.

## Result contract

Before writing the human-facing report or chat summary, read
`${CLAUDE_PLUGIN_ROOT}/references/review-report-writing.md` completely and apply
it.

```
## ADR Sync Results (mode: deep|quick)

### At a glance
- Verdict: <what is aligned, changed, or unresolved>
- Impact: <what a developer or operator can observe>
- Action: <the next required action, or "None">
- Risk: <what remains unverified or contradictory, or "None">

### Scope
- Categories: <list or "all">
- ADRs inspected: <n>

### Evidence boundary
- Repository evidence inspected: <source/IaC/config/tests/local-only outputs>
- Live environment access: Not performed — outside adr-sync scope
- Runtime-only claims: <none | [Runtime state unverified] ...>

### Visual map
<the smallest grounded Mermaid required by the shared report guide, or omit this section>
Notice: <the decision, dependency, or unresolved branch the reader should verify>

### Fixed
- [ADR <category>/NNNN: semantic diff]
  - Decision: <Changed: old meaning → current meaning | Unchanged | Unverified>
  - Requirement contract: <Changed: exact values/rules | Unchanged | Unverified>
  - Decision Drivers: <Changed: old pressure → current pressure | Unchanged | Unverified>
  - Consequences: <Changed: old risk/trade-off → current risk/trade-off | Unchanged | Unverified>
- [ADR <category>/NNNN: document cleanup] — removed evolution narration / rewrote in present tense: <what, and how>. Gray-zone decisions preserved: <rationale, alternatives>. (only for the ADRs affected)
- [decision-log <category>] — major transitions harvested: <what>. (only when major narration was moved into the log)

### Contradictions Resolved
- [ADR A ↔ ADR B] — what conflicted and how it was reconciled

### In Sync
- [ADR ...], ...

### Index Hygiene
- .mapping.json changes (path/status/summary)
- decision-log: <lightweight verification result — newest-first order, current-ADR links valid, no PRD citations or old numbers; corrections applied>

### Suggestions
- [New ADR needed?] — an unrecorded decision that passes the ADR admission gate
- [Retire low-level ADR] — <category>: the core subject is a replaceable implementation means. Move useful guidance to code/project docs; do not synchronize it as an architectural decision
- [Supersede recommended?] — only when the decision topic has branched and the old decision must coexist as a separate record (i.e. when edit-in-place + decision-log cannot hold it — `authoring-rules.md` "Changing an ADR — edit-in-place vs supersede"). A plain decision switch is absorbed by edit-in-place + decision-log, not a supersede
- [Sub-folder split recommended] — <category>: <n> ADRs, candidate sub-features ...
- [Feature-ID naming] — <category>: old fN naming, canonicalization deferred (when the user declined)
- [Runtime state unverified] — <claim>: repository evidence was inspected, but deployed state would require live access outside adr-sync
- [Missing requirement] — <category>: a contract the code honors (<what>) is absent from the ADR. If it is a requirement, add it with its value and basis (user confirmation required)
- [Requirement value drift] — <category>: ADR "<value/set/rule>" ↔ code "<value/set/rule>". Needs a ruling on whether it was an intended change or a violation (this bucket covers not only numbers but also mismatched allowed value sets, mandatory fields, permissions, and transition rules)
```

In chat, lead with At a glance, then show each changed ADR's `Decision` and
`Requirement contract` semantic diff. Keep file locations, code evidence, and
harness detail in the full report unless they explain an unresolved
contradiction. `Unchanged` means that axis was inspected and still matches.
`Unverified` means the available evidence could not establish it and must never
be rendered as `Unchanged`.
