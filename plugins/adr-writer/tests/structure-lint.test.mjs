// Tests for the ADR structure-lint harness — both the pure checkers in
// scripts/adr-lint-lib.mjs (unit) and the CLI scripts/adr-structure-lint.mjs
// end-to-end against fixture repos (integration). This is the deterministic
// self-test the user asked for: it proves each "ADR item well-formed?" rule
// fires on a bad fixture and passes a clean one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { withTmp, write, runStructureLint, parseLint, PLUGIN_ROOT, TEMPLATES } from "./helpers.mjs";
import {
  classifyStatus,
  checkFilename,
  categoryDepth,
  checkSections,
  countDrivers,
  countAlternatives,
  relatedLinkTargets,
  decisionLogLinkTargets,
  codeRefHits,
  constantAssignmentHits,
  validateMappingShape,
  checkCategoryKey,
  numberingGaps,
  rulesVersion,
  compareVersions,
} from "../scripts/adr-lint-lib.mjs";

test("document-only review ignores code references but still rejects ADR references to planning documents", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(dir, "src/session.mjs", "// docs/adr/identity/login/0001-password-policy.md\n");
    const broad = parseLint(dir, [], { full: true });
    assert.equal(broad.code, 1);
    assert.ok(
      broad.errors.some(
        (item) => item.rule === "invariants" && item.msg.includes("src/session.mjs"),
      ),
    );
    const documents = parseLint(dir, ["--documents-only"], { full: true });
    assert.equal(documents.code, 0, JSON.stringify(documents.errors));
    assert.equal(documents.errors.length, 0);
    const adr = path.join(dir, "docs/adr/identity/login/0001-password-policy.md");
    write(
      dir,
      "docs/adr/identity/login/0001-password-policy.md",
      readFileSync(adr, "utf8") + "\nSee product.alps.xml.\n",
    );
    const planningRef = parseLint(dir, ["--documents-only"], { full: true });
    assert.equal(planningRef.code, 1);
    assert.ok(
      planningRef.errors.some(
        (item) => item.rule === "invariants" && item.msg.includes("product.alps.xml"),
      ),
    );
    assert.ok(planningRef.errors.every((item) => !item.msg.includes("src/session.mjs")));
  });
});

test("document-only mode rejects a simultaneous request to skip its invariant checks", () => {
  withTmp((dir) => {
    for (const args of [
      ["--documents-only", "--no-invariants"],
      ["--no-invariants", "--documents-only"],
    ]) {
      assert.equal(runStructureLint(dir, args).code, 2);
    }
  });
});

// ── unit: classifyStatus ────────────────────────────────────────────────
test("classifyStatus accepts the four sanctioned forms", () => {
  assert.equal(classifyStatus("Proposed").ok, true);
  assert.equal(classifyStatus("Accepted (2026-07-02)").ok, true);
  assert.equal(classifyStatus("Deprecated (2026-07-02)").ok, true);
  assert.equal(classifyStatus("Superseded by [ADR 0007](./0007-x.md)").ok, true);
});

test("classifyStatus rejects informal / mis-dated statuses with a reason", () => {
  assert.equal(classifyStatus("Done").reason, "informal-status");
  assert.equal(classifyStatus("Implemented").reason, "informal-status");
  assert.equal(classifyStatus("Accepted").reason, "missing-date");
  assert.equal(classifyStatus("Proposed (2026-07-02)").reason, "proposed-should-not-carry-date");
  assert.equal(classifyStatus("Superseded").reason, "superseded-needs-adr-link");
  assert.equal(classifyStatus("").reason, "empty");
});

test("classifyStatus coerces a non-string without throwing (forgotten-quotes status)", () => {
  // a hand-edited mapping can carry `"status": 2026` (number) or true (boolean);
  // classifyStatus must return a reason, never throw on .trim of a non-string
  assert.doesNotThrow(() => classifyStatus(2026));
  assert.equal(classifyStatus(2026).ok, false);
  assert.equal(classifyStatus(true).ok, false);
  assert.equal(classifyStatus(null).reason, "empty");
  assert.equal(classifyStatus(undefined).reason, "empty");
});

test("classifyStatus rejects extra text after the Accepted/Deprecated date (date-only)", () => {
  // the parentheses must hold ONLY the date — no reference / feature-id / note
  assert.equal(classifyStatus("Accepted (2026-07-09) — F1 구현").reason, "date-only");
  assert.equal(classifyStatus("Accepted (2026-07-09, ref)").reason, "date-only");
  assert.equal(classifyStatus("Accepted 2026-07-09").reason, "date-only");
  assert.equal(classifyStatus("Deprecated (2026-07-09) 사유 있음").reason, "date-only");
  // the clean date-only forms still pass
  assert.equal(classifyStatus("Accepted (2026-07-09)").ok, true);
  assert.equal(classifyStatus("Deprecated (2026-07-09)").ok, true);
});

