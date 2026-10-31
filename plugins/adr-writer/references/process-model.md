# Business process model

Read this module when a repository has a business process model — one or more
Turtle documents in `docs/process/` — or when a workflow is about to create one.
Without model documents and without `realizes` links in `docs/adr/.mapping.json`,
nothing here applies and no workflow reads or requires a model.

## What each level owns

The model is an optional level above ADRs. Levels with a current authority
depend in this order: business process model, ADR, code. A PRD stays planning
input. Each level answers a different question:

| Level                  | Question it answers                                                                    | Facts it owns                                                                                                                                                                                                         | Facts it never shows                                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Business process model | How does the business flow, and which events, policies and rules connect its features? | flow, event hand-offs and the policies that react to them, actor responsibilities, rules across steps, business concepts and their relations, business terms, business-level observation criteria, current vs. target | state machines and transition conditions, exact values and thresholds, behavior, permissions and failure handling inside one step, architecture, technology, APIs, schemas, code, realization status |
| ADR                    | Which decision and contract makes each feature realize that business?                  | architectural decisions and rationale, feature contracts, feature-resolution compliance contracts, feature-level observable evidence                                                                                  | the end-to-end business flow, code structure, names and tuning values                                                                                                                                |
| Code and tests         | How is the contract implemented and verified?                                          | implementation, identifiers, dependencies, tests, execution evidence                                                                                                                                                  | —                                                                                                                                                                                                    |

Implementation authority stays with ADRs. A model relation reaches code only
through a **compliance contract**: a contract row in a realizing ADR that keeps
the relation at feature resolution — the inputs the feature accepts and the
events it emits for that relation, its rejection and failure behavior, exact
values and conditions, and architecture guarantees such as duplicate delivery or
consistency. A compliance contract never copies the model sentence.

When a realizing ADR contradicts the model's flow, event hand-offs, policies,
business rules or actor responsibilities, the model is the reference: the ADR is
what changes, unless the user approves a process change. An ADR edit, an ADR
Status change, a category rename, split or rollup, and a code refactor never
change the model. Business changes flow down: model, then the ADR index link,
then the ADR, then code.

The model holds flow and relations only:

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

- Every Turtle document under `docs/process/`, symbolic links included, belongs
  to the model, and the union of all of them is the model. Split shared elements
  and per-process documents freely; moving an element between documents changes
  nothing.
- Other files there, such as a change-log Markdown document, are not part of the
  model. Never copy the vocabulary into the model directory.
- ADR Writer rewrites a document it saves into the canonical form
  (`process-model.mjs format`): fixed prefixes, elements ordered by type then
  identifier, properties in vocabulary order. Turtle comments are not part of the
  model and are dropped on rewrite, so show their removal in the approval summary
  before rewriting. Keep human notes in `rdfs:comment`.
- The process list, each process's Status and one-line summary are process
  attributes. There is no separate index file.
- Model documents never record ADR paths, numbers or category keys.

## Vocabulary

The vocabulary is published as RDFS in
`${CLAUDE_PLUGIN_ROOT}/templates/process/vocabulary.ttl`; a complete example
model is `${CLAUDE_PLUGIN_ROOT}/templates/process/example.ttl`. A model uses only
the vocabulary's classes and properties plus `rdf:type`, `rdfs:label` (name) and
`rdfs:comment` (note). OWL terms, blank nodes, collections, reification, `@base`
and relative IRIs are rejected.

```turtle
@prefix m: <urn:adr-writer:model:> .
@prefix pm: <urn:adr-writer:process:> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

m:ordering.submit-order a pm:Step ;
    rdfs:label "Submit the order" ;
    pm:definition "The customer sends the cart as an order." ;
    pm:stepKind "system" ;
    pm:emits m:ordering.order-placed ;
    pm:inContext m:ordering .
```

**Identifiers.** Every element is `urn:adr-writer:model:<id>`, written `m:<id>`.
The id is a Turtle local name without escapes or `:` — letters, digits, `_`, `-`
and inner `.`. Prefer stable ids from business language; their format is not a
contract. Ids are unique across the whole model, and one id names one element.

**Element types** (exactly one per element):

