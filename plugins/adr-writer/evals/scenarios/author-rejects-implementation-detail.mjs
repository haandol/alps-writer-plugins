// Scenario: an existing ADR-worthy provider/model boundary stays unchanged,
// while the requested work changes only the SDK and credential plumbing.
// /adr-new must reject the request at the admission gate instead of creating a
// polished ADR whose core subject lives at code resolution.
import {
  skillText,
  seedRuleDocs,
  seedMapping,
  read,
  TAIL_SPEC,
  expectText,
  expectNoText,
} from "../lib/harness.mjs";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const BRIEF = `기존 결정은 GPT-5.6 모델을 Amazon Bedrock을 통해 사용한다는 것이다.
모델, 제공자, fallback, 보안 신뢰 경계, 사용자 동작은 바뀌지 않는다.

이번 변경에서는 Bedrock 호출 코드를 AWS SDK v3로 바꾸고 default credential
provider chain을 사용한다. 요청 서명과 인증 연결은 SDK adapter가 처리한다.
이 구현 변경을 ADR로 작성해줘.`;

export default {
  name: "author-rejects-implementation-detail",
  description:
    "/adr-new must not create an ADR for an SDK and credential-provider change that preserves the existing Bedrock provider boundary.",
  bugReport:
    "“Bedrock SDK와 credential provider만 바꾸는데도 새 ADR을 만들고 인증 라이브러리까지 본문에 적었다”",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);

    return [
      skillText("adr-new"),
      `\n---\n\n# This run\n`,
      `You are executing /adr-new in the repository at ${dir}, with the argument: llm/bedrock-client`,
      ``,
      `This is a NON-INTERACTIVE run. The brief below is complete.`,
      `Apply the ADR admission gate before writing any file. If it fails, do not`,
      `create an ADR or mapping entry; explain where the decision belongs instead.`,
      ``,
      `## The user's brief`,
      ``,
      BRIEF,
      TAIL_SPEC,
    ].join("\n");
  },

  score({ tail, output, dir }) {
    return [
      ...deterministicScore({ dir }),
      expectText(
        output,
        /admission gate|implementation substitution/i,
        "applies the admission gate",
      ),
      expectText(
        output,
        /implementation detail|implementation discretion|코드 수준|구현 디테일/i,
        "routes the SDK and credential choice to code",
      ),
      expectText(
        output,
        /GPT-5\.6.{0,80}(Bedrock|Amazon Bedrock)|Bedrock.{0,80}provider boundary/is,
        "preserves the distinction from the provider/model boundary",
      ),
      expectNoText(
        output,
        /(?:create|write|save|작성|생성|저장).{0,50}(?:ADR).{0,80}(?:SDK|credential provider)/i,
        "does not recommend an ADR for the SDK or credential provider",
      ),
      {
        pass: tail.verdict !== null && !/^(BLOCK|FIX_REQUIRED)$/i.test(tail.verdict.trim()),
        detail: tail.verdict ? `verdict was ${tail.verdict}` : "no verdict in the tail block",
        label: "reports the request as out of ADR scope rather than a document defect",
      },
    ];
  },
};

export const obligations = [
  {
    id: "admission",
    text: "The SDK, credential-provider and signing-adapter changes are exempt implementation choices because the GPT-5.6/Bedrock provider boundary, fallback, trust boundary and observable behavior stay unchanged. Explain this in the visible reply without recommending a new ADR for this SDK change. Discussion of a separate provider-boundary decision is not a recommendation to record the SDK plumbing.",
  },
  {
    id: "scope",
    text: "No ADR or mapping entry is created. The response treats this as outside ADR admission, not a defective ADR requiring implementation blockage. Actual unchanged artifacts must agree with the report.",
  },
];

/** File/index absence is exact; natural-language routing is evaluated by GEval. */
export function deterministicScore({ dir }) {
  const mapping = JSON.parse(read(dir, "docs/adr/.mapping.json") ?? '{"categories":{}}');
  const numbered = findNumberedAdrFiles(path.join(dir, "docs", "adr"));
  return [
    {
      pass: numbered.length === 0,
      detail: numbered.length ? `unexpected ADRs: ${numbered.join(", ")}` : "no ADR created",
      label: "creates no ADR for replaceable SDK and credential plumbing",
    },
    {
      pass: Object.keys(mapping.categories ?? {}).length === 0,
      detail: `mapping categories: ${Object.keys(mapping.categories ?? {}).join(", ") || "none"}`,
      label: "creates no mapping entry",
    },
  ];
}

function findNumberedAdrFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (/^\d{4}-.*\.md$/.test(entry)) out.push(full);
    }
  }
  return out;
}
