# From a familiar picture to precise understanding

Use this guidance when a report must explain unfamiliar or complex material.
Drill-down lowers the abstraction level of the same subject: a role visible in
the parent becomes a set of responsibilities, relationships, rules, or concrete
actions in the child. The reader should recognize what is being expanded and
understand it more precisely after the descent.

## Start from what the reader already knows

Actively use relevant context the agent already has: the user's work, previous
examples, familiar tools or concepts, vocabulary, and stated learning preferences.
Let it change the explanation, not merely add a personal greeting. Current
instructions and the report's intended audience take precedence over older user
context. A report for colleagues cannot assume they share its author's background.

Choose a familiar analogy that explains the important relationship with little
new machinery. Do not ask again for background that is already known. Do not
invent a profession, experience, preference, or level of expertise. When relevant
context is unavailable, use a broadly understandable analogy or a plain direct
explanation and continue; personalization does not require a profile interview,
new personal-data lookup, or a saved learner profile. Use only the context needed
to teach the subject, without retelling unrelated personal information.

An experienced reader may already have an accurate model of part of the subject.
Build from it and spend detail on the unfamiliar boundary. Do not force an
elementary metaphor or fixed beginner-to-expert ladder onto every audience.

## Hide detail without hiding the answer

Keep the required background and early answer. A short analogy can make that
answer approachable, but must not delay it behind a story. At the upper level,
show the purpose, overall role, essential relationships, and limitations that
change the conclusion. Defer internal components, identifiers, detailed sequences,
and exact mechanics that do not answer that level's question.

When descending, say which previously introduced object or relationship is being
opened up, then explain its relevant internals. Introduce actual terms at the
point they become useful. A lower level should let the reader explain a mechanism
or apply a condition that the parent intentionally left abstract. Preserve every
required value, state, permission, ordering rule, exception, and source at its
owning scope; simplified explanations cannot replace an authoritative contract.

Same-level alternatives, success/failure branches, and additional examples may
be useful children without being a new abstraction level. Distinguish that
branching from expanding their common parent. Sources establish why a claim is
supported; opening a log is not a substitute for explaining the mechanism.
Choose only the depth the subject needs, not a quota of headings or clicks.

## Translate the analogy into the actual subject

Connect the analogy's useful elements to the real concepts before asking the
reader to use them. Gradually let the real terms carry the detailed explanation.
Keep the object recognizable across prose and pictures: a parent box representing
a responsibility can expand into its internal participants and interactions.
Keep enough of its outside relationship visible to orient the reader, without
redrawing the whole system at each level.

State an analogy's limit where it would otherwise cause a wrong inference.
An analogy cannot establish a guarantee, an ordering rule, a permission, or a
failure outcome that the evidence does not support. Do not extend every metaphor
element into a fictional component. If explaining its exceptions is harder than
explaining the subject directly, shorten or replace the analogy.

### Example: one operation despite repeated requests

Suppose the supplied reader context says they know a library's request desk,
and the supplied system facts say a repeated request uses one identifier, a
completed result is reused, and an unknown external outcome must be checked
before another operation is attempted.

The upper explanation can compare the identifier to a claim slip: presenting
the same slip means asking about the same request, not placing a new one. This
teaches the overall role without exposing storage or network messages. Keep the
important limit visible: a missing reply does not tell us whether work finished.

Next, expand that request-tracking role. The slip corresponds to the request
identifier, and the desk's record corresponds to the stored outcome. Explain how
recognizing the identifier and finding a known result avoids a second operation.
Now expand the unknown-outcome case: the external service can finish even though
its reply never arrives, so the caller checks the original outcome before trying
another operation. A sequence diagram can show those separate events.

The analogy does not imply that all requests are serialized like people in a
line, or that the local record always knows the external result. Those properties
require their own evidence. Logs or tests supporting the explanation belong with
it, but are not another level of the request-tracking model.

### Visualize the detail being revealed

Reassess visualization when opening each explanation, including the deepest
section. The overview may correctly hide the relationships that a detailed
figure needs to expose. If prose would make the reader reconstruct participants,
branches, state changes, timing, or correspondences, draw those relationships
beside the explanation at that depth. Do not stop after an overview diagram or
reserve figures for major headings.

For the request-tracking example, the upper view can show one service role;
inside it, a relationship or flow diagram can connect recognizing the request,
looking up its outcome, and deciding what to do. The completed-request detail
can use a concrete identifier and result to show reuse when that would clarify
the rule. The unknown-outcome detail can show the relevant events in a sequence
diagram: external completion, missing reply, caller timeout, and outcome lookup.
These views expand different parts of the same subject instead of repeating one
overview in several folded sections.

Other subjects may benefit from an analogy-to-concept mapping, a state diagram
of allowed changes, a comparison table, or a worked calculation and chart with
supported inputs. Choose the view for the relationship being explained, not for
variety. Keep each view at its section's resolution and identify its parent
element. Use a concrete example when it makes an abstract rule understandable;
distinguish illustrative inputs from observations.

Use as many focused views as the explanation needs. There is no report-wide or
per-depth figure budget, and no requirement to put a diagram in every section.
A one-step instruction or simple fact may be clearer in prose; do not diagram
it merely because another leaf has a picture. Conversely, a complex leaf must
not remain a wall of text just because its parent already has a diagram. Never
invent a relationship or hide a missing-evidence limitation to supply a figure.
When evidence or format prevents a useful view, explain the supported mechanism
in prose. A missing figure alone never blocks delivery.

## Review each reading depth

Read the default fully expanded document for continuity and print readiness.
Then consider the upper explanation on its own: can this reader grasp the role
and answer without the deferred vocabulary, while retaining important limits?
Temporarily collapsing details can help this check; it is not the delivery default.
Then inspect a descent: locate the parent object, the actual concepts mapped
from the analogy, and the internals that become visible. Finally, apply a relevant
edge case using the literal rules rather than relying on the analogy.

With a detail section open, check whether its newly exposed relationships are
visible at a useful resolution. When feasible, a sequence can clarify a timing
rule that prose leaves hard to follow. A reused overview may still hide that
mechanism, while a decorative rendering may add nothing to an obvious sentence.
Fix the explanatory gap; do not fail delivery solely for a missing figure or
judge coverage by figure count or how colorful the page looks.

Reject detail dumped into the overview, a new heading that merely repeats its
parent, peer branches presented as deeper resolution, and sources that leave the
reader to infer the mechanism. Check that known reader context actually shaped
the explanation and that no familiarity or guarantee was invented. Preserve the
existing report design when improving depth; a different theme, navigation widget,
or smaller diagram does not establish a more precise explanation.

These are semantic checks. Schema validation, diagram rendering, and successful
navigation can support delivery, but cannot establish understanding or measured
learning gains.