// ── unit: checkFilename ─────────────────────────────────────────────────
test("checkFilename accepts canonical NNNN-kebab and rejects fN-/uppercase", () => {
  assert.equal(checkFilename("0001-password-policy.md").ok, true);
  assert.equal(checkFilename("0001-f1-email-signup.md").reason, "stale-fN-prefix");
  assert.equal(checkFilename("0001-Password.md").reason, "uppercase");
  assert.equal(checkFilename("1-x.md").reason, "not-canonical");
});

// ── unit: categoryDepth ─────────────────────────────────────────────────
test("categoryDepth counts directory segments, capping the 2-segment rule", () => {
  assert.equal(categoryDepth("auth/0001-x.md"), 1);
  assert.equal(categoryDepth("identity/login/0001-x.md"), 2);
  assert.equal(categoryDepth("identity/login/social/0001-x.md"), 3); // violation
});

// ── unit: checkCategoryKey (R5a) ────────────────────────────────────────
test("checkCategoryKey flags anti-pattern segments and over-deep keys", () => {
  assert.deepEqual(checkCategoryKey("identity/login"), []);
  assert.ok(checkCategoryKey("api").some((i) => i.reason === "anti-pattern-segment"));
  assert.ok(checkCategoryKey("identity/api").some((i) => i.reason === "anti-pattern-segment"));
  assert.ok(checkCategoryKey("a/b/c").some((i) => i.reason === "too-deep"));
});

// ── unit: section / count parsers ───────────────────────────────────────
const GOOD_BODY = `# ADR 0001: x

## Status
Proposed

## Context
c

## Decision Drivers
- one
- two
- three

## Decision
d

### 대안 검토
- opt A
- opt B

## Consequences
ok

## Related
- [y](./0002-y.md)
`;

test("checkSections finds all hard sections + alternatives + drivers present", () => {
  const s = checkSections(GOOD_BODY);
  assert.deepEqual(s.missingHard, []);
  assert.equal(s.hasAlternatives, true);
  assert.equal(s.hasDrivers, true);
  assert.equal(s.hasRelated, true);
});

