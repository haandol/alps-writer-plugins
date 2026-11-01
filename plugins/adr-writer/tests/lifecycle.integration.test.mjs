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
import { withTmp, initRepo, parseLint } from "./helpers.mjs";
import { seedScaffold, adrNew } from "./authoring.mjs";

const lintFull = (dir, args = []) => parseLint(dir, args, { full: true });

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
