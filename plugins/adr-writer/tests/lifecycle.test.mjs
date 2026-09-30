// lifecycle.test.mjs — end-to-end tests of how an ADR is CREATED and evolved.
//
// The /adr-new and /adr-impl skills are LLM prompts, so this suite can't invoke
// them directly. Instead it reproduces their DETERMINISTIC contract via
// authoring.mjs (seed scaffold → author ADR → register in the .mapping.json
// index → promote Status in body + index) and asserts, at each step, that the
// deterministic oracle — scripts/adr-structure-lint.mjs, which itself runs
// adr-invariants.sh — agrees the artifacts are well-formed.
//
// .mapping.json is the single ADR index (the README holds no ADR list), so the
// index-orphan check is disk↔mapping only, and promotion must keep the index
// record's Status in lockstep with the body.
//
// The load-bearing tests (skip one authoring step → harness goes red) prove the
// harness actually gates each part of the contract, not just that a happy path
// passes. That is the real value: it pins WHAT a correct /adr-new must produce.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { withTmp, initRepo, parseLint, runHook } from "./helpers.mjs";
import { seedScaffold, authorAdr, registerMapping, adrNew, promote } from "./authoring.mjs";

// parse the --json report → { code, ok, errors:[{rule,...}], warnings:[...] }
const lint = (dir, args = []) => parseLint(dir, args);
const lintFull = (dir, args = []) => parseLint(dir, args, { full: true });
const rules = (r) => r.errors.map((e) => e.rule);

// ── the happy path: a fresh repo, one /adr-new, harness green ─────────────

