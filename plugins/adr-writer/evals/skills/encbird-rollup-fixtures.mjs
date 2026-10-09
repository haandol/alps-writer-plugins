import { readFileSync } from "node:fs";

export const encbirdRollupProvenance = JSON.parse(
  readFileSync(new URL("./encbird-fixtures/provenance.json", import.meta.url), "utf8"),
);
const progressSource = readFileSync(
  new URL("./encbird-fixtures/chatTurnProgress.ts.txt", import.meta.url),
  "utf8",
);

export const rollupPaths = {
  survivor: "docs/adr/chatbot/0001-freechat-disposable-conversation.md",
  absorbed: "docs/adr/chatbot/0003-new-session-cohort-limits.md",
  independent: "docs/adr/chatbot/0005-real-streaming-sse.md",
  reference: "docs/adr/pictochat/0001-pictochat-implementation.md",
  log: "docs/adr/chatbot/decision-log.md",
  mapping: "docs/adr/.mapping.json",
  plan: ".adr-review/rollup/plan.md",
};

function adr(
  number,
  title,
  decision,
  {
    status = "Accepted (2026-10-07)",
    date = "2026-10-06",
    purpose,
    driver,
    alternative,
    related = "- 없음",
  },
) {
  return `# ADR ${number}: ${title}

Date: ${date}

## Status

${status}

## Purpose

${purpose}

## Decision Drivers

- ${driver}

## Decision

${decision}

### Alternatives

${alternative}

## Consequences

현재 계약은 구현을 교체해도 유지해야 한다. 조건별 검증이 필요하며, 명시하지 않은 다른 기능의 정책을 이 결정으로 바꾸지 않는다.

## Related

${related}
`;
}

