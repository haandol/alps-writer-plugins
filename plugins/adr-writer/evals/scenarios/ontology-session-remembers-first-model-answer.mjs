import { ruleText, seedMapping, TAIL_SPEC, write } from "../lib/harness.mjs";
import { ontologyDirective } from "../lib/ontology-fixtures.mjs";

export const obligations = [
  {
    id: "records-later",
    text: "Because the user explicitly answered later, the agent records that choice with the preference helper named in the directive — `set setup later` run in the project directory — and records nothing else.",
  },
  {
    id: "continues",
    text: "It continues the original request (fixing recieve to receive in README.md) without starting /ontology-build, drafting a model or asking about the ontology again in this conversation.",
  },
].map((o) => ({ ...o, label: `first model answer: ${o.id}` }));

export default {
  name: "ontology-session-remembers-first-model-answer",
  description:
    "After the user defers the first-model question, the agent records 'later' once and continues the original request without asking again.",
  obligations,
  build(dir) {
    seedMapping(dir);
    write(dir, "README.md", "# Quotes\n\nSales can recieve a quote request and send a quote.\n");
    const directive = ontologyDirective(dir);
    if (!/set setup <choice>/.test(directive))
      throw new Error("the fixture must give the first-model directive");
    return [
      // The project uses ADR Writer, so its seeded rule document is background context.
      ruleText("concepts.md"),
      "# Session start",
      "The client loaded this directive at the start of the session:",
      "```text",
      directive,
      "```",
      "# Conversation so far",
      "User: README의 오타 하나만 고쳐 줘. recieve → receive.",
      "Assistant: 지금 이 프로젝트의 업무 온톨로지를 만들까요? 만들려면 /ontology-build에 업무 문서나 폴더를 지정하거나, 견적을 누가 올리고 누가 승인하는지처럼 업무 하나를 설명해 주세요. README 오타는 바로 고치겠습니다.",
      "User: 나중에 할게. 오타나 고쳐 줘.",
      "# This run",
      "README.md currently reads:",
      "```markdown",
      "# Quotes\n\nSales can recieve a quote request and send a quote.",
      "```",
      "Do not call tools. Show the exact commands and file edit you would make, in order, and your reply to the user.",
      "In the tail use PREFERENCE, ORIGINAL_REQUEST and ASK_AGAIN tags. Put each tag exactly to the left of the | separator.",
      TAIL_SPEC,
    ].join("\n");
  },
};
