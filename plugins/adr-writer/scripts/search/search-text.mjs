// Query semantics and ranking shared by the command line and saved-model view.
// This module has no I/O so the browser can search the same authored facts.

export class SearchInputError extends Error {}

/** Compatibility forms, case and whitespace do not change a text search. */
export function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

/** Quoted phrases stay together; all unquoted terms are required, in any order. */
export function parseSearchQuery(value) {
  if (typeof value !== "string" || value.includes("\0"))
    throw new SearchInputError("search must be text without NUL characters");
  const terms = [];
  let token = "",
    quoted = false;
  const append = (required = false) => {
    const text = normalizeSearchText(token);
    if (required && !text) throw new SearchInputError("a quoted search phrase must not be empty");
    if (text && !terms.includes(text)) terms.push(text);
    token = "";
  };
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === "\\" && (value[i + 1] === '"' || value[i + 1] === "\\")) {
      token += value[++i];
    } else if (c === '"') {
      if (quoted) {
        append(true);
        quoted = false;
      } else {
        append();
        quoted = true;
      }
    } else if (/\s/u.test(c) && !quoted) append();
    else token += c;
  }
  if (quoted) throw new SearchInputError("search has an unclosed quoted phrase");
  append();
  return terms;
}

const FIELD_WEIGHT = { identifier: 8, title: 5, heading: 3, summary: 2 };
const lexical = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Normalize one read-only search unit without changing its original evidence. */
export function prepareSearchUnit(unit) {
  if (!unit || typeof unit.id !== "string" || !unit.id)
    throw new TypeError("a search unit requires a stable id");
  const fields = [
    { name: "identifier", value: unit.identifier ?? unit.id, source: unit.source },
    { name: "title", value: unit.title ?? "", source: unit.titleSource ?? unit.source },
    ...(unit.fields ?? []),
  ]
    .map((field) => {
      if (typeof field.value !== "string") throw new TypeError("searchable fields must be text");
      return {
        ...field,
        text: normalizeSearchText(field.value),
        weight: FIELD_WEIGHT[field.name] ?? 1,
      };
    })
    .filter((field) => field.text);
  return {
    id: unit.id,
    fields,
    identifier: normalizeSearchText(unit.identifier ?? unit.id),
    title: normalizeSearchText(unit.title ?? ""),
    titles: fields.filter((field) => field.name === "title").map((field) => field.text),
    length: Math.max(
      1,
      fields.reduce((n, field) => n + (field.text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0), 0),
    ),
  };
}

export function searchTermMatches(unit, term) {
  return unit.fields.some((field) => field.text.includes(term));
}

function frequency(text, term) {
  let count = 0,
    at = 0;
  while ((at = text.indexOf(term, at)) >= 0) {
    count++;
    at += term.length;
  }
  return count;
}

/**
 * Rank a fixed corpus of prepared units with BM25 term statistics and explicit
 * identifier/title precedence. Matching is computed from the current units on
 * every call; no index or cache exists, so nothing can fall out of date.
 */
export function rankSearchUnits(units, terms) {
  if (!terms.length) return [];
  const matching = terms.map(
    (term) => new Set(units.filter((unit) => searchTermMatches(unit, term)).map((unit) => unit.id)),
  );
  const averageLength = units.reduce((n, unit) => n + unit.length, 0) / Math.max(1, units.length);
  const query = terms.join(" ");
  const results = [];
  for (const unit of units) {
    if (!matching.every((set) => set.has(unit.id))) continue;
    let score = 0;
    for (const [i, term] of terms.entries()) {
      const tf = unit.fields.reduce(
        (n, field) => n + field.weight * frequency(field.text, term),
        0,
      );
      const idf = Math.log(1 + (units.length - matching[i].size + 0.5) / (matching[i].size + 0.5));
      score += (idf * tf * 2.2) / (tf + 1.2 * (0.25 + (0.75 * unit.length) / averageLength));
    }
    const tier =
      unit.identifier === query
        ? 3
        : unit.titles.some((title) => title === query)
          ? 2
          : unit.titles.some((title) => terms.every((term) => title.includes(term)))
            ? 1
            : 0;
    results.push({
      id: unit.id,
      score,
      tier,
      kind: tier === 3 ? "identifier" : tier > 0 ? "title" : "text",
      matches: unit.fields.flatMap((field) => {
        const matched = terms.filter((term) => field.text.includes(term));
        return matched.length
          ? [
              {
                field: field.name,
                terms: matched,
                ...(field.source ? { source: field.source } : {}),
              },
            ]
          : [];
      }),
    });
  }
  return results.sort(compareSearchHits);
}

/** Search raw source units read from the current files. */
export function searchUnits(rawUnits, query) {
  const terms = parseSearchQuery(query);
  const units = rawUnits.map(prepareSearchUnit);
  if (new Set(units.map((unit) => unit.id)).size !== units.length)
    throw new TypeError("search unit ids must be unique");
  return rankSearchUnits(units, terms);
}

/** Keep direct matches ahead of incidental text; ties use stable identifiers. */
export function compareSearchHits(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.tier - a.tier || b.score - a.score || lexical(a.id, b.id);
}
