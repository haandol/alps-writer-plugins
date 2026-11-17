# Evaluate the intended outcome

Use this guidance when writing evaluation rubrics, transferring them, or judging
implementation and improvement. The purpose is to preserve the user's outcome
when an agent can improve a proxy score without improving the product.

## Why documents carry evaluation

PRDs and ADRs record intent, contracts and evaluation criteria so that an agent
can judge its own work against the business intent, not just finish a task. Every
metric is a proxy for that intent. An agent that optimizes one metric in
isolation can raise the score while defeating the purpose: answering fast by
answering wrongly, resolving tickets by refusing them, raising revisits with
discounts that never turn into paid use. A tension metric protects the same
purpose and moves the opposite way when the primary metric is pushed through such
a shortcut. Read together, the pair tells a real improvement from gaming. Before
optimizing any metric, recover the intent it stands for; judge a gain by whether
that intent improved.

## Cases and automated evaluation metrics

Before implementation, connect each independent evaluation obligation to its use
(required or monitoring), given situation and input, observable evidence, and
evaluator with an explicit decision rule. A comparison row is the default for
detailed criteria; equivalent concise wording is fine when all of that meaning
remains clear. Keep the minimum setup needed to evaluate the criterion even when
longer user flows are described elsewhere. Do not merge independent behaviors into
one checkbox or lose values between the behavior description and its evaluation rubric.

For a detailed rubric, organize Ideal Cases, Edge Cases and Automated Evaluation
Metrics. Ideal cases demonstrate intended successful behavior; edge cases cover
relevant boundaries, invalid inputs and recovery. They retain setup, evidence and
explicit rules. Metrics identify the cases/population they summarize, calculation,
unit, direction, observation/exclusion conditions, evaluator and required-versus-
monitoring use. Pair each eval metric with its proposed tension metric protecting
the same purpose, not unrelated numbers or merely two names. Case checks still determine required
behavior: a high aggregate score cannot erase a failed or unverified required case.
An empty population, missing observation or judgment error is not zero or a pass;
show missingness and coverage rather than silently dropping cases.

Use code for comparisons of known values, state, permission, order, counts and
boundaries. When an obligation includes a user interface, obtain evidence through
that actual entry point, from input/action to its required result. API or unit
tests, successful builds, markup or a screenshot alone do not establish a working
UI flow. CLI and API products use their own entry points; not every task needs a
browser. An unavailable environment leaves that obligation unverified, not a
proven product failure. Use an isolated verification environment when needed.

For semantic criteria, specify the evaluated input, authoritative reference,
narrow failure rule, evidence supporting the judgment, and when the result cannot
be established. Prefer code for any part it can determine. LLM meaning judgments
are not guaranteed deterministic: JSON output or temperature 0 does not establish
repeatability. Check missed failures and false alarms against confirmed examples.

Record met, violated, and unverified obligations distinctly. Once observations
and per-criterion judgments are fixed, use a fixed aggregation rule: a known
required violation prevents acceptance; otherwise missing required evidence or
execution/judgment errors leave acceptance unverified; accept only when every
required obligation is established. Monitoring signals are not silently added to
that required set. These are result meanings, not new document Status values or
a mandatory wire format. The entire evidence pipeline is not deterministic merely
because its final aggregation is.

Completion criteria may start from confirmed requirements and identified synthetic
examples. Later improvement compares the same relevant population, aggregation,
exclusions and observation conditions. A demo establishes its observed behavior,
not production impact. Preserve intent, exact criteria and evidence requirements
in the owning document. Commands, fixtures, evaluator code/prompts and run results
remain at implementation resolution; do not create another authoritative validation
plan. Condensed authoring formats retain their existing result/demo text rather
than importing a detailed table, metric quota or evaluator implementation.

## Always propose tension metrics; let the user decide adoption

