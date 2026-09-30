import { skillText, write, TAIL_SPEC } from "../lib/harness.mjs";
import { fixtureFiles, score as discoveryScore } from "./author-discovers-existing-boundaries.mjs";

export const score = (input) => discoveryScore(input, ".adr-review/import/report.md");

export default {
  name: "import-asks-intent-before-writing",
  description:
    "Use adr-import on an existing layered repository to discover business features, preserve source evidence and collect unknown intent before official ADR/index writes.",
  obligations: [
    {
      id: "import",
      text: "Inspect repository and deployment evidence, group business contexts and vertical features, preserve the member/1..3-item/submitted-to-confirmed and payment-failure contracts as candidates, and visibly distinguish unknown historical intent. Ask remaining questions together with visible IDs and do not save official ADR/index or modify application code before approval. Declare unavailable repository scope honestly.",
    },
  ],
  score,
  deterministicScore: score,
  build(dir) {
    for (const [file, body] of Object.entries(fixtureFiles)) write(dir, file, body);
    return [
      skillText("adr-import", {
        references: [
          "references/feature-boundaries.md",
          "references/decision-reconciliation.md",
          "references/decision-questions.md",
        ],
      }),
      `# This run
Run adr-import for the existing project at ${dir}. Read actual files, discover
the features and prepare complete contract candidates and intent questions.
The user has not approved official ADR/index writes. Application and supplied
project files must remain unchanged. This evaluation explicitly requests one
Markdown question report at .adr-review/import/report.md rather than HTML.
Only that disposable report may be written. Read through the available fixture
tools; do not call external systems, browsers or install dependencies. Describe
observed behavior separately from confirmed intent and ask all remaining
questions together using visible IDs.`,
      TAIL_SPEC,
    ].join("\n\n");
  },
};
