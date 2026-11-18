# Starting a first business ontology

When an operation needs a saved model and the project has none, say what is
missing. Read `show setup` through [project preferences](../skills/ontology-build/references/preferences.md).
If a preference is set, omit the creation question. A current request to build
starts `/ontology-build`; a saved preference alone does not. When undecided,
ask once in the user's language, “Would you like to create a business ontology
for this project now?” Remember an explicit answer with the preference helper.
With the question, name `/ontology-build` and one starting point: a business
document or folder, or a short account of one workflow, such as who submits a
quote, who approves it and what happens if they send it back. A yes starts the
build. On a decline, deferral or no answer, continue any independent work.

If the user chooses to build or already asked to set up the model, continue
with the installed `ontology-build` skill. For a first build with existing ADRs,
that skill uses the chosen ADR review route or asks if it is undecided.
Reuse the scope, explanations and sources they already supplied.
When none are available, ask which workflow
they want to start with. They review the draft before approving what to save.
Once saved, resume the original request when it still applies.

If the user only asked to view or review, the offer itself creates nothing.
A missing process in an existing model, an unreadable model, broken step links
or a missing explicitly requested draft calls for a diagnosis of that input.
