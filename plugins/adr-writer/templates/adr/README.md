# Architecture Decision Records (ADR)

This directory documents the project's major architectural decisions. An ADR is the rationale behind the code implementation, and new decisions are written directly with `/adr-new <category>`. In a project that also has an ALPS (PRD), each Section 7 feature can be converted into an ADR in one pass with the `/feature-to-adr` helper.

This document is the directory's index — what an ADR is, the template to write one from, and where the ADR list lives. The principle, the rules, and the layout live in sub-documents.

When uncommon terminology needs explanation, `glossary.md` at this root stores
confirmed term meanings. It is created only when needed, is not an ADR or mapping
entry, and does not replace the requirements in ADR bodies. Read it selectively;
normal authoring requires no upfront terminology exercise.

> **Read [`concepts.md`](./concepts.md) before writing or reviewing an ADR.** It holds the one principle every rule here follows from — PRD, ADR, and code are the same system at three resolutions, and each level earns its place by what it refuses to show — plus the ADR admission gate, gray zone, regeneration test, requirement gate, dependency model, and how Status moves. The rules below are that principle applied case by case, so they read as arbitrary without it.

- [`concepts.md`](./concepts.md) — how ADRs work here: the abstraction ladder, ADR admission gate, gray zone, regeneration test, requirement gate, one-way dependency model, Status and its automatic transitions
- [`authoring-rules.md`](./authoring-rules.md) — what goes into an ADR body and what stays out: the requirement gate and two filters, requirement values vs implementation tuning values, code-reference depth, DB changes as one unit, prose style, and the review checklist
- [`structure.md`](./structure.md) — the DDD domain (bounded context) × feature directory layout, feature sub-folder splitting, subdomain classification, and the [`ADR registry`](./structure.md#the-adr-registry-mappingjson) (`.mapping.json` policy)

## What is an ADR?

An Architecture Decision Record (ADR) documents an important architectural decision made during software development. Each ADR contains:

- **Context**: the background and problem that required the decision
- **Decision Drivers**: the pressures, constraints, and requirements used to evaluate the options (only those that genuinely discriminate between them)
- **Decision**: the decision made and why
- **Alternatives**: **at least two** realistic alternatives and why they were not adopted
- **Consequences**: the positive and negative effects of the decision

An ADR first has to pass the **ADR admission gate**: its core subject must change a durable requirement, boundary, provider/model/fallback, key design, algorithm, or cross-implementation trade-off. It then records only the **gray zone** between business requirements and code — the rationale a reader cannot recover from the code, plus the requirement contract the result must honor. Replaceable libraries, SDKs, frameworks, credential/auth wiring, and module structure stay at code resolution.

## ADR template

```markdown
# ADR XXXX: title

Date: YYYY-MM-DD

## Status

Proposed | Accepted (YYYY-MM-DD) | Deprecated (YYYY-MM-DD) | Superseded by [ADR XXXX](link)

<!-- The Accepted/Deprecated parentheses hold the transition date only — no trailing references or explanations. -->

## Context

The background and problem requiring the decision. _Absorb_ the PRD's business motivation and narrate it here — never write an ALPS file path, section number, or feature ID in the body. Never point at the PRD (adr-writer does not reference ALPS).

When the adopted alternative depends on an assumption, add one short line here or under the relevant Decision Driver: `Assumption: <fact> — reconsider <decision> if false`. Do not add a separate assumptions section or confidence table. Requirement values and rules belong in the requirement contract below. Replaceable libraries, SDKs, adapters, internal structures, and tuning defaults belong in code and the implementation review's ephemeral Notable implementation choices.

## Decision Drivers

- The 3-5 pressures, constraints, and requirements that discriminate this decision. Not generic quality attributes ("maintainability") but only what genuinely decides between the options.
- Examples: "handle 10k concurrent users", "PII must not leave the system", "the team has Go experience only".

## Decision

The currently valid decision and why. State the result directly; do not describe it as a transition from a previous identifier, value, or approach.

### Requirement contract

(What the result must honor — so it can be rebuilt from this alone once the code is gone. Record **requirement values with their number and basis verbatim**, such as limits, quotas, cycles, retention periods, and allowed ranges. Example: "a chat session is capped at 20 turns — pricing policy". **Record non-numeric requirements here too** — allowed value sets and forbidden transitions, mandatory fields, permissions and visibility, ordering and uniqueness, units. Example: "an order is paid, shipping, delivered, or cancelled, and a cancelled order never moves to shipping". Do not record implementation tuning values (pool sizes, backoff, cache TTL) or enum identifier names.)

Group populated contract rows under **Required guarantees**, **Prohibitions**, **Failure guarantees**, and **Observable evidence** so a reader can recover what must happen, what must never happen, what remains guaranteed when an operation fails, and what result shows whether each obligation was met. Write one independently reviewable obligation per row. Observable evidence is implementation-independent: record the result to observe, never a test file, command, function, class, library, fixture, or internal data representation. Omit an empty group instead of writing filler. This grouping changes presentation only: preserve every exact value, allowed state, permission, ordering rule, uniqueness rule, and basis.

### Sequence diagram

If a flow, state, boundary, or alternative relationship is clearer visually, add a grounded Mermaid diagram. Draw only relationships that belong at architectural resolution; never copy a code call graph or add a decorative diagram.

### Alternatives

Compare **at least two** realistic alternatives. Real alternatives only — never include a strawman (an option nobody would take). Write each alternative's pros and cons against the Decision Drivers above. If it truly was the only path, reconsider whether the decision needs an ADR at all.

## Consequences

### Positive / Negative / Risks

## Implementation Notes

(An optional section — keep it only when there are architecture-level implementation considerations, and omit it otherwise.) Architecture-level considerations only. Do not include code snippets, file paths, per-field schemas, or implementation tuning values. Requirement values go in the Decision's requirement contract, not here.

## Related

- Related ADRs: [...] (links to ADRs in the same or a depended-upon category — ADR ↔ ADR references are fine)
- Schema/table documents: [...] (when there is a DB change)

> adr-writer is standalone, so an ADR body never points at the PRD — do not write an ALPS feature link here either. The mapping stores no PRD reference.
```

> The template's section headings are illustrative. Write ADR bodies in the language the user writes in (`authoring-rules.md` "Conventions") — the harness accepts either an English "Alternatives" heading or its localized equivalent.

## Where the ADR index lives

The ADR list is held solely by [`docs/adr/.mapping.json`](./structure.md#the-adr-registry-mappingjson) rather than this README — each category's `adrs[]` record carries a path, Status, and one-line summary, and admitted work reads that index on demand before code changes. So the README keeps no separate ADR list and remains a **conceptual index** only. When you add an ADR or its body decision changes, update that one-line summary in the corresponding `adrs[]` record in `.mapping.json`.

## References

- [ADR GitHub](https://adr.github.io/) — a collection of general ADR material
- [Joel Parker Henderson — ADR templates](https://github.com/joelparkerhenderson/architecture-decision-record) — a comparison of various templates
- [Michael Nygard — Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) — the original ADR article
- [adr-writer plugin](https://github.com/haandol/alps-writer-plugins) — this plugin itself

<!-- adr-writer:rules-version 0.8.24 — seeded by /adr-new. `adr-structure-lint` warns when this trails the installed plugin; refresh with /adr-new (it re-seeds a stale doc set). Keep this line on re-seed. -->