test("checkSections reports a missing hard section", () => {
  const noConseq = GOOD_BODY.replace(/## Consequences\nok\n/, "");
  assert.deepEqual(checkSections(noConseq).missingHard, ["Consequences"]);
});

test("countDrivers counts bullets under Decision Drivers", () => {
  assert.deepEqual(countDrivers(GOOD_BODY), { present: true, count: 3 });
});

test("countAlternatives counts bullet-form alternatives", () => {
  assert.deepEqual(countAlternatives(GOOD_BODY), { present: true, count: 2 });
});

// Harness prompts and rule docs are English, but an ADR BODY follows the language
// the user writes in (authoring-rules "Conventions"). So the alternatives heading
// arrives either way, and the checkers must accept both: matching only one spelling
// would report `alternatives-missing` on a perfectly good ADR and make R14's count
// check silently skip it. The fixtures above cover the Korean spelling; these cover
// the English one.
test("checkSections and countAlternatives accept an English alternatives heading", () => {
  const english = GOOD_BODY.replace("### 대안 검토", "### Alternatives");
  assert.equal(checkSections(english).hasAlternatives, true);
  assert.deepEqual(countAlternatives(english), { present: true, count: 2 });
  // the README template's fuller form, with a trailing qualifier after a dash
  const withQualifier = GOOD_BODY.replace("### 대안 검토", "### Alternatives — at least two");
  assert.equal(checkSections(withQualifier).hasAlternatives, true);
  assert.deepEqual(countAlternatives(withQualifier), { present: true, count: 2 });
  // an unrelated heading must still not be mistaken for the alternatives section
  const unrelated = GOOD_BODY.replace("### 대안 검토", "### Alternative payment providers we use");
  assert.equal(checkSections(unrelated).hasAlternatives, false);
});

test("countAlternatives counts table rows minus the header", () => {
  const body = `## Decision
d
### 대안 검토
| 옵션 | pros | cons |
| --- | --- | --- |
| A | p | c |
| B | p | c |
## Consequences
`;
  assert.deepEqual(countAlternatives(body), { present: true, count: 2 });
});

test("parsers ignore headings inside fenced code blocks", () => {
  const body = `## Status
Proposed
## Context
\`\`\`
## Decision
this is inside a fence, not a real heading
\`\`\`
## Consequences
`;
  // Decision is only inside the fence → reported missing
  assert.ok(checkSections(body).missingHard.includes("Decision"));
});

// ── unit: relatedLinkTargets ────────────────────────────────────────────
test("relatedLinkTargets returns local targets, skips URLs, strips anchors", () => {
  const body = `## Related
- [a](./0002-a.md)
- [ext](https://example.com)
- [b](../other/0003-b.md#section)
`;
  assert.deepEqual(relatedLinkTargets(body), ["./0002-a.md", "../other/0003-b.md"]);
});

// ── unit: codeRefHits (advisory R2) ─────────────────────────────────────
test("codeRefHits flags a source-file path but not a .md Related link", () => {
  assert.equal(codeRefHits("apps/web/src/Login.tsx 를 고친다").length, 1);
  assert.equal(codeRefHits("- [x](./0002-x.md)").length, 0);
  assert.equal(codeRefHits("services/auth/auth_service.go:42 참조").length, 1);
});

// ── unit: constantAssignmentHits (advisory R18 form half) ───────────────
// The rule the harness must NOT overreach on: a requirement value belongs in the
// ADR, so a bare number is never flagged. Only the code-constant FORM is.
test("constantAssignmentHits flags a value written as a code constant", () => {
  assert.equal(constantAssignmentHits("`MAX_TURNS = 20` 으로 제한한다").length, 1);
  assert.equal(constantAssignmentHits("TIMER = {1: 60}").length, 1);
  assert.equal(constantAssignmentHits("AUTH_TOKEN_TTL: 604800").length, 1);
});

test("constantAssignmentHits leaves requirement values written as prose alone", () => {
  // Every one of these MUST survive: they are the contract a regenerated
  // implementation has to honor.
  for (const line of [
    "채팅 한 세션은 최대 20턴이며, 초과 시 새 세션을 시작한다 (요금제 정책)",
    "무료 플랜은 월 업로드 5회 (과금 정책)",
    "refresh token 은 7일 만료로 회전한다",
    "p95 응답 3초 이내 (NFR 6.2)",
    "첨부는 최대 25MB — 요금·UX 계약",
  ])
    assert.deepEqual(constantAssignmentHits(line), [], line);
});

test("constantAssignmentHits ignores fenced blocks and constants without a value", () => {
  // Fenced code is the impl-detail rule's (R3) territory, judged by the reviewer.
  assert.deepEqual(constantAssignmentHits("```ts\nconst MAX_TURNS = 20;\n```"), []);
  // An enum member or error code mentioned without an assigned number is fine.
  assert.deepEqual(constantAssignmentHits("에러 코드 RATE_LIMIT_EXCEEDED 를 반환한다"), []);
});

// ── unit: validateMappingShape ──────────────────────────────────────────
test("validateMappingShape passes a clean mapping", () => {
  const m = {
    categories: {
      "identity/login": {
        feature: "Login",
        adrs: [{ path: "docs/adr/identity/login/0001-x.md", status: "Proposed", summary: "s" }],
        dependsOn: [],
      },
      identity: { feature: "Identity", subdomainType: "core", adrs: [] },
    },
  };
  assert.deepEqual(
    validateMappingShape(m).filter((i) => i.level === "error"),
    [],
  );
});

test("validateMappingShape flags dangling, self-edge, unknown field, double-index", () => {
  const rec = (p) => ({ path: p, status: "Proposed", summary: "s" });
  const m = {
    categories: {
      api: { adrs: [rec("docs/adr/api/0001-x.md")], dependson: ["x"] }, // typo'd field + anti-pattern key
      a: { adrs: [rec("docs/adr/api/0001-x.md")], dependsOn: ["a", "ghost"] }, // self-edge + dangling + double-index
    },
  };
  const codes = validateMappingShape(m).map((i) => i.code);
  assert.ok(codes.includes("key-anti-pattern-segment"));
  assert.ok(codes.includes("dependson-self-edge"));
  assert.ok(codes.includes("dependson-dangling"));
  assert.ok(codes.includes("dependson-cycle"));
  assert.ok(codes.includes("adr-double-indexed"));
  assert.ok(codes.includes("unknown-field")); // warn level
});

// ── unit: numberingGaps (rollup advisory) ───────────────────────────────
test("numberingGaps returns empty for a contiguous-from-0001 category", () => {
  const gaps = numberingGaps({ auth: ["0001-a.md", "0002-b.md", "0003-c.md"] });
  assert.deepEqual(gaps, []);
});

test("numberingGaps flags a hole and reports present + missing numbers", () => {
  // 0002 deleted by a rollup, 0003 not yet renumbered → gap at 2.
  const gaps = numberingGaps({ auth: ["0001-a.md", "0003-c.md"] });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].category, "auth");
  assert.deepEqual(gaps[0].present, [1, 3]);
  assert.deepEqual(gaps[0].missing, [2]);
});

test("numberingGaps flags a missing 0001 (sequence not starting at 1)", () => {
  const gaps = numberingGaps({ auth: ["0002-b.md", "0003-c.md"] });
  assert.deepEqual(gaps[0].missing, [1]);
});

