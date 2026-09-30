# Organize documents by business boundaries and vertical features

Use this model before classifying features in product planning, direct decision
authoring, handoff, or existing-project import. Reuse a still-valid project view
already established in the session; do not rescan the entire repository for each
small edit. The caller's document format and approval boundaries remain intact.

## Understand the existing project first

When the requested product has code, inspect its accessible repository documentation, workspace and
package manifests, entry points, deployment configuration, tests and representative
flows. Unrelated code in the working directory does not establish the target
product architecture. Distinguish two independent axes:

- **Repository organization:** one repository with multiple projects (monorepo),
  a system spread over repositories (multirepo), a single project, or a mixture.
- **Execution/deployment organization:** one main application (monolith),
  independently operated services (microservices), or a hybrid.

Record the evidence and unknown scope in the working report. Repository count
does not determine service count. A workspace manifest alone cannot establish
deployment independence. If another repository is referenced but unavailable,
name that limit; do not claim the whole system was inspected or automatically
expand into remote systems. Local configuration shows intended deployment,
not proof of the live environment.

For new planning without code, use the supplied product problem, actors and
required outcomes to propose boundaries. Mark unestablished deployment/repository
facts unknown rather than inventing an existing architecture. Implementation
inventories and discovered paths stay ephemeral unless they are durable requirements.

## Identify bounded contexts

A DDD bounded context is the scope in which business terms and rules have a
consistent meaning and owner. Infer candidates from behavior, vocabulary, rule
ownership, data authority and interactions. A service, team, package, database or
repository is evidence to inspect, not automatically a bounded context. One
monolith may hold several contexts; one context may span services or repositories.

Use this grouping by default, without requiring the user to request DDD or know
its terminology. Reuse already established boundaries. When the evidence supports
a candidate, explain the business responsibility in plain language. Ask only
about a material ambiguity in ownership or meaning before finalizing it; propose
grounded choices instead of asking the user to classify the entire system from
scratch. Import and maintenance collect such questions in their batch report.

Core/supporting/generic subdomain labels are optional metadata. Their absence
does not prevent identifying contexts or writing features. A glossary clarifies
terms; it is not a separate domain-classification interview.

## Write one feature from trigger to result

Within a context, organize by user story or vertical slice: actor/event → the
required behavior and rules → observable result. Keep the relevant UI, request,
data and external interactions together at the document's resolution. A headless
job, operator action or domain event needs no invented screen or human click.

Never divide feature documents into frontend, backend, API, database,
controllers, services or other implementation layers. Existing layered code can
be read across folders and documented as one feature without moving that code.
Do not force one service per context or one ADR per source folder.

An ADR still owns one durable decision. A feature may need several independent
decisions; retain them in the same feature scope. A genuinely shared contract has
one owner at its actual shared scope, with relationships to affected features.
Do not duplicate it or create technical-layer categories as a shortcut.

## Preserve each artifact's resolution

Product documents keep the user problem, product responsibility, observable
outcome and durable constraints. Place context/feature grouping in existing
sections; do not add a required taxonomy section, implementation inventory, or
lower-level diagrams. Keep the caller's fixed section names, order, save units
and permitted diagram levels.

Decision records keep purpose, rationale, exact contract and observable evidence.
Keep category keys at most two segments: `<context>` for a single-feature
context or context-wide decision, and `<context>/<feature>` for multiple features.
Use domain vocabulary for the context and user-action vocabulary for the feature.
Keep existing valid flat categories. Topology discovery does not add another
folder level, code-path mapping, or persistent architecture registry.

Preserve established grouping during handoff. If the input lacks a boundary,
propose one from the available meaning and confirm only unresolved material
choices; absence of an explicit grouping request is not a reason to skip discovery.
Keep both plugins independently readable with plugin-local guidance.

Changing these authoring defaults does not authorize repository refactoring,
service decomposition, or automatic movement/deletion of existing ADRs. Route
actual document reorganization through its normal scope and approval rules.
