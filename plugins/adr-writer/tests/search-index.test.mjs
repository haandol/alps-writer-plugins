import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  parseSearchQuery,
  prepareSearchUnit,
  rankSearchUnits,
  SearchInputError,
} from "../scripts/search/search-text.mjs";
import { searchCachePath, searchWithSqlite } from "../scripts/search/search-index.mjs";

const records = [
  {
    id: "a",
    title: "Parcel handling",
    fields: [{ name: "body", value: "Quarantine the parcel marker." }],
  },
  {
    id: "b",
    title: "결제 처리",
    fields: [{ name: "body", value: "결제가 완료되면 주문을 확정한다." }],
  },
  { id: "c", title: "Other work", fields: [{ name: "body", value: "A parcel is inspected." }] },
];
const memory = (data, query) =>
  rankSearchUnits(data.map(prepareSearchUnit), parseSearchQuery(query));

test("all words match in any order while quoted phrases retain adjacency", () => {
  assert.deepEqual(
    memory(records, "parcel quarantine").map((h) => h.id),
    ["a"],
  );
  assert.deepEqual(
    memory(records, "quarantine parcel").map((h) => h.id),
    ["a"],
  );
  assert.deepEqual(memory(records, '"quarantine parcel"'), []);
  assert.deepEqual(
    memory(records, '"quarantine the parcel"').map((h) => h.id),
    ["a"],
  );
});

test("short Korean, particles and compatibility forms remain searchable", () => {
  assert.deepEqual(
    memory(records, "확정 결제").map((h) => h.id),
    ["b"],
  );
  assert.deepEqual(
    memory(records, "결").map((h) => h.id),
    ["b"],
  );
  assert.deepEqual(
    memory(records, "ＱＵＡＲＡＮＴＩＮＥ").map((h) => h.id),
    ["a"],
  );
});

test("direct identifiers and titles precede incidental body matches with stable ties", () => {
  const data = [
    { id: "z", title: "Other", fields: [{ name: "body", value: "parcel ".repeat(40) }] },
    { id: "a", title: "Parcel", fields: [] },
    { id: "parcel", title: "Identifier owner", fields: [] },
  ];
  assert.deepEqual(
    memory(data, "parcel").map((h) => h.id),
    ["parcel", "a", "z"],
  );
  assert.deepEqual(memory([...data].reverse(), "parcel"), memory(data, "parcel"));
});

test("query syntax is literal and invalid phrases fail before searching", () => {
  assert.deepEqual(parseSearchQuery('foo OR "bar baz"'), ["foo", "or", "bar baz"]);
  assert.throws(() => parseSearchQuery('"missing'), SearchInputError);
  assert.throws(() => parseSearchQuery('""'), SearchInputError);
  assert.throws(() => parseSearchQuery("a\0b"), SearchInputError);
});

test("SQLite and memory agree for phrases, punctuation, Korean and empty queries", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "writer-search-"));
  try {
    const options = { root: dir, namespace: "terms", cacheDir: path.join(dir, "cache") };
    const data = [
      ...records,
      {
        id: "punct",
        title: "A+b",
        fields: [{ name: "body", value: 'literal "foo" and 100% match.' }],
      },
    ];
    for (const query of [
      "parcel quarantine",
      '"quarantine parcel"',
      "확정 결제",
      "결",
      "A+b",
      '"\\"foo\\""',
      "100%",
      "missing",
      "",
    ]) {
      assert.deepEqual(await searchWithSqlite(data, query, options), memory(data, query), query);
    }
    assert.equal(
      readFileSync(searchCachePath(options)).subarray(0, 15).toString(),
      "SQLite format 3",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("editing, deleting and rebuilding a cache preserve current matches and evidence", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "writer-search-"));
  try {
    const options = { root: dir, namespace: "freshness", cacheDir: path.join(dir, "cache") };
    await searchWithSqlite(records, "quarantine", options);
    const changed = [
      {
        id: "new-path",
        title: "Parcel",
        source: { doc: "moved.md", line: 5 },
        fields: [
          {
            name: "body",
            value: "Quarantine a parcel safely.",
            source: { doc: "moved.md", line: 12 },
          },
        ],
      },
    ];
    const expected = memory(changed, "quarantine parcel");
    assert.deepEqual(await searchWithSqlite(changed, "quarantine parcel", options), expected);
    rmSync(options.cacheDir, { recursive: true, force: true });
    assert.deepEqual(await searchWithSqlite(changed, "quarantine parcel", options), expected);
    assert.equal(expected[0].matches.find((m) => m.field === "body").source.line, 12);
    assert.deepEqual(await searchWithSqlite([], "quarantine", options), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unwritable and corrupt cache locations fall back to the same in-memory SQLite search", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "writer-search-"));
  try {
    const options = { root: dir, namespace: "fallback", cacheDir: path.join(dir, "cache") };
    const expected = memory(records, "parcel");
    await searchWithSqlite(records, "parcel", options);
    writeFileSync(searchCachePath(options), "not a database");
    let observed = 0;
    assert.deepEqual(
      await searchWithSqlite(records, "parcel", {
        ...options,
        onCacheUnavailable: () => observed++,
      }),
      expected,
    );
    assert.equal(observed, 1);
    const blocked = path.join(dir, "not-a-directory");
    writeFileSync(blocked, "preserve");
    assert.deepEqual(
      await searchWithSqlite(records, "parcel", { ...options, cacheDir: blocked }),
      expected,
    );
    assert.equal(readFileSync(blocked, "utf8"), "preserve");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a damaged posting index cannot turn a current source match into a false miss", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "writer-search-"));
  try {
    const options = { root: dir, namespace: "postings", cacheDir: path.join(dir, "cache") };
    await searchWithSqlite(records, "quarantine", options);
    const db = new DatabaseSync(searchCachePath(options));
    db.exec("INSERT INTO search_fts(search_fts) VALUES('delete-all')");
    db.close();
    let fallback = 0;
    assert.deepEqual(
      await searchWithSqlite(records, "quarantine", {
        ...options,
        onCacheUnavailable: () => fallback++,
      }),
      memory(records, "quarantine"),
    );
    assert.equal(fallback, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("candidate indexing preserves matches after embedded NUL without inventing replacement-character matches", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "writer-search-"));
  try {
    const options = { root: dir, namespace: "nul", cacheDir: path.join(dir, "cache") };
    const data = [
      {
        id: "text",
        title: "Raw fact",
        fields: [{ name: "body", value: "before\0quarantine marker" }],
      },
    ];
    for (const query of ["quarantine", "marker", "\uFFFD"])
      assert.deepEqual(await searchWithSqlite(data, query, options), memory(data, query));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
