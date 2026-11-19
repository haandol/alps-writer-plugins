import { seedIndexedAdrs, seedMapping, write } from "../lib/harness.mjs";
import { buildPrompt } from "../lib/ontology-fixtures.mjs";

const MAPPING = {
  categories: {
    "sales/quotes": {
      feature: "Quote approval",
      dependsOn: [],
      adrs: [
        {
          path: "docs/adr/sales/quotes/0001-quote-approval.md",
          status: "Accepted (2026-10-01)",
          summary: "A sales manager decides whether to approve a submitted quote",
        },
      ],
    },
  },
};

export default {
  name: "ontology-build-remembers-review-choice",
  description:
    "An explicit answer to the pre-build ADR review question is remembered as the project's route and the build continues without review.",
  obligations: [
    {
      id: "recorded",
      text: "The user explicitly chose to build directly from now on, so the response records that route with the project preference helper — `ontology-preferences.mjs set adr-review build-direct`.",
    },
    {
      id: "continues",
      text: "It continues to the build with the current documents (quote-workflow.md and the existing ADR) without running an ADR review first.",
    },
    {
      id: "not-approval",
      text: "It does not treat the remembered route as approval to edit ADRs or to save the model; model saving is still approved after the user reviews the candidates.",
    },
  ],
  build(dir) {
    seedMapping(dir, MAPPING);
    seedIndexedAdrs(dir, MAPPING);
    write(
      dir,
      "quote-workflow.md",
      "A salesperson submits a quote. A sales manager approves or returns it.\n",
    );
    return buildPrompt(
      [
        "skills/ontology-build/references/preferences.md",
        "skills/ontology-build/references/pre-build-adr-review.md",
      ],
      'This project has no saved ontology. It holds docs/adr/sales/quotes/0001-quote-approval.md and quote-workflow.md. The project preference helper\'s `show` printed: {"setup":"build"}',
      "You asked: “기존 ADR을 먼저 리뷰하고 발견 사항을 반영할까요, 아니면 현재 문서로 바로 구축할까요?”",
      "사용자: 리뷰 없이 바로 구축해 줘. 앞으로도 이 프로젝트는 그렇게 해.",
      "Do not call tools or write files. Respond to the user and list the commands you would run next, including any preference you record.",
    );
  },
};