test("numberingGaps is per-category and ignores non-canonical basenames", () => {
  const gaps = numberingGaps(
    new Map([
      ["auth", ["0001-a.md", "0004-d.md"]], // gap 2,3
      ["billing", ["0001-a.md", "0002-b.md"]], // clean
      ["misc", ["decision-log.md", "0001-a.md"]], // non-NNNN ignored → clean
    ]),
  );
  assert.deepEqual(
    gaps.map((g) => g.category),
    ["auth"],
  );
  assert.deepEqual(gaps[0].missing, [2, 3]);
});

// ── integration: CLI end-to-end ─────────────────────────────────────────
// A reusable clean fixture. inScope/mapping/README all consistent.
function seedClean(dir) {
  write(
    dir,
    "docs/adr/identity/login/0001-password-policy.md",
    `# ADR 0001: 비밀번호 정책

Date: 2026-07-01

## Status
Accepted (2026-07-02)

## Context
가입 시 비밀번호 강도.

## Decision Drivers
- 크리덴셜 스터핑 방어
- 이탈률 5% 이내
- 보안 전문가 부재

## Decision
bcrypt, 최소 12자.

### 대안 검토
- bcrypt: 표준
- argon2: 최신

## Consequences
### Positive
- 강력

## Related
- [0002](./0002-rate-limit.md)
`,
  );
  write(
    dir,
    "docs/adr/identity/login/0002-rate-limit.md",
    `# ADR 0002: 레이트 리밋

Date: 2026-07-01

## Status
Proposed

## Context
무차별 대입 방어.

## Decision Drivers
- 초당 제한
- 정상 사용자 영향 최소
- 분산 고려

## Decision
토큰 버킷.

### 대안 검토
- 토큰 버킷
- 고정 윈도우

## Consequences
### Positive
- 방어력

## Related
- [0001](./0001-password-policy.md)
`,
  );
  write(
    dir,
    "docs/adr/.mapping.json",
    JSON.stringify({
      categories: {
        "identity/login": {
          feature: "Login",
          adrs: [
            {
              path: "docs/adr/identity/login/0001-password-policy.md",
              status: "Accepted (2026-07-02)",
              summary: "bcrypt 최소 12자",
            },
            {
              path: "docs/adr/identity/login/0002-rate-limit.md",
              status: "Proposed",
              summary: "토큰 버킷 레이트 리밋",
            },
          ],
          dependsOn: [],
        },
      },
    }),
  );
  // .mapping.json is the single ADR index; the README carries no ADR list.
  write(dir, "docs/adr/README.md", `# ADR\n\nADR 인덱스는 .mapping.json 참조.\n`);
}

test("CLI: clean repo exits 0 with no errors", () => {
  withTmp((dir) => {
    seedClean(dir);
    const r = parseLint(dir);
    assert.equal(r.code, 0, JSON.stringify(r.errors));
    assert.equal(r.ok, true);
    assert.deepEqual(r.errors, []);
  });
});

test("CLI: bad Status enum is a hard error", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/0001-password-policy.md",
      `# ADR 0001: x\n\nDate: 2026-07-01\n\n## Status\nDone\n\n## Context\nc\n\n## Decision\nd\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n\n## Related\n- [0002](./0002-rate-limit.md)\n`,
    );
    const r = parseLint(dir);
    assert.equal(r.code, 1);
    assert.ok(r.errors.some((e) => e.rule === "status-enum"));
  });
});

test("CLI: 3-segment nesting is flagged as path-depth error", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/social/0001-oauth.md",
      `# ADR 0001: x\n\n## Status\nProposed\n\n## Context\nc\n\n## Decision\nd\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n`,
    );
    const r = parseLint(dir);
    assert.equal(r.code, 1);
    assert.ok(r.errors.some((e) => e.rule === "path-depth"));
  });
});

test("CLI: mapping adrs path with no file on disk is flagged", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/.mapping.json",
      JSON.stringify({
        categories: {
          "identity/login": {
            feature: "Login",
            adrs: [
              {
                path: "docs/adr/identity/login/0001-password-policy.md",
                status: "Accepted (2026-07-02)",
                summary: "bcrypt 최소 12자",
              },
              {
                path: "docs/adr/identity/login/0002-rate-limit.md",
                status: "Proposed",
                summary: "토큰 버킷",
              },
              {
                path: "docs/adr/identity/login/0099-ghost.md",
                status: "Proposed",
                summary: "존재하지 않는 ADR",
              },
            ],
            dependsOn: [],
          },
        },
      }),
    );
    const r = parseLint(dir);
    assert.equal(r.code, 1);
    assert.ok(r.errors.some((e) => e.rule === "mapping-dangling-adr"));
  });
});

test("CLI: an on-disk ADR absent from mapping is an index orphan", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/0003-lockout.md",
      `# ADR 0003: x\n\n## Status\nProposed\n\n## Context\nc\n\n## Decision\nd\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n`,
    );
    const r = parseLint(dir);
    assert.equal(r.code, 1);
    assert.ok(r.errors.some((e) => e.rule === "index-orphan-mapping"));
  });
});

