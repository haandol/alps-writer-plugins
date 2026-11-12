# Reading path: plan first, then allocate detail by level

Read before drafting any selected report. [Explanation design](explanation-design.md)
owns the principles; this module turns them into a fixed authoring order and a
per-level budget so reports read alike regardless of the model writing them.

## Plan the reading path before writing prose

Decide the path before writing any paragraph. The plan is a working step: keep
it in your scratch reasoning or a throwaway outline, never as a report section,
companion file or approval record.

1. **Reader and goal.** Who reads this, and what should they be able to
   understand, decide or do afterwards? This becomes Purpose.
2. **Core message.** Write the answer as one sentence a reader could repeat.
   If it needs "and" between unrelated claims, the report has two subjects;
   choose the one the reader asked about and attach the other where it changes
   that answer.
3. **The whole as parts.** Name the parts (at most four) that together produce
   the core message, by responsibility rather than file or component, and the
   relationship that connects them. When the topic lies in a business ontology's
   bounded contexts, those contexts are the parts; see
   [reuse the business ontology](diagrams.md#reuse-the-business-ontology). This becomes the Overview and the top-level
   sections, in the order a reader needs them.
4. **Each part's question.** For every section, write the question it answers
   and what it deliberately leaves to a lower level. A part whose question you
   cannot state is a topic list, not an explanation; merge or drop it.
5. **Paragraph flow.** For each section, list the paragraphs by role: lead
   answer, then mechanism or relationship, then condition, example or exception.
   Note how each paragraph connects to the one before it.

Check the plan before drafting: reading only the titles, previews and each
paragraph's first sentence in order, does a reader get the core message and see
why each section follows the previous one? If not, fix the plan, not the prose.

Then copy [the report template](../templates/report.json), replace every
`{{...}}` placeholder from the plan, and delete optional objects (diagram,
children, evidence excerpt) the content does not need. Write the prose last,
following [writing style](writing-style.md).

## Allocate detail by level

The template owns this allocation: each region's position fixes its level.
Within a region, what you write and in which form is your judgment, as long as
it stays at that level. Each level answers its own question and pushes
everything else down. Moving a
detail down is not deleting it: exact values, conditions and evidence stay in
the report at the level that explains them.

| Level                 | Answers                                      | Contains                                                                       | Defers                                              |
| --------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| Core answer (summary) | What is the conclusion and what do I do?     | Conclusion, why it matters, the limitation that changes it, next action        | Identifiers, file paths, commands, logs, mechanisms |
| Overview              | What is the whole made of?                   | The parts and how they connect to produce the answer; a figure of those parts  | Each part's internals                               |
| Top-level section     | How does this part work and what rules hold? | Lead answer, role, relationships, rules; implementation names after their role | Step-by-step behavior, exhaustive cases             |
| Child section         | What exactly happens in this case?           | Concrete input → condition → result, exceptions, exact values                  | Raw code, logs, reproduction settings               |
| Evidence              | Where can I verify it?                       | Source excerpts, code, logs, diffs, hashes                                     | —                                                   |

Two exceptions keep upper levels honest. A condition, failure or unverified
scope that changes the answer stays visible at every level above it. An exact
value that is itself the conclusion ("the limit is 30 seconds") belongs in the
core answer; how it is enforced does not.

On screen, top-level sections and their first-level children start open; deeper
children start collapsed with their title and preview visible. Put what the
reader needs to understand the answer at the first two levels, and mark a deeper
child `expanded: true` only when the conclusion cannot be understood without it.

## Common failures to catch in the draft

- The core answer names functions, files or fields, or narrates the investigation.
- The Overview lists section titles without saying how the parts connect.
- A top-level section opens with code, raw identifiers or a log excerpt before explaining the part's role.
- A comparison or before/after change is buried in sentences where a table would show it at once, or a flow is described in prose where a diagram would.
- A child repeats its parent's summary instead of adding a case, rule or value.
- Five or more peer sections or explanation cards; regroup them by responsibility instead of truncating. Rows of a table and items of a list are not limited.