test("e2e: /adr-new on an empty repo produces a harness-clean Proposed ADR", () => {
  withTmp((dir) => {
    seedScaffold(dir); // step 1: seed rule docs + empty mapping
    adrNew(dir, {
      category: "identity/login",
      slug: "password-policy",
      title: "비밀번호 정책",
      feature: "Login",
      summary: "Proposed. bcrypt 최소 12자.",
    });
    const r = lint(dir);
    assert.equal(r.ok, true, JSON.stringify(r.errors, null, 2));
    assert.deepEqual(r.errors, []);
    // the ADR was actually written as Proposed
    const body = readFileSync(
      path.join(dir, "docs/adr/identity/login/0001-password-policy.md"),
      "utf8",
    );
    assert.match(body, /##\s+Status\s*\n\s*\nProposed\b/);
  });
});

test("e2e: a flat single-feature context (auth) is also harness-clean", () => {
  withTmp((dir) => {
    seedScaffold(dir);
    adrNew(dir, { category: "auth", slug: "jwt-rotation", title: "JWT 회전", feature: "Auth" });
    assert.equal(lint(dir).ok, true);
  });
});

// ── each authoring step is load-bearing: skip it → harness catches it ─────

test("e2e: skipping the mapping registration (step 4) → harness flags index-orphan", () => {
  withTmp((dir) => {
    seedScaffold(dir);
    // author the ADR on disk but DO NOT registerMapping — .mapping.json is the
    // single ADR index, so an unregistered ADR is a hard orphan.
    authorAdr(dir, { category: "identity/login", slug: "password-policy" });
    const r = lint(dir);
    assert.equal(r.ok, false);
    assert.ok(rules(r).includes("index-orphan-mapping"), rules(r).join(","));
  });
});

test("e2e: registering a mapping path with no file on disk → harness flags mapping-dangling-adr", () => {
  withTmp((dir) => {
    seedScaffold(dir);
    // register a mapping entry pointing at an ADR that was never written
    registerMapping(dir, {
      key: "identity/login",
      feature: "Login",
      adr: "docs/adr/identity/login/0001-password-policy.md",
    });
    const r = lint(dir);
    assert.equal(r.ok, false);
    assert.ok(rules(r).includes("mapping-dangling-adr"), rules(r).join(","));
  });
});

test("e2e: omitting the index summary → harness warns (not a hard error)", () => {
  withTmp((dir) => {
    seedScaffold(dir);
    const adr = authorAdr(dir, { category: "identity/login", slug: "password-policy" });
    // registered without a one-line summary — advisory, since the summary is
    // the /adr-sync --quick entry point but not load-bearing for correctness.
    registerMapping(dir, { key: "identity/login", feature: "Login", adr });
    const r = lint(dir);
    assert.equal(r.ok, true, "missing summary is advisory, not a hard error");
    assert.ok(r.warnings.some((w) => w.rule === "map-adrs-item-summary-missing"));
  });
});

test("e2e: mapping index Status out of lockstep with the ADR body → harness flags it", () => {
  withTmp((dir) => {
    seedScaffold(dir);
    // body says Proposed; index record claims Accepted → the index went stale.
    const adr = authorAdr(dir, { category: "identity/login", slug: "password-policy" });
    registerMapping(dir, {
      key: "identity/login",
      feature: "Login",
      adr,
      status: "Accepted (2026-07-02)",
      summary: "bcrypt 최소 12자",
    });
    const r = lint(dir);
    assert.equal(r.ok, false);
    assert.ok(rules(r).includes("status-index-mismatch"), rules(r).join(","));
  });
});

// ── malformed authoring is caught with the specific rule ──────────────────

test("e2e: authoring with a Feature-ID filename (0001-f1-…) → harness flags filename", () => {
  withTmp((dir) => {
    seedScaffold(dir);
    // an old-style /feature-to-adr that embedded the Feature ID in the filename
    const adr = authorAdr(dir, {
      category: "identity/login",
      num: "0001",
      slug: "f1-email-signup",
    });
    registerMapping(dir, { key: "identity/login", feature: "Login", adr });
    const r = lint(dir);
    assert.ok(rules(r).includes("filename"), rules(r).join(","));
  });
});

test("e2e: authoring under an anti-pattern category (api) → harness flags it", () => {
  withTmp((dir) => {
    seedScaffold(dir);
    adrNew(dir, { category: "api", slug: "endpoints", title: "API", feature: "API" });
    const r = lint(dir);
    assert.equal(r.ok, false);
    // both the mapping key and the on-disk dir segment are flagged
    assert.ok(
      rules(r).some((x) => x.includes("anti-pattern")),
      rules(r).join(","),
    );
  });
});

test("e2e: one realistic alternative is sufficient for the structural gate", () => {
  withTmp((dir) => {
    seedScaffold(dir);
    const adr = authorAdr(dir, {
      category: "identity/login",
      slug: "password-policy",
      alternatives: ["중앙 인증: 계정 관리는 단순하지만 오프라인 로그인을 제공할 수 없다."],
    });
    registerMapping(dir, { key: "identity/login", feature: "Login", adr });
    const r = lint(dir);
    assert.equal(r.code, 0, JSON.stringify(r));
    assert.ok(!rules(r).includes("alternatives-count"), rules(r).join(","));
  });
});

// ── dependency-aware creation + /adr-impl promotion ───────────────────────

test("e2e: two ADRs with a dependsOn edge author clean, then /adr-impl promotes Proposed→Accepted", () => {
  withTmp((dir) => {
    seedScaffold(dir);
    // prerequisite first (topological order — the queue /feature-to-adr builds)
    const login = adrNew(dir, {
      category: "identity/login",
      slug: "password-policy",
      title: "비밀번호 정책",
      feature: "Login",
    });
    // dependent references the prerequisite via dependsOn AND a Related link
    const checkout = adrNew(dir, {
      category: "ordering/checkout",
      slug: "checkout-flow",
      title: "체크아웃",
      feature: "Checkout",
      dependsOn: ["identity/login"],
      related: [{ label: "login", href: "../../identity/login/0001-password-policy.md" }],
    });
    // authored state is clean and both are Proposed
    assert.equal(lint(dir).ok, true, JSON.stringify(lint(dir).errors));
    assert.match(readFileSync(path.join(dir, checkout), "utf8"), /\nProposed\b/);

    // /adr-impl implements the prerequisite first, tests pass → auto-promote
    promote(dir, login);
    let body = readFileSync(path.join(dir, login), "utf8");
    assert.match(body, /##\s+Status\s*\n\s*\nAccepted \(\d{4}-\d{2}-\d{2}\)/);
    // harness still clean and the promoted Status is a valid enum form
    assert.equal(lint(dir).ok, true);

    // then the dependent
    promote(dir, checkout);
    assert.equal(lint(dir).ok, true);
  });
});

test("e2e: dependsOn pointing at a non-existent category → harness flags dangling", () => {
  withTmp((dir) => {
    seedScaffold(dir);
    const adr = authorAdr(dir, { category: "ordering/checkout", slug: "checkout-flow" });
    // depend on a category that was never created
    registerMapping(dir, {
      key: "ordering/checkout",
      feature: "Checkout",
      adr,
      dependsOn: ["identity/login"],
    });
    const r = lint(dir);
    assert.equal(r.ok, false);
    assert.ok(rules(r).includes("map-dependson-dangling"), rules(r).join(","));
  });
});

// ── the created mapping stays on demand instead of entering session context ───

test("e2e: after /adr-new the hook points to the mapping without injecting its contents", () => {
  withTmp((dir) => {
    seedScaffold(dir);
    adrNew(dir, {
      category: "identity/login",
      slug: "password-policy",
      feature: "Login",
      dependsOn: [],
    });
    const mapping = JSON.parse(readFileSync(path.join(dir, "docs/adr/.mapping.json"), "utf8"));
    assert.equal(mapping.categories["identity/login"].adrs[0].status, "Proposed");

    const ctx = runHook(dir);
    assert.match(ctx, /before code read the full docs\/adr\/\.mapping\.json/);
    assert.doesNotMatch(ctx, /identity\/login/);
    assert.doesNotMatch(ctx, /password-policy/);
  });
});

// ── full run (structure + adr-invariants reverse-ref oracle) stays clean ──

test("e2e: a correctly authored ADR set passes the FULL run (structure + invariants)", () => {
  withTmp((dir) => {
    initRepo(dir); // adr-invariants scans a real tree; a git repo mirrors reality
    seedScaffold(dir);
    adrNew(dir, {
      category: "identity/login",
      slug: "password-policy",
      title: "비밀번호 정책",
      feature: "Login",
    });
    const r = lintFull(dir);
    assert.equal(r.ok, true, JSON.stringify(r.errors, null, 2));
  });
});
