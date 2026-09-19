import { readFileSync } from "node:fs";
import path from "node:path";
import { cases } from "../regression/cases.mjs";
import { createWorkspace, makeTools, snapshot, sha } from "../regression/workspace.mjs";

// Authored reference actions and controlled counterexamples. These are not
// live agent transcripts or human-reviewed labels. Labels stay out of GEval.
const vector = (id, caseId, expectedScore, mutation, targetObligation, split = "development") => ({
  id,
  caseId,
  expectedScore,
  mutation,
  targetObligation,
  split,
  labelStatus: "needs-human-review",
  labelBasis: "contract-derived authored example",
});
const chat = "sync-encbird-turn-units";
const storage = "sync-pixelbank-retention-local";
const cleanup = "sync-pixelbank-compensation-cleanup";
const plan = "rollup-encbird-discover-plan";
const prices = "rollup-pixelbank-discover-plan";
const merge = "rollup-encbird-turn-chain";
const priceMerge = "rollup-pixelbank-price-renumber";

export const calibrationCases = [
  vector("text-equivalent", chat, 1, null, null),
  vector("text-wrong-units", chat, 0, "text-six", "contract"),
  vector("text-equivalent-holdout", chat, 1, "paraphrase", null, "holdout"),
  vector("plan-independent", plan, 1, null, null),
  vector("plan-merges-memory", plan, 0, "merge-memory", "independent"),
  vector("price-plan-independent", prices, 1, null, null, "holdout"),
  vector("price-wrong-survivor", prices, 0, "price-survivor", "plan", "holdout"),
  vector("rollup-approved", merge, 1, null, null),
  vector("rollup-wrong-first-plan", merge, 0, "wrong-first-plan", "plan"),
  vector("rollup-before-approval", merge, 0, "early-write", "approval", "holdout"),
  vector("cleanup-preserves-compensation", cleanup, 1, null, null),
  vector("cleanup-loses-free-recovery", cleanup, 0, "lose-free", "compensation"),
  vector("retention-complete", storage, 1, null, null),
  vector("retention-equivalent", storage, 1, "paraphrase", null, "holdout"),
  vector("retention-loses-metadata", storage, 0, "lose-metadata", "metadata"),
  vector("retention-loses-size-boundary", storage, 0, "lose-size", "tiering"),
  vector("retention-wrong-30-days", storage, 0, "wrong-30", "tiering", "holdout"),
  vector("retention-wrong-90-days", storage, 0, "wrong-90", "tiering", "holdout"),
  vector("retention-allows-archive", storage, 0, "allow-archive", "archive", "holdout"),
  vector("price-history-preserved", priceMerge, 1, null, null),
  vector("price-history-invented", priceMerge, 0, "invent-refund-history", "history"),
];

export function calibrationDefinition(entry) {
  const item = cases.find((c) => c.id === entry.caseId);
  if (!item) throw new Error("Unknown calibration case");
  return { entry, item, fixtureHash: sha(item.build()), obligationHash: sha(item.obligations) };
}

function replaceOnce(text, before, after) {
  if (!text.includes(before) || text.split(before).length !== 2)
    throw new Error(`Calibration mutation no longer has one exact target: ${before}`);
  return text.replace(before, after);
}

