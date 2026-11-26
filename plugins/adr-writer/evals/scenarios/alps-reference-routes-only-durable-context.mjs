import {
  alpsGuideText,
  alpsSkillText,
  seedMapping,
  seedRuleDocs,
  TAIL_SPEC,
} from "../lib/harness.mjs";

const REFERENCE = `
Incident INC-417

Users could not save approved documents during a regional failover.
The MVP must support about 500 total users and 10 concurrent users.
Users access it through a web browser.
Customer documents must remain in the contracted region.
The external model provider must not train on customer content.

Current implementation snapshot:
- React in apps/web/src/App.tsx
- Express and MongoDB in services/api/
- LangChain with the Bedrock SDK
- GitHub Actions deployment
- log stream prod-save-2026-08-31 showed ECONNRESET
`;

// The incident's durable conditions, judged on the visible digest only.
export const obligations = [
  {
    id: "durable-constraints",
    text: "The visible Section 4 digest keeps every durable condition from the incident: about 500 total users and 10 concurrent users, access through a web browser, customer documents remaining in the contracted region, and the external model provider not training on customer content. Dropping, weakening or reversing any of them fails.",
  },
  {
    id: "architecture-constraints",
    text: "The digest presents these conditions as Section 4.2 Architecture Constraints, as scale assumptions and mandated access, data and provider boundaries, not as a technology inventory.",
  },
  {
    id: "ephemeral-and-replaceable",
    text: "The visible digest leaves out the incident ticket INC-417, the log stream and its ECONNRESET error, code paths such as apps/web/src/App.tsx and services/api/, and the replaceable technologies React, Express, MongoDB, LangChain, the Bedrock SDK and GitHub Actions. Naming them as excluded items or in an exclusion list also fails.",
  },
  {
    id: "approval-before-save",
    text: "The reply is an approval digest that offers approve, revise and defer before anything is saved. It calls no tool and does not claim the section was saved.",
  },
];

export default {
  name: "alps-reference-routes-only-durable-context",
  description:
    "ALPS reference handling must preserve reproducible product and architecture constraints while leaving ticket metadata and code-recoverable technology facts out of the document.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      alpsSkillText("alps-init"),
      alpsGuideText(4),
      `\n---\n\n# This run`,
      REFERENCE,
      `Use the incident as reference input and produce the user-facing Section 4 approval digest only.`,
      `Do not call tools.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
