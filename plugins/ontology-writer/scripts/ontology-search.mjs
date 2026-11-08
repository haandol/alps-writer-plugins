// Search only authored business fields. Graph membership and diagnostics remain
// the responsibility of navigation and validation.
import { ATTRIBUTES, RDFS, elementId, inRetiredOnly, isRetired } from "./ontology-lib.mjs";
import { searchUnits } from "./search/search-text.mjs";

const FIELDS = ATTRIBUTES.filter((field) => field.kind === "fact" && field.iri !== RDFS + "label");
const location = (triple) =>
  triple ? { path: triple.doc, lineStart: triple.line, lineEnd: triple.line } : undefined;

/** Same fields and original positions are used by CLI search and saved HTML. */
export function ontologySearchUnit(index, iri) {
  const node = index.subjects.get(iri);
  const labels = (node?.props.get(RDFS + "label") ?? []).filter((t) => t.o.type === "literal");
  const label = labels[0];
  return {
    id: iri,
    identifier: elementId(iri) ?? iri,
    title: label?.o.value ?? "",
    source: location(node?.first),
    titleSource: location(label),
    fields: [
      ...labels.slice(1).map((t) => ({ name: "title", value: t.o.value, source: location(t) })),
      ...FIELDS.filter((field) => field.on.includes(index.typeOf(iri))).flatMap((field) => {
        return (node?.props.get(field.iri) ?? [])
          .filter((t) => t.o.type === "literal")
          .map((t) => ({ name: field.key, value: t.o.value, source: location(t) }));
      }),
    ],
  };
}

export function ontologySearchUnits(index, { includeRetired = false } = {}) {
  return [...index.subjects.keys()]
    .filter(
      (iri) =>
        includeRetired ||
        !(index.typeOf(iri) === "Process" ? isRetired(index, iri) : inRetiredOnly(index, iri)),
    )
    .sort()
    .map((iri) => ontologySearchUnit(index, iri));
}

/** Rank the current graph's units on every call; there is no index to keep fresh. */
export function ontologySearch(index, search, options) {
  return new Map(
    searchUnits(ontologySearchUnits(index, options), search).map((hit) => [hit.id, hit]),
  );
}
