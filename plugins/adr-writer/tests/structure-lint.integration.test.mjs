// Tests for the ADR structure-lint harness — both the pure checkers in
// scripts/adr-lint-lib.mjs (unit) and the CLI scripts/adr-structure-lint.mjs
// end-to-end against fixture repos (integration). This is the deterministic
// self-test the user asked for: it proves each "ADR item well-formed?" rule
// fires on a bad fixture and passes a clean one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { withTmp, write, parseLint } from "./helpers.mjs";
import { seedClean } from "./structure-lint-helpers.mjs";

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

test("the CLI accepts Purpose and legacy Context without changing either document", () => {
  withTmp((dir) => {
    seedClean(dir);
    const relative = "docs/adr/identity/login/0001-password-policy.md";
    const original = readFileSync(path.join(dir, relative), "utf8");
    for (const heading of ["Purpose", "Context"]) {
      const body = original.replace(/^## (?:Purpose|Context)$/m, `## ${heading}`);
      write(dir, relative, body);
      const result = parseLint(dir, ["--documents-only"], { full: true });
      assert.equal(result.code, 0, JSON.stringify(result.errors));
      assert.equal(readFileSync(path.join(dir, relative), "utf8"), body);
    }
  });
});

for (const [label, content, empty] of [
  ["one rejected option", "- Central authentication cannot serve offline login.", false],
  [
    "a constrained decision in prose",
    "Regulation requires the accredited provider; other providers cannot serve this market.",
    false,
  ],
  ["an empty comparison", "", true],
]) {
  test(`CLI accepts rationale without an option quota: ${label}`, () => {
    withTmp((dir) => {
      seedClean(dir);
      const relative = "docs/adr/identity/login/0001-password-policy.md";
      const body = readFileSync(path.join(dir, relative), "utf8").replace(
        /### 대안 검토[\s\S]*?(?=## Consequences)/,
        `### Alternatives\n${content}\n\n`,
      );
      write(dir, relative, body);
      const result = parseLint(dir, ["--documents-only"], { full: true });
      assert.equal(result.code, 0, JSON.stringify(result.errors));
      assert.equal(
        result.warnings.some((w) => w.rule === "alternatives-empty"),
        empty,
      );
      assert.ok(
        ![...result.errors, ...result.warnings].some((w) => w.rule === "alternatives-count"),
      );
    });
  });
}

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
