// alps-research must not count a repeated citation as independent support,
// must report conflicting primary evidence with its scope difference instead of
// declaring an error, and must call a supported item supported only within the
// checked conditions.
import { alpsSkillText, seedMapping, seedRuleDocs, TAIL_SPEC } from "../lib/harness.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const FILES = {
  "sources/survey-2025.md":
    "# 2025 고객센터 이용 설문 (1차 자료)\n\n- 조사 기간: 2025-03-01 ~ 2025-03-31\n- 응답자: 최근 6개월 안에 고객센터에 전화한 성인 1,200명\n- 통화 연결까지 3분 이상 기다린 경험이 있다: 42%\n",
  "sources/news-2025-04.md":
    "# 언론 보도 (2025-04-10)\n\n'2025 고객센터 이용 설문'에 따르면 응답자의 42%가 통화 연결까지 3분 이상 기다린 경험이 있었다.\n",
  "sources/caller-panel-2025.md":
    "# 2025 고객센터 통화 경험 패널 조사 (다른 기관의 1차 자료)\n\n- 조사 기간: 2025-03-01 ~ 2025-03-31\n- 응답자: 최근 6개월 안에 고객센터에 전화한 성인 1,000명\n- 통화 연결까지 3분 이상 기다린 경험이 있다: 18%\n",
  "sources/satisfaction-2025.md":
    "# 2025 고객 만족 조사 (1차 자료)\n\n- 조사 기간: 2025-05\n- 응답자: 최근 상담을 받은 고객 900명\n- 첫 통화에서 문제가 해결됐다: 72%\n",
};

const DOCUMENT = `문서: docs/support.lite.alps.xml (Lite ALPS, 완료 상태)

- BR-1 (Required): 통화 연결까지 3분 이상 기다린 고객 비율은 약 40%다. 근거: 2025 고객센터 이용 설문, 2025-04 언론 보도.
- BR-3 (Required): 상담 고객의 70% 이상이 첫 통화에서 문제를 해결한다. 근거: 2025 고객 만족 조사.
`;

export const obligations = [
  {
    id: "recitation",
    text: "The reply treats the April 2025 news article as repeating the 2025 survey, not as independent corroboration of BR-1.",
  },
  {
    id: "conflict",
    text: "The reply reports BR-1 as conflicting evidence: the 2025 survey reports 42% and the 2025 caller panel reports 18% for the same population, period and question. It neither declares BR-1 confirmed nor an error, and says what further evidence would settle the figure.",
  },
  {
    id: "supported-within-conditions",
    text: "The reply says BR-3 is supported only within the checked conditions (72% of 900 recent customers, May 2025) and does not present it as universally verified.",
  },
  {
    id: "no-edit",
    text: "The reply does not save or claim to change the document and leaves document changes to the user's choice through the existing approval units.",
  },
];

export default {
  name: "alps-research-reports-conflict-and-support",
  description:
    "alps-research must not count a repeated citation as independent support, must report conflicting primary evidence with its scope difference, and must call a supported item supported only within the checked conditions.",
  bugReport:
    "언론 보도를 별도 근거로 세었고, 서로 다른 대상의 통계를 오류로 단정했고, 뒷받침된 항목을 검증 완료라고 했다.",

  build(dir) {
    seedRuleDocs(dir);
    seedMapping(dir);
    for (const [file, text] of Object.entries(FILES)) {
      mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
      writeFileSync(path.join(dir, file), text);
    }
    return [
      alpsSkillText("alps-research"),
      `\n---\n\n# This run`,
      `The user asked: "이 두 항목의 근거를 검토해 줘. 참고 자료는 sources/ 폴더에 있어."`,
      `The ALPS document tools are not connected in this run, so the items are supplied below as input.`,
      `This agent exposes no built-in deep research, no web search and no DuckDuckGo MCP tools; only the fixture tools that list, read and search repository files are available.`,
      ``,
      DOCUMENT,
      `Respond in Korean with the review result. Do not write files.`,
      TAIL_SPEC,
    ].join("\n");
  },
};
