// Tests for scripts/adr-invariants.sh — the PRD→ADR→code one-way oracle.
// Focus: the two reverse-reference checks and the A2 regression (canonical
// two-segment refs must be caught, not just flat one-segment ones).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { withTmp, write, initRepo, runInvariants, seedRuleDocs, TEMPLATES } from "./helpers.mjs";

// A minimal but realistic canonical fixture: DDD context × feature folders,
// canonical NNNN-title.md filenames (no fN prefix), seeded rule docs.
function seedCanonicalRepo(dir) {
  initRepo(dir);
  // seeded rule docs legitimately mention ALPS — check (b) must not flag them
  seedRuleDocs(dir);
  write(
    dir,
    "docs/adr/identity/login/0001-password-policy.md",
    "# 0001. 비밀번호 정책\n\n## Status\nAccepted (2026-07-02)\n\n## Decision\nbcrypt.\n",
  );
  write(
    dir,
    "docs/adr/infra/0001-deploy-topology.md",
    "# 0001. 배포\n\n## Status\nAccepted (2026-07-02)\n\n## Decision\n단일 리전.\n",
  );
  write(dir, "docs/adr/.mapping.json", JSON.stringify({ categories: {} }));
  write(dir, "src/features/login/index.ts", 'export const login = () => "ok";\n');
}

test("clean canonical repo passes all invariants (exit 0)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    const { code, stdout } = runInvariants(dir);
    assert.equal(code, 0, stdout);
    assert.match(stdout, /invariants clean/);
  });
});

test("A2 regression: canonical TWO-segment code→ADR ref is caught", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // This is the form the plugin emits today; the old regex missed it.
    fs.appendFileSync(
      path.join(dir, "src/features/login/index.ts"),
      "// see ADR identity/login/0001 for rationale\n",
    );
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1, "two-segment ref must be flagged");
    assert.match(stdout, /identity\/login\/0001/);
  });
});

test("flat ONE-segment code→ADR ref is still caught", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "src/features/login/index.ts"),
      'const r = "ADR infra/0001";\n',
    );
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /infra\/0001/);
  });
});

test("ADR_REF token in code is caught", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "src/features/login/index.ts"),
      'const ADR_REF = "identity/login/0001";\n',
    );
    const { code } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1);
  });
});

test("seeded rule docs' ALPS mentions do NOT trip check (b)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // (b) scopes to NNNN-*.md only, so README/structure ALPS text is exempt.
    const { code, stdout } = runInvariants(dir, ["--prd-only"]);
    assert.equal(code, 0, stdout);
  });
});

test("PRD reference inside an ADR body trips check (b)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/identity/login/0001-password-policy.md"),
      "\n관련 PRD: prd/shop.alps.xml Section 6.3\n",
    );
    const { code, stdout } = runInvariants(dir, ["--prd-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /alps\.xml|Section 6\.3/);
  });
});

test("ADR↔ADR Related links under docs/adr/ are NOT flagged as code refs", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // A legit Related link from one ADR to another lives under docs/adr/ and
    // must be excluded by the post-filter, not reported as a code→ADR ref.
    fs.appendFileSync(
      path.join(dir, "docs/adr/infra/0001-deploy-topology.md"),
      "\n## Related\n- docs/adr/identity/login/0001-password-policy.md\n",
    );
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 0, stdout);
  });
});

test("malformed --renumbered pair is a usage error (exit 2), not a violation", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    const { code } = runInvariants(dir, ["--renumbered", "bad-no-colon"]);
    assert.equal(code, 2);
  });
});

// ── defect regressions (fixes verified against the reported findings) ─────

test("FIX inv-a-relpath-fn: a genuine code→ADR ref whose CONTENT contains a slash before docs/adr/ is NOT swallowed", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // The old whole-line post-filter dropped this because the content matched
    // "(^|/)docs/adr/"; the path-anchored filter now keeps it (file is under src/).
    fs.appendFileSync(
      path.join(dir, "src/features/login/index.ts"),
      "// see ../docs/adr/identity/login/0001-password-policy.md for rationale\n",
    );
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1, "genuine ref must be flagged, not swallowed");
    assert.match(stdout, /index\.ts/);
  });
});

test("FIX inv-cd-substring-fp: removing auth/0002 does NOT false-positive on oauth/0002-token.md", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    write(
      dir,
      "docs/adr/oauth/0002-token.md",
      "# 0002. token\n\n## Status\nProposed\n\n## Related\n- [self](./0002-token.md)\n",
    );
    // 'auth/0002' is a suffix of 'oauth/0002' — must not match after the fix.
    const { code, stdout } = runInvariants(dir, ["--removed", "auth/0002"]);
    assert.equal(code, 0, stdout);
    assert.doesNotMatch(stdout, /oauth\/0002-token/);
  });
});

