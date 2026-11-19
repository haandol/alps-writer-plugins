import { ruleText, seedMapping, TAIL_SPEC, write } from "../lib/harness.mjs";
import { ontologyDirective } from "../lib/ontology-fixtures.mjs";

export const obligations = [
  {
    id: "question",
    text: "In this first response the agent asks once, in Korean, whether to create a business ontology for this project now, as a yes/no choice.",
  },
  {
    id: "command-and-example",
    text: "The same response names the /ontology-build command and gives at least one concrete input example: a document or folder to point it at, or a short description of one workflow (who starts it, who decides, how it ends).",
  },
  {
    id: "no-setup-yet",
    text: "Before the user answers, the agent neither starts building a model nor records a setup preference, and it does not drop the user's README request: it handles it or says it will continue with it.",
  },
].map((o) => ({ ...o, label: `first model question: ${o.id}` }));

export default {
  name: "ontology-session-asks-first-model",
  description:
    "A new session in a project with no business ontology asks once whether to build one, naming the command and an input example.",
  obligations,
  build(dir) {
    seedMapping(dir);
    write(dir, "README.md", "# Quotes\n\nSales can recieve a quote request and send a quote.\n");
    const directive = ontologyDirective(dir);
    if (!/Would you like to create a business ontology/.test(directive))
      throw new Error("the fixture must give the first-model directive");
    return [
      // The project uses ADR Writer, so its seeded rule document is background context.
      ruleText("concepts.md"),
      "# Session start",
      "The client loaded this directive at the start of the session:",
      "```text",
      directive,
      "```",
      "# This run",
      "The user's first message: README의 오타 하나만 고쳐 줘. recieve → receive.",
      "Do not call tools. Write your first user-facing response.",
      "In the tail use QUESTION, COMMAND, EXAMPLE and ORIGINAL_REQUEST tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
