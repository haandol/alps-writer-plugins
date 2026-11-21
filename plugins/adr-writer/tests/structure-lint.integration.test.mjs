// The ADR structure-lint CLI scripts/adr-structure-lint.mjs end-to-end in its full
// run, which also starts adr-invariants.sh in bash, and git to find its scope.
// The pure checkers in scripts/adr-lint-lib.mjs and the CLI runs that start no
// external tool are in structure-lint.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { withTmp, write, parseLint } from "./helpers.mjs";
import { seedClean } from "./structure-lint-helpers.mjs";

test("a scoped document review checks only the selected ADR bodies, including planning references", () => {
  withTmp((dir) => {
    seedClean(dir);
    const root = "docs/adr";
    const first = root + "/identity/login/0001-password-policy.md";
    const second = root + "/identity/login/0002-rate-limit.md";
    const check = (...args) => parseLint(dir, ["--documents-only", ...args], { full: true });
    const addReference = (file) =>
      write(dir, file, readFileSync(path.join(dir, file), "utf8") + "\nSee product.alps.xml.\n");
    write(dir, root + "/billing/0001-payment.md", "See outside.alps.xml.\n");
    assert.equal(check("identity").code, 0);
    addReference(second);
    for (const target of [first, path.join(dir, first), "identity/login/0001-password-policy.md"])
      assert.equal(check(target).code, 0);
    for (const target of ["identity", "identity/login", second]) {
      const result = check("--adr-dir", path.join(dir, root), target);
      assert.equal(result.code, 1);
      assert.ok(
        result.errors.some(
          (err) => err.msg.includes("product.alps.xml") && err.msg.includes("0002-rate-limit.md"),
        ),
      );
      assert.ok(result.errors.every((err) => !err.msg.includes("outside.alps.xml")));
    }
    assert.ok(check().errors.some((err) => err.msg.includes("outside.alps.xml")));
    assert.notEqual(check(root + "/identity/login/0003-missing.md").code, 0);
  });
});

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

test("a single ADR reports shared index failure separately and does not infer a sibling numbering gap", () => {
  withTmp((dir) => {
    seedClean(dir);
    const file = "docs/adr/identity/login/0002-rate-limit.md";
    const mapFile = "docs/adr/.mapping.json";
    const mapping = JSON.parse(readFileSync(path.join(dir, mapFile), "utf8"));
    mapping.categories.billing = { adrs: [], dependsOn: ["missing"] };
    write(dir, mapFile, JSON.stringify(mapping));
    const result = parseLint(dir, ["--documents-only", file], { full: true });
    assert.equal(result.code, 1);
    assert.deepEqual(result.scope, { target: file, documentsOk: true, repositoryOk: false });
    assert.ok(result.errors.every((error) => error.scope === "repository"));
    assert.ok(!result.warnings.some((warning) => warning.rule === "numbering-gap"));
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
