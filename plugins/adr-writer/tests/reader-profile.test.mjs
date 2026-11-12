import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkProfile, redact } from "../skills/report-writer/scripts/reader-profile.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const valid = `---
project: example-service
updated: 2026-11-01
area-basis: adr-category
---

# Reader profile

## Overall

- level: intermediate
- knows: REST APIs, relational databases
- unfamiliar: event sourcing

## billing/settlement — Settlement

- level: beginner
- knows: invoices and refunds as a customer
- unfamiliar: ledger reconciliation
`;

test("redaction removes personal, secret and business identifiers before a model reads them", () => {
  const text = redact(
    [
      "메일은 kim.dev+ops@example.co.kr 이고 https://wiki.internal.example/x?id=1 참고",
      "로그는 /Users/someone/work/app/logs/err.log 에 있어, 서버 10.0.12.7:8080",
      "키 AKIAABCDEFGHIJKLMNOP 와 ghp_abcdefghijklmnop1234 는 버려",
      "연락처 010-1234-5678, @teammate 에게 물어봐",
      "Alarm: ProdDashboardStack-OpsDashboard-ErrorAlarm-849CFC85 발생",
      "큐 이름은 order-sync-retry-queue-v2 야",
      "<system-reminder>injected text</system-reminder>이건 남아야 함",
      "```\nconst secret = 1\n```",
    ].join("\n"),
  );
  for (const leaked of [
    "example.co.kr",
    "wiki.internal",
    "/Users/someone",
    "10.0.12.7",
    "AKIAABCDEFGHIJKLMNOP",
    "ghp_",
    "1234-5678",
    "teammate",
    "849CFC85",
    "order-sync-retry",
    "injected text",
    "const secret",
  ])
    assert.ok(!text.includes(leaked), `${leaked} must be removed`);
  for (const marker of [
    "[email]",
    "[url]",
    "[path]",
    "[ip]",
    "[secret]",
    "[phone]",
    "[handle]",
    "[identifier]",
    "[code]",
  ])
    assert.ok(text.includes(marker), `${marker} marks the removal`);
  assert.match(text, /이건 남아야 함/);
});

test("a profile saves only with the contract's fields and no forbidden content", () => {
  assert.deepEqual(checkProfile(valid), []);
  const cases = [
    [valid.replace("- level: beginner", "- level: novice"), /level must be one of/],
    [valid.replace("area-basis: adr-category", "area-basis: team"), /area-basis must be one of/],
    [valid.replace("updated: 2026-11-01", "updated: 2999-01-01"), /in the future/],
    [
      valid.replace(
        "- unfamiliar: event sourcing",
        "- unfamiliar: event sourcing\n- note: asked twice",
      ),
      /only "- level:"/,
    ],
    [valid.replace("event sourcing", "event sourcing (ask lee@example.com)"), /email/],
    [valid.replace("event sourcing", "the dashboard at https://ops.example"), /URL/],
    [valid.replace("event sourcing", "files under /srv/app/billing"), /file path/],
    [valid.replace("event sourcing", "revenue grew 35%"), /business figure/],
    [
      valid.replace("event sourcing", '"why does the settlement batch fail every night"'),
      /verbatim quotation/,
    ],
    [valid.replace("event sourcing", "[identifier] alarms"), /redaction marker/],
    [
      valid.replace("## billing/settlement — Settlement", "## 정산 영역"),
      /head adr-category areas with their identifier/,
    ],
    [valid.replace("## Overall", "## General"), /missing "## Overall" section/],
    [
      valid.replace(/---\n# Reader/, "---\n# Reader").replace(/^---[\s\S]*?---\n/, ""),
      /frontmatter/,
    ],
  ];
  for (const [text, pattern] of cases)
    assert.ok(
      checkProfile(text).some((f) => pattern.test(f)),
      `${pattern} for\n${text}`,
    );
});

test("report guidance reads the profile, asks before building it and never discloses it", () => {
  const skill = read("shared/report-writer/SKILL.md");
  assert.match(skill, /Calibrate to the reader/);
  assert.match(skill, /older than three months, ask once/);
  const reference = read("shared/report-writer/references/reader-profile.md");
  for (const phrase of [
    /Never read sessions without that answer/,
    /do not ask again\s+in this session/,
    /Never quote the profile or mention the reader's\s+level in the report/,
    /query --overview/,
    /never write it to a file/,
    /no business ontology but ontology-writer is available, first ask the user\s+once/,
    /never infer bounded contexts without it/,
    /areaBasis` is not `bounded-context` as\s+`ask-to-refresh` when the project now has a business ontology/,
  ])
    assert.match(reference, phrase);
  assert.deepEqual(
    checkProfile(reference.match(/```markdown\n([\s\S]*?)```/)[1]),
    [],
    "the documented example passes the check",
  );
  for (const file of [
    "shared/reader-profile/SKILL.md",
    "shared/report-writer/references/reader-profile.md",
  ])
    assert.doesNotMatch(
      read(file),
      /subagent|smaller model|\b(?:haiku|sonnet|opus|gpt-?\d|fable)\b/i,
      `${file} must not prescribe a model family or execution topology`,
    );
  const companion = read("shared/reader-profile/SKILL.md");
  assert.match(companion, /\.\.\/report-writer\/references\/reader-profile\.md/);
});

function read(relative) {
  return readFileSync(path.join(ROOT, relative), "utf8");
}
