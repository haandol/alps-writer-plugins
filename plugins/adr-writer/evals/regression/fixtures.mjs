// Small, authored reproductions of public-behavior contracts from the two
// reference repositories. These are not copies or audits of either repository.
function adr(title, decision, options = {}) {
  return `# ADR ${options.number ?? "0001"}: ${title}

Date: ${options.date ?? "2026-08-31"}

## Status

Accepted (${options.date ?? "2026-08-31"})

## Context

${options.context ?? "사용자가 완료 조건과 비용을 예측할 수 있도록 기능의 계약을 일관되게 유지해야 한다."}

## Decision Drivers

- ${options.driver ?? "같은 사용자 행동은 같은 계약으로 처리해야 한다."}
- 장애나 재시도 때문에 사용자에게 약속한 결과가 달라지면 안 된다.
- 현재의 결정과 과거의 변경 이유를 각각 읽을 수 있어야 한다.

## Decision

${decision}

### Alternatives

- ${options.alternative ?? "모든 기능에 같은 규칙을 적용하면 단순하지만 각 기능의 비용과 사용자 기대를 반영하지 못한다."}
- 규칙을 호출부마다 따로 정하면 변경은 쉽지만 같은 기능의 동작이 달라질 수 있다.

## Consequences

현재 계약을 유지하면서 구현은 교체할 수 있다. ${options.consequence ?? "조건별 검증이 필요하다."}

## Related

${options.related ?? "- 없음"}
`;
}