| Class                     | Meaning                                                                         | Must have                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `pm:Actor`                | a person's role, operator, outside organization or system, or system role       | name, definition                                                                                   |
| `pm:BoundedContext`       | business boundary with one consistent meaning of terms and rules                | name, definition                                                                                   |
| `pm:BusinessConcept`      | business noun defined in one context                                            | name, definition, exactly one context                                                              |
| `pm:BusinessEvent`        | a fact that already happened, independent of delivery technology                | name, definition, exactly one context                                                              |
| `pm:Process`              | flow from a start condition to a business outcome                               | name, definition, start condition, business outcome, open scope, Status, at least one criterion    |
| `pm:Step`                 | business activity an actor performs in a process                                | name, definition, step kind, exactly one process, exactly one context, at least one performer      |
| `pm:Policy`               | decision rule reacting to an event and starting a step when its condition holds | name, definition, reaction condition, basis kind, basis, one context, a trigger and a started step |
| `pm:BusinessRule`         | condition that always holds across two or more steps                            | name, definition, basis kind, basis, a target, and a reach of at least two steps                   |
| `pm:ObservationCriterion` | a process start condition and the business result to observe                    | name, start condition, observed result, exactly one process                                        |

When one name means different things in different contexts, define one business
concept per context and link them with `pm:correspondsTo`; never mix the meanings
in one definition.

**Relations:**

| Property           | Name                 | From                                         | To                                     | Meaning                                    |
| ------------------ | -------------------- | -------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| `pm:hasStep`       | contains             | Process                                      | Step                                   | the process contains the step              |
| `pm:flowsTo`       | flow                 | Step                                         | Step                                   | order of progress inside the same process  |
| `pm:performs`      | performs             | Actor                                        | Step                                   | the actor performs the step                |
| `pm:emits`         | emits                | Step                                         | BusinessEvent                          | the event happens as a result of the step  |
| `pm:triggers`      | triggers             | BusinessEvent                                | Policy                                 | the event wakes the policy                 |
| `pm:starts`        | starts               | Policy                                       | Step                                   | the policy starts the step when it holds   |
| `pm:uses`          | uses                 | Step, Policy                                 | BusinessConcept                        | reads, changes or decides with the concept |
| `pm:constrains`    | constrains           | BusinessRule                                 | Step, Policy, BusinessConcept, Process | the rule applies to the target             |
| `pm:hasPart`       | composition          | BusinessConcept                              | BusinessConcept                        | one concept has the other as a part        |
| `pm:refersTo`      | reference            | BusinessConcept                              | BusinessConcept                        | one concept points at the other            |
| `pm:correspondsTo` | correspondence       | BusinessConcept                              | BusinessConcept                        | the same thing in another context          |
| `pm:inContext`     | context membership   | Step, Policy, BusinessConcept, BusinessEvent | BoundedContext                         | the boundary the element belongs to        |
| `pm:criterionOf`   | criterion membership | ObservationCriterion                         | Process                                | the process the criterion checks           |
| `pm:passesThrough` | passes through       | ObservationCriterion                         | BusinessEvent                          | an event between the start and the result  |

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
`Accepted` date is renewed when an approved save or process sync confirms a
change that keeps the business composition — open scope only, or wording the
user confirmed keeps its meaning —, the confirmation covers every change since
the process became `Accepted`, no lifecycle edit is pending and the alignment
gates hold. A renewal is the comparison baseline once committed; on the day of
the current `Accepted` date it cannot be recorded, and ADR Writer says so.

| Property               | Family      | On                            | Value                                                                   |
| ---------------------- | ----------- | ----------------------------- | ----------------------------------------------------------------------- |
| `rdfs:label`           | fact        | every element                 | name, one text value                                                    |
| `pm:definition`        | fact        | every element but criteria    | meaning in business language                                            |
| `pm:stepKind`          | fact        | Step                          | `"system"` or `"outside-system"`                                        |
| `pm:reactionCondition` | fact        | Policy                        | relation and meaning the policy checks, no exact values                 |
| `pm:basisKind`         | fact        | Policy, BusinessRule          | `"regulation"`, `"contract"`, `"operating-policy"` or `"user-decision"` |
| `pm:basis`             | fact        | Policy, BusinessRule          | the regulation, contract, policy or decision behind it                  |
| `pm:startCondition`    | fact        | Process, ObservationCriterion | where the flow or observation starts                                    |
| `pm:businessOutcome`   | fact        | Process                       | the business result the process reaches                                 |
| `pm:observedResult`    | fact        | ObservationCriterion          | the business result to observe                                          |
| `pm:openScope`         | fact        | Process (required), Step      | typed items, see below                                                  |
| `pm:summary`           | description | Process                       | one-line summary                                                        |
| `rdfs:comment`         | description | every element                 | notes, any number                                                       |
| `pm:status`            | lifecycle   | Process                       | the process Status                                                      |
| `pm:replacedBy`        | lifecycle   | Process                       | the process that replaces this one                                      |

Single-valued attributes take exactly one value; text values are non-empty plain
or language-tagged literals.