function fixture(records, code, tests, extra = {}) {
  const files = {
    ".gitignore": ".adr-review/\n",
    "package.json": '{"private":true,"type":"module"}\n',
    "README.md":
      "# EncBird contract fixture\n\n실제 ADR의 선택된 계약으로 재구성한 로컬 평가 저장소다. 경로와 결정 분할은 테스트용이며 실제 EncBird의 롤업 대상 목록이 아니다. chatTurnProgress.ts는 고정한 실제 원본이며 나머지 정책 코드는 선택한 계약의 실행 가능한 투영이다. 실제 서비스·인프라 검증은 포함하지 않는다.\n",
    "src/policy.mjs": code,
    "test/policy.test.mjs":
      'import {test} from "node:test";\nimport assert from "node:assert/strict";\nimport * as policy from "../src/policy.mjs";\n' +
      tests,
    ...extra,
  };
  const categories = {};
  for (const [file, body, summary] of records) {
    files[file] = body;
    const key = file.slice("docs/adr/".length).split("/").slice(0, -1).join("/");
    categories[key] ??= { feature: key, adrs: [], dependsOn: [] };
    categories[key].adrs.push({
      path: file,
      status: body.match(/## Status\s+([^\n]+)/)[1],
      summary,
    });
  }
  files[rollupPaths.mapping] = JSON.stringify({ categories }, null, 2) + "\n";
  return files;
}

/** Reconstruct one adopted change; old-session entitlement is still current, not obsolete history. */
export function buildEncbirdCohortRollup({ proposed = false } = {}) {
  const old = adr(
    "0001",
    "프리챗의 실제 학습자 턴 한도",
    `텍스트 프리챗은 실제 학습자 5턴, 음성은 6턴까지 제공한다. 텍스트 시작 시 저장하는 숨은 사용자 시드 한 개는 학습자 턴이 아니다. 저장 상한 6은 텍스트에서 시드 1개와 실제 5턴을 뜻하고 음성에는 시드 보정이 없다.
한도를 채우면 추가 발화를 거절한다. 텍스트 프리챗에는 조기 종료가 없고 모든 실제 턴을 채운 뒤에만 텍스트 세션 피드백을 생성한다.`,
    {
      status: "Accepted (2026-09-28)",
      date: "2026-09-28",
      purpose:
        "일회성 상황 연습의 끝을 예측할 수 있게 하고, 완료 경험과 세션 비용의 상한을 유지한다.",
      driver:
        "짧은 텍스트 세션은 완료율과 분량 예측 가능성을 높인다. 저장 메시지 수를 학습자의 실제 발화 수로 잘못 표시해서는 안 된다.",
      alternative:
        "종료 없는 대화는 상황 연습의 완결 경험과 비용 상한을 만들지 못하므로 채택하지 않는다.",
    },
  );
  const next = adr(
    "0003",
    "신규 프리챗 한도와 기존 세션의 이용 기회",
    `2026-10-06에 채택한 이 변경은 같은 프리챗 턴 한도 결정의 신규 세션 범위를 조정한다. 기존 세션의 이용 기회와 종료 규칙은 유지한다.

신규 TEXT는 실제 4턴, 신규 VOICE는 실제 5턴이다. 서버는 두 모드의 저장 상한 5를 생성할 때 고정하며 재시도·재연결·조회로 바꾸지 않는다. 저장 상한이 없는 기존 세션은 6으로 해석한다. 따라서 기존 TEXT는 실제 5턴, 기존 VOICE는 실제 6턴이며 기존 결제의 이용 기회를 줄이지 않는다.
TEXT의 숨은 시작 시드 1개는 실제 학습자 턴에서 빼고 VOICE에는 시드가 없다. 한도를 채운 뒤 추가 발화를 거절하고, TEXT는 조기 종료 없이 해당 세션의 실제 한도를 모두 채운 뒤에만 세션 피드백을 생성한다. 완료 부담을 낮추는 변경을 보상하려고 최소 답변 길이를 늘리지 않는다.
${proposed ? "채택은 확인되었으나 이 테스트 저장소에서 새 계약의 최종 완료 검토는 아직 끝나지 않았다. 로컬 정책 코드가 맞아도 이 포함 결정의 완료 상태는 Proposed다." : "이 포함 결정은 이미 Accepted이며 현재 로컬 정책과 검증이 그 계약을 유지한다."}

\`\`\`mermaid
flowchart LR
N[신규 세션] --> S[생성 시 저장 상한 5 고정]
L[저장 상한 없는 기존 세션] --> O[기존 저장 상한 6 해석]
S --> T[TEXT는 시드 1 제외]
O --> T
S --> V[VOICE는 시드 없음]
O --> V
\`\`\``,
    {
      status: proposed ? "Proposed" : "Accepted (2026-10-07)",
      purpose:
        "새 연습의 완료 부담을 줄이면서 이미 시작하고 결제한 세션의 약속한 이용 기회를 보존한다.",
      driver:
        "신규 텍스트 연습의 분량을 예측 가능하게 줄이되 기존 사용자에게 소급 적용하지 않는다. 텍스트와 음성의 시드 단위를 구분한다.",
      alternative:
        "현재 기본값 5를 기존 세션에도 일괄 적용하면 이미 제공한 이용 기회를 줄이므로 채택하지 않는다. 짧아진 턴을 긴 답변 강제로 보충하지 않는다.",
      related: "- [기존 턴 한도 결정](0001-freechat-disposable-conversation.md)",
    },
  );
  const streaming = adr(
    "0005",
    "텍스트 스트림과 저장의 정합",
    "본문은 일반 텍스트로 먼저 전달하고 보조 피드백은 완결된 결과에서 전달한다. 사용자와 AI 메시지는 한 쌍으로 원자 저장한다. 미완료 스트림을 완료 메시지 쌍으로 확정하지 않는다. 이는 턴의 분량과 별개의 전송·저장 정합 결정이다.",
    {
      status: "Accepted (2026-10-03)",
      date: "2026-10-03",
      purpose:
        "먼저 읽은 본문과 최종 저장 기록이 달라지거나 중단된 스트림이 완료로 남지 않아야 한다.",
      driver: "사용자에게 전달한 대화와 저장한 메시지 쌍의 정합성을 유지한다.",
      alternative:
        "부분 응답을 각각 확정 저장하면 미완료 내용을 완료로 오인할 수 있어 채택하지 않는다.",
    },
  );
  const picto = adr(
    "0001",
    "픽토챗의 학습자 턴 카운팅",
    "픽토챗은 실제 학습자 4턴이며 숨은 시작 시드 1개를 제외한다. 이 그림 대화의 정책은 프리챗의 과거 세션 한도 변경으로 대체되지 않는다.",
    {
      date: "2026-10-07",
      purpose: "그림 대화에서 실제로 답한 횟수와 숨은 시작 메시지를 구분한다.",
      driver: "학습자에게 숨은 시드를 학습 완료로 표시하지 않는다.",
      alternative:
        "숨은 시드를 실제 답변으로 세면 시작하자마자 학습한 것처럼 보이므로 채택하지 않는다.",
      related: "- [프리챗의 시드와 세션 한도](../chatbot/0003-new-session-cohort-limits.md)",
    },
  );
  return fixture(
    [
      [rollupPaths.survivor, old, "프리챗의 실제 학습자 턴과 종료 규칙"],
      [rollupPaths.absorbed, next, "신규 4/5턴, 기존 5/6턴을 구분한 같은 프리챗 한도 변경"],
      [rollupPaths.independent, streaming, "본문 스트리밍과 원자 메시지 저장의 독립 결정"],
      [rollupPaths.reference, picto, "픽토챗의 독립 4턴·시드 제외 계약"],
    ],
    `import {learnerTurnProgress,isLearnerTurnComplete,sessionMaxMessageCount} from './chatTurnProgress.ts';
export const progress = (mode, session, count) => learnerTurnProgress(count,sessionMaxMessageCount(session),mode==='TEXT');
export const canContinue = (mode,session,count) => !isLearnerTurnComplete(count,sessionMaxMessageCount(session),mode==='TEXT');
export const createSession = () => ({maxMessageCount:5});
export const textFeedbackReady = (session,count) => !canContinue('TEXT',session,count);
export const canAcceptAnswer = (mode,session,count,answer) => answer.trim().length>0 && canContinue(mode,session,count);
export const commitPair = (human,ai,complete) => complete?[human,ai]:[];
export const pictoMaxTurns = 4;
`,
    `test('new and existing cohorts preserve different actual-turn entitlements',()=>{
 const fresh=policy.createSession();
 assert.deepEqual(policy.progress('TEXT',fresh,1),{completedTurns:0,maxTurns:4});
 assert.deepEqual(policy.progress('VOICE',fresh,0),{completedTurns:0,maxTurns:5});
 assert.equal(policy.progress('TEXT',{},1).maxTurns,5);assert.equal(policy.progress('VOICE',{},0).maxTurns,6);
 assert.equal(policy.progress('TEXT',{maxMessageCount:6},1).maxTurns,5);
});
test('resume reads do not replace the creation snapshot and text feedback requires the actual cap',()=>{
 const old={maxMessageCount:6};policy.progress('TEXT',old,4);assert.deepEqual(old,{maxMessageCount:6});
 assert.equal(policy.canContinue('TEXT',{},5),true);assert.equal(policy.canContinue('TEXT',{},6),false);
 assert.equal(policy.textFeedbackReady(policy.createSession(),4),false);assert.equal(policy.textFeedbackReady(policy.createSession(),5),true);
 assert.equal(policy.canAcceptAnswer('TEXT',policy.createSession(),1,'I'),true);assert.equal(policy.canAcceptAnswer('TEXT',policy.createSession(),5,'hello'),false);
 assert.deepEqual(policy.progress('TEXT',{},0),{completedTurns:0,maxTurns:5});
});
test('independent stream and picture-chat contracts remain intact',()=>{
 assert.deepEqual(policy.commitPair('h','a',false),[]);assert.deepEqual(policy.commitPair('h','a',true),['h','a']);assert.equal(policy.pictoMaxTurns,4);
});
`,
    { "src/chatTurnProgress.ts": progressSource },
  );
}

/** Current pool responsibilities are related peers, not an adopted replacement chain. */
export function buildEncbirdPoolNoChain() {
  const specs = [
    [
      "0001",
      "review-quiz-immersive-workspace",
      "학습 모달의 진입·재개·닫기",
      "학습은 원래 화면 위의 URL 연결 모달로 열린다. 같은 탭·계정에서 닫았다 열면 메모리의 입력·힌트를 이어가고, 새로고침·로그아웃·계정 변경에는 그 임시 상태를 복원하지 않는다. 배경 상호작용은 차단하고 포커스는 모달 안에서 순환하며 닫으면 복원한다. 닫기는 학습 완료가 아니다. 큐의 내용 선택은 0004가 소유한다.",
      "원래 화면의 맥락과 주소·포커스·진행 상태를 함께 유지한다.",
      "주소 없는 모달은 직접 링크와 로그인 복귀를 복원할 수 없어 채택하지 않는다.",
    ],
    [
      "0002",
      "review-quiz-sentence-flow-game-layer",
      "정답 확정의 감각적 피드백",
      "0001 워크스페이스 위에서 정답 단어가 확정되는 순간 시각·청각·촉각 피드백과 단어 단위 진척 게이지를 제공한다. 콤보 배수·연속 보너스·스트릭 리셋은 도입하지 않는다. reduced-motion·음소거·기기 능력 가드를 지키며 기존 채점과 힌트 계약은 바꾸지 않는다.",
      "정적인 정답 상태와 다른 축인 확정 순간의 보상과 누적 진척을 제공한다.",
      "풀스크린 게임으로 엔진까지 바꾸는 대안은 동작 회귀와 과한 게임 톤 때문에 채택하지 않는다.",
    ],
    [
      "0003",
      "keyboard-typable-quiz-text",
      "문장 생성·표시·채점의 문자 호환",
      "새 한국어 문제와 영어 정답에는 --·—·–·콜론·세미콜론을 넣지 않는다. 단어 내부 단일 하이픈과 실제 학습자 인용 원문은 보존한다. 과거 레코드를 재작성하지 않고 표시·채점에서 같은 키보드 등가 정규화를 사용한다. 잘못된 생성 결과는 각 기능의 기존 실패 경로를 따르며 추가 재작성 모델 호출을 만들지 않는다.",
      "보이는 대로 입력할 수 있고 같은 규칙으로 채점돼야 한다.",
      "프롬프트 지시만으로는 생성 오류를 보장해 막지 못하므로 저장 전 검증과 기존 호환 정규화를 함께 둔다.",
    ],
    [
      "0004",
      "review-quiz-due-exploration-mix",
      "복습 세션의 문제 선정",
      "새 세션은 서로 다른 표현 5개에 3지선다 1개·번역 4개를 배정한다. due·탐색을 섞고 사용자 자산이 없으면 현재 CEFR 3개·인접 레벨 2개로 보충한다. 최초 진입·새로고침·명시적 새 세션은 새 조회이며, 같은 탭·계정의 모달 재개는 큐와 입력을 유지한다. 보기 노출은 완료가 아니고 정답 대상만 FSRS에 반영한다. 원본 퀴즈가 사라진 404는 기록을 바꾸지 않고 새 조회를 제공하며 조회 실패 시 기존 답안을 보존한다.",
      "due 복습 부채와 표현 다양성을 균형 있게 유지하면서 짧은 생산 연습을 제공한다.",
      "due 이후 가장 가까운 future due만 고르면 방금 푼 표현이 반복되므로 채택하지 않는다. 영속 큐는 삭제된 퀴즈와 어긋날 수 있어 보존하지 않는다.",
    ],
  ];
  return fixture(
    specs.map(([number, name, title, decision, driver, alternative]) => [
      `docs/adr/pool/${number}-${name}.md`,
      adr(number, title, decision, {
        status: `Accepted (${{ "0001": "2026-10-08", "0002": "2026-07-08", "0003": "2026-07-25", "0004": "2026-10-08" }[number]})`,
        date: {
          "0001": "2026-10-08",
          "0002": "2026-07-08",
          "0003": "2026-07-25",
          "0004": "2026-10-08",
        }[number],
        purpose: driver,
        driver,
        alternative,
        related:
          number === "0001"
            ? "- [문제 선정](0004-review-quiz-due-exploration-mix.md)"
            : number === "0002"
              ? "- [작업 화면](0001-review-quiz-immersive-workspace.md)"
              : "- 없음",
      }),
      title,
    ]),
    "export const quizCount=5;export const types={choice:1,translation:4};export const closeCompletes=false;\n",
    "test('closing is not completion and session composition remains five questions',()=>{assert.equal(policy.closeCompletes,false);assert.equal(policy.quizCount,5);assert.deepEqual(policy.types,{choice:1,translation:4});});\n",
  );
}
