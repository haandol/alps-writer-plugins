# Review orchestration contract

Read this file completely before planning a review role. Also apply
`non-invasive-harness.md`. The calling skill owns the required perspectives,
inputs, evidence, and output contract. The current model owns the action-level
orchestration.

## Provider capability gate

If the active environment is known not to support subagents, do not attempt a
named or generic dispatch. Use an available main-session or tool-supported path
that preserves the calling skill's required perspectives and evidence.

If an attempted dispatch returns `validation_error` with
`Invalid 'input': value did not match any expected variant`, do not retry the
same unsupported orchestration through another role. Mark that capability
unavailable for the rest of the command and choose another execution strategy.
Record the limitation only when it affects review confidence.

## Orchestration discretion

The model may use any of these paths, alone or in combination:

- invoke a discoverable named agent;
- invoke one or more generic read-only subagents and have each read the relevant
  `${CLAUDE_PLUGIN_ROOT}/agents/*.md` file from an absolute path;
- perform the role as a distinct main-session pass over the original material;
- reuse one execution context for multiple mechanical roles when doing so cannot
  anchor or contaminate a required independent judgment.

Choose based on risk, context size, available capabilities, latency, and cost.
Do not create subagents merely to match a prescribed topology.

When the scope is known, prefer overlapping independent read-only reviews and
checks within available capacity. A common test can supply its actual output to
multiple reviewers. Sequence work that consumes another result or would
conflict on a fixture, worktree or external quota. The report's reading order
does not impose dependencies on execution.

When a subagent is used, pass task inputs separately and require only the role
file's output contract. Do not request an instruction echo, raw input dump,
private reasoning, or exploratory transcript. If the child cannot read the
absolute role path, passing the role text is an allowed compatibility fallback.

Where the calling skill requires conclusions to remain independent until
synthesis, do not pass one perspective's result into the other perspective.
That separation may be achieved with subagents or with separately grounded
passes; the number and type of agents are not part of the persisted contract.
