// lifecycle.integration.test.mjs — the FULL run (structure + invariants) over an ADR
// set authored the way /adr-new and /adr-impl author one.
//
// Like lifecycle.test.mjs, it reproduces their DETERMINISTIC contract via
// authoring.mjs. The full run also starts adr-invariants.sh, which reads the
// scope from git, so this test needs bash and git. The load-bearing tests (skip
// one authoring step → harness goes red) are in lifecycle.test.mjs.
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
