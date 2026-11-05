# Business ontology

The purpose is to capture actual business workflows accurately and richly so
business logic reaches ADRs, code and tests. A perfect ontology or inference
capability is not the goal. Preserve the evidenced flow, decision reasons,
exceptions and manual/external hand-offs at business resolution; exact values
and feature-level conditions retain their ADR owner rather than disappearing.
For discovery, load `eventstorming.md`; for business completeness and readiness,
load `workflow-readiness.md` only on those paths. Completeness means sufficient
context for the requested business implementation and verification.

Construct ontology knowledge in layers: author the small BC-only layer of
responsibility, core business logic and collaborations, then each BC's internal
workflow knowledge. For construction and scoped retrieval, read `knowledge-layers.md`.

Read this module when a repository has a business ontology — one or more
Turtle documents in `docs/ontology/` — or when a workflow is about to create one.
Without model documents and without `realizes` links in `docs/adr/.mapping.json`,
nothing here applies and no workflow reads or requires a model.

## What each level owns

The model is an optional level above ADRs. Levels with a current authority
depend in this order: business ontology, ADR, code. A PRD stays planning
input. Each level answers a different question:

| Level             | Question it answers                                                                    | Facts it owns                                                                                                                                                                                                         | Facts it never shows                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business ontology | How does the business flow, and which events, policies and rules connect its features? | flow, event hand-offs and the policies that react to them, actor responsibilities, rules across steps, business concepts and their relations, business terms, business-level observation criteria, current vs. target | state machines and transition conditions, exact values and thresholds, behavior, permissions and failure handling inside one step, architecture, technology, APIs, schemas, code, realization status |
| ADR               | Which decision and contract makes each feature realize that business?                  | architectural decisions and rationale, feature contracts, feature-resolution compliance contracts, feature-level observable evidence                                                                                  | the end-to-end business flow, code structure, names and tuning values                                                                                                                                |
| Code and tests    | How is the contract implemented and verified?                                          | implementation, identifiers, dependencies, tests, execution evidence                                                                                                                                                  | —                                                                                                                                                                                                    |

Implementation authority stays with ADRs. A model relation reaches code only
through a **compliance contract**: a contract row in a realizing ADR that keeps
the relation at feature resolution — the inputs the feature accepts and the
events it emits for that relation, its rejection and failure behavior, exact
values and conditions, and architecture guarantees such as duplicate delivery or
consistency. A compliance contract never copies the model sentence.

When a realizing ADR contradicts the model's flow, event hand-offs, policies,
business rules or actor responsibilities, the model is the reference: the ADR is
what changes, unless the user approves an ontology change. An ADR edit, an ADR
Status change, a category rename, split or rollup, and a code refactor never
change the model. Business changes flow down: model, then the ADR index link,
then the ADR, then code.

The upper knowledge layer holds BC responsibility and `coreLogic` with explicit
`collaboratesWith` connections. The lower layer holds internal business flow and
relations, linked to BCs by `inContext`. The upper layer never duplicates every
step or policy, and its collaborations assert neither sequence nor causation.

The internal model holds flow and relations only:

- A state dependency between features is an event that announces the change and
  a policy that reacts to it. A dependency that only assumes another feature's
  state is a business rule that reaches both the step that changes the state and
  the step that relies on it. The model has no state elements or transitions.