test("FIX inv-grep-error-silent-pass: a grep that errors (exit 2) fails CLOSED, not clean", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // Stub grep that always errors. The script must surface exit 2, not report
    // "clean" (exit 0). PATH is prepended so the stub shadows the real grep.
    const stub = path.join(dir, "stub");
    fs.mkdirSync(stub, { recursive: true });
    fs.writeFileSync(path.join(stub, "grep"), "#!/usr/bin/env bash\nexit 2\n");
    fs.chmodSync(path.join(stub, "grep"), 0o755);
    const { code, stdout } = runInvariants(dir, ["--code-only"], {
      PATH: `${stub}:${process.env.PATH}`,
    });
    assert.equal(code, 2, "must fail closed on grep error");
    assert.match(stdout, /failing closed|grep failed/i);
  });
});

for (const args of [
  ["--rollup-only", "--removed", "auth/0002"],
  ["--rollup-only", "--renumbered", "auth/0003:auth/0002"],
]) {
  test(`rollup ${args[1]} fails when the real file search errors after a successful probe`, () => {
    withTmp((dir) => {
      seedCanonicalRepo(dir);
      const stub = path.join(dir, "stub");
      fs.mkdirSync(stub);
      fs.writeFileSync(
        path.join(stub, "grep"),
        '#!/bin/sh\nif [ "$1" = "-nE" ]; then exit 1; fi\nprintf "src/policy.mjs:1:partial match\\n"\nexit 2\n',
        { mode: 0o755 },
      );
      const { code, stdout } = runInvariants(dir, args, {
        PATH: `${stub}:${process.env.PATH}`,
      });
      assert.equal(code, 2, "partial results cannot hide a failed file search");
      assert.doesNotMatch(stdout, /invariants clean/);
    });
  });
  test(`rollup ${args[1]} propagates a search failure without reporting clean`, () => {
    withTmp((dir) => {
      seedCanonicalRepo(dir);
      const stub = path.join(dir, "stub");
      fs.mkdirSync(stub);
      fs.writeFileSync(path.join(stub, "grep"), "#!/bin/sh\nexit 2\n", { mode: 0o755 });
      const { code, stdout } = runInvariants(dir, args, {
        PATH: `${stub}:${process.env.PATH}`,
      });
      assert.equal(code, 2, "an unperformed search cannot establish clean references");
      assert.doesNotMatch(stdout, /invariants clean/);
    });
  });
}

test("FIX inv-b-section-overmatch: a non-ALPS 'Section N.N' (RFC) in an ADR body does NOT trip check (b)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/identity/login/0001-password-policy.md"),
      "\nPer HTTP RFC 7231 Section 6.5 the 4xx codes apply.\n",
    );
    const { code, stdout } = runInvariants(dir, ["--prd-only"]);
    assert.equal(code, 0, stdout);
  });
});

test("check (b) still catches an ALPS-qualified section citation", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/identity/login/0001-password-policy.md"),
      "\n관련 ALPS Section 7 참조\n",
    );
    const { code, stdout } = runInvariants(dir, ["--prd-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /ALPS Section/);
  });
});

test("check (b) catches a feature-id (F-LOGIN-01) in an ADR body", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/identity/login/0001-password-policy.md"),
      "\nrelated feature F-LOGIN-01\n",
    );
    const { code, stdout } = runInvariants(dir, ["--prd-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /F-LOGIN-01/);
  });
});

// ── rollup checks (c)/(d) happy paths ─────────────────────────────────────

test("a tracked source removed from the working tree does not make reference scanning fail", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // A rollup may remove a tracked file before the user stages the changes.
    const source = "docs/adr/identity/login/0001-password-policy.md";
    assert.equal(spawnSync("git", ["add", source], { cwd: dir }).status, 0);
    fs.unlinkSync(path.join(dir, source));
    const { code, stdout } = runInvariants(dir, ["--rollup-only", "--removed", "auth/0002"]);
    assert.equal(code, 0, stdout);
  });
});

test("check (c) --removed flags a kebab-title link to a removed ADR", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/infra/0001-deploy-topology.md"),
      "\n## Related\n- [old](./identity/login/0002-old.md)\n",
    );
    const { code, stdout } = runInvariants(dir, ["--removed", "identity/login/0002"]);
    assert.equal(code, 1);
    assert.match(stdout, /✗ \(c\)/);
    assert.match(stdout, /0002-old\.md/);
  });
});