**Open scope.** Each process covers three axes: start, end and normal flow;
performers and rules; exceptions, rejections and hand-offs. A path the model does
not cover yet is an open path, on the process or on the step it concerns. When the
user confirms the business has no path, or no path on one axis, the process
records it as not applicable. A process with neither states so explicitly.

```turtle
m:refund pm:openScope "Re-submitting a rejected refund."^^pm:OpenPath ,
    "Hand-offs: refunds never pass to another organization."^^pm:NotApplicable .
m:returns pm:openScope "none"^^pm:NoOpenScope .
```

Only open paths leave scope open; a process with only not-applicable items has no
open scope. `pm:NoOpenScope` stands alone, and steps carry open paths only.

## Linking features to steps

The step a feature realizes is recorded only in the ADR index: the category entry
in `docs/adr/.mapping.json` lists step ids in `realizes`. The lower level knows the
upper level's step ids, so renaming, splitting or rolling up a category edits only
the index. An empty `realizes: []` records that the feature was confirmed to
realize no step; it is not a link. A link to a step the model does not have, a
link to a step of a `Deprecated` or `Superseded` process, and a link left behind
when the model is gone are validation errors. A realizing ADR
body never cites `docs/process/`, model IRIs or `m:` element ids; it states the
business meaning its contract needs.

## Validation

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/process-model.mjs validate` (or
`adr-structure-lint`, which includes the same checks when a model exists). It
judges the union graph under a closed world and fails when any document cannot be
parsed — an out-of-range or lone-surrogate `\u`/`\U` escape and a document that is
not valid UTF-8 included — reporting the document and position instead of passing
on the part it could read.

| Finding                                                                                                                       | What to do                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `process-parse`, `process-blank-node`, `process-collection`, `process-base`, `process-relative-iri`, `process-unknown-prefix` | fix the reported position; give every element an `m:` identifier                    |
| `process-unknown-term`, `process-owl`                                                                                         | use only vocabulary terms plus `rdf:type`, `rdfs:label`, `rdfs:comment`             |
| `process-element-iri`, `process-type-missing`, `process-type-multiple`, `process-type-literal`                                | one `m:` id, one element type given as a class, never a literal                     |
| `process-relation-source`, `process-relation-target`, `process-relation-dangling`                                             | follow the relation table; point at existing elements                               |
| `process-attribute-*`                                                                                                         | required attributes, one value, allowed values, attribute only on its types         |
| `process-membership`, `process-policy`, `process-correspondence`                                                              | memberships, performers, triggers and started steps, cross-context correspondence   |
| `process-rule-reach`                                                                                                          | a rule reaches two or more steps; a rule inside one step belongs to the ADR         |
| `process-flow-cross`                                                                                                          | connect processes with an event and a policy                                        |
| `process-open-scope`                                                                                                          | typed open-scope items; `none` alone; steps hold open paths only                    |
| `process-adr-reference`                                                                                                       | remove ADR paths, numbers and category keys from the model                          |
| `process-link-dangling`                                                                                                       | fix or remove the `realizes` id                                                     |
| `process-link-retired`                                                                                                        | remove or move the link to the step of a retired process                            |
| `process-link-shape`                                                                                                          | write `realizes` as a list of step ids                                              |
| `process-adr-status-mismatch`, `process-adr-missing`, `process-adr-unindexed`                                                 | bring the index and the ADR files back in lockstep (Status only through the script) |
| `process-adr-record-invalid`                                                                                                  | give the realizing feature's records the paths of its own ADR files, as a list      |
| `process-index-unreadable`                                                                                                    | fix `.mapping.json` so it parses before any change approval                         |
| `process-adr-identifier`                                                                                                      | replace the model citation in the realizing ADR with business meaning               |
| `process-comment` (warning)                                                                                                   | move notes to `rdfs:comment`; comments are dropped on rewrite                       |
| `process-exact-value`, `process-technical-detail` (warnings)                                                                  | move values and technical detail to the realizing ADR or the code                   |
| `process-glossary-overlap` (warning)                                                                                          | clean the glossary entry up through the model's change approval                     |
| `process-glossary-mention` (warning)                                                                                          | ask whether the table cell defines the term; if it does, clean it up as an entry    |

`process-model.mjs format --check` lists documents that are not canonical
(`--write` rewrites them without changing their graph), and
`process-model.mjs diff` shows the semantic difference from a git revision
(default `HEAD`) — formatting, ordering and comments never appear in it.

## Never in the model

State machines and transition conditions, exact values and thresholds, behavior,
permissions and failure guarantees inside one step, architecture choices,
technical components, APIs, data schemas, code locations, and ADR paths, numbers
or category keys. Changing the vocabulary's element, relation or attribute sets is
a change of the ADR that owns the vocabulary, not a tool or vocabulary edit.
