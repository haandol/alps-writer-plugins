# Conditional repair guide

Add `## Repair guide` only when the verdict is `FIX_REQUIRED` or `BLOCK`, or when
the user asks for detailed repair guidance. This is report content, not permission
to apply a fix. [Remediation routing](remediation-routing.md) belongs to the caller.

For `FIX_REQUIRED` and `BLOCK`, preserve the
[native finding anchors and repair labels](artifact-schema.md#narrative-source-and-generated-sections):
write findings with `### F1. <finding summary>`-style headings. Across the report,
the validator requires at least one matching numbered heading per JSON finding;
ordinary unnumbered headings do not count. It also requires `## Repair guide`,
`Files and symbols to change:`, `Scope not to touch:`, `Completion criteria:`,
and `Needs confirmation:` literally. A user-requested repair guide with a `PASS`
or `INCONCLUSIVE` verdict does not activate those conditional validation checks.

For each actionable finding in a conditional repair guide, include:

1. What the problem is and which user or operational symptom it manifests as
2. The difference between the ADR decision and the actual code
3. The order of files and symbols to read
4. The reproduction command and the current result
5. The fix steps and the scope not to touch
6. The expected behavior after the fix
7. The tests that must pass and the completion criteria
8. The confidence level and what has not been confirmed yet

Do not add a glossary, code-reading tour, merge checklist, or extra diagram
unless it directly helps resolve a verified finding.

Keep Files and symbols to change, Scope not to touch, ordered fix steps, expected
behavior, verification, Completion criteria, and Needs confirmation explicit.
Use concrete steps proportional to the finding, not "handle appropriately" or
"add the necessary tests". Additional diagrams may help resolve a verified finding.

When a finding concerns documentation, tests, or long inline comments, read
`${CLAUDE_PLUGIN_ROOT}/references/implementation-evidence.md` completely and
derive the repair guidance from that contract.