test("check (d) --renumbered flags the old id and names the new number", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    fs.appendFileSync(
      path.join(dir, "docs/adr/infra/0001-deploy-topology.md"),
      "\n관련: ADR identity/login/0004\n",
    );
    const { code, stdout } = runInvariants(dir, [
      "--renumbered",
      "identity/login/0004:identity/login/0002",
    ]);
    assert.equal(code, 1);
    assert.match(stdout, /✗ \(d\)/);
    assert.match(stdout, /0002/); // repoints to the NEW number
  });
});

test("--removed/--renumbered disable checks (a)/(b) so unrelated tree hits aren't misattributed", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // A genuine code→ADR ref exists (would make --code-only exit 1)…
    fs.appendFileSync(
      path.join(dir, "src/features/login/index.ts"),
      '\nconst r = "ADR infra/0001";\n',
    );
    assert.equal(runInvariants(dir, ["--code-only"]).code, 1, "sanity: (a) fires alone");
    // …but under --removed for an id nothing cites, (a) is disabled → exit 0.
    const { code } = runInvariants(dir, ["--removed", "identity/login/9999"]);
    assert.equal(code, 0, "(a) must be disabled under --removed");
  });
});

// ── env / arg-parse coverage ──────────────────────────────────────────────

test("custom --adr-dir with a trailing slash is honored and normalized", () => {
  withTmp((dir) => {
    initRepo(dir);
    for (const f of ["README.md", "structure.md", "authoring-rules.md"])
      fs.copyFileSync(path.join(TEMPLATES, f), write(dir, `architecture/${f}`, ""));
    write(dir, "architecture/identity/login/0001-x.md", "# 0001\n\n## Status\nProposed\n");
    write(dir, "src/x.ts", "// see ADR identity/login/0001 here\n");
    const { code, stdout } = runInvariants(dir, ["--adr-dir", "architecture/", "--code-only"]);
    assert.equal(code, 1, stdout); // trailing slash normalized, custom root honored
    assert.match(stdout, /identity\/login\/0001/);
  });
});

// ── scan scope: authored files only ───────────────────────────────────────
// A repo-indexing build cache (Nx, Turbo) stores the ADR file list verbatim, so
// scanning it reports every ADR path in the repo as a code→ADR violation and the
// real hits drown in noise. In a git repo the scope comes from git, so
// .gitignore — the repo's own "generated vs authored" declaration — decides.

// The generated dirs a real consumer repo ignores. .gitignore is what makes them
// out of scope, so the fixture must declare them the way a real repo does.
const GENERATED_DIRS = [
  ".nx/workspace-data",
  ".turbo",
  "cdk.out",
  ".venv/lib/site-packages",
  "__pycache__",
  ".pytest_cache",
  "coverage",
  ".output",
  "target",
  "node_modules/pkg",
];

for (const genDir of GENERATED_DIRS) {
  test(`gitignored tree '${genDir}' is out of scope for the code→ADR scan`, () => {
    withTmp((dir) => {
      seedCanonicalRepo(dir);
      write(dir, ".gitignore", GENERATED_DIRS.map((d) => `${d.split("/")[0]}/`).join("\n") + "\n");
      // The shape a build cache actually stores: the repo's own file list.
      write(dir, `${genDir}/file-map.json`, '{"file":"docs/adr/infra/0001-deploy-topology.md"}\n');
      const { code, stdout } = runInvariants(dir, ["--code-only"]);
      assert.equal(code, 0, stdout);
      assert.doesNotMatch(stdout, /file-map\.json/);
    });
  });
}

test("narrowing the scan does NOT weaken (a) for authored files", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    write(dir, ".gitignore", ".nx/\n");
    // A cache hit is out of scope…
    write(dir, ".nx/workspace-data/file-map.json", '{"file":"docs/adr/infra/0001-x.md"}\n');
    // …but a real ref in authored code is still caught in the same run.
    write(dir, "src/features/login/notes.ts", '\nconst r = "ADR infra/0001";\n');
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1, "authored ref must still fire");
    assert.match(stdout, /notes\.ts/);
    assert.doesNotMatch(stdout, /file-map\.json/);
  });
});