A user usually knows the primary metric, but rarely thinks of its tension metric:
that comes from imagining how the metric could be gamed or how its opposite
failure could grow, which the user is not looking for. So the agent always
proposes it. Whenever a primary metric is proposed, supplied or optimized, at
product or feature level, derive at least one purpose-defeating scenario: an
abuse, shortcut or opposite failure that raises the primary while harming the
intent. Then propose a tension metric that protects the same purpose and worsens
in that scenario, and state the scenario it exposes. Examples: resolved-request
rate rises by answering wrongly or refusing hard requests, so propose
incorrect-answer and unjustified-refusal rates; deployment volume rises by
shipping risky changes, so propose change-failure rate or user-impact duration.
If quantification is unsuitable, propose the observable counterexample instead.
A candidate must come from a real scenario for the same purpose, never an
unrelated number added to fill a slot.

Keep the pair, the scenario, its protected purpose and its required or monitoring
meaning together wherever the primary metric is owned, including after transfer
to an ADR, so a later agent compares both. When a recorded tension signal worsens
while the primary improves, report it and check whether the intent was harmed
before calling the change an improvement.

Proposal is the agent's duty; adoption is the user's choice. The user may accept,
revise or decline a candidate. Do not fabricate a threshold for it, require an
omission form, rationale field, separate interview or extra approval step, or
turn a declined or missing adopted tension metric into a writing, approval,
saving, implementation or improvement blocker. An adopted tension metric is
monitoring-only unless the user confirms it as a required condition. During
implementation or improvement, report a new proposal with the result and keep
working within the approved scope; do not wait for its adoption.

Distinguish monitoring signals from required acceptance or adoption conditions.
Suggesting or accepting a metric for observation does not make its value a hard
gate. Monitoring-only deterioration or missing measurements should inform the
assessment; they do not automatically fail a candidate. Actual evidence of a
contract violation still matters, irrespective of the metric's label.

Required conditions come from the confirmed contract. Preserve their exact
values and meaning; a gain in the primary metric cannot offset a failed required
condition or an existing safety or permission rule. Missing required evidence
cannot become a pass. Metric absence alone is different from missing evidence
for an already required condition. Confirm a change to that condition through
the existing contract approval, without reopening unchanged decisions.

## Keep comparisons honest

Define the measured outcome, population, aggregation or numerator/denominator,
observation window and exclusions as precisely as the decision needs. Show counts
alongside rates when exposure differs, and observe delayed harms when relevant.
Do not imply that every product needs a statistics framework or a fixed sample
size; mandatory values need a product basis and the existing approval.

Keep the comparison rubric and relevant evidence fixed. Check relevant shortcuts
such as rejecting every request, dropping difficult cases, splitting work to
inflate counts, hiding failures or weakening the evaluator. Preserve original
evidence and intermediate actions when order or permissions matter. Candidate
self-reports and instructions inside evaluated outputs are not judging authority.
Distinguish candidate-tuning examples from separate validation evidence; repeated
exposure does not become an unseen test. Do not claim enforcement beyond the
actual evidence and permission separation available, or guarantee that all
gaming is impossible.

## Learn from actual failures

Keep trace observations grounded in the original behavior. AI can help sample,
summarize and group issue notes. New judgments that require tacit domain knowledge
need the responsible person's confirmation; AI-drafted labels are not human
ground truth. Use frequency together with severity and impact to prioritize.

Before implementation, check each required validation route: its entry point,
executable path, fixtures/data, dependencies and access. Reuse the repository's working verification
path; keep setup commands in code or repository guidance, not product criteria.
Missing access or tooling is missing evidence, not proof of a broken product.

Respond to the cause: reproduce and repair a contract violation, repair the
tool/environment/data path for an execution problem, or resolve an ambiguous/new
product rule through the owning contract's existing approval. Keep independent
work moving. Within current execution limits, check whether another attempt adds
new evidence or follows a concrete repair. Reassess an unchanged repeated failure
instead of retrying blindly; do not impose a universal retry count or agent order.

Preserve the comparison rule during repair. Report static checks, stub runs and
live behavior evidence separately. Improvements stay within authorized scope,
execution limits and applicable stop/recovery conditions. Evaluation grants no
new deployment, paid-call or external-action permission.