test("CLI: a decision-log.md in a category folder is invisible to the harness (not an ADR)", () => {
  // decision-log.md is a convention file, not an ADR: it is NOT registered in
  // .mapping.json and must not trip index-orphan-mapping, filename, or any
  // per-ADR check. findAdrFiles only enumerates ^NNNN-*.md, so the log — which
  // starts with 'd' — is never seen as an ADR. This locks in that guarantee.
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/decision-log.md",
      `# Decision Log: identity/login

이 문서는 identity/login 카테고리의 주요 결정 변경 이력이다.

## 2026-07-02 — 비밀번호 해시를 argon2 에서 bcrypt 로 교체

- **현재 ADR**: [password-policy](./0001-password-policy.md)
- **변경 유형**: 채택 대안 교체
- **무엇이**: argon2id → bcrypt(최소 12자)
- **왜**: 운영 표준 라이브러리 가용성
`,
    );
    // structural lint (no invariants): still clean — log is not enumerated.
    const r = parseLint(dir);
    assert.equal(r.code, 0, JSON.stringify(r.errors));
    assert.equal(r.ok, true);
    assert.deepEqual(r.errors, []);
    // full run (with adr-invariants.sh check (a)): the log's ADR link lives
    // under docs/adr/ so the (a) post-filter drops it — no code→ADR violation.
    const full = parseLint(dir, [], { full: true });
    assert.equal(full.code, 0, JSON.stringify(full.errors));
    assert.deepEqual(
      full.errors.filter((e) => e.rule === "invariants"),
      [],
    );
  });
});

test("CLI: no docs/adr dir → clean exit 0 (nothing to lint)", () => {
  withTmp((dir) => {
    const { code } = runStructureLint(dir, ["--no-invariants"]);
    assert.equal(code, 0);
  });
});

test("CLI: --warn-as-error turns a warning into a failure", () => {
  withTmp((dir) => {
    seedClean(dir);
    // add a file-level code ref → advisory warning
    write(
      dir,
      "docs/adr/identity/login/0001-password-policy.md",
      `# ADR 0001: x\n\nDate: 2026-07-01\n\n## Status\nAccepted (2026-07-02)\n\n## Context\napps/web/src/Login.tsx 를 고친다\n\n## Decision Drivers\n- a\n- b\n- c\n\n## Decision\nd\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n\n## Related\n- [0002](./0002-rate-limit.md)\n`,
    );
    const clean = runStructureLint(dir, ["--no-invariants"]);
    assert.equal(clean.code, 0, "warning alone does not fail");
    const strict = runStructureLint(dir, ["--no-invariants", "--warn-as-error"]);
    assert.equal(strict.code, 1, "--warn-as-error escalates the warning");
  });
});

// ── integration: R18 (requirement value vs code constant) ───────────────
// The pair that pins the rule's direction. An ADR carrying its requirement
// values as prose is CLEAN — the harness must never nudge an author toward
// deleting them; only the code-constant form draws a warning.
test("CLI: an ADR stating requirement values in prose stays clean", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/0001-password-policy.md",
      `# ADR 0001: x\n\nDate: 2026-07-01\n\n## Status\nAccepted (2026-07-02)\n\n## Context\nc\n\n## Decision Drivers\n- p95 응답 3초 이내\n- b\n- c\n\n## Decision\n비밀번호는 최소 10자 (보안 정책). 5회 연속 실패 시 계정을 잠근다.\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n\n## Related\n- [0002](./0002-rate-limit.md)\n`,
    );
    const r = parseLint(dir);
    assert.equal(r.code, 0, JSON.stringify(r.errors));
    assert.deepEqual(
      r.warnings.filter((w) => w.rule === "value-as-constant"),
      [],
      "requirement values written as prose must not be flagged",
    );
  });
});

test("CLI: a value written as a code constant is a warning, not an error", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/0001-password-policy.md",
      `# ADR 0001: x\n\nDate: 2026-07-01\n\n## Status\nAccepted (2026-07-02)\n\n## Context\nc\n\n## Decision Drivers\n- a\n- b\n- c\n\n## Decision\n세션 상한은 MAX_TURNS = 20 으로 둔다.\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n\n## Related\n- [0002](./0002-rate-limit.md)\n`,
    );
    const r = parseLint(dir);
    assert.equal(r.code, 0, "advisory only — the value itself may well belong here");
    assert.ok(r.warnings.some((w) => w.rule === "value-as-constant"));
  });
});

test("CLI: usage error (unknown flag) exits 2", () => {
  withTmp((dir) => {
    seedClean(dir);
    const { code } = runStructureLint(dir, ["--bogus"]);
    assert.equal(code, 2);
  });
});