test("an UNTRACKED but non-ignored new file is in scope (checked before staging)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // --others: a file the user just wrote is checked before `git add`, or the
    // gate would pass on exactly the change under review.
    write(dir, "src/features/login/fresh.ts", '\nconst x = "ADR infra/0001";\n');
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /fresh\.ts/);
  });
});

test("a hand-authored doc outside docs/adr/ citing an ADR is still flagged", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // Human-written docs are NOT generated output — a stale citation here is a
    // real finding after a rollup renumbers, so scope narrowing must not cover it.
    write(dir, "docs/architecture-review.md", "판정 근거는 ADR infra/0001 을 따른다.\n");
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /architecture-review\.md/);
  });
});

test("a repository code-ignore file suppresses intentional prompt examples but not product source", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    write(dir, ".adr-invariants-code-ignore", "plugins/adr-writer/skills/\nREADME.md\n");
    write(
      dir,
      "plugins/adr-writer/skills/reviewer.md",
      "Example: docs/adr/identity/login/0001-x.md\n",
    );
    write(dir, "README.md", "Example: ADR identity/login/0001\n");
    write(dir, "plugins/adr-writer/hooks/real.mjs", 'const ref = "ADR infra/0001";\n');

    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1, stdout);
    assert.match(stdout, /hooks\/real\.mjs/);
    assert.doesNotMatch(stdout, /reviewer\.md|README\.md/);
  });
});

test("this self-hosting repository passes the exact code-reference oracle", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const { code, stdout } = runInvariants(repoRoot, ["--code-only"]);
  assert.equal(code, 0, stdout);
});

test("a real source dir merely NAMED like a cache is still scanned when not ignored", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // The git path keys off .gitignore, not basenames, so a source dir named
    // 'build/' stays in scope — the precision the basename fallback can't give.
    write(dir, "build/tooling/thing.ts", '\nconst x = "ADR infra/0001";\n');
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1, stdout);
    assert.match(stdout, /build\/tooling\/thing\.ts/);
  });
});

test("a path with spaces survives the authored-file listing", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    write(dir, "src/my notes/ref.ts", '\nconst x = "ADR infra/0001";\n');
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1, stdout);
    assert.match(stdout, /my notes\/ref\.ts/);
  });
});

test("rollup checks (c)/(d) use the same narrowed scope as (a)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    write(dir, ".gitignore", ".nx/\n");
    // A stale citation inside generated output is not actionable, so (c) must
    // not report it either — the two scan sites share one scope by construction.
    write(dir, ".nx/workspace-data/file-map.json", '{"f":"docs/adr/identity/login/0002-old.md"}\n');
    const { code, stdout } = runInvariants(dir, ["--removed", "identity/login/0002"]);
    assert.equal(code, 0, stdout);
    assert.doesNotMatch(stdout, /file-map\.json/);
  });
});

// ── fallback: no git available ────────────────────────────────────────────

test("outside a git repo, the basename EXCLUDES fallback still skips generated trees", () => {
  withTmp((dir) => {
    // Deliberately NOT initRepo: exercises the non-git path. Seed by hand since
    // seedCanonicalRepo git-inits.
    seedRuleDocs(dir);
    write(
      dir,
      "docs/adr/infra/0001-deploy-topology.md",
      "# 0001. 배포\n\n## Status\nAccepted (2026-07-02)\n\n## Decision\n단일 리전.\n",
    );
    write(dir, ".nx/workspace-data/file-map.json", '{"file":"docs/adr/infra/0001-x.md"}\n');
    write(dir, "src/x.ts", '\nconst r = "ADR infra/0001";\n');
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1, stdout);
    assert.match(stdout, /src\/x\.ts/, "authored ref must fire in the fallback too");
    assert.doesNotMatch(stdout, /file-map\.json/, ".nx must be pruned by basename");
  });
});

test("a code→ADR ref inside a src dir that shares the 'adr' basename is still scanned", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    // src/adr/ is NOT the ADR dir; its basename must not prune it from (a).
    write(dir, "src/adr/thing.ts", '\nconst x = "ADR infra/0001";\n');
    const { code, stdout } = runInvariants(dir, ["--code-only"]);
    assert.equal(code, 1);
    assert.match(stdout, /src\/adr\/thing\.ts/);
  });
});

test("empty --adr-dir value is a usage error (exit 2)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    assert.equal(runInvariants(dir, ["--adr-dir", ""]).code, 2);
  });
});

test("unknown flag is a usage error (exit 2)", () => {
  withTmp((dir) => {
    seedCanonicalRepo(dir);
    assert.equal(runInvariants(dir, ["--bogus"]).code, 2);
  });
});
