import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { initRepo, runStatusTransition, seedRuleDocs, withTmp, write } from "./helpers.mjs";

function seedRepo(dir) {
  initRepo(dir);
  seedRuleDocs(dir);
  write(
    dir,
    "docs/adr/analytics/0001-truth.md",
    "# ADR 0001: Truth\n\n## Status\n\nProposed\n\n## Context\n\nContext.\n",
  );
  write(
    dir,
    "docs/adr/voicechat/0003-call-mission.md",
    "# ADR 0003: Call mission\n\n## Status\n\nProposed\n\n## Context\n\nContext.\n",
  );
  write(
    dir,
    "docs/adr/.mapping.json",
    `${JSON.stringify(
      {
        categories: {
          analytics: {
            adrs: [
              {
                path: "docs/adr/analytics/0001-truth.md",
                status: "Proposed",
                summary: "analytics summary",
              },
            ],
          },
          voicechat: {
            adrs: [
              {
                path: "docs/adr/voicechat/0003-call-mission.md",
                status: "Proposed",
                summary: "old call summary",
              },
            ],
          },
        },
      },
      null,
      2,
    )}\n`,
  );
}

test("status transition changes only the mapping record with the exact ADR path", () => {
  withTmp((dir) => {
    seedRepo(dir);

    const result = runStatusTransition(dir, [
      "docs/adr/voicechat/0003-call-mission.md",
      "Accepted (2026-08-12)",
      "--summary",
      "new call summary",
    ]);

    assert.equal(result.code, 0, result.stdout);
    const mapping = JSON.parse(readFileSync(path.join(dir, "docs/adr/.mapping.json"), "utf8"));
    assert.equal(mapping.categories.analytics.adrs[0].status, "Proposed");
    assert.equal(mapping.categories.analytics.adrs[0].summary, "analytics summary");
    assert.equal(mapping.categories.voicechat.adrs[0].status, "Accepted (2026-08-12)");
    assert.equal(mapping.categories.voicechat.adrs[0].summary, "new call summary");
    assert.match(
      readFileSync(path.join(dir, "docs/adr/voicechat/0003-call-mission.md"), "utf8"),
      /## Status\n\nAccepted \(2026-08-12\)/,
    );
    assert.match(
      readFileSync(path.join(dir, "docs/adr/analytics/0001-truth.md"), "utf8"),
      /## Status\n\nProposed/,
    );
  });
});

test("status transition refuses a body and mapping mismatch without modifying either file", () => {
  withTmp((dir) => {
    seedRepo(dir);
    const mappingPath = path.join(dir, "docs/adr/.mapping.json");
    const mapping = JSON.parse(readFileSync(mappingPath, "utf8"));
    mapping.categories.voicechat.adrs[0].status = "Accepted (2026-08-11)";
    const beforeMapping = `${JSON.stringify(mapping, null, 2)}\n`;
    write(dir, "docs/adr/.mapping.json", beforeMapping);
    const adrPath = path.join(dir, "docs/adr/voicechat/0003-call-mission.md");
    const beforeAdr = readFileSync(adrPath, "utf8");

    const result = runStatusTransition(dir, [
      "docs/adr/voicechat/0003-call-mission.md",
      "Accepted (2026-08-12)",
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /refusing transition because body status/);
    assert.equal(readFileSync(mappingPath, "utf8"), beforeMapping);
    assert.equal(readFileSync(adrPath, "utf8"), beforeAdr);
  });
});

test("status transition refuses duplicate mapping paths instead of guessing", () => {
  withTmp((dir) => {
    seedRepo(dir);
    const mappingPath = path.join(dir, "docs/adr/.mapping.json");
    const mapping = JSON.parse(readFileSync(mappingPath, "utf8"));
    mapping.categories.duplicate = {
      adrs: [
        {
          path: "docs/adr/voicechat/0003-call-mission.md",
          status: "Proposed",
          summary: "duplicate",
        },
      ],
    };
    write(dir, "docs/adr/.mapping.json", `${JSON.stringify(mapping, null, 2)}\n`);
    const beforeMapping = readFileSync(mappingPath, "utf8");
    const adrPath = path.join(dir, "docs/adr/voicechat/0003-call-mission.md");
    const beforeAdr = readFileSync(adrPath, "utf8");

    const result = runStatusTransition(dir, [
      "docs/adr/voicechat/0003-call-mission.md",
      "Accepted (2026-08-12)",
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /expected exactly one .mapping.json record, found 2/);
    assert.equal(readFileSync(mappingPath, "utf8"), beforeMapping);
    assert.equal(readFileSync(adrPath, "utf8"), beforeAdr);
  });
});

test("status transition ignores Status headings inside fenced code blocks", () => {
  withTmp((dir) => {
    seedRepo(dir);
    write(
      dir,
      "docs/adr/voicechat/0003-call-mission.md",
      [
        "# ADR 0003: Call mission",
        "",
        "## Status",
        "",
        "Proposed",
        "",
        "## Context",
        "",
        "```markdown",
        "## Status",
        "Example only",
        "```",
        "",
      ].join("\n"),
    );

    const result = runStatusTransition(dir, [
      "docs/adr/voicechat/0003-call-mission.md",
      "Accepted (2026-08-12)",
    ]);

    assert.equal(result.code, 0, result.stdout);
    const body = readFileSync(path.join(dir, "docs/adr/voicechat/0003-call-mission.md"), "utf8");
    assert.match(body, /## Status\n\nAccepted \(2026-08-12\)/);
    assert.match(body, /```markdown\n## Status\nExample only\n```/);
  });
});

test("status transition rejects summaries that violate the mapping schema", () => {
  withTmp((dir) => {
    seedRepo(dir);
    const mappingPath = path.join(dir, "docs/adr/.mapping.json");
    const adrPath = path.join(dir, "docs/adr/voicechat/0003-call-mission.md");
    const beforeMapping = readFileSync(mappingPath, "utf8");
    const beforeAdr = readFileSync(adrPath, "utf8");

    for (const summary of ["two\nlines", "x".repeat(241)]) {
      const result = runStatusTransition(dir, [
        "docs/adr/voicechat/0003-call-mission.md",
        "Accepted (2026-08-12)",
        "--summary",
        summary,
      ]);

      assert.equal(result.code, 2);
      assert.match(result.stdout, /--summary must be one line and at most 240 characters/);
      assert.equal(readFileSync(mappingPath, "utf8"), beforeMapping);
      assert.equal(readFileSync(adrPath, "utf8"), beforeAdr);
    }
  });
});

test("status transition writes the Status value without stray spaces from its argument", () => {
  withTmp((dir) => {
    seedRepo(dir);
    const result = runStatusTransition(dir, [
      "docs/adr/analytics/0001-truth.md",
      " Accepted (2026-08-12) ",
    ]);
    assert.equal(result.code, 0, result.stdout);
    const mapping = JSON.parse(readFileSync(path.join(dir, "docs/adr/.mapping.json"), "utf8"));
    assert.equal(mapping.categories.analytics.adrs[0].status, "Accepted (2026-08-12)");
    assert.match(
      readFileSync(path.join(dir, "docs/adr/analytics/0001-truth.md"), "utf8"),
      /## Status\n\nAccepted \(2026-08-12\)\n/,
    );
  });
});