// ── integration: numbering-gap advisory (rollup renumber pending) ────────
// A minimal valid ADR body (no mapping → no orphan noise; Related empty so no
// broken-link error). Two of these with a hole between them = a gap.
const gapAdr = (n, title) =>
  `# ADR ${n}: ${title}\n\nDate: 2026-07-01\n\n## Status\nProposed\n\n## Context\nc\n\n## Decision Drivers\n- a\n- b\n- c\n\n## Decision\nd\n\n### 대안 검토\n- a\n- b\n\n## Consequences\nok\n\n## Related\n`;

test("CLI: a numbering gap is a WARNING, not an error (rollup renumber pending)", () => {
  withTmp((dir) => {
    // auth/0001 + auth/0003 — 0002 was deleted by a rollup, renumber not done.
    write(dir, "docs/adr/auth/0001-session-key.md", gapAdr("0001", "세션 키"));
    write(dir, "docs/adr/auth/0003-sso.md", gapAdr("0003", "SSO"));
    write(dir, "docs/adr/README.md", `# ADR\n`);
    const r = parseLint(dir);
    assert.equal(r.code, 0, "gap alone must not fail the lint");
    const gap = r.warnings.find((w) => w.rule === "numbering-gap");
    assert.ok(gap, "numbering-gap warning must be present");
    assert.match(gap.msg, /0002/, "names the missing number");
    assert.match(gap.msg, /renumber/, "points the LLM at rollup step 7");
  });
});

test("CLI: --warn-as-error escalates a numbering gap so a rollup can gate on it", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/auth/0001-session-key.md", gapAdr("0001", "세션 키"));
    write(dir, "docs/adr/auth/0003-sso.md", gapAdr("0003", "SSO"));
    write(dir, "docs/adr/README.md", `# ADR\n`);
    const { code } = runStructureLint(dir, ["--no-invariants", "--warn-as-error"]);
    assert.equal(code, 1);
  });
});

test("CLI: a contiguous-from-0001 category emits no numbering-gap warning", () => {
  withTmp((dir) => {
    write(dir, "docs/adr/auth/0001-session-key.md", gapAdr("0001", "세션 키"));
    write(dir, "docs/adr/auth/0002-sso.md", gapAdr("0002", "SSO"));
    write(dir, "docs/adr/README.md", `# ADR\n`);
    const r = parseLint(dir);
    assert.equal(r.code, 0);
    assert.equal(r.warnings.filter((w) => w.rule === "numbering-gap").length, 0);
  });
});

// ── unit: decisionLogLinkTargets ────────────────────────────────────────
test("decisionLogLinkTargets returns local targets, skips URLs and the seed placeholder", () => {
  const body = `# Decision Log: auth

## 2026-07-25 — x

- **현재 ADR**: [token](./0001-token.md)
- 참고: [spec](https://example.com/s.md) and [anchor](#why)
- 상위: [other](../billing/0002-plan.md#decision)
`;
  assert.deepEqual(decisionLogLinkTargets(body), ["./0001-token.md", "../billing/0002-plan.md"]);
});

test("decisionLogLinkTargets ignores an unedited seed (NNNN placeholder)", () => {
  const seed = `# Decision Log: <category>

## YYYY-MM-DD — <한 줄 변경 요약>

- **현재 ADR**: [<kebab-title>](./NNNN-kebab-title.md)
`;
  assert.deepEqual(decisionLogLinkTargets(seed), []);
});

// ── CLI: decision-log ADR pointer must resolve ──────────────────────────
// The gap this closes: a rollup renumber moves the ADR a log points at, and
// neither the stale-citation finder (matches "<cat>/NNNN" tokens, not the log's
// relative "./NNNN-title.md") nor R10 related-broken (reads NNNN-*.md bodies
// only) notices the orphaned pointer.
test("CLI: a decision-log pointing at a missing ADR is an error", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/decision-log.md",
      `# Decision Log: identity/login

## 2026-07-02 — 해시 교체

- **현재 ADR**: [gone](./0009-renumbered-away.md)
`,
    );
    const r = parseLint(dir);
    assert.equal(r.code, 1, JSON.stringify(r.errors));
    const hit = r.errors.find((e) => e.rule === "decision-log-link-broken");
    assert.ok(hit, JSON.stringify(r.errors));
    assert.match(hit.msg, /0009-renumbered-away\.md/);
  });
});

test("CLI: an unedited decision-log seed in a category is not flagged", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(
      dir,
      "docs/adr/identity/login/decision-log.md",
      `# Decision Log: <category>

## YYYY-MM-DD — <한 줄 변경 요약>

- **현재 ADR**: [<kebab-title>](./NNNN-kebab-title.md)
`,
    );
    const r = parseLint(dir);
    assert.equal(r.code, 0, JSON.stringify(r.errors));
  });
});