- Business rules and reaction conditions state relation and meaning in business
  language — "the refund window counts from delivery" — never the value ("30
  days"), which the realizing ADR's requirement contract owns. State machines or
  values several features decide together belong to a context-level ADR.
- A permission rule across steps ("the approver is not the executor") is a model
  business rule; a permission inside one step belongs to the realizing ADR.
- In a repository with a model, the model owns business-concept definitions and
  bounded-context terms; the ADR glossary keeps only other terms. A glossary
  entry for a term the model now owns is cleaned up through the model's change
  approval.

## Documents

- Every Turtle document under `docs/ontology/`, symbolic links included, belongs
  to the model, and the union of all of them is the model. Split shared elements
  and per-process documents freely; moving an element between documents changes
  nothing.
- Other files there, such as a change-log Markdown document, are not part of the
  model. Never copy the vocabulary into the model directory.
- Ontology Writer rewrites a document it saves into the canonical form
  (`ontology.mjs format`): fixed prefixes, elements ordered by type then
  identifier, properties in vocabulary order. Turtle comments are not part of the
  model and are dropped on rewrite, so show their removal in the approval summary
  before rewriting. Keep human notes in `rdfs:comment`.
- The process list, each process's Status and one-line summary are process
  attributes. There is no separate index file.
- Model documents never record ADR paths, numbers or category keys.

## Vocabulary

The vocabulary is published as RDFS in
`${CLAUDE_PLUGIN_ROOT}/templates/ontology/vocabulary.ttl`; a complete example
model is `${CLAUDE_PLUGIN_ROOT}/templates/ontology/example.ttl`. A model uses only
the vocabulary's classes and properties plus `rdf:type`, `rdfs:label` (name) and
`rdfs:comment` (note). OWL terms, blank nodes, collections, reification, `@base`
and relative IRIs are rejected.

```turtle
@prefix m: <urn:ontology-writer:model:> .
@prefix onto: <urn:ontology-writer:vocabulary:> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

m:ordering.submit-order a onto:Step ;
    rdfs:label "Submit the order" ;
    onto:definition "The customer sends the cart as an order." ;
    onto:stepKind "system" ;
    onto:emits m:ordering.order-placed ;
    onto:inContext m:ordering .
```

**Identifiers.** Every element is `urn:ontology-writer:model:<id>`, written `m:<id>`.
The id is a Turtle local name without escapes or `:` — letters, digits, `_`, `-`
and inner `.`. Prefer stable ids from business language; their format is not a
contract. Ids are unique across the whole model, and one id names one element.

**Element types** (exactly one per element):

| Class                       | Meaning                                                                         | Must have                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `onto:Actor`                | a person's role, operator, outside organization or system, or system role       | name, definition                                                                                   |
| `onto:BoundedContext`       | business boundary with one consistent meaning of terms and rules                | name, definition                                                                                   |
| `onto:BusinessConcept`      | business noun defined in one context                                            | name, definition, exactly one context                                                              |
| `onto:BusinessEvent`        | a fact that already happened, independent of delivery technology                | name, definition, exactly one context                                                              |
| `onto:Process`              | flow from a start condition to a business outcome                               | name, definition, start condition, business outcome, open scope, Status, at least one criterion    |
| `onto:Step`                 | business activity an actor performs in a process                                | name, definition, step kind, exactly one process, exactly one context, at least one performer      |
| `onto:Policy`               | decision rule reacting to an event and starting a step when its condition holds | name, definition, reaction condition, basis kind, basis, one context, a trigger and a started step |
| `onto:BusinessRule`         | condition that always holds across two or more steps                            | name, definition, basis kind, basis, a target, and a reach of at least two steps                   |
| `onto:ObservationCriterion` | a process start condition and the business result to observe                    | name, start condition, observed result, exactly one process                                        |

When one name means different things in different contexts, define one business
concept per context and link them with `onto:correspondsTo`; never mix the meanings
in one definition.

**Relations:**

| Property                | Name                 | From                                         | To                                     | Meaning                                                                       |
| ----------------------- | -------------------- | -------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| `onto:hasStep`          | contains             | Process                                      | Step                                   | the process contains the step                                                 |
| `onto:flowsTo`          | flow                 | Step                                         | Step                                   | order of progress inside the same process                                     |
| `onto:performs`         | performs             | Actor                                        | Step                                   | the actor performs the step                                                   |
| `onto:emits`            | emits                | Step                                         | BusinessEvent                          | the event happens as a result of the step                                     |
| `onto:triggers`         | triggers             | BusinessEvent                                | Policy                                 | the event wakes the policy                                                    |
| `onto:starts`           | starts               | Policy                                       | Step                                   | the policy starts the step when it holds                                      |
| `onto:uses`             | uses                 | Step, Policy                                 | BusinessConcept                        | reads, changes or decides with the concept                                    |
| `onto:constrains`       | constrains           | BusinessRule                                 | Step, Policy, BusinessConcept, Process | the rule applies to the target                                                |
| `onto:hasPart`          | composition          | BusinessConcept                              | BusinessConcept                        | one concept has the other as a part                                           |
| `onto:refersTo`         | reference            | BusinessConcept                              | BusinessConcept                        | one concept points at the other                                               |
| `onto:correspondsTo`    | correspondence       | BusinessConcept                              | BusinessConcept                        | the same thing in another context                                             |
| `onto:inContext`        | context membership   | Step, Policy, BusinessConcept, BusinessEvent | BoundedContext                         | the boundary the element belongs to                                           |
| `onto:criterionOf`      | criterion membership | ObservationCriterion                         | Process                                | the process the criterion checks                                              |
| `onto:passesThrough`    | passes through       | ObservationCriterion                         | BusinessEvent                          | an event between the start and the result                                     |
| `onto:collaboratesWith` | collaboration        | BoundedContext                               | BoundedContext                         | authored BC collaboration, read in both directions; not sequence or causation |

Flow is order, never a cause. When several flows leave a step, all of them
proceed. Choice branches, the cause that starts a step, and connections between
processes are events and policies. Several performers are alternatives: any of
them may perform the step. A policy with several triggering events reacts each
time one of them happens; joint participation or "all of these events" is a
business rule or a reaction condition. The steps a rule reaches are the steps it
constrains, the steps started by policies it constrains, the steps using concepts
it constrains, and the steps of processes it constrains.

**Attributes.** Fact attributes carry business facts; description attributes
are for people and never decide anything; lifecycle attributes change only
through lifecycle transitions. Besides promotion, demotion and retirement, the
`Accepted` date is renewed when an approved save or ontology sync confirms a
change that keeps the business composition — open scope only, or wording the
user confirmed keeps its meaning —, the confirmation covers every change since
the process became `Accepted`, no lifecycle edit is pending and the alignment
gates hold. A renewal is the comparison baseline once committed; on the day of
the current `Accepted` date it cannot be recorded, and Ontology Writer says so.

| Property                 | Family      | On                            | Value                                                                         |
| ------------------------ | ----------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `rdfs:label`             | fact        | every element                 | name, one text value                                                          |
| `onto:definition`        | fact        | every element but criteria    | meaning in business language                                                  |
| `onto:coreLogic`         | fact        | BoundedContext                | one authored BC-scale explanation of inputs, principal decisions and outcomes |
| `onto:stepKind`          | fact        | Step                          | `"system"` or `"outside-system"`                                              |
| `onto:reactionCondition` | fact        | Policy                        | relation and meaning the policy checks, no exact values                       |
| `onto:basisKind`         | fact        | Policy, BusinessRule          | `"regulation"`, `"contract"`, `"operating-policy"` or `"user-decision"`       |
| `onto:basis`             | fact        | Policy, BusinessRule          | the regulation, contract, policy or decision behind it                        |
| `onto:startCondition`    | fact        | Process, ObservationCriterion | where the flow or observation starts                                          |
| `onto:businessOutcome`   | fact        | Process                       | the business result the process reaches                                       |
| `onto:observedResult`    | fact        | ObservationCriterion          | the business result to observe                                                |
| `onto:openScope`         | fact        | Process (required), Step      | typed items, see below                                                        |
| `onto:summary`           | description | Process                       | one-line summary                                                              |
| `rdfs:comment`           | description | every element                 | notes, any number                                                             |
| `onto:status`            | lifecycle   | Process                       | the process Status                                                            |
| `onto:replacedBy`        | lifecycle   | Process                       | the process that replaces this one                                            |

Single-valued attributes take exactly one value; text values are non-empty plain
or language-tagged literals.

**Open scope.** Each process covers three axes: start, end and normal flow;
performers and rules; exceptions, rejections and hand-offs. A path the model does
not cover yet is an open path, on the process or on the step it concerns. When the
user confirms the business has no path, or no path on one axis, the process
records it as not applicable. A process with neither states so explicitly.

```turtle
m:refund onto:openScope "Re-submitting a rejected refund."^^onto:OpenPath ,
    "Hand-offs: refunds never pass to another organization."^^onto:NotApplicable .
m:returns onto:openScope "none"^^onto:NoOpenScope .
```

Only open paths leave scope open; a process with only not-applicable items has no
open scope. `onto:NoOpenScope` stands alone, and steps carry open paths only.

## Linking features to steps

The step a feature realizes is recorded only in the ADR index: the category entry
in `docs/adr/.mapping.json` lists step ids in `realizes`. The index and the shape
of that list belong to adr-writer; this plugin writes the links in the same change
unit as the model and checks them against it. The lower level knows the
upper level's step ids, so renaming, splitting or rolling up a category edits only
the index. An empty `realizes: []` records that the feature was confirmed to
realize no step; it is not a link. A link to a step the model does not have, a
link to a step of a `Deprecated` or `Superseded` process, and a link left behind
when the model is gone are validation errors. A realizing ADR
body never cites `docs/ontology/`, model IRIs or `m:` element ids; it states the
business meaning its contract needs.

## Validation

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/ontology.mjs validate`; use
`--require-layers` for construction, with repeatable `--layer-context <id>` for
a scoped extension. Missing core logic or a missing upper collaboration for an
internal cross-BC relation is a legacy warning and a construction error. A new
BC must pass those checks before save. Validation reports gaps without filling
model facts.

ADR Writer's `adr-structure-lint` checks only the shape of `realizes`, never the
model. Ontology Writer judges the union graph under a closed world and fails when any document cannot be
parsed — an out-of-range or lone-surrogate `\u`/`\U` escape and a document that is
not valid UTF-8 included — reporting the document and position instead of passing
on the part it could read.

| Finding                                                                                                                             | What to do                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ontology-parse`, `ontology-blank-node`, `ontology-collection`, `ontology-base`, `ontology-relative-iri`, `ontology-unknown-prefix` | fix the reported position; give every element an `m:` identifier                                      |
| `ontology-unknown-term`, `ontology-owl`                                                                                             | use only vocabulary terms plus `rdf:type`, `rdfs:label`, `rdfs:comment`                               |
| `ontology-element-iri`, `ontology-type-missing`, `ontology-type-multiple`, `ontology-type-literal`                                  | one `m:` id, one element type given as a class, never a literal                                       |
| `ontology-relation-source`, `ontology-relation-target`, `ontology-relation-dangling`                                                | follow the relation table; point at existing elements                                                 |
| `ontology-attribute-*`                                                                                                              | required attributes, one value, allowed values, attribute only on its types                           |
| `ontology-membership`, `ontology-policy`, `ontology-correspondence`                                                                 | memberships, performers, triggers and started steps, cross-context correspondence                     |
| `ontology-rule-reach`                                                                                                               | a rule reaches two or more steps; a rule inside one step belongs to the ADR                           |
| `ontology-flow-cross`                                                                                                               | connect processes with an event and a policy                                                          |
| `ontology-layer-core-missing`, `ontology-layer-link-missing`, `ontology-layer-context-missing`                                      | author the missing BC knowledge through the approval path; legacy warnings become construction errors |
| `ontology-context-collaboration`                                                                                                    | connect distinct BCs; collaboration is symmetric and is not an event flow                             |
| `ontology-open-scope`                                                                                                               | typed open-scope items; `none` alone; steps hold open paths only                                      |
| `ontology-adr-reference`                                                                                                            | remove ADR paths, numbers and category keys from the model                                            |
| `ontology-link-dangling`                                                                                                            | fix or remove the `realizes` id                                                                       |
| `ontology-link-retired`                                                                                                             | remove or move the link to the step of a retired process                                              |
| `ontology-link-shape`                                                                                                               | write `realizes` as a list of step ids                                                                |
| `ontology-adr-status-mismatch`, `ontology-adr-missing`, `ontology-adr-unindexed`                                                    | bring the index and the ADR files back in lockstep (Status only through the script)                   |
| `ontology-adr-record-invalid`                                                                                                       | give the realizing feature's records the paths of its own ADR files, as a list                        |
| `ontology-index-unreadable`                                                                                                         | fix `.mapping.json` so it parses before any change approval                                           |
| `ontology-adr-identifier`                                                                                                           | replace the model citation in the realizing ADR with business meaning                                 |
| `ontology-comment` (warning)                                                                                                        | move notes to `rdfs:comment`; comments are dropped on rewrite                                         |
| `ontology-exact-value`, `ontology-technical-detail` (warnings)                                                                      | move values and technical detail to the realizing ADR or the code                                     |
| `ontology-glossary-overlap` (warning)                                                                                               | clean the glossary entry up through the model's change approval                                       |
| `ontology-glossary-mention` (warning)                                                                                               | ask whether the table cell defines the term; if it does, clean it up as an entry                      |

`ontology.mjs format --check` lists documents that are not canonical
(`--write` rewrites them without changing their graph), and
`ontology.mjs diff` shows the semantic difference from a git revision
(default `HEAD`) — formatting, ordering and comments never appear in it.

## Never in the model

State machines and transition conditions, exact values and thresholds, behavior,
permissions and failure guarantees inside one step, architecture choices,
technical components, APIs, data schemas, code locations, and ADR paths, numbers
or category keys. Changing the vocabulary's element, relation or attribute sets is
a change of the ADR that owns the vocabulary, not a tool or vocabulary edit.
