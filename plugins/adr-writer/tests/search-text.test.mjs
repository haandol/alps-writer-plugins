import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseSearchQuery,
  prepareSearchUnit,
  rankSearchUnits,
  SearchInputError,
  searchUnits,
} from "../scripts/search/search-text.mjs";

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

test("searchUnits matches phrases, punctuation, Korean and empty queries like the ranking it wraps", () => {
  const data = [
    ...records,
    {
      id: "punct",
      title: "A+b",
      fields: [{ name: "body", value: 'literal "foo" and 100% match.' }],
    },
    {
      id: "nul",
      title: "Raw fact",
      fields: [{ name: "body", value: "before\0quarantine marker" }],
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
    "marker",
    "missing",
    "",
  ])
    assert.deepEqual(searchUnits(data, query), memory(data, query), query);
  assert.throws(() => searchUnits([records[0], records[0]], "parcel"), TypeError);
});

test("every search reads the units it is given, so edits, moves and deletions show at once", () => {
  assert.deepEqual(
    searchUnits(records, "quarantine").map((h) => h.id),
    ["a"],
  );
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
  const hits = searchUnits(changed, "quarantine parcel");
  assert.deepEqual(
    hits.map((h) => h.id),
    ["new-path"],
  );
  assert.equal(hits[0].matches.find((m) => m.field === "body").source.line, 12);
  assert.deepEqual(searchUnits([], "quarantine"), []);
});