test("CLI: the decision-log seed at the ADR root is scaffolding, not a category log", () => {
  withTmp((dir) => {
    seedClean(dir);
    // Root-level seed named .template.md — must be ignored by the log walk and
    // never enumerated as an ADR.
    write(
      dir,
      "docs/adr/decision-log.template.md",
      `# Decision Log: <category>\n\n- **현재 ADR**: [x](./NNNN-x.md)\n`,
    );
    const r = parseLint(dir);
    assert.equal(r.code, 0, JSON.stringify(r.errors));
  });
});

// ── seeded rule-doc staleness ───────────────────────────────────────────
// /adr-new seeds the rule docs only when they are ABSENT, so a repo seeded once
// keeps that day's rule set forever while every rule added upstream stops
// existing for it. The docs are the source of truth each reviewer reads, so the
// new axis is not failed loudly — it goes unjudged across the whole ADR set at
// once. A warning, never an error: stale rules do not make an ADR wrong, and a
// project may pin or hand-edit its copy deliberately.
function stampedDoc(version) {
  return `# rules\n\nbody\n\n<!-- adr-writer:rules-version ${version} -->\n`;
}

test("rulesVersion reads the stamp and ignores unstamped or malformed docs", () => {
  assert.equal(rulesVersion(stampedDoc("0.4.30")), "0.4.30");
  assert.equal(rulesVersion("# rules\n\nno stamp here\n"), null);
  // a non-triple must not parse as a version — otherwise compareVersions gets NaN
  assert.equal(rulesVersion("<!-- adr-writer:rules-version 0.4 -->"), null);
  assert.equal(rulesVersion(""), null);
  assert.equal(rulesVersion(null), null);
});

test("compareVersions orders by numeric component, not lexically", () => {
  assert.ok(compareVersions("0.4.9", "0.4.10") < 0); // lexical compare would invert this
  assert.ok(compareVersions("0.4.30", "0.4.30") === 0);
  assert.ok(compareVersions("1.0.0", "0.9.9") > 0);
});

test("CLI: rule docs stamped behind the plugin version warn once for the doc set", () => {
  withTmp((dir) => {
    seedClean(dir);
    for (const doc of ["README.md", "authoring-rules.md", "structure.md"]) {
      write(dir, `docs/adr/${doc}`, stampedDoc("0.0.1"));
    }
    const r = parseLint(dir);
    assert.equal(r.code, 0, "staleness is advisory — it must not fail the lint");
    const stale = r.warnings.filter((w) => w.rule === "rules-doc-stale");
    assert.equal(stale.length, 1, "reported once for the set, not once per doc");
    // the message has to name which docs lag, or the user cannot act on it
    for (const doc of ["README.md", "authoring-rules.md", "structure.md"]) {
      assert.match(stale[0].msg, new RegExp(doc));
    }
  });
});

test("CLI: rule docs at the current plugin version produce no staleness warning", () => {
  withTmp((dir) => {
    seedClean(dir);
    const current = JSON.parse(
      readFileSync(path.join(PLUGIN_ROOT, ".claude-plugin", "plugin.json"), "utf8"),
    ).version;
    for (const doc of ["README.md", "authoring-rules.md", "structure.md"]) {
      write(dir, `docs/adr/${doc}`, stampedDoc(current));
    }
    const r = parseLint(dir);
    assert.equal(r.warnings.filter((w) => w.rule === "rules-doc-stale").length, 0);
    assert.equal(r.warnings.filter((w) => w.rule === "rules-doc-unstamped").length, 0);
  });
});

test("CLI: rule docs with no stamp at all warn separately (they predate the stamp)", () => {
  withTmp((dir) => {
    seedClean(dir);
    for (const doc of ["README.md", "authoring-rules.md", "structure.md"]) {
      write(dir, `docs/adr/${doc}`, "# rules\n\nhand-written, no stamp\n");
    }
    const r = parseLint(dir);
    assert.equal(r.code, 0);
    assert.equal(r.warnings.filter((w) => w.rule === "rules-doc-unstamped").length, 1);
    // unstamped is a distinct signal from stale — it means "cannot compare"
    assert.equal(r.warnings.filter((w) => w.rule === "rules-doc-stale").length, 0);
  });
});

// A repo with no rule docs at all has not been seeded yet — that is /adr-new
// step 1's job, and reporting it here would fire on every fresh repo before the
// first ADR exists. Absence is silence; only a doc that IS there and cannot be
// compared (unstamped) or lags (stale) is worth a word.
test("CLI: absent rule docs are /adr-new's seeding job, not a staleness finding", () => {
  withTmp((dir) => {
    // deliberately not seedClean() — that writes an (unstamped) README, which is
    // the different case covered by the unstamped test above
    write(
      dir,
      "docs/adr/auth/0001-x.md",
      `# ADR 0001: x\n\n## Status\nProposed\n\n## Context\nc\n\n## Decision Drivers\n- a\n- b\n- c\n\n## Decision\nd\n\n### 대안 검토\n- A\n- B\n\n## Consequences\nok\n`,
    );
    write(
      dir,
      "docs/adr/.mapping.json",
      JSON.stringify({
        categories: {
          auth: {
            feature: "인증",
            adrs: [{ path: "docs/adr/auth/0001-x.md", status: "Proposed", summary: "x" }],
          },
        },
      }),
    );
    const r = parseLint(dir);
    assert.equal(r.warnings.filter((w) => w.rule === "rules-doc-stale").length, 0);
    assert.equal(r.warnings.filter((w) => w.rule === "rules-doc-unstamped").length, 0);
  });
});

