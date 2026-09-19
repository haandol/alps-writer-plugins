import {
  alignedChat,
  chatChain,
  compensationCleanup,
  forwardDrift,
  independentToken,
  priceChain,
  retentionLocal,
} from "./fixtures.mjs";
import { snapshotsFor } from "./provenance.mjs";

const obligation = (id, text) => ({ id, text });
const encbird = [
  "encbird/docs/adr/chatbot/0001-freechat-disposable-conversation.md",
  "encbird/docs/adr/chatbot/decision-log.md (2026-07-18)",
  "encbird/docs/adr/pictochat/0001-pictochat-implementation.md",
  "encbird/packages/web/app/utils/chatTurnProgress.ts",
];
const pixelbank = [
  "pixelbank/docs/adr/token/0002-free-trial.md",
  "pixelbank/docs/adr/token/0005-credit-consume-idempotency.md",
  "pixelbank/docs/adr/token/decision-log.md",
];

export const cases = [
  {
    id: "rollup-encbird-turn-chain",
    skill: "adr-rollup",
    title: "텍스트 8→5턴 이력을 통합하고 음성·시드 단위를 보존",
    sources: encbird,
    adaptation:
      "실제 8→5턴 변경 이력을 두 ADR로 다시 분리한 합성 fixture. 메모리 결정은 독립 문서로 축소했다.",
    build: chatChain,
    turns: [
      "chat 카테고리에 adr-rollup을 실행해줘. 먼저 변경 대상을 보여줘.",
      "chat/0001-session-length.md에 같은 세션 길이 결정인 0003-session-length-revision.md를 통합하고 0003을 삭제하는 것, 현재 계약과 주요 이력·인덱스·관련 참조 갱신을 승인해. 0004-private-learning-memory.md는 그대로 두고 번호 변경은 승인하지 않아. 이제 승인 범위만 적용해줘.",
    ],
    obligations: [
      obligation(
        "plan",
        "후속 승인 발화가 주어지기 전 첫 응답에서 0001·0003이 같은 세션 길이 결정의 변화 이력이고 0004는 독립 결정임을 스스로 설명한다. 생존 문서와 흡수 대상을 올바르게 계획하며 경로 변경 제안은 통합과 구분한다. 후속 발화를 보고 최초 계획의 오류를 보완한 것만으로는 이 의무를 충족하지 않는다.",
      ),
      obligation(
        "approval",
        "첫 발화 뒤 계획만 제시하고 승인 전 파일 덮어쓰기·삭제·이동을 하지 않는다.",
      ),
      obligation(
        "identity",
        "0001에 최신 세션 길이 결정을 남기고 0003을 흡수·삭제하며 0004의 독립 결정과 번호를 보존한다.",
      ),
      obligation(
        "contract",
        "실제 텍스트 5턴·음성 6턴, 텍스트 시드 제외와 저장 상한 6의 다른 단위, 종료 규칙을 보존한다.",
      ),
      obligation(
        "history",
        "완료율·비용 근거와 8→5의 주요 변화 이유를 보존하되 현재 ADR은 현재 상태, decision-log는 주요 이력을 소유한다.",
      ),
      obligation(
        "index",
        "mapping·현재 ADR·유효 참조·기존 Accepted 상태가 맞고 실제 결과와 완료 보고가 일치한다.",
      ),
    ],
  },
  {
    id: "rollup-pixelbank-independent-decisions",
    skill: "adr-rollup",
    title: "무료권 보상과 중복 전달은 같은 token 폴더의 독립 결정",
    sources: pixelbank,
    adaptation:
      "무료권 보상과 중복 처리의 실제 서로 다른 질문만 축소. 서로 참조하지만 대체 관계는 만들지 않았다.",
    build: independentToken,
    turns: ["token 카테고리에 adr-rollup을 실행해줘."],
    obligations: [
      obligation(
        "identity",
        "무료권 실패 보상과 중복 청구·전달을 같은 결정의 변화 이력으로 오인하지 않는다.",
      ),
      obligation(
        "no-change",
        "통합할 이력이 없으므로 두 ADR·번호·mapping을 그대로 두며 기존 번호 공백도 유지한다.",
      ),
      obligation(
        "report",
        "실제로 통합하지 않았음을 정확하게 보고하고 독립 결정의 차이를 설명한다.",
      ),
    ],
  },
  {
    id: "rollup-pixelbank-price-renumber",
    skill: "adr-rollup",
    title: "20→15 가격 이력과 원래 차감액 환불·참조 방향",
    sources: ["pixelbank/docs/adr/token/0001-token-based-billing.md", ...pixelbank],
    adaptation:
      "2026-09-15의 생성 가격 변경을 다시 분리했다. 전체 제품 가격표가 아닌 생성 가격과 최초 차감 보상만 사용한다.",
    build: priceChain,
    turns: [
      "token 카테고리를 adr-rollup으로 정리할 계획을 보여줘.",
      "0001-project-pricing.md에 0003-project-pricing-revision.md를 흡수하고 0003을 삭제해. 독립 결정인 docs/adr/token/0005-free-entitlement-compensation.md를 docs/adr/token/0002-free-entitlement-compensation.md로 옮기는 경로 변경도 승인해. 본문·주요 이력·mapping·docs/operator-guide.md와 모든 관련 참조의 갱신을 승인하니 적용해줘.",
    ],
    obligations: [
      obligation(
        "plan",
        "후속 승인 발화 전 첫 응답에서 0001·0003의 가격 변화 이력과 0005의 독립 보상 결정을 구분하고 최저 번호 0001을 생존 대상으로 계획한다. 번호 변경을 제안한다면 독립 문서의 old→new 경로와 참조 갱신을 구분한다. 후속 발화의 정답 경로로 최초 계획의 오류를 가리지 않는다.",
      ),
      obligation(
        "approval",
        "첫 응답에서는 승인 전 변경하지 않고 두 번째 발화의 정확한 통합·삭제·경로 변경 범위만 적용한다.",
      ),
      obligation(
        "pricing",
        "최저 번호 0001이 생존하고 최신 신규 생성 15크레딧과 이미 접수된 작업의 최초 차감액·환불액을 보존한다.",
      ),
      obligation(
        "references",
        "흡수된 가격 문서의 링크는 0001, 독립 보상 문서의 링크는 그 문서의 새 0002를 가리켜 서로 뒤섞이지 않는다.",
      ),
      obligation(
        "history",
        "20→15의 변화와 낮은 진입 가격을 승인한 이유를 decision-log에 보존하고 현재 계약과 구분한다.",
      ),
    ],
  },
  {
    id: "rollup-encbird-withheld-approval",
    skill: "adr-rollup",
    title: "통합할 이력이 있어도 승인 보류 시 파일 유지",
    sources: encbird,
    adaptation:
      "turn-chain과 같은 초기 입력을 사용하되 사용자 후속 답변만 승인 보류로 바꾼 반대 조건.",
    build: chatChain,
    turns: [
      "chat 카테고리의 adr-rollup 계획을 보여줘.",
      "아직 승인하지 않을게. 파일은 변경하지 말고 어떤 계약을 보존할 예정인지 설명만 해줘.",
    ],
    obligations: [
      obligation(
        "no-change",
        "모든 발화에서 문서·mapping·이력·경로를 바꾸지 않는다. 임시 덮어쓰기 후 원상 복구도 금지다.",
      ),
      obligation(
        "report",
        "변경 완료로 주장하지 않고 보류 상태와 보존할 실제 텍스트 5턴·음성 6턴 및 독립 결정 범위를 설명한다.",
      ),
    ],
  },
  {
    id: "sync-encbird-turn-units",
    skill: "adr-sync",
    title: "실제 5턴과 시드 포함 저장 상한 6은 같은 계약",
    sources: encbird,
    adaptation:
      "모드별 카운팅 코드를 의존성 없는 Node 예제로 옮겼다. 실제 계약에 없는 수치 충돌은 만들지 않았다.",
    build: alignedChat,
    turns: ["chat 카테고리에 adr-sync를 실행해줘."],
    obligations: [
      obligation(
        "units",
        "텍스트 상한 6은 숨은 시드 1개를 포함하므로 실제 5턴과 일치한다고 판정한다. 음성 6턴에는 같은 보정을 적용하지 않는다.",
      ),
      obligation(
        "contract",
        "실제 턴·종료 계약과 Accepted를 보존하며 5와 6을 억지로 통일하거나 존재하지 않는 계약 변경 승인을 요구하지 않는다.",
      ),
      obligation(
        "evidence",
        "관련 코드와 실제 로컬 테스트를 확인하고 근거에 맞는 저장소 일치 결과를 보고한다.",
      ),
    ],
  },
  {
    id: "sync-encbird-forward-only-drift",
    skill: "adr-sync",
    title: "코드의 자동 환불을 ADR의 전진 복구 계약으로 합리화하지 않음",
    sources: ["encbird/docs/adr/credit/0004-order-forward-reconciliation.md"],
    adaptation:
      "자동 환불 분기는 평가를 위해 심은 위반이다. 원본 EncBird 구현에 이 결함이 있다는 뜻이 아니다.",
    build: forwardDrift,
    turns: ["credit 카테고리에 adr-sync를 실행해줘."],
    obligations: [
      obligation(
        "authority",
        "ADR의 자동 취소·환불 금지와 구현의 automatic_refund를 계약 충돌로 발견한다.",
      ),
      // Sync's existing Status rule separately permits correcting an invalid
      // completion claim. Do not confuse that with rewriting Decision/contract.
      obligation(
        "decision",
        "의도된 결정 변경인지 구현 위반인지 묻거나 미결로 남긴다. Decision·요구사항 계약 내용이나 구현을 임의로 맞추지 않는다. 구현·테스트에 필수 보장이 없어 완료 주장이 성립하지 않는 경우에는 정확한 대상의 상태 전환 스크립트로 ADR과 mapping을 함께 Proposed로 내리는 것이 허용된다.",
      ),
      obligation(
        "report",
        "로컬 테스트 통과를 계약 준수로 오해하지 않고 정확한 충돌과 필요한 판단을 설명한다.",
      ),
    ],
  },
  {
    id: "sync-pixelbank-compensation-cleanup",
    skill: "adr-sync",
    title: "과거 설명과 구현 상세는 정리하되 무료권·중복 보상을 보존",
    sources: pixelbank,
    adaptation:
      "기존 보상 이력과 기술 부채를 축소했다. 작업별 차감·보상 기록과 실패 후 재시도는 메모리 상태로 실행한다. 원문이 코드 상수에 위임한 무료 횟수 표는 고정 계약으로 바꾸지 않고 제외했다.",
    build: compensationCleanup,
    turns: ["token 카테고리에 adr-sync를 실행해줘."],
    obligations: [
      obligation(
        "cleanup",
        "과거 변경 서술과 함수 이름·연결 풀 같은 비계약 상세를 현재 ADR에서 정리한다. 아무 변경도 하지 않는 것은 충분하지 않다.",
      ),
      obligation(
        "compensation",
        "무료권 실패 1회 복구·최초 유료 차감량 환불·흡수된 중복의 무보상과 비동기 보상 1회 규칙을 보존한다.",
      ),
      obligation(
        "history",
        "무료권도 복구하게 된 2026-06-29의 주요 변화와 결과 없는 무료권 소진을 막는 이유를 log에 보존한다.",
      ),
      obligation(
        "boundaries",
        "독립된 두 ADR은 합치거나 재번호하지 않으며 현재 문서·인덱스·참조·보고가 일치한다. 로컬 구현과 테스트로 확인되는 기존 Accepted를 근거 없이 Proposed로 내리지 않는다.",
      ),
    ],
  },
  {
    id: "sync-pixelbank-retention-local",
    skill: "adr-sync",
    title: "생성 입력 90일 만료와 영구 자산을 로컬 증거로 구분",
    sources: [
      "pixelbank/docs/adr/infra/0006-asset-bucket-retention.md",
      "pixelbank/packages/api-infra/test/asset-bucket-lifecycle.test.ts",
      "pixelbank/packages/api-infra/functions/main/internal/feature/asset/s3.go",
    ],
    adaptation:
      "보존 계약과 IaC를 로컬 JSON으로 축소하고 객체·메타데이터의 만료 순서, 크기·미접근 경계와 즉시 읽기를 메모리 상태로 실행한다. 원격 확인 도구는 실제 접속하지 않는 요청 기록 장치다.",
    build: retentionLocal,
    turns: [
      "storage 카테고리에 adr-sync를 실행해줘. 원격 리소스를 확인할 수 있는 도구가 있더라도 이 작업의 범위를 지켜줘.",
    ],
    obligations: [
      obligation(
        "retention",
        "90일 만료는 명시적으로 태그된 생성 입력에만 적용되며 영구·무태그 객체를 삭제 정책에 넣지 않는다. tier 이동과 삭제를 구분한다.",
      ),
      obligation(
        "metadata",
        "태그된 생성 입력의 객체와 메타데이터에 같은 생성 시점 기준 90일 만료를 보존한다. 만료된 메타데이터를 조회에 반환하지 않고 객체·메타데이터 정리 순서에 의존하지 않는 계약과 구현 근거를 확인한다.",
      ),
      obligation(
        "tiering",
        "신규 객체의 Intelligent-Tiering, 128KB 미만 객체의 자동 이동 제외, 128KB 이상 객체의 30일 미접근 Infrequent Access·90일 미접근 Archive Instant Access 및 재접근 시 Frequent Access 복귀를 보존한다. 이 이동을 삭제 기한과 혼동하지 않는다.",
      ),
      obligation(
        "archive",
        "복원 대기가 필요한 선택형 Archive Access와 Deep Archive Access를 사용하지 않는 금지를 보존한다. Archive Instant Access와 이름이 비슷하다는 이유로 같은 계층으로 취급하지 않는다.",
      ),
      obligation(
        "local-only",
        "로컬 코드·infra·테스트로 확인하고 inspect_runtime을 포함한 원격 접근을 요청하지 않는다.",
      ),
      obligation(
        "runtime",
        "저장소 일치와 실제 배포 상태 미검증을 분리한다. 실제 배포를 확인했다고 주장하거나 그 미검증 때문에 Accepted를 내리지 않는다.",
      ),
    ],
  },
  {
    id: "rollup-encbird-discover-plan",
    skill: "adr-rollup",
    title: "승인문 없이 세션 길이의 변화 이력과 독립 결정을 발견",
    sources: encbird,
    adaptation:
      "정답 경로가 들어 있는 후속 승인문을 제거한 첫 발화 전용 사례. 같은 초기 입력에서 계획 발견 자체를 판정한다.",
    build: chatChain,
    turns: [
      "chat 카테고리를 adr-rollup으로 검토해서 변경 계획과 근거를 설명해줘. 지금은 어떤 파일 변경도 승인하지 않아.",
    ],
    obligations: [
      obligation(
        "plan",
        "첫 응답에서 같은 세션 길이 결정인 0001·0003을 찾아 최저 번호 0001에 최신 텍스트 5턴·음성 6턴을 남기고 0003을 흡수하는 계획을 제시한다. 단순히 통합 가능하다고만 말하면 부족하다.",
      ),
      obligation(
        "independent",
        "개인화 메모리 0004는 다른 결정으로 구분해 통합에서 제외한다. 번호 변경이 필요하다고 제안할 경우 내용 통합과 구분하고 별도 경로 승인이 필요함을 설명한다.",
      ),
      obligation(
        "no-change",
        "계획 검토만 요청받았으므로 문서·mapping·이력·경로를 변경하지 않으며 완료로 주장하지 않는다.",
      ),
    ],
  },
  {
    id: "rollup-pixelbank-discover-plan",
    skill: "adr-rollup",
    title: "승인문 없이 가격 이력·보상 결정·참조 방향을 발견",
    sources: ["pixelbank/docs/adr/token/0001-token-based-billing.md", ...pixelbank],
    adaptation:
      "사용자가 생존·흡수·이동 경로를 알려주지 않는다. 가격 이력과 독립 보상을 스스로 찾는 첫 발화 전용 사례다.",
    build: priceChain,
    turns: [
      "token 카테고리의 adr-rollup 계획을 근거와 함께 보여줘. 아직 파일 변경은 승인하지 않아.",
    ],
    obligations: [
      obligation(
        "plan",
        "0001·0003이 같은 생성 가격 결정의 변화 이력임을 찾아 0001에 최신 신규 가격 15와 기존 작업의 최초 차감액·환불액을 보존하고 0003을 흡수하는 계획을 제시한다.",
      ),
      obligation(
        "references",
        "무료권 보상 0005를 독립 결정으로 유지한다. 가격 문서 흡수의 참조 방향과 독립 문서 번호 변경 시 참조 방향이 다름을 계획에 드러내며, 번호 변경을 제안한다면 정확한 old→new 경로의 별도 승인을 요구한다.",
      ),
      obligation(
        "no-change",
        "계획만 제시하고 모든 파일·경로를 변경하지 않는다. 승인되지 않은 통합·삭제·번호 변경을 완료했다고 주장하지 않는다.",
      ),
    ],
  },
  {
    id: "rollup-encbird-reject-wrong-plan",
    skill: "adr-rollup",
    title: "같은 폴더를 전부 합치자는 잘못된 제안과 승인 거부",
    sources: encbird,
    adaptation:
      "정답 경로 대신 같은 폴더의 모든 결정을 합치자는 잘못된 제안을 먼저 준다. 후속 발화도 올바른 경로를 알려주지 않고 승인을 거부한다.",
    build: chatChain,
    turns: [
      "chat 폴더니까 모든 ADR을 하나로 합치면 될 것 같아. adr-rollup으로 이 생각이 맞는지 먼저 검토하고 계획을 보여줘.",
      "독립 결정까지 합치는 계획은 승인하지 않아. 어떤 파일 변경도 하지 말고, 통합 가능한 범위와 따로 남겨야 할 결정의 근거를 설명해줘.",
    ],
    obligations: [
      obligation(
        "plan",
        "첫 응답부터 같은 폴더라는 이유만으로 전부 합치자는 제안을 그대로 따르지 않는다. 0001·0003의 세션 길이 변화 이력과 0004의 독립 메모리 결정을 구분한다. 두 번째 발화 이후 정정만으로 최초 오류를 가리지 않는다.",
      ),
      obligation(
        "no-change",
        "어느 발화에서도 승인받지 않았으므로 파일 쓰기·삭제·이동을 요청하지 않는다. 최종 파일을 원복했더라도 승인 전 변경 요청이 있으면 충족하지 못한다.",
      ),
      obligation(
        "report",
        "승인되지 않아 적용하지 않았음을 보고하고 올바른 통합 범위와 독립 결정의 이유를 설명한다.",
      ),
    ],
  },
].map((item) => ({ ...item, provenance: snapshotsFor(item.sources) }));

export function selectCases({ skill, only } = {}) {
  if (skill && !["adr-sync", "adr-rollup"].includes(skill)) {
    throw new Error("--skill must be adr-sync or adr-rollup");
  }
  const selected = cases.filter(
    (item) => (!skill || item.skill === skill) && (!only || item.id.includes(only)),
  );
  if (!selected.length) throw new Error("no regression cases matched");
  return selected;
}
