// Authored examples, not model responses or human-reviewed calibration labels.
export const approvedDigest = `팀 작업 세션 승인 요청
한 세션은 최대 20턴이다.
미승인 세션은 30일 뒤 삭제한다.
워크스페이스 owner만 결과를 내보낼 수 있다.
상태는 draft, approved, archived이며 archived에서 draft로 돌아갈 수 없다.
승인 후 팀 대시보드에 결과가 표시된다.
답변: 승인 / 수정 / 보류
=== EVAL-VERDICT: PASS ===
=== EVAL-FINDINGS ===
CONTRACT_ITEM | 한 세션은 최대 20턴이다.
CONTRACT_ITEM | 미승인 세션은 30일 뒤 삭제한다.
CONTRACT_ITEM | 워크스페이스 owner만 결과를 내보낼 수 있다.
CONTRACT_ITEM | 상태는 draft, approved, archived이며 archived에서 draft로 돌아갈 수 없다.
CONTRACT_ITEM | 승인 후 팀 대시보드에 결과가 표시된다.
NO_UNSEEN_CONTRACT | digest에 없는 요구사항은 저장하지 않는다.
SEPARATE_SAVE_UNIT | Feature 7.x 전체를 독립 저장한다.
=== EVAL-END ===`;

const reversed = [
  ["limit", "최대 20턴이다", "최소 20턴이며 상한은 없다"],
  [
    "retention",
    "미승인 세션은 30일 뒤 삭제한다",
    "승인된 세션은 30일 뒤 삭제하고 미승인 세션은 영구 보관한다",
  ],
  ["permission", "owner만 결과를 내보낼 수 있다", "owner와 모든 멤버가 결과를 내보낼 수 있다"],
  ["states", "archived에서 draft로 돌아갈 수 없다", "archived에서 draft로 돌아갈 수 있다"],
];

export const digestCases = [
  { id: "valid", output: approvedDigest, failed: [] },
  {
    id: "equivalent-wording",
    output: approvedDigest
      .replaceAll("한 세션은 최대 20턴이다.", "세션당 스무 턴을 넘길 수 없다.")
      .replaceAll(
        "미승인 세션은 30일 뒤 삭제한다.",
        "승인을 받지 않은 세션의 보존 기간은 30일이며 그 뒤 지운다.",
      )
      .replaceAll("owner만 결과를 내보낼 수 있다", "소유자(owner)에게만 결과 내보내기를 허용한다")
      .replaceAll(
        "archived에서 draft로 돌아갈 수 없다",
        "draft로의 복귀는 archived 상태에서 금지된다",
      ),
    failed: [],
  },
  ...reversed.map(([id, from, to]) => ({
    id,
    output: approvedDigest.replaceAll(from, to),
    failed: [id, "tail"],
  })),
  {
    id: "missing-options",
    output: approvedDigest.replace("답변: 승인 / 수정 / 보류", "답변: 승인"),
    failed: ["options"],
  },
  {
    id: "tail-contradiction",
    output: approvedDigest.replace(
      "CONTRACT_ITEM | 워크스페이스 owner만 결과를 내보낼 수 있다.",
      "CONTRACT_ITEM | 모든 멤버가 결과를 내보낼 수 있다.",
    ),
    failed: ["tail"],
  },
  {
    id: "all-reversed",
    output: reversed
      .reduce((output, [, from, to]) => output.replaceAll(from, to), approvedDigest)
      .replace("답변: 승인 / 수정 / 보류", "답변: 승인"),
    failed: ["limit", "retention", "permission", "states", "options", "tail"],
  },
];