function repo(records, code, tests, extra = {}) {
  const categories = {};
  const files = {
    "package.json": '{"private":true,"type":"module"}\n',
    "README.md": "# Local practice application\n\n로컬 검증: node --test test/policy.test.mjs\n",
    "src/policy.mjs": code,
    "test/policy.test.mjs":
      'import test from "node:test";\nimport assert from "node:assert/strict";\n' +
      'import * as policy from "../src/policy.mjs";\n' +
      tests,
    ...extra,
  };
  for (const record of records) {
    files[record.path] = record.body;
    const key = record.path.slice("docs/adr/".length).split("/").slice(0, -1).join("/");
    categories[key] ??= { feature: key, adrs: [], dependsOn: [] };
    const status = record.body.match(/## Status\s+([^\n]+)/)[1];
    categories[key].adrs.push({
      path: record.path,
      status,
      summary: record.summary,
    });
  }
  files["docs/adr/.mapping.json"] = JSON.stringify({ categories }, null, 2) + "\n";
  return files;
}

const chatContract = `텍스트 프리챗은 실제 학습자 발화 최대 5턴, 음성은 최대 6턴이다.
텍스트 시작 시 저장하는 숨은 시드는 학습자 턴이 아니다. 텍스트 저장 상한 6은
시드 1개와 학습자 5턴을 합친 수다. 음성에는 시드 보정이 없다.
한도를 채우면 추가 발화를 거절하고 종료한다. 텍스트는 조기 종료하지 않는다.
짧은 텍스트 세션은 완료율과 세션당 비용의 예측 가능성을 위해 선택했다.`;

const chatCode = `export const textStoredLimit = 6;
export const voiceLimit = 6;
export function progress(mode, stored) {
  const seed = mode === "TEXT" ? 1 : 0;
  return { completed: Math.max(0, stored - seed), max: (mode === "TEXT" ? textStoredLimit : voiceLimit) - seed };
}
export function canContinue(mode, stored) { const p = progress(mode, stored); return p.completed < p.max; }
`;
const chatTests = `test("text seed is not a learner turn", () => {
  assert.deepEqual(policy.progress("TEXT", 1), {completed:0,max:5});
  assert.equal(policy.canContinue("TEXT", 5), true);
  assert.equal(policy.canContinue("TEXT", 6), false);
});
test("voice counts six actual turns without a seed", () => {
  assert.deepEqual(policy.progress("VOICE", 0), {completed:0,max:6});
  assert.equal(policy.canContinue("VOICE", 6), false);
});
`;

export function chatChain() {
  return repo(
    [
      {
        path: "docs/adr/chat/0001-session-length.md",
        summary: "텍스트 상황 연습은 실제 사용자 8턴의 유한 세션이다",
        body: adr("상황 연습의 세션 길이", "텍스트 세션은 실제 사용자 8턴이다. 완료 시 종료한다.", {
          date: "2026-07-10",
          context: "사용자가 대화를 마쳤다는 느낌을 갖도록 상황 연습에 끝을 둔다.",
        }),
      },
      {
        path: "docs/adr/chat/0003-session-length-revision.md",
        summary: "동일한 세션 길이 결정을 텍스트 5턴·음성 6턴으로 변경한다",
        body: adr(
          "상황 연습의 세션 길이 조정",
          "이 결정은 0001의 세션 길이 결정을 대체한다.\n\n" + chatContract,
          {
            number: "0003",
            date: "2026-07-18",
            context:
              "8턴은 일회성 상황 연습의 끝을 멀게 느끼게 하므로 실제 텍스트 발화를 5턴으로 줄인다.",
            related: "- [기존 세션 길이](./0001-session-length.md)",
          },
        ),
      },
      {
        path: "docs/adr/chat/0004-private-learning-memory.md",
        summary: "개인화 메모리는 내부 참고이며 저장 사실과 내용을 사용자에게 노출하지 않는다",
        body: adr(
          "개인화 메모리의 비공개 경계",
          "관심사 메모리는 현재 장면에 관련된 질문 각도의 내부 참고로만 쓴다. 저장된 메모리의 내용·출처·저장 사실을 응답에 노출하지 않는다.",
          {
            number: "0004",
            context: "학습자가 개인화 자료가 상대역의 대사로 노출되는 일을 겪지 않아야 한다.",
          },
        ),
      },
    ],
    chatCode + "export function memoryCanBeDisclosed() { return false; }\n",
    chatTests +
      'test("private memory never becomes dialogue content", () => assert.equal(policy.memoryCanBeDisclosed(), false));\n',
  );
}

export function alignedChat() {
  return repo(
    [
      {
        path: "docs/adr/chat/0001-session-length.md",
        summary: "텍스트 실제 5턴·음성 실제 6턴, 텍스트 시드는 제외한다",
        body: adr("상황 연습의 세션 길이", chatContract),
      },
    ],
    chatCode,
    chatTests,
  );
}

const trialContract = `무료권으로 과금한 작업이 확정 실패하면 해당 기능의 무료권을 1회 복구한다.
유료 크레딧으로 과금했다면 최초 실제 차감량을 환불한다.
흡수된 중복 요청은 새 차감이 없으므로 무료권·크레딧 어느 쪽도 보상하지 않는다.
무료권은 결과를 받기 위해 사용자가 소비한 가치이므로 크레딧과 대칭으로 복구한다.`;
const duplicateContract = `동일한 작업 키의 재시도는 한 번만 차감한다.
흡수된 중복 요청은 작업을 다시 수행하지 않는다.
비동기 제출은 확인된 원 작업을 반환하고 원 작업을 찾지 못하면 거절한다.
결과를 저장하지 않는 동기 실행은 재시도 불가의 이미 처리됨으로 거절한다.
비동기 보상은 작업별 보상 기록으로 한 번만 적용한다. 실패 상태만으로 보상을 건너뛰지 않는다.`;
const tokenCode = `export function compensation({duplicate, free, originalCharge}) {
  if (duplicate) return {free:0,credits:0};
  return free ? {free:1,credits:0} : {free:0,credits:originalCharge};
}
export function duplicateResponse(async, originalJob) {
  return async && originalJob ? {job:originalJob} : {error:"already_processed",retry:false};
}
`;
const tokenTests = `test("compensation is symmetric and duplicates are excluded", () => {
  assert.deepEqual(policy.compensation({free:true,duplicate:false,originalCharge:5}),{free:1,credits:0});
  assert.deepEqual(policy.compensation({free:false,duplicate:false,originalCharge:12}),{free:0,credits:12});
  assert.deepEqual(policy.compensation({free:true,duplicate:true,originalCharge:5}),{free:0,credits:0});
});
test("duplicate delivery never creates another job", () => {
  assert.deepEqual(policy.duplicateResponse(true,"original"),{job:"original"});
  assert.deepEqual(policy.duplicateResponse(false),{error:"already_processed",retry:false});
});
`;

export function independentToken() {
  return repo(
    [
      {
        path: "docs/adr/token/0002-free-entitlement-compensation.md",
        summary: "확정 실패는 최초 과금 수단에 대칭으로 보상한다",
        body: adr("무료권과 크레딧의 실패 보상", trialContract, { number: "0002" }),
      },
      {
        path: "docs/adr/token/0005-duplicate-delivery.md",
        summary: "중복 청구와 중복 전달을 막고 보상은 작업별로 한 번 적용한다",
        body: adr("중복 청구와 전달", duplicateContract, {
          number: "0005",
          related: "- [실패 보상](./0002-free-entitlement-compensation.md)",
        }),
      },
    ],
    tokenCode,
    tokenTests,
  );
}

export function priceChain() {
  const files = repo(
    [
      {
        path: "docs/adr/token/0001-project-pricing.md",
        summary: "새 프로젝트 생성은 20크레딧이며 실패 시 최초 차감량을 환불한다",
        body: adr(
          "프로젝트 생성 과금",
          "새 프로젝트 생성은 20크레딧이다. 확정 실패 시 최초 실제 차감량을 환불한다.",
          { date: "2026-08-28" },
        ),
      },
      {
        path: "docs/adr/token/0003-project-pricing-revision.md",
        summary: "동일한 프로젝트 생성 가격을 15크레딧으로 변경한다",
        body: adr(
          "프로젝트 생성 가격 조정",
          "이 결정은 0001의 새 프로젝트 생성 가격을 대체한다. 새 프로젝트 생성은 15크레딧이다. 이미 접수된 작업은 최초 차감량과 환불액을 유지한다.",
          {
            number: "0003",
            date: "2026-09-15",
            context:
              "소규모 작업 평가 뒤 사용자가 낮은 진입 가격을 승인했다. 기존에 접수된 작업의 과금 약속은 보존한다.",
            related: "- [이전 가격 결정](./0001-project-pricing.md)",
          },
        ),
      },
      {
        path: "docs/adr/token/0005-free-entitlement-compensation.md",
        summary: "무료권으로 실행한 확정 실패는 무료권을 복구한다",
        body: adr("무료권 실패 보상", trialContract, { number: "0005" }),
      },
    ],
    tokenCode + "export const creationPrice = 15;\n",
    tokenTests +
      'test("new jobs cost 15 while compensation uses original charge", () => assert.equal(policy.creationPrice,15));\n',
    {
      "docs/operator-guide.md": `# Policy references
- [프로젝트 가격](./adr/token/0003-project-pricing-revision.md)
- [무료권 보상](./adr/token/0005-free-entitlement-compensation.md)
`,
    },
  );
  return files;
}

export function forwardDrift() {
  return repo(
    [
      {
        path: "docs/adr/credit/0001-forward-recovery.md",
        summary: "청구 후 미적립 주문은 전진 복구하며 자동 취소·환불하지 않는다",
        body: adr(
          "청구 후 미적립 주문의 전진 복구",
          `청구가 확인됐지만 미적립인 주문은 재발행으로 적립을 완료한다.
완료된 주문을 재처리해도 추가 적립하지 않는다.
복구 한도에 도달하거나 SLA를 넘겨도 시스템이 자동 취소·환불하지 않는다.
운영자에게 미적립 사실과 조사 필요성을 알리고 최종 판단을 맡긴다.`,
          {
            context: "복구 가능한 장애를 자동 환불로 바꾸면 결제 약속과 사용자의 기대가 훼손된다.",
          },
        ),
      },
    ],
    `export function recover(status, exhausted) {
  if (status === "COMPLETED") return "no_credit";
  return exhausted ? "automatic_refund" : "republish";
}\n`,
    `test("implementation's current recovery branches", () => {
  assert.equal(policy.recover("COMPLETED",true),"no_credit");
  assert.equal(policy.recover("CONFIRMED",true),"automatic_refund");
  assert.equal(policy.recover("CONFIRMED",false),"republish");
});\n`,
  );
}

export function compensationCleanup() {
  const files = independentToken();
  const file = "docs/adr/token/0002-free-entitlement-compensation.md";
  files[file] = files[file].replace(
    trialContract,
    `예전에는 크레딧만 환불했지만 2026-06-29부터 무료권도 복구하도록 바뀌었다.
무료 작업이 실패하면 결과를 못 받은 사용자에게 무료권만 소진되었기 때문이다.
\n${trialContract}
\n구현 참고: OnboardingService.restore_free_trial()을 호출하고 커넥션 풀 크기는 10이다.`,
  );
  return files;
}

export function retentionLocal() {
  return repo(
    [
      {
        path: "docs/adr/storage/0001-asset-retention.md",
        summary: "생성 입력만 90일 만료하며 최종 자산은 시간 기반 삭제하지 않는다",
        body: adr(
          "자산의 보존과 즉시 접근",
          `모든 신규 객체는 Intelligent-Tiering 저장 클래스를 사용한다.
128KB 이상 객체는 30일 미접근 시 Infrequent Access, 90일 미접근 시 Archive Instant Access로 이동한다.
복원 대기가 필요한 선택형 Archive Access와 Deep Archive Access는 사용하지 않는다.
생성 입력만 명시적 보존 tag로 90일에 객체와 메타데이터를 만료한다.
최종 이미지·애니메이션·프로젝트 자산은 시간 기반으로 삭제하지 않는다.
태그가 없는 기존 객체도 시간 기반 삭제 대상이 아니다.`,
          {
            context:
              "같은 key prefix의 생성 입력과 최종 자산을 일괄 삭제하면 사용자가 저장한 결과를 잃는다.",
          },
        ),
      },
    ],
    `export const inputRetentionDays = 90;
export function expires(retention) { return retention === "generation-input" ? 90 : null; }\n`,
    `test("only tagged generation inputs expire", () => {
  assert.equal(policy.expires("generation-input"),90);
  assert.equal(policy.expires("permanent"),null);
  assert.equal(policy.expires(undefined),null);
});\n`,
    {
      "infra/storage.json":
        JSON.stringify({
          storageClass: "INTELLIGENT_TIERING",
          automaticTiers: [
            { inactiveDays: 30, tier: "INFREQUENT_ACCESS" },
            { inactiveDays: 90, tier: "ARCHIVE_INSTANT_ACCESS" },
          ],
          optionalArchiveTiers: false,
          lifecycle: [{ tag: { retention: "generation-input" }, days: 90 }],
        }) + "\n",
    },
  );
}