// ── 0.5.0 seeded-doc layout: README = index, concepts = working model ────────
// Two migration states need catching, and the stale-stamp checks above catch
// NEITHER: staleness only compares docs that are present (so an absent
// concepts.md is invisible to it) and never looks at content (so a section left
// behind in README is invisible too). Both get named rules instead.
const LAYOUT = "rules-doc-layout-legacy";
const DUPED = "rules-doc-layout-duplicated";
const CONCEPTS_MIN = "# How ADRs work here\n\n## The abstraction ladder\n\nx\n";

test("CLI: a repo with README but no concepts.md is flagged as the pre-split layout", () => {
  withTmp((dir) => {
    seedClean(dir); // writes docs/adr/README.md and no concepts.md — the old layout
    const r = parseLint(dir);
    assert.equal(r.code, 0, "a layout lag is advisory — the old layout still reads fine");
    const hit = r.warnings.filter((w) => w.rule === LAYOUT);
    assert.equal(hit.length, 1, "reported once for the directory, not per doc");
    // must name the file to create and the command that creates it, or the
    // reader cannot act on it
    assert.match(hit[0].msg, /concepts\.md/);
    assert.match(hit[0].msg, /\/adr-new/);
    // ...and must say the old layout still works, so it doesn't read as broken
    assert.match(hit[0].msg, /falls back/);
  });
});

test("CLI: seeding concepts.md clears the layout warning", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(dir, "docs/adr/concepts.md", CONCEPTS_MIN);
    const r = parseLint(dir);
    assert.equal(r.warnings.filter((w) => w.rule === LAYOUT).length, 0);
    assert.equal(r.warnings.filter((w) => w.rule === DUPED).length, 0);
  });
});

// Half-migrated is worse than un-migrated: two copies of one rule can drift
// apart with no way to tell which is current — the duplication the abstraction
// ladder exists to forbid. So it gets its own rule rather than sharing LAYOUT.
test("CLI: a README still holding moved sections is flagged as duplicated", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(dir, "docs/adr/concepts.md", CONCEPTS_MIN);
    write(
      dir,
      "docs/adr/README.md",
      "# ADR\n\nADR 인덱스는 .mapping.json 참조.\n\n## Status\n\nold copy\n\n## Dependencies run one way\n\nold copy\n",
    );
    const r = parseLint(dir);
    assert.equal(r.code, 0);
    const hit = r.warnings.filter((w) => w.rule === DUPED);
    assert.equal(hit.length, 1);
    // must name WHICH sections — "tidy your README" is not actionable on a file
    // with a dozen headings
    assert.match(hit[0].msg, /Status/);
    assert.match(hit[0].msg, /dependency model/);
  });
});

// README legitimately keeps the ADR template, and that fenced block holds a
// literal "## Status" heading for authors to copy. Matching inside the fence
// would flag the CORRECT layout as duplicated — the one state that must stay
// silent. Regression: the first cut of this check did exactly that.
test("CLI: a heading inside README's fenced ADR template is not a duplication hit", () => {
  withTmp((dir) => {
    seedClean(dir);
    write(dir, "docs/adr/concepts.md", CONCEPTS_MIN);
    write(
      dir,
      "docs/adr/README.md",
      "# ADR\n\nADR 인덱스는 .mapping.json 참조.\n\n## ADR template\n\n```markdown\n# ADR XXXX: title\n\n## Status\n\nProposed\n\n## Context\n\nbackground\n```\n",
    );
    const r = parseLint(dir);
    assert.equal(
      r.warnings.filter((w) => w.rule === DUPED).length,
      0,
      "the template fence is index material, not a duplicated section",
    );
  });
});

// The shipped templates are what every repo is seeded from, so if they trip
// either layout rule, every consumer inherits the warning on day one.
test("CLI: the shipped template pair passes both layout checks", () => {
  withTmp((dir) => {
    seedClean(dir);
    for (const doc of ["README.md", "concepts.md", "authoring-rules.md", "structure.md"]) {
      write(dir, `docs/adr/${doc}`, readFileSync(path.join(TEMPLATES, doc), "utf8"));
    }
    const r = parseLint(dir);
    assert.equal(r.warnings.filter((w) => w.rule === LAYOUT).length, 0);
    assert.equal(r.warnings.filter((w) => w.rule === DUPED).length, 0);
  });
});
