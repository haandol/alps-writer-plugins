# Example: one operation despite repeated requests

Use this example when an analogy or a sequence of detail views would help explain
[the same subject in finer detail](../explanation-design.md#open-the-same-process-at-a-lower-level).

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

A report organized only as "caller, stored records, external service" could
describe every participant without explaining why they must cooperate. The
descent above keeps one question in view: what makes a repeated request safe?
The identifier connects the retry to one operation; the recorded result can
answer a completed request; a missing result leaves the external outcome to be
checked. Each detail explains a relationship needed by the preceding view.

If the supplied reader context instead establishes HTTP API experience, start
with the familiar distinction between sending a request and receiving its reply.
Explain how retry handling preserves one operation across that gap, then open
the recorded-result and unknown-outcome responsibilities. The system facts stay
the same; the route from known behavior to the unfamiliar rule changes.

## Views that reveal the mechanism

For the request-tracking example, the upper view can show one service role;
inside it, a relationship or flow diagram can connect recognizing the request,
looking up its outcome, and deciding what to do. The completed-request detail
can use a concrete identifier and result to show reuse when that would clarify
the rule. The unknown-outcome detail can show the relevant events in a sequence
diagram: external completion, missing reply, caller timeout, and outcome lookup.
These views expand different parts of the same subject instead of repeating one
overview in several folded sections.
