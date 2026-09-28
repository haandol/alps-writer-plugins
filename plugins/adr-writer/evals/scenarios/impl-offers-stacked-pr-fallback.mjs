import { responseChecks } from "../lib/response-checks.mjs";

export const obligations = [
  {
    id: "delivery",
    text: "Keep the Feature and its single ADR decision intact. Offer dependency-ordered cumulative Stacked PR delivery steps, each answering a conceptual review question and preserving the same contract. Do not split by technical layer.",
  },
  {
    id: "scope",
    text: "Keep the Stack plan ephemeral, create no branch or PR, and make publishing depend on an explicit user request and available GitHub capability. No layer alone promotes the ADR: keep Proposed until the entire implementation and final review pass, then transition to Accepted. All requested tail items agree with the visible plan.",
  },
];

/** Enforce exact response records and no fixture mutation, independently of prose. */
export function deterministicScore(input) {
  return responseChecks(
    input,
    {
      KEEP_ONE_ADR: [],
      STACK_FALLBACK: [],
      STACK_BOUNDARY: [],
      EPHEMERAL: [],
      NO_AUTOPUBLISH: [],
      STATUS_LIFECYCLE: [],
    },
    { noTools: false },
  );
}

import { skillText, seedRuleDocs, seedMapping, TAIL_SPEC, expectNoText } from "../lib/harness.mjs";

export default {
  name: "impl-offers-stacked-pr-fallback",
  description:
    "When the user requests lower review load but one Feature and one ADR must stay intact, adr-impl may offer an ephemeral dependency-ordered Stacked PR delivery plan without publishing it.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    return [
      skillText("adr-impl"),
      `\n---\n\n# This run`,
      `The approved ADR contains one architectural decision: payment idempotency across the`,
      `checkout state flow, provider call, ledger transaction, and duplicate webhook handling.`,
      `The Feature is one observable checkout behavior and the ADR cannot be split into independent`,
      `decisions without duplicating the contract or dividing the vertical slice by technical layer.`,
      `The user explicitly asks to reduce review load and is open to multiple PRs.`,
      `Decide how to decompose delivery, but do not create branches or publish PRs in this run.`,
      `Use KEEP_ONE_ADR, STACK_FALLBACK, STACK_BOUNDARY, EPHEMERAL, NO_AUTOPUBLISH,`,
      `and STATUS_LIFECYCLE finding tags.`,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output }) {
    const all = `${output}\n${tail.raw}`;
    const summary = (tag) =>
      tail.findings.find((finding) => new RegExp(tag, "i").test(finding.tag))?.summary ?? "";
    const keepOneAdr = summary("KEEP_ONE_ADR");
    const stack = summary("STACK_FALLBACK");
    const boundary = summary("STACK_BOUNDARY");
    const ephemeral = summary("EPHEMERAL");
    const noAutopublish = summary("NO_AUTOPUBLISH");
    const lifecycle = summary("STATUS_LIFECYCLE");
    const namesTechnicalLayer =
      /(technical layer|기술 계층|frontend|backend|database|\bUI\b|\bAPI\b|\bDB\b)/i.test(boundary);
    const rejectsTechnicalLayer = /(not|instead of|rather than|아닌|아니라|금지|나누지)/i.test(
      boundary,
    );
    return [
      {
        pass:
          /(Feature|기능)/i.test(keepOneAdr) &&
          /ADR/i.test(keepOneAdr) &&
          /(contract|계약)/i.test(keepOneAdr) &&
          /(same|one|single|하나|동일|유지)/i.test(keepOneAdr),
        detail: keepOneAdr || "missing KEEP_ONE_ADR finding",
        label: "keeps every layer under the same approved ADR contract",
      },
      {
        pass: /(Stacked PR|PR stack)/i.test(stack) && /(dependency|base|순서|의존)/i.test(stack),
        detail: stack || "missing STACK_FALLBACK finding",
        label: "offers a dependency-ordered Stacked PR fallback",
      },
      {
        pass: /(review question|리뷰 질문)/i.test(stack),
        detail: stack || "missing STACK_FALLBACK finding",
        label: "gives each layer one review question",
      },
      {
        pass:
          /(conceptual|review question|개념|리뷰 질문)/i.test(boundary) &&
          (!namesTechnicalLayer || rejectsTechnicalLayer),
        detail: boundary || "missing STACK_BOUNDARY finding",
        label: "splits by conceptual review unit, not technical layer",
      },
      {
        pass:
          /(do not|does not|not persisted|ephemeral|비영속|저장하지)/i.test(ephemeral) &&
          /(ADR|mapping|registry|권위|artifact)/i.test(ephemeral),
        detail: ephemeral || "missing EPHEMERAL finding",
        label: "keeps the Stack plan out of authoritative artifacts",
      },
      {
        pass:
          /(request|요청)/i.test(noAutopublish) &&
          /(capability|지원|기능 사용 가능)/i.test(noAutopublish) &&
          /(before|until|without|전에는|전까지|없이는|확인 전)/i.test(noAutopublish) &&
          /(publish|게시)/i.test(noAutopublish),
        detail: noAutopublish || "missing NO_AUTOPUBLISH finding",
        label: "requires both an explicit publish request and GitHub capability",
      },
      {
        pass:
          /Proposed/i.test(lifecycle) &&
          /(whole|entire|all|전체)/i.test(lifecycle) &&
          /(test|review|verify|검증|테스트|리뷰)/i.test(lifecycle) &&
          /Accepted/i.test(lifecycle) &&
          /(after|until|only then|이후|전까지|완료 후|끝날 때까지)/i.test(lifecycle),
        detail: lifecycle || "missing STATUS_LIFECYCLE finding",
        label: "keeps the ADR Proposed until the whole Stack is verified",
      },
      expectNoText(
        all,
        /create (?:a )?new ADR|새 ADR|split the ADR|ADR을 분할/i,
        "does not invent ADRs for delivery layers",
      ),
    ];
  },
};