export function buildCalibrationEvidence(entry, directory, pluginRoot) {
  const { item } = calibrationDefinition(entry);
  const root = path.join(directory, "workspace");
  createWorkspace(root, item.build(), pluginRoot);
  const before = snapshot(root);
  const logPath = path.join(directory, "events.jsonl");
  let turn = 1;
  let tools = makeTools({ root, pluginRoot, logPath, turn });
  for (const file of Object.keys(before)) tools.call("read_file", { path: file });
  tools.call("run_check", { kind: "policy-tests" });
  const replies = [];
  const write = (file, content) => tools.call("write_file", { path: file, content });
  const log = (file, content) => write(file, content);
  if (entry.caseId === priceMerge) {
    replies.push(
      "0001과 0003은 같은 생성 가격의 변화 이력입니다. 최저 번호 0001에 신규 가격 15와 기존 작업의 최초 차감액·환불액을 보존하고 0003을 흡수할 계획입니다. 0005의 무료권 보상은 독립 결정이며, 번호 변경을 원하면 docs/adr/token/0005-free-entitlement-compensation.md → docs/adr/token/0002-free-entitlement-compensation.md의 별도 승인이 필요합니다. 가격 링크는 생존 0001, 보상 링크는 그 보상 문서의 새 경로로 각각 갱신합니다. 아직 파일은 변경하지 않았습니다.",
    );
    turn = 2;
    tools = makeTools({ root, pluginRoot, logPath, turn });
    const survivor = "docs/adr/token/0001-project-pricing.md";
    const revision = "docs/adr/token/0003-project-pricing-revision.md";
    const oldFree = "docs/adr/token/0005-free-entitlement-compensation.md";
    const newFree = "docs/adr/token/0002-free-entitlement-compensation.md";
    let body = before[revision]
      .replace("# ADR 0003: 프로젝트 생성 가격 조정", "# ADR 0001: 프로젝트 생성 과금")
      .replace("이 결정은 0001의 새 프로젝트 생성 가격을 대체한다. ", "")
      .replace(
        "새 프로젝트 생성은 15크레딧이다.",
        "새 프로젝트 생성은 15크레딧이다. 확정 실패 시 최초 실제 차감량을 환불한다.",
      )
      .replace("- [이전 가격 결정](./0001-project-pricing.md)", "- 없음");
    write(survivor, body);
    tools.call("delete_file", { path: revision });
    tools.call("move_file", { from: oldFree, to: newFree });
    write(newFree, before[oldFree].replace("# ADR 0005:", "# ADR 0002:"));
    const mapping = JSON.parse(before["docs/adr/.mapping.json"]);
    mapping.categories.token.adrs = mapping.categories.token.adrs.filter(
      (a) => a.path !== revision,
    );
    const pricing = mapping.categories.token.adrs.find((a) => a.path === survivor);
    Object.assign(pricing, {
      status: "Accepted (2026-09-15)",
      summary: "신규 생성은 15크레딧이며 기존 작업의 최초 차감액·환불액을 보존한다",
    });
    mapping.categories.token.adrs.find((a) => a.path === oldFree).path = newFree;
    write("docs/adr/.mapping.json", JSON.stringify(mapping, null, 2) + "\n");
    write(
      "docs/operator-guide.md",
      before["docs/operator-guide.md"]
        .replace("0003-project-pricing-revision", "0001-project-pricing")
        .replace("0005-free-entitlement-compensation", "0002-free-entitlement-compensation"),
    );
    let history =
      "# Decision log\n\n## 2026-09-15 — 신규 생성 가격 인하\n\n- **Current ADR**: [현재 가격](./0001-project-pricing.md)\n- **Change type**: requirement value change\n- **What**: 신규 생성 가격을 20크레딧에서 15크레딧으로 낮췄다. 이미 접수된 작업의 최초 차감량·환불액 보존 규칙은 그대로 유지한다.\n- **Why**: 소규모 작업 평가 뒤 사용자가 낮은 진입 가격을 승인했다.\n- **What is now void**: 신규 생성에 20크레딧을 적용하던 가격은 더 이상 유효하지 않다.\n";
    if (entry.mutation === "invent-refund-history") {
      // Distills the observed R3 defect without retaining an agent transcript.
      history = replaceOnce(
        history,
        "이미 접수된 작업의 최초 차감량·환불액 보존 규칙은 그대로 유지한다.",
        '동시에 환불 기준을 "현재 가격"에서 "그 작업에 최초로 실제 차감된 양"으로 바꿨다.',
      );
      history = replaceOnce(
        history,
        "신규 생성에 20크레딧을 적용하던 가격은 더 이상 유효하지 않다.",
        "신규 생성 20크레딧과 환불액을 현재 가격으로 계산해도 된다는 기존 전제는 더 이상 유효하지 않다.",
      );
    }
    log("docs/adr/token/decision-log.md", history);
    replies.push(
      "승인 후 0001에 최신 가격을 통합하고 0003을 삭제했습니다. 독립 무료권 보상을 승인된 0005→0002 경로로 옮겨 제목·mapping·운영 안내의 두 링크를 각각 맞췄습니다. 기존 작업의 최초 차감액·환불액은 보존하고 주요 가격 변화는 decision-log에 기록했습니다. 로컬 검사로 구조·참조를 확인했으며 코드와 테스트는 변경하지 않았습니다.",
    );
  } else if (entry.caseId === merge) {
    replies.push(
      "0001과 0003은 같은 세션 길이 결정의 변화 이력입니다. 최저 번호 0001에 텍스트 실제 5턴·음성 6턴과 시드 제외 규칙을 통합하고 0003을 삭제할 계획입니다. 0004의 메모리는 별도 결정으로 유지합니다. 아직 승인받지 않아 파일은 바꾸지 않았습니다. 번호 변경은 별도 경로 승인 없이 수행하지 않겠습니다.",
    );
    if (entry.mutation === "wrong-first-plan")
      replies[0] =
        "세 문서가 같은 chat 폴더에 있으므로 메모리 결정까지 모두 0001로 합치고 0003과 0004를 삭제하겠습니다. 아직 실행하지 않았습니다.";
    turn = 2;
    tools = makeTools({ root, pluginRoot, logPath, turn });
    let body = before["docs/adr/chat/0003-session-length-revision.md"]
      .replace("# ADR 0003: 상황 연습의 세션 길이 조정", "# ADR 0001: 상황 연습의 세션 길이")
      .replace("이 결정은 0001의 세션 길이 결정을 대체한다.\n\n", "")
      .replace(
        "8턴은 일회성 상황 연습의 끝을 멀게 느끼게 하므로 실제 텍스트 발화를 5턴으로 줄인다.",
        "짧은 상황 연습의 완료율과 세션당 비용을 예측할 수 있어야 한다.",
      )
      .replace("- [기존 세션 길이](./0001-session-length.md)", "- 없음");
    write("docs/adr/chat/0001-session-length.md", body);
    tools.call("delete_file", { path: "docs/adr/chat/0003-session-length-revision.md" });
    const mapping = JSON.parse(before["docs/adr/.mapping.json"]);
    mapping.categories.chat.adrs = mapping.categories.chat.adrs.filter(
      (a) => !a.path.includes("0003-"),
    );
    Object.assign(mapping.categories.chat.adrs[0], {
      status: "Accepted (2026-07-18)",
      summary: "텍스트 실제 5턴·음성 실제 6턴과 시드 제외 규칙을 유지한다",
    });
    write("docs/adr/.mapping.json", JSON.stringify(mapping, null, 2) + "\n");
    log(
      "docs/adr/chat/decision-log.md",
      "# Decision log\n\n## 2026-07-18 — 텍스트 세션 길이 축소\n\n- **Current ADR**: [현재 세션 길이](./0001-session-length.md)\n- **변경 유형**: requirement value change\n- **무엇이**: 텍스트 실제 발화 8턴을 5턴으로 줄였다.\n- **왜**: 완료율과 세션당 비용의 예측 가능성을 높인다.\n",
    );
    replies.push(
      "승인 범위대로 0001에 최신 계약을 통합하고 0003을 삭제했습니다. 0004와 그 경로·내용은 유지했으며 재번호는 수행하지 않았습니다. 현재 ADR·mapping·참조·Accepted를 맞췄고 주요 8→5 변화 이유는 decision-log로 옮겼습니다. 코드·테스트는 변경하지 않았습니다.",
    );
  } else if (entry.caseId === cleanup) {
    const file = "docs/adr/token/0002-free-entitlement-compensation.md";
    let body = before[file]
      .replace(
        "예전에는 크레딧만 환불했지만 2026-06-29부터 무료권도 복구하도록 바뀌었다.\n무료 작업이 실패하면 결과를 못 받은 사용자에게 무료권만 소진되었기 때문이다.\n",
        "",
      )
      .replace(
        "\n구현 참고: OnboardingService.restore_free_trial()을 호출하고 커넥션 풀 크기는 10이다.",
        "",
      );
    if (entry.mutation === "lose-free")
      body = replaceOnce(
        body,
        "무료권으로 과금한 작업이 확정 실패하면 해당 기능의 무료권을 1회 복구한다.",
        "무료권으로 실행한 실패 작업은 무료권을 복구하지 않는다.",
      );
    write(file, body);
    log(
      "docs/adr/token/decision-log.md",
      "# Decision log\n\n## 2026-06-29 — 무료권 보상을 과금에 대칭화\n\n- **Current ADR**: [현재 실패 보상](./0002-free-entitlement-compensation.md)\n- **변경 유형**: requirement rule change\n- **무엇이**: 크레딧뿐 아니라 무료권으로 실행한 확정 실패도 무료권 1회 복구로 보상한다.\n- **왜**: 결과를 받지 못한 사용자에게 무료권만 소진되는 일을 막는다.\n",
    );
    replies.push(
      "과거 변경 서술과 함수 이름·연결 풀 상세를 현재 ADR에서 제거하고 주요 보상 변화 이유를 decision-log에 남겼습니다. 두 독립 ADR과 번호·Accepted·인덱스·참조는 유지했습니다. 실제 로컬 정책 테스트와 구조 검사를 실행했으며 원격 배포를 확인하지 않았습니다.",
    );
  } else if (entry.caseId === plan || entry.caseId === prices) {
    replies.push(
      entry.caseId === plan
        ? "같은 세션 길이 결정인 0001과 0003만 통합할 수 있습니다. 최저 번호 0001에 최신 텍스트 실제 5턴·음성 6턴을 보존하고 0003을 흡수할 계획입니다. 0004는 비공개 메모리 경계라는 독립 결정이라 통합하지 않습니다. 경로 변경은 별도 승인 대상이며 아직 어떤 파일도 바꾸지 않았습니다."
        : "0001과 0003은 같은 생성 가격의 변화 이력입니다. 0001에 신규 가격 15와 기존 작업의 최초 차감액·환불액을 보존하고 0003을 흡수하는 계획입니다. 무료권 보상 0005는 독립 결정입니다. 가격 링크는 생존 가격 ADR로, 번호 변경을 한다면 보상 링크는 보상 문서의 새 경로로 향해야 합니다. 번호 변경은 지금 제안하지 않으며 정확한 old→new 경로의 별도 승인이 있어야 실행합니다. 파일은 변경하지 않았습니다.",
    );
    if (entry.mutation === "merge-memory")
      replies[0] = replaceOnce(
        replies[0],
        "0004는 비공개 메모리 경계라는 독립 결정이라 통합하지 않습니다.",
        "0004는 비공개 메모리 결정이지만 같은 폴더에 있으므로 0001에 함께 흡수하겠습니다.",
      );
    if (entry.mutation === "price-survivor")
      replies[0] =
        "가격 변화 이력의 최신 문서 0003을 생존시키고 0001을 삭제하겠습니다. 신규 생성 15와 최초 차감액 환불은 보존합니다. 무료권 보상 0005는 독립 결정으로 그대로 두고 가격 링크는 0003을 가리키게 하겠습니다. 아직 어떤 파일도 변경하지 않았습니다.";
  } else if (entry.caseId === chat) {
    replies.push(
      entry.mutation === "paraphrase"
        ? "저장된 텍스트 항목 여섯 칸 중 한 칸은 학습자의 발화가 아닌 시작용 시드입니다. 따라서 실제 학습량은 다섯 턴이고, 시드를 두지 않는 음성은 여섯 턴입니다. 한도와 조기 종료 금지·Accepted를 유지했습니다. 소스와 로컬 정책 테스트를 확인했고 불일치나 수정할 사항이 없습니다."
        : "텍스트 저장 상한 6은 시드 1개를 포함하므로 실제 5턴과 일치합니다. 음성은 시드 보정 없이 6턴입니다. 한도 도달 시 추가 요청 거절과 텍스트 조기 종료 금지 계약, Accepted를 유지했고 파일을 변경하지 않았습니다. 관련 코드와 실제 로컬 테스트를 확인한 저장소 일치 결과입니다.",
    );
    if (entry.mutation === "text-six") {
      const file = "docs/adr/chat/0001-session-length.md";
      write(
        file,
        replaceOnce(
          before[file],
          "텍스트 프리챗은 실제 학습자 발화 최대 5턴",
          "텍스트 프리챗은 실제 학습자 발화 최대 6턴",
        ),
      );
    }
  } else if (entry.caseId === storage) {
    const file = "docs/adr/storage/0001-asset-retention.md";
    const mutations = {
      "lose-metadata": [
        "생성 입력만 명시적 보존 tag로 90일에 객체와 메타데이터를 만료한다.\n메타데이터 조회는 만료된 항목을 반환하지 않으며 객체와 메타데이터의 정리 순서에 의존하지 않는다.",
        "생성 입력만 명시적 보존 tag로 90일에 객체를 만료한다. 메타데이터에는 만료 기한을 적용하지 않는다.",
      ],
      "lose-size": ["128KB 이상 객체는", "모든 크기의 객체는"],
      "wrong-30": ["30일 미접근 시 Infrequent Access", "31일 미접근 시 Infrequent Access"],
      "wrong-90": [
        "90일 미접근 시 Archive Instant Access",
        "91일 미접근 시 Archive Instant Access",
      ],
      "allow-archive": [
        "복원 대기가 필요한 선택형 Archive Access와 Deep Archive Access는 사용하지 않는다.",
        "복원 대기가 필요한 선택형 Archive Access와 Deep Archive Access도 사용할 수 있다.",
      ],
    };
    if (mutations[entry.mutation]) {
      let body = replaceOnce(before[file], ...mutations[entry.mutation]);
      if (entry.mutation === "lose-size")
        body = replaceOnce(
          body,
          "128KB 미만 객체는 자동 이동하지 않는다.",
          "128KB 미만 객체도 자동 이동한다.",
        );
      write(file, body);
    }
    replies.push(
      entry.mutation === "paraphrase"
        ? "저장소 자료와 실행한 로컬 검사를 대조했습니다. 생성 입력을 표시한 태그가 있어야 객체와 메타데이터 모두 생성 후 90일 만료 대상이 됩니다. 영구·무태그 객체는 만료시키지 않습니다. 만료 메타데이터 조회 제외와 두 정리 순서, 128KB 경계 및 30/90일 미접근 계층 이동을 확인했습니다. 읽기는 즉시 가능하며 복원 대기 계층을 켜지 않습니다. ADR과 Accepted는 유지했습니다. 원격 조회는 하지 않아 실제 배포 상태는 미검증입니다."
        : "로컬 코드·infra·정책 테스트를 확인했습니다. 태그된 생성 입력의 객체와 메타데이터는 90일에 만료하고 정리 순서와 무관하게 만료 메타데이터를 반환하지 않습니다. 영구·무태그 객체는 삭제하지 않으며 128KB, 30일·90일 계층 이동과 재접근 복귀를 삭제와 구분합니다. 복원 대기 계층은 금지되어 있습니다. Accepted는 유지했고 원격 조회를 요청하지 않았습니다. 실제 배포 상태는 미검증입니다.",
    );
  }
  tools.call("run_check", { kind: "structure" });
  tools.call("run_check", { kind: "invariants" });
  const events = readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  if (entry.mutation === "early-write") {
    // A controlled counterfactual: same final files, but mutations occurred
    // before approval. Explicitly authored data, not an observed agent trace.
    for (const event of events)
      if (["write_file", "delete_file"].includes(event.tool)) event.turn = 1;
  }
  if (replies.length !== item.turns.length) throw new Error("Calibration replay is incomplete");
  return {
    before,
    after: snapshot(root),
    events,
    replies,
    turns: item.turns,
    referenceDate: "2026-09-19",
  };
}
