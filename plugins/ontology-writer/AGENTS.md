# Ontology Writer

## Core purpose

The ontology represents actual business workflows and responsibility boundaries.
Its purpose is to guide the propagation of that business structure through
feature-level ADR contracts into code organization, as intended by Domain-Driven
Design. Model the work people and systems perform, the business outcomes, rules
and hand-offs that explain it, and the language and ownership that define each
bounded context.

The business model supplies the upper structure. Existing ADRs describe functional
decisions that realize that work; their categories, technical services and source
folders are evidence, not the definition of the business domain or its boundaries.

## Keep the resolutions connected

- Discover domains, bounded contexts and workflows from business evidence and
  confirmed intent. Preserve missing or disputed knowledge explicitly.
- Connect business processes and their steps to the functional ADRs that realize
  them. Keep shared responsibilities and the actual scope of each link visible.
- Carry confirmed responsibilities, rules and dependencies into owning ADR
  contracts before implementation. Use those contracts to guide cohesive code
  responsibilities and dependencies; exact file names and replaceable structures
  remain code-level choices.
- Keep views as read-only projections of the same business knowledge. A different
  visual form or drill-down level must not redefine boundaries or invent links.

The authoritative vocabulary and ownership rules are in
[`references/ontology.md`](references/ontology.md). Construction follows
[`references/eventstorming.md`](references/eventstorming.md); completeness and
realization are assessed through
[`references/workflow-readiness.md`](references/workflow-readiness.md).
