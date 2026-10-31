// process-model-lib.mjs — dependency-free support for the business process
// model level (docs/process/*.ttl): the closed vocabulary, a strict Turtle
// subset parser, the closed-world validator, canonical serialization and the
// semantic diff. Pure functions over strings and plain objects; the CLI and
// adr-structure-lint do the filesystem work, so tests exercise the same logic.
//
// The model is optional. Nothing here runs unless a repository holds at least
// one Turtle document in its model directory.

export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
export const XSD = "http://www.w3.org/2001/XMLSchema#";
export const OWL = "http://www.w3.org/2002/07/owl#";
export const PM = "urn:adr-writer:process:";
export const MODEL = "urn:adr-writer:model:";

const RDF_TYPE = `${RDF}type`;
const RDFS_LABEL = `${RDFS}label`;
const RDFS_COMMENT = `${RDFS}comment`;
const XSD_STRING = `${XSD}string`;
const RDF_LANG_STRING = `${RDF}langString`;

// ── closed vocabulary ──────────────────────────────────────────────────
// Changing any of these sets is a contract change, not a local edit; the
// vocabulary document and the consistency test pin them together.

/** The nine element types, in canonical order. */
export const CLASSES = [
  { key: "Actor", ko: "행위자" },
  { key: "BoundedContext", ko: "바운디드 컨텍스트" },
  { key: "BusinessConcept", ko: "업무 개념" },
  { key: "BusinessEvent", ko: "업무 사건" },
  { key: "Process", ko: "프로세스" },
  { key: "Step", ko: "단계" },
  { key: "Policy", ko: "정책" },
  { key: "BusinessRule", ko: "업무 규칙" },
  { key: "ObservationCriterion", ko: "관찰 기준" },
];

/** The fourteen relation types with their allowed source and target types. */
export const RELATIONS = [
  { key: "hasStep", ko: "포함", from: ["Process"], to: ["Step"] },
  { key: "flowsTo", ko: "흐름", from: ["Step"], to: ["Step"] },
  { key: "performs", ko: "수행", from: ["Actor"], to: ["Step"] },
  { key: "emits", ko: "발생", from: ["Step"], to: ["BusinessEvent"] },
  { key: "triggers", ko: "촉발", from: ["BusinessEvent"], to: ["Policy"] },
  { key: "starts", ko: "시작", from: ["Policy"], to: ["Step"] },
  { key: "uses", ko: "사용", from: ["Step", "Policy"], to: ["BusinessConcept"] },
  {
    key: "constrains",
    ko: "제약",
    from: ["BusinessRule"],
    to: ["Step", "Policy", "BusinessConcept", "Process"],
  },
  { key: "hasPart", ko: "구성", from: ["BusinessConcept"], to: ["BusinessConcept"] },
  { key: "refersTo", ko: "참조", from: ["BusinessConcept"], to: ["BusinessConcept"] },
  { key: "correspondsTo", ko: "대응", from: ["BusinessConcept"], to: ["BusinessConcept"] },
  {
    key: "inContext",
    ko: "컨텍스트 소속",
    from: ["Step", "Policy", "BusinessConcept", "BusinessEvent"],
    to: ["BoundedContext"],
  },
  { key: "criterionOf", ko: "기준 소속", from: ["ObservationCriterion"], to: ["Process"] },
  { key: "passesThrough", ko: "경유", from: ["ObservationCriterion"], to: ["BusinessEvent"] },
];

const ALL_TYPES = CLASSES.map((c) => c.key);
const NOT_CRITERION = ALL_TYPES.filter((t) => t !== "ObservationCriterion");

export const STEP_KINDS = ["system", "outside-system"];
export const BASIS_KINDS = ["regulation", "contract", "operating-policy", "user-decision"];

/** Datatypes that classify one value of the open-scope attribute. */
export const OPEN_SCOPE_KINDS = {
  OpenPath: "open-path",
  NotApplicable: "not-applicable",
  NoOpenScope: "none",
};

/**
 * The closed attribute set in canonical order. `kind` is the attribute
 * family: fact attributes carry business facts, description attributes are for
 * people and never decide anything, lifecycle attributes change only through
 * the lifecycle transitions.
 */
export const ATTRIBUTES = [
  { iri: RDFS_LABEL, ko: "이름", kind: "fact", on: ALL_TYPES, required: ALL_TYPES, value: "text" },
  {
    key: "definition",
    ko: "정의",
    kind: "fact",
    on: NOT_CRITERION,
    required: NOT_CRITERION,
    value: "text",
  },
  {
    key: "stepKind",
    ko: "단계 구분",
    kind: "fact",
    on: ["Step"],
    required: ["Step"],
    value: "enum",
    values: STEP_KINDS,
  },
  {
    key: "reactionCondition",
    ko: "반응 조건",
    kind: "fact",
    on: ["Policy"],
    required: ["Policy"],
    value: "text",
  },
  {
    key: "basisKind",
    ko: "근거 종류",
    kind: "fact",
    on: ["Policy", "BusinessRule"],
    required: ["Policy", "BusinessRule"],
    value: "enum",
    values: BASIS_KINDS,
  },
  {
    key: "basis",
    ko: "근거",
    kind: "fact",
    on: ["Policy", "BusinessRule"],
    required: ["Policy", "BusinessRule"],
    value: "text",
  },
  {
    key: "startCondition",
    ko: "시작 조건",
    kind: "fact",
    on: ["Process", "ObservationCriterion"],
    required: ["Process", "ObservationCriterion"],
    value: "text",
  },
  {
    key: "businessOutcome",
    ko: "업무 결과",
    kind: "fact",
    on: ["Process"],
    required: ["Process"],
    value: "text",
  },
  {
    key: "observedResult",
    ko: "관찰 결과",
    kind: "fact",
    on: ["ObservationCriterion"],
    required: ["ObservationCriterion"],
    value: "text",
  },
  {
    key: "openScope",
    ko: "미정 범위",
    kind: "fact",
    on: ["Process", "Step"],
    required: ["Process"],
    value: "openScope",
    multi: true,
  },
  { key: "summary", ko: "한 줄 요약", kind: "description", on: ["Process"], value: "text" },
  { iri: RDFS_COMMENT, ko: "메모", kind: "description", on: ALL_TYPES, value: "text", multi: true },
  {
    key: "status",
    ko: "Status",
    kind: "lifecycle",
    on: ["Process"],
    required: ["Process"],
    value: "text",
  },
  {
    key: "replacedBy",
    ko: "대체 대상",
    kind: "lifecycle",
    on: ["Process"],
    value: "iri",
    range: ["Process"],
  },
].map((a) => ({ ...a, iri: a.iri ?? PM + a.key }));

const CLASS_BY_IRI = new Map(CLASSES.map((c) => [PM + c.key, c]));
const RELATION_BY_IRI = new Map(RELATIONS.map((r) => [PM + r.key, r]));
const ATTRIBUTE_BY_IRI = new Map(ATTRIBUTES.map((a) => [a.iri, a]));
const OPEN_SCOPE_BY_IRI = new Map(Object.entries(OPEN_SCOPE_KINDS).map(([k, v]) => [PM + k, v]));
const TYPE_ORDER = new Map(ALL_TYPES.map((t, i) => [t, i]));
const PREDICATE_ORDER = new Map(
  [RDF_TYPE, ...ATTRIBUTES.map((a) => a.iri), ...RELATIONS.map((r) => PM + r.key)].map((p, i) => [
    p,
    i,
  ]),
);

export function elementId(iri) {
  return typeof iri === "string" && iri.startsWith(MODEL) ? iri.slice(MODEL.length) : null;
}

export function elementIri(id) {
  return MODEL + id;
}

export function isValidElementId(id) {
  return typeof id === "string" && LOCAL_ID_RE.test(id);
}

// ── Turtle subset parser ──────────────────────────────────────────────────
// Accepts prefix directives and triples whose subjects are IRIs and whose
// objects are IRIs or literals. Blank nodes, collections, RDF-star, @base and
// relative IRIs are rejected with their position: the model states
// facts only as identified elements, their relations and attribute values.

const PN_CHARS_BASE =
  "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D" +
  "\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\u{10000}-\\u{EFFFF}";
const PN_CHARS_U = `${PN_CHARS_BASE}_`;
const PN_CHARS = `${PN_CHARS_U}\\-0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040`;
const PREFIX_RE = new RegExp(`^(?:[${PN_CHARS_BASE}](?:[${PN_CHARS}.]*[${PN_CHARS}])?)?:`, "u");
const LOCAL_START = new RegExp(`[${PN_CHARS_U}0-9]`, "u");
const LOCAL_BODY = new RegExp(`[${PN_CHARS}.]`, "u");
const ABSOLUTE_IRI_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;
/** Element identifiers are the local part after the model namespace: a Turtle local name without escapes or ":". */
const LOCAL_ID_RE = new RegExp(`^[${PN_CHARS_U}0-9](?:[${PN_CHARS}.]*[${PN_CHARS}])?$`, "u");

class TurtleError extends Error {
  constructor(code, message, offset) {
    super(message);
    this.code = code;
    this.offset = offset;
  }
}

/**
 * Parse one Turtle document of the supported subset.
 *
 * @param {string} text Document source.
 * @param {string} doc Document label used in positions (a repository path).
 * @returns {{triples: object[], errors: object[], comments: number[], prefixes: object}}
 *   `errors` holds at most the first error with its line and column; a document
 *   with an error contributes no triples, so a partial parse never validates.
 */
export function parseTurtle(text, doc = "(input)") {
  const src = String(text).replace(/^﻿/, "");
  const lineStarts = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === "\n") lineStarts.push(i + 1);
  const position = (offset) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: offset - lineStarts[lo] + 1 };
  };

  const prefixes = {};
  const triples = [];
  const comments = [];
  let i = 0;

  const fail = (code, message, at = i) => {
    throw new TurtleError(code, message, at);
  };

  const skipSpace = () => {
    for (;;) {
      const c = src[i];
      if (c === " " || c === "\t" || c === "\r" || c === "\n") i++;
      else if (c === "#") {
        comments.push(position(i).line);
        while (i < src.length && src[i] !== "\n") i++;
      } else return;
    }
  };

  const expect = (ch, what) => {
    skipSpace();
    if (src[i] !== ch) fail("syntax", `expected ${what}`);
    i++;
  };

  const readIriRef = () => {
    const start = i;
    i++; // <
    let value = "";
    for (;;) {
      if (i >= src.length) fail("syntax", "unterminated IRI", start);
      const c = src[i];
      if (c === ">") {
        i++;
        break;
      }
      if (c === "\\") {
        const at = i;
        const decoded = readUnicodeEscape();
        if (/[\u0000- <>"{}|^`\\]/.test(decoded))
          fail("syntax", "the escape decodes to a character IRIs do not allow", at);
        value += decoded;
        continue;
      }
      if (/[\u0000- <"{}|^`]/.test(c)) fail("syntax", "invalid character in IRI");
      value += c;
      i++;
    }
    if (!ABSOLUTE_IRI_RE.test(value))
      fail(
        "relative-iri",
        `relative IRI <${value}> is not supported; write an absolute IRI`,
        start,
      );
    return value;
  };

  const readUnicodeEscape = () => {
    const kind = src[i + 1];
    const len = kind === "u" ? 4 : kind === "U" ? 8 : 0;
    if (!len) fail("syntax", "invalid escape sequence");
    const hex = src.slice(i + 2, i + 2 + len);
    if (!/^[0-9A-Fa-f]+$/.test(hex) || hex.length !== len) fail("syntax", "invalid unicode escape");
    const code = parseInt(hex, 16);
    if (code > 0x10ffff)
      fail("syntax", `unicode escape \\${kind}${hex} is outside the Unicode range`);
    if (code >= 0xd800 && code <= 0xdfff)
      fail("syntax", `unicode escape \\${kind}${hex} names a surrogate, not a character`);
    i += 2 + len;
    return String.fromCodePoint(code);
  };

  const readPrefixedName = () => {
    const start = i;
    const m = PREFIX_RE.exec(src.slice(i, i + 200));
    if (!m) fail("syntax", "expected an IRI or prefixed name");
    const prefix = m[0].slice(0, -1);
    i += m[0].length;
    let local = "";
    const charAt = (k) => (k < src.length ? String.fromCodePoint(src.codePointAt(k)) : "");
    if (LOCAL_START.test(charAt(i))) {
      let j = i;
      for (let ch = charAt(j); ch && LOCAL_BODY.test(ch); ch = charAt(j)) j += ch.length;
      while (j > i && src[j - 1] === ".") j--;
      local = src.slice(i, j);
      i = j;
    }
    if (src[i] === "\\" || src[i] === "%")
      fail("syntax", "escaped or percent-encoded local names are not supported");
    if (!(prefix in prefixes)) fail("unknown-prefix", `undefined prefix "${prefix}:"`, start);
    return prefixes[prefix] + local;
  };

  const readIri = () => {
    skipSpace();
    const c = src[i];
    if (c === "<") {
      if (src[i + 1] === "<") fail("rdf-star", "RDF-star quoted triples are not supported");
      return readIriRef();
    }
    if (c === "_" && src[i + 1] === ":")
      fail("blank-node", "blank nodes are not allowed; give the element an identifier");
    if (c === "[")
      fail("blank-node", "blank nodes are not allowed; give the element an identifier");
    if (c === "(") fail("collection", "RDF collections are not allowed");
    return readPrefixedName();
  };

  const readString = () => {
    const start = i;
    const q = src[i];
    const long = src.slice(i, i + 3) === q.repeat(3);
    i += long ? 3 : 1;
    let value = "";
    for (;;) {
      if (i >= src.length) fail("syntax", "unterminated string", start);
      const c = src[i];
      if (long ? src.slice(i, i + 3) === q.repeat(3) : c === q) {
        i += long ? 3 : 1;
        break;
      }
      if (!long && (c === "\n" || c === "\r")) fail("syntax", "line break in a short string");
      if (c === "\\") {
        const e = src[i + 1];
        const simple = {
          t: "\t",
          b: "\b",
          n: "\n",
          r: "\r",
          f: "\f",
          '"': '"',
          "'": "'",
          "\\": "\\",
        };
        if (e in simple) {
          value += simple[e];
          i += 2;
        } else value += readUnicodeEscape();
        continue;
      }
      value += c;
      i++;
    }
    let lang = null;
    let datatype = XSD_STRING;
    if (src[i] === "@") {
      const m = /^@([A-Za-z]+(?:-[A-Za-z0-9]+)*)/.exec(src.slice(i, i + 40));
      if (!m) fail("syntax", "invalid language tag");
      lang = m[1].toLowerCase();
      datatype = RDF_LANG_STRING;
      i += m[0].length;
    } else if (src.slice(i, i + 2) === "^^") {
      i += 2;
      datatype = readIri();
    }
    return { type: "literal", value, lang, datatype };
  };

  const readObject = () => {
    skipSpace();
    const c = src[i];
    if (c === '"' || c === "'") return readString();
    const num =
      /^[+-]?(?:[0-9]+\.[0-9]*[eE][+-]?[0-9]+|\.?[0-9]+[eE][+-]?[0-9]+|[0-9]*\.[0-9]+|[0-9]+)/.exec(
        src.slice(i, i + 80),
      );
    if (num) {
      i += num[0].length;
      const t = /[eE]/.test(num[0]) ? "double" : num[0].includes(".") ? "decimal" : "integer";
      return { type: "literal", value: num[0], lang: null, datatype: XSD + t };
    }
    const bool = /^(true|false)(?![\w:-])/.exec(src.slice(i, i + 6));
    if (bool) {
      i += bool[0].length;
      return { type: "literal", value: bool[1], lang: null, datatype: `${XSD}boolean` };
    }
    return { type: "iri", value: readIri() };
  };

  const readVerb = () => {
    skipSpace();
    if (src[i] === "a" && /[\s<"']/.test(src[i + 1] ?? " ")) {
      i++;
      return RDF_TYPE;
    }
    return readIri();
  };

  try {
    for (;;) {
      skipSpace();
      if (i >= src.length) break;
      const start = i;
      const word = /^(@prefix|@base|PREFIX|BASE)(?![\w:-])/i.exec(src.slice(i, i + 9));
      if (word) {
        const w = word[1];
        if (/base/i.test(w)) fail("base", "@base / BASE is not supported; write absolute IRIs");
        if (w.startsWith("@") && w !== "@prefix") fail("syntax", "directives are lowercase");
        i += w.length;
        skipSpace();
        const m = PREFIX_RE.exec(src.slice(i, i + 200));
        if (!m) fail("syntax", "expected a prefix name");
        i += m[0].length;
        skipSpace();
        if (src[i] !== "<") fail("syntax", "expected the prefix IRI");
        prefixes[m[0].slice(0, -1)] = readIriRef();
        if (w === "@prefix") expect(".", '"." after @prefix');
        continue;
      }
      const subject = readIri();
      const line = position(start).line;
      for (;;) {
        const predicate = readVerb();
        for (;;) {
          triples.push({ s: subject, p: predicate, o: readObject(), doc, line });
          skipSpace();
          if (src[i] === ",") {
            i++;
            continue;
          }
          break;
        }
        skipSpace();
        if (src[i] === ";") {
          while (src[i] === ";") {
            i++;
            skipSpace();
          }
          if (src[i] === ".") break;
          continue;
        }
        break;
      }
      expect(".", '"." at the end of the statement');
    }
  } catch (e) {
    if (!(e instanceof TurtleError)) throw e;
    const { line, col } = position(Math.min(e.offset, src.length));
    return {
      doc,
      triples: [],
      errors: [{ code: e.code, doc, line, col, message: e.message }],
      comments,
      prefixes,
    };
  }
  return { doc, triples, errors: [], comments, prefixes };
}

// ── union graph ───────────────────────────────────────────────────────────

export function termKey(term) {
  return term.type === "iri"
    ? `<${term.value}>`
    : `"${term.value}"@${term.lang ?? ""}^^${term.datatype}`;
}

const tripleKey = (t) => `${t.s}\u0000${t.p}\u0000${termKey(t.o)}`;

/**
 * Merge parsed documents into one graph. Identical triples from several
 * documents collapse into one; the first occurrence keeps its position.
 */
export function unionGraph(parsedDocs) {
  const seen = new Map();
  for (const d of parsedDocs)
    for (const t of d.triples) if (!seen.has(tripleKey(t))) seen.set(tripleKey(t), t);
  return [...seen.values()];
}

/** Index a graph by subject for validation, queries and serialization. */
export function indexGraph(triples) {
  const subjects = new Map();
  const incoming = new Map();
  for (const t of triples) {
    if (!subjects.has(t.s)) subjects.set(t.s, { iri: t.s, types: [], props: new Map(), first: t });
    const node = subjects.get(t.s);
    if (t.p === RDF_TYPE && t.o.type === "iri") node.types.push(t.o.value);
    if (!node.props.has(t.p)) node.props.set(t.p, []);
    node.props.get(t.p).push(t);
    if (t.o.type === "iri" && t.p !== RDF_TYPE) {
      if (!incoming.has(t.o.value)) incoming.set(t.o.value, []);
      incoming.get(t.o.value).push(t);
    }
  }
  const typeOf = (iri) => {
    const node = subjects.get(iri);
    if (!node) return null;
    const known = node.types.filter((t) => CLASS_BY_IRI.has(t));
    return known.length === 1 && node.types.length === 1 ? CLASS_BY_IRI.get(known[0]).key : null;
  };
  const out = (iri, rel) => (subjects.get(iri)?.props.get(PM + rel) ?? []).map((t) => t.o.value);
  const into = (iri, rel) =>
    (incoming.get(iri) ?? []).filter((t) => t.p === PM + rel).map((t) => t.s);
  const ofType = (type) => [...subjects.keys()].filter((iri) => typeOf(iri) === type).sort();
  const literal = (iri, attr) => {
    const values =
      subjects
        .get(iri)
        ?.props.get(attr.startsWith("http") || attr.startsWith("urn") ? attr : PM + attr) ?? [];
    return values.map((t) => t.o);
  };
  return { triples, subjects, incoming, typeOf, out, into, ofType, literal };
}

/**
 * Steps a business rule reaches: the steps it constrains, the steps
 * started by policies it constrains, the steps using concepts it constrains
 * and the steps of processes it constrains.
 */
export function ruleReach(index, ruleIri) {
  const steps = new Set();
  for (const target of index.out(ruleIri, "constrains")) {
    const type = index.typeOf(target);
    let reached = [];
    if (type === "Step") reached = [target];
    else if (type === "Policy") reached = index.out(target, "starts");
    else if (type === "BusinessConcept") reached = index.into(target, "uses");
    else if (type === "Process") reached = index.out(target, "hasStep");
    for (const s of reached) steps.add(s);
  }
  return [...steps].filter((s) => index.typeOf(s) === "Step").sort();
}

/**
 * Classify a process's open scope. Only open-path items leave scope
 * open; not-applicable items and the explicit none value close it.
 */
export function openScopeOf(index, iri) {
  const items = index.literal(iri, "openScope").map((o) => ({
    kind: OPEN_SCOPE_BY_IRI.get(o.datatype) ?? null,
    text: o.value,
  }));
  return { items, open: items.some((item) => item.kind === "open-path") };
}

// ── closed-world validation ──────────────────────────────────────────────

const isText = (o) =>
  o.type === "literal" && (o.datatype === XSD_STRING || o.datatype === RDF_LANG_STRING);

/**
 * Validate a parsed model as one union graph under the closed vocabulary.
 *
 * @param {{doc: string, text: string}[]} documents Model documents.
 * @param {{categoryKeys?: string[]}} [options] Category keys from the ADR index,
 *   used only to detect ADR references written into the model.
 * @returns {{ok: boolean, findings: object[], index: object|null, parsed: object[]}}
 *   Each finding is `{level, code, where, element, msg}`. Graph checks are
 *   skipped when any document fails to parse, so a partial model never passes.
 */
export function validateModel(documents, options = {}) {
  const findings = [];
  const add = (level, code, where, element, msg) =>
    findings.push({ level, code, where, element, msg });
  const parsed = documents.map(parseDocument);

  for (const p of parsed) {
    for (const e of p.errors)
      add(
        "error",
        `process-${e.code === "syntax" ? "parse" : e.code}`,
        `${e.doc}:${e.line}:${e.col}`,
        null,
        e.message,
      );
    if (p.comments.length)
      add(
        "warn",
        "process-comment",
        `${p.doc}:${p.comments[0]}`,
        null,
        `Turtle comments on line(s) ${p.comments.join(", ")} are not part of the model and are dropped when ADR Writer rewrites the document; keep notes in rdfs:comment`,
      );
  }
  if (parsed.some((p) => p.errors.length)) {
    add(
      "error",
      "process-not-validated",
      "docs/process",
      null,
      "the model was not validated because a document could not be parsed; fix the reported position first",
    );
    return { ok: false, findings, index: null, parsed };
  }

  const triples = unionGraph(parsed);
  const index = indexGraph(triples);
  const where = (t) => `${t.doc}:${t.line}`;
  const name = (iri) => elementId(iri) ?? iri;

  // Only vocabulary terms plus rdf:type, rdfs:label and rdfs:comment.
  for (const t of triples) {
    const allowedPredicate =
      t.p === RDF_TYPE || ATTRIBUTE_BY_IRI.has(t.p) || RELATION_BY_IRI.has(t.p);
    if (!allowedPredicate) {
      add(
        "error",
        termFamily(t.p) === "owl" ? "process-owl" : "process-unknown-term",
        where(t),
        name(t.s),
        `property <${t.p}> is not in the process vocabulary`,
      );
    }
    if (t.p === RDF_TYPE && t.o.type !== "iri")
      add(
        "error",
        "process-type-literal",
        where(t),
        name(t.s),
        `an element type is one of the nine type IRIs, not the literal "${t.o.value}"`,
      );
    if (t.p === RDF_TYPE && t.o.type === "iri" && !CLASS_BY_IRI.has(t.o.value))
      add(
        "error",
        termFamily(t.o.value) === "owl" ? "process-owl" : "process-unknown-term",
        where(t),
        name(t.s),
        `type <${t.o.value}> is not one of the nine element types`,
      );
    if (t.o.type === "iri" && termFamily(t.o.value) === "owl" && t.p !== RDF_TYPE)
      add("error", "process-owl", where(t), name(t.s), `OWL term <${t.o.value}> is not allowed`);
    if (
      t.o.type === "literal" &&
      t.o.datatype.startsWith(PM) &&
      !OPEN_SCOPE_BY_IRI.has(t.o.datatype)
    )
      add(
        "error",
        "process-unknown-term",
        where(t),
        name(t.s),
        `datatype <${t.o.datatype}> is not in the process vocabulary`,
      );
  }

  // Every element has an identifier in the model namespace and one type.
  const elements = [];
  for (const node of index.subjects.values()) {
    const id = elementId(node.iri);
    if (id === null || !isValidElementId(id)) {
      add(
        "error",
        "process-element-iri",
        where(node.first),
        node.iri,
        `element identifier <${node.iri}> must be ${MODEL}<id> with a letter, digit or underscore first and no trailing "."`,
      );
      continue;
    }
    if (node.types.length === 0)
      add(
        "error",
        "process-type-missing",
        where(node.first),
        id,
        `element "${id}" has no element type`,
      );
    else if (node.types.length > 1)
      add(
        "error",
        "process-type-multiple",
        where(node.first),
        id,
        `identifier "${id}" is used for more than one element type: ${node.types.map(shortName).join(", ")}`,
      );
    else if (index.typeOf(node.iri)) elements.push(node);
  }

  // Relation ends follow the relation table and both ends exist in the model.
  for (const t of triples) {
    const rel = RELATION_BY_IRI.get(t.p);
    if (!rel) continue;
    const s = index.typeOf(t.s);
    if (s && !rel.from.includes(s))
      add(
        "error",
        "process-relation-source",
        where(t),
        name(t.s),
        `${rel.key} (${rel.ko}) cannot start from ${s}; allowed: ${rel.from.join(", ")}`,
      );
    if (t.o.type !== "iri") {
      add(
        "error",
        "process-relation-target",
        where(t),
        name(t.s),
        `${rel.key} (${rel.ko}) must point at an element, not a literal`,
      );
      continue;
    }
    const o = index.typeOf(t.o.value);
    if (!index.subjects.has(t.o.value))
      add(
        "error",
        "process-relation-dangling",
        where(t),
        name(t.s),
        `${rel.key} points at "${name(t.o.value)}", which is not an element of the model`,
      );
    else if (o && !rel.to.includes(o))
      add(
        "error",
        "process-relation-target",
        where(t),
        name(t.s),
        `${rel.key} (${rel.ko}) cannot end at ${o}; allowed: ${rel.to.join(", ")}`,
      );
  }

  // Attribute scope, cardinality, required set and values.
  for (const node of elements) {
    const id = elementId(node.iri);
    const type = index.typeOf(node.iri);
    for (const attr of ATTRIBUTES) {
      const values = node.props.get(attr.iri) ?? [];
      if (values.length && !attr.on.includes(type)) {
        add(
          "error",
          "process-attribute-scope",
          where(values[0]),
          id,
          `${type} cannot carry ${attr.ko} (${shortName(attr.iri)})`,
        );
        continue;
      }
      if (!attr.on.includes(type)) continue;
      if (!values.length) {
        if (attr.required?.includes(type))
          add(
            "error",
            "process-attribute-missing",
            where(node.first),
            id,
            `${type} "${id}" is missing ${attr.ko} (${shortName(attr.iri)})`,
          );
        continue;
      }
      if (!attr.multi && values.length > 1)
        add(
          "error",
          "process-attribute-multiple",
          where(values[1]),
          id,
          `${attr.ko} (${shortName(attr.iri)}) has ${values.length} values; write exactly one`,
        );
      for (const t of values) checkValue(attr, t, type, id);
    }
    if (type === "Process" || type === "Step") checkOpenScope(node, type, id);
  }

  function checkValue(attr, t, type, id) {
    const o = t.o;
    if (attr.value === "text" || attr.value === "enum") {
      if (!isText(o))
        return add(
          "error",
          "process-attribute-value",
          where(t),
          id,
          `${attr.ko} must be a text literal`,
        );
      if (!o.value.trim())
        return add("error", "process-attribute-value", where(t), id, `${attr.ko} is empty`);
      if (attr.value === "enum" && !attr.values.includes(o.value))
        add(
          "error",
          "process-attribute-enum",
          where(t),
          id,
          `${attr.ko} "${o.value}" is not one of ${attr.values.join(", ")}`,
        );
    } else if (attr.value === "iri") {
      if (o.type !== "iri")
        return add(
          "error",
          "process-attribute-value",
          where(t),
          id,
          `${attr.ko} must point at an element`,
        );
      const target = index.typeOf(o.value);
      if (!target || !attr.range.includes(target))
        add(
          "error",
          "process-attribute-value",
          where(t),
          id,
          `${attr.ko} must point at an existing ${attr.range.join(" or ")}`,
        );
    } else if (attr.value === "openScope") {
      if (o.type !== "literal" || !OPEN_SCOPE_BY_IRI.has(o.datatype))
        add(
          "error",
          "process-open-scope",
          where(t),
          id,
          `미정 범위 values must be typed pm:OpenPath, pm:NotApplicable or pm:NoOpenScope`,
        );
      else if (!o.value.trim())
        add("error", "process-open-scope", where(t), id, `미정 범위 item is empty`);
    }
  }

  function checkOpenScope(node, type, id) {
    const kinds = index
      .literal(node.iri, "openScope")
      .map((o) => OPEN_SCOPE_BY_IRI.get(o.datatype));
    if (type === "Step" && kinds.some((k) => k && k !== "open-path"))
      add(
        "error",
        "process-open-scope",
        where(node.first),
        id,
        `a step's 미정 범위 holds open paths only; record not-applicable items and "none" on the process`,
      );
    if (type === "Process" && kinds.includes("none") && kinds.length > 1)
      add(
        "error",
        "process-open-scope",
        where(node.first),
        id,
        `미정 범위 "none" cannot be combined with other items`,
      );
  }

  // Membership and policy cardinalities.
  const count = (list) => new Set(list).size;
  for (const node of elements) {
    const iri = node.iri;
    const id = elementId(iri);
    const type = index.typeOf(iri);
    const w = where(node.first);
    if (type === "Step") {
      const owners = index.into(iri, "hasStep").filter((p) => index.typeOf(p) === "Process");
      if (count(owners) !== 1)
        add(
          "error",
          "process-membership",
          w,
          id,
          `step "${id}" belongs to ${count(owners)} processes; it must belong to exactly one`,
        );
      if (count(index.out(iri, "inContext")) !== 1)
        add(
          "error",
          "process-membership",
          w,
          id,
          `step "${id}" belongs to ${count(index.out(iri, "inContext"))} contexts; it must belong to exactly one`,
        );
      if (!index.into(iri, "performs").some((a) => index.typeOf(a) === "Actor"))
        add("error", "process-membership", w, id, `step "${id}" has no performing actor`);
    }
    if (type === "Policy" || type === "BusinessConcept" || type === "BusinessEvent") {
      const n = count(index.out(iri, "inContext"));
      if (n !== 1)
        add(
          "error",
          "process-membership",
          w,
          id,
          `${type} "${id}" belongs to ${n} contexts; it must belong to exactly one`,
        );
    }
    if (type === "ObservationCriterion") {
      const n = count(index.out(iri, "criterionOf"));
      if (n !== 1)
        add(
          "error",
          "process-membership",
          w,
          id,
          `criterion "${id}" belongs to ${n} processes; it must belong to exactly one`,
        );
    }
    if (type === "Process" && !index.into(iri, "criterionOf").length)
      add("error", "process-membership", w, id, `process "${id}" has no observation criterion`);
    if (type === "Policy") {
      if (!index.into(iri, "triggers").length)
        add("error", "process-policy", w, id, `policy "${id}" has no triggering event`);
      if (!index.out(iri, "starts").length)
        add("error", "process-policy", w, id, `policy "${id}" starts no step`);
    }
    if (type === "BusinessConcept") {
      const ctx = index.out(iri, "inContext")[0];
      for (const other of index.out(iri, "correspondsTo")) {
        if (other === iri || (ctx && index.out(other, "inContext")[0] === ctx))
          add(
            "error",
            "process-correspondence",
            w,
            id,
            `correspondence with "${name(other)}" must link concepts of different contexts`,
          );
      }
    }
    // A rule constrains something and reaches at least two steps.
    if (type === "BusinessRule") {
      if (!index.out(iri, "constrains").length)
        add("error", "process-rule-reach", w, id, `rule "${id}" constrains nothing`);
      else {
        const reach = ruleReach(index, iri);
        if (reach.length < 2)
          add(
            "error",
            "process-rule-reach",
            w,
            id,
            `rule "${id}" reaches ${reach.length} step(s); a business rule must reach at least two steps (a rule inside one step belongs to the realizing ADR)`,
          );
      }
    }
  }

  // Process Status values and the replacement of a Superseded process.
  findings.push(...statusFindings(index));

  // Flow is ordering inside one process.
  for (const t of triples) {
    if (t.p !== PM + "flowsTo" || t.o.type !== "iri") continue;
    if (flowCrossesProcesses(index, t.s, t.o.value))
      add(
        "error",
        "process-flow-cross",
        where(t),
        name(t.s),
        `flow from "${name(t.s)}" to "${name(t.o.value)}" crosses processes; connect processes with an event and a policy`,
      );
  }

  // Element identifiers never carry ADR numbers.
  for (const node of elements) {
    const id = elementId(node.iri);
    if (/(?:^|[._-])adr[._-]?\d{1,4}(?:$|[._-])/i.test(id))
      add(
        "error",
        "process-adr-reference",
        where(node.first),
        id,
        `the model must not record ADR numbers, in identifiers either: "${id}"`,
      );
  }

  // Text guards on literal values: code locations, exact values and ADR references.
  const keyRefs = (options.categoryKeys ?? []).filter((k) => k.includes("/"));
  for (const t of triples) {
    if (t.o.type !== "literal") continue;
    const v = t.o.value;
    if (
      /docs\/adr\b|\b\d{4}-[a-z0-9-]+\.md\b|\bADR[ -]?\d{1,4}\b/i.test(v) ||
      keyRefs.some((k) => v.includes(k))
    )
      add(
        "error",
        "process-adr-reference",
        where(t),
        name(t.s),
        `the model must not record ADR paths, numbers or category keys: "${v}"`,
      );
    if (/[\w-]+\.(?:mjs|cjs|js|jsx|ts|tsx|py|java|kt|go|rb|cs|php|sql)\b/.test(v))
      add(
        "warn",
        "process-technical-detail",
        where(t),
        name(t.s),
        `looks like a code location; the model holds business flow and relations only: "${v}"`,
      );
    const owner = index.typeOf(t.s);
    if (
      ((owner === "BusinessRule" && t.p === PM + "definition") ||
        (owner === "Policy" && t.p === PM + "reactionCondition")) &&
      /\d/.test(v)
    )
      add(
        "warn",
        "process-exact-value",
        where(t),
        name(t.s),
        `rules and reaction conditions state relations and meaning; exact values and thresholds belong to the realizing ADR: "${v}"`,
      );
  }

  return { ok: !findings.some((f) => f.level === "error"), findings, index, parsed };
}

function termFamily(iri) {
  if (iri.startsWith(OWL)) return "owl";
  if (iri.startsWith(PM)) return "pm";
  return "other";
}

export function shortName(iri) {
  if (iri === RDF_TYPE) return "a";
  if (iri.startsWith(PM)) return `pm:${iri.slice(PM.length)}`;
  if (iri.startsWith(RDFS)) return `rdfs:${iri.slice(RDFS.length)}`;
  if (iri.startsWith(RDF)) return `rdf:${iri.slice(RDF.length)}`;
  if (iri.startsWith(MODEL)) return `m:${iri.slice(MODEL.length)}`;
  return `<${iri}>`;
}

// ── index links and the realizing-ADR body guard ─────────────────────────

/** Parse one model document; one that cannot be read is a positioned syntax error with no triples. */
export function parseDocument({ doc, text, unreadable }) {
  return unreadable
    ? {
        doc,
        triples: [],
        errors: [{ code: "syntax", doc, ...unreadable }],
        comments: [],
        prefixes: {},
      }
    : parseTurtle(text, doc);
}

/**
 * Check `realizes` links in the ADR index against the model.
 *
 * @param {object} mapping Parsed .mapping.json.
 * @param {object|null} index Indexed model graph, or null when no model exists.
 * @returns {object[]} findings `{level, code, where, element, msg}`.
 */
export function checkRealizes(mapping, index, where = "docs/adr/.mapping.json") {
  const findings = [];
  for (const [key, entry] of Object.entries(mapping?.categories ?? {})) {
    if (entry?.realizes !== undefined && !Array.isArray(entry.realizes))
      findings.push({
        level: "error",
        code: "process-link-shape",
        where,
        element: null,
        category: key,
        msg: `category "${key}" has a realizes value that is not a list of step ids`,
      });
    if (!Array.isArray(entry?.realizes)) continue;
    for (const id of entry.realizes) {
      if (typeof id !== "string") {
        findings.push({
          level: "error",
          code: "process-link-shape",
          where,
          element: null,
          category: key,
          msg: `category "${key}" realizes ${JSON.stringify(id)}, which is not a step id`,
        });
        continue;
      }
      if (!index)
        findings.push({
          level: "error",
          code: "process-link-dangling",
          where,
          element: id,
          category: key,
          msg: `category "${key}" realizes step "${id}", but the repository has no process model`,
        });
      else if (index.typeOf(elementIri(id)) !== "Step")
        findings.push({
          level: "error",
          code: "process-link-dangling",
          where,
          element: id,
          category: key,
          msg: `category "${key}" realizes "${id}", which is not a step of the process model`,
        });
      else {
        const owner = processOfStep(index, elementIri(id));
        if (owner && isRetired(index, owner))
          findings.push({
            level: "error",
            code: "process-link-retired",
            where,
            element: id,
            category: key,
            msg: `category "${key}" realizes step "${id}" of the retired process "${elementId(owner)}"; a retirement removes or moves its links`,
          });
      }
    }
  }
  return findings;
}

// Link targets of one Markdown line: inline, reference-style, angle-bracket and HTML links.
const LINK_TARGETS = [
  /\bhref\s*=\s*["']([^"']+)["']/g,
  /\]\(\s*<?([^\s)>]+)>?(?:\s+["'(][^)]*)?\)/g,
  /^\s*\[[^\]]+\]:\s*<?([^\s>]+)>?/g,
  /<([^\s<>]+)>/g,
];

/**
 * Model locations and element identifiers a realizing ADR body must not
 * contain: the model directory in any path or URL, a link into a model
 * directory, any full model IRI, and an `m:` name or backticked id of an
 * existing element.
 *
 * @param {{inModel: (target: string) => boolean}} options Whether a relative link
 *   target, resolved from the ADR's own folder, leads into the model directory.
 */
export function modelReferenceHits(body, index, { inModel }) {
  const ids = new Set();
  for (const iri of index?.subjects.keys() ?? []) if (elementId(iri)) ids.add(elementId(iri));
  const hits = [];
  String(body)
    .split("\n")
    .forEach((line, n) => {
      if (/(?:^|[^\w-])docs\/process(?:\/|\b)/.test(line))
        hits.push({ line: n + 1, text: "docs/process" });
      for (const re of LINK_TARGETS)
        for (const [, target] of line.matchAll(re)) {
          const bare = target.replace(/[?#].*$/, "");
          const leads = !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(bare) && inModel(bare);
          if (!/docs\/process/.test(target) && leads) hits.push({ line: n + 1, text: target });
        }
      for (const m of line.matchAll(/`([^`\s]+)`/g))
        if (m[1].includes(".") && ids.has(m[1])) hits.push({ line: n + 1, text: m[0] });
      for (const m of line.matchAll(
        new RegExp(`${MODEL.replace(/[.:]/g, (c) => `\\${c}`)}[^\\s<>"'\`)]*`, "g"),
      ))
        hits.push({ line: n + 1, text: m[0] });
      for (const m of line.matchAll(
        new RegExp(`(?<![\\w:-])m:([${PN_CHARS}.]*[${PN_CHARS}])`, "gu"),
      ))
        if (ids.has(m[1])) hits.push({ line: n + 1, text: m[0] });
    });
  // One link can match two link forms; report it once.
  return [...new Map(hits.map((h) => [`${h.line}\u0000${h.text}`, h])).values()];
}

/**
 * Glossary terms whose meaning the model owns: concept and context names the
 * glossary defines, read as `glossaryTerms` reads entries — headings, table rows,
 * list items and paragraphs that start with a term, and definition lists; inline
 * code, emphasis and a trailing parenthetical alias are stripped, and the alias
 * counts as a term too. A name found only in a table column that may hold other
 * content is `possible`: whether it defines the term is the user's answer.
 */
export function glossaryOverlap(glossary, index) {
  if (!index || !glossary) return [];
  const entries = new Set();
  const possible = new Set();
  for (const e of glossaryTerms(glossary))
    (e.possible ? possible : entries).add(normalizeTerm(e.name));
  const overlap = [];
  for (const type of ["BusinessConcept", "BoundedContext"])
    for (const iri of index.ofType(type))
      for (const label of index.literal(iri, RDFS_LABEL)) {
        const key = normalizeTerm(label.value);
        if (entries.has(key)) overlap.push({ id: elementId(iri), term: label.value, type });
        else if (possible.has(key))
          overlap.push({ id: elementId(iri), term: label.value, type, possible: true });
      }
  return overlap;
}

const normalizeTerm = (s) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

// A Markdown link, its URL allowed one level of parentheses (`…/Refund_(finance)`).
const LINK = /\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g;
// A table's delimiter row, as GitHub-flavored Markdown accepts it: one hyphen per cell is enough.
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

// The words a table header uses for what its column holds. A column of terms, words or
// names, or of the language they are written in, holds glossary entries; any other word
// beside them (`Preferred`, `표준`, `(Eng)`) only qualifies them. A column that holds
// something else — a definition, a context, an owner, a category, related terms — holds
// none, and neither does the name of a business area (`Domain name`, `업무명`), though a
// term may be qualified by one (`Business term`, `업무 용어`).
const TERM_WORD =
  /^(?:terms?|words?|concepts?|entr(?:y|ies)|items?|keywords?|abbr|abbrev|abbreviations?|acronyms?|synonyms?|alias(?:es)?|expansions?|forms?|spellings?|phrases?|expressions?|translations?|vocabulary|glossary|용어|단어|낱말|어휘|개념|항목|표제어|키워드|약어|약자|약칭|동의어|유의어|별칭|원어|번역|번역어|표기|표현)$/;
const NAME_WORD = /^(?:names?|labels?|titles?|이름|명칭)$/;
const LANGUAGE_WORD = /^(?:english|korean|en|ko|kr|eng|kor|영문|영어|한글|국문|국어|한|영|국)$/;
const AREA_WORD = /^(?:domains?|business(?:es)?|areas?|업무|도메인|비즈니스|영역|분야)$/;
// A column of definitions or examples holds no names at all.
const DEFINITION_WORD =
  /^(?:definitions?|descriptions?|meanings?|explanations?|notes?|remarks?|comments?|examples?|usage|설명|정의|의미|뜻|풀이|해설|내용|비고|예|예시|용례)$/;
const OTHER_WORD =
  /^(?:sources?|references?|related|see|broader|narrower|child|children|antonyms?|opposites?|codes?|ids?|identifiers?|contexts?|owners?|teams?|categor(?:y|ies)|groups?|types?|kinds?|status(?:es)?|systems?|process(?:es)?|steps?|parents?|units?|formats?|values?|rules?|하위|반의어|코드|식별자|아이디|출처|참고|참조|관련|컨텍스트|문맥|담당|담당자|소유|소유자|팀|분류|범주|그룹|유형|종류|상태|시스템|프로세스|단계|상위|단위|형식|값|규칙)$/;
// The Korean words of those kinds a compound can end in (`표준용어`, `용어설명`), longest
// first; single syllables (한, 영, 예 …) end too many other words to count.
const KOREAN_ENDINGS = [TERM_WORD, NAME_WORD, LANGUAGE_WORD, AREA_WORD, DEFINITION_WORD, OTHER_WORD]
  .flatMap((re) => re.source.match(/[가-힣]{2,}/g) ?? [])
  .sort((a, b) => b.length - a.length);
const known = (w) => TERM_WORD.test(w) || NAME_WORD.test(w) || LANGUAGE_WORD.test(w);
/** A header word, with a Korean compound split into its stem and the word it ends in. */
const headerParts = (w) => {
  if (known(w) || AREA_WORD.test(w) || DEFINITION_WORD.test(w) || OTHER_WORD.test(w)) return [w];
  const ending = KOREAN_ENDINGS.find((e) => w.length > e.length && w.endsWith(e));
  if (ending) return [w.slice(0, -ending.length), ending];
  // A compound ending in 명 names its stem's kind: 영문명, 용어명, 정식명, 컨텍스트명.
  return w.length > 1 && w.endsWith("명") ? [w.slice(0, -1), "name"] : [w];
};
/**
 * What a table header cell says its column holds: `term` (names of the row's term —
 * `Term`, `English term`, `영문명`, `용어(한)`, `Term (primary)`, `표준용어`, `KOR`,
 * `Alias`), `definition` (definitions or examples — `Meaning`, `설명`, `용어설명`),
 * `other` (names of something else: a context, an owner, a category, a code, a related
 * term, a business area or its name — `Context name`, `Broader term`, `Business name`)
 * or `plain` (nothing it names: `표제`, `구분`, `No.`).
 */
const columnKind = (cell) => {
  const words = cell
    .toLowerCase()
    .replace(/\balso known as\b|\ba\.?k\.?a\b\.?/g, " aliases ")
    .split(/[\s/·・,.;:()（）[\]{}<>+&-]+/)
    .filter(Boolean)
    .flatMap(headerParts);
  const has = (re) => words.some((w) => re.test(w));
  const term = has(TERM_WORD);
  if (has(DEFINITION_WORD)) return "definition";
  if (has(OTHER_WORD) || (has(AREA_WORD) && !term)) return "other";
  return term || has(NAME_WORD) || has(LANGUAGE_WORD) ? "term" : "plain";
};

/**
 * The entry names of a glossary document: every heading (a section number is no part
 * of its name); list items and paragraphs that start with a term — bold (Markdown or
 * HTML) alone, or plain, italic, linked or in a code span before a colon, an equals
 * sign, a dash between spaces or an em dash, with a parenthetical second name allowed
 * after a marked one; definition-list terms (Markdown or HTML); and in a table, the
 * term columns, or where no header names one the first column that does not number
 * the rows. A name in any other table column but a definition is `possible`: that
 * column may hold it as other content. Two names around a slash, or a name and its
 * parenthetical second name, are both entries. A heading counts whatever its body
 * holds: one named like a model term that only groups other terms is reworded once
 * (`## Payment terms`), so a save never defines a term the glossary still defines, and
 * no reading of a heading's body can miss one. Fenced code is never read.
 *
 * @param {string} glossary The glossary text.
 * @returns {{name: string, possible: boolean}[]}
 */
function glossaryTerms(glossary) {
  const lines = String(glossary).replace(/\r\n?/g, "\n").split("\n");
  let fence = false;
  const code = lines.map((l) => {
    if (/^\s*(?:```|~~~)/.test(l)) {
      fence = !fence;
      return true;
    }
    return fence;
  });
  const clean = (raw) =>
    raw
      .replace(/\\\|/g, "|")
      .replace(LINK, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[`*_]/g, "")
      .replace(/[:：]\s*$/, "")
      .trim();
  const out = [];
  // Two names of one entry: a parenthetical second name, or two around a slash.
  // A possible entry is a name in a table column that may hold other content.
  const push = (raw, possible = false) => {
    const plain = clean(raw);
    const alias = /^(.*?)\s*[(（]([^()（）]+)[)）]$/.exec(plain);
    for (const name of alias ? [alias[1], alias[2]] : [plain])
      for (const t of name.split(/\s*\/\s*/)) if (t.trim()) out.push({ name: t.trim(), possible });
  };
  const cells = (line) => line.replace(/^\s*\|/, "").split(/(?<!\\)\|/);
  // The term a list item or paragraph starts with (bold, italic or a code span, or a
  // plain one before a separator), or null.
  const entryOf = (raw) => {
    // An HTML bold term reads as a Markdown one.
    const line = raw.replace(/<(b|strong)>(.*?)<\/\1>/gi, "**$2**");
    if (/^\s*(?:#|\||>|<|:)/.test(line)) return null;
    // A linked term reads as its text, whatever its URL holds.
    const text = line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").replace(LINK, "$1");
    const marked = /^(\*\*|__|\*|_|`)([^*_`].*?)\1/.exec(text);
    if (marked) {
      // A parenthetical second name may follow the marked term: `**환불** (Refund): …`;
      // a run-in term may end in its period: `**Refund.** Money given back.`
      const term = marked[2].replace(/[.。]$/, "");
      const alias = /^\s*([(（][^()（）]+[)）])/.exec(text.slice(marked[0].length));
      const rest = text.slice(marked[0].length + (alias?.[0].length ?? 0));
      if (marked[1].length === 2 || /^\s*(?:[:：=—]|[-–](?:\s|$))/.test(rest))
        return alias ? `${term} ${alias[1]}` : term;
      return null;
    }
    // A plain term before a colon, an equals sign, a dash between spaces or an em dash; an
    // en dash or hyphen without spaces joins a compound (`Order–payment link`).
    const plain = /^([^\s:：*_`][^:：]{0,60}?)\s*(?:[:：](?=\s|$)|\s=\s|\s[-–]\s|—)/.exec(text);
    return plain ? plain[1] : null;
  };
  // A line a definition-list line (": …") follows, after at most one blank line.
  const definitionTermAt = (n) =>
    !code[n] &&
    Boolean(lines[n].trim()) &&
    !/^\s*(?:[-*+]\s|\d+[.)]\s|#|\||:|>)/.test(lines[n]) &&
    (/^\s*:\s+\S/.test(lines[n + 1] ?? "") ||
      (!lines[n + 1]?.trim() && /^\s*:\s+\S/.test(lines[n + 2] ?? "")));
  const headingAt = (n) => {
    if (code[n]) return null;
    // A heading's section number is no part of its name: `## 1. Refund`, `### 2.3 Refund`.
    const atx = /^(#{1,6})\s+(?:\d+(?:\.\d+)*[.)]?\s+)?(.+?)\s*#*\s*$/.exec(lines[n]);
    if (atx) return { text: atx[2], end: n };
    if (
      lines[n].trim() &&
      !/^\s*(?:[-*+]\s|\d+[.)]\s|#|\||>)/.test(lines[n]) &&
      /^\s*(?:=+|-{2,})\s*$/.test(lines[n + 1] ?? "")
    )
      return { text: lines[n].trim(), end: n + 1 };
    return null;
  };
  for (let n = 0; n < lines.length; n++) {
    if (code[n]) continue;
    const line = lines[n];
    const heading = headingAt(n);
    if (heading) {
      push(heading.text);
      n = heading.end;
      continue;
    }
    if (TABLE_SEPARATOR.test(line) && n > 0 && lines[n - 1].includes("|")) {
      const header = cells(lines[n - 1]).map(clean);
      const rows = [];
      for (let r = n + 1; r < lines.length && lines[r].includes("|") && lines[r].trim(); r++)
        rows.push(cells(lines[r]));
      // Entries: the term columns, or where no header names one, the first column that
      // does not number the rows, whatever it names (a table of contexts and their
      // responsibilities). A name in any other column but a definition is a possible
      // entry: that column may hold it as other content.
      const kinds = header.map(columnKind);
      // Whether each column numbers the rows, decided once for the whole table.
      const numbers = header.map((_, i) =>
        rows.every((row) => /^(?:#?\d+[.)]?)?$/.test(clean(row[i] ?? ""))),
      );
      const named = kinds.flatMap((k, i) => (k === "term" ? [i] : []));
      const entries = new Set(
        named.length
          ? named
          : [header.findIndex((_, i) => !numbers[i] && kinds[i] !== "definition")],
      );
      for (const row of rows)
        header.forEach((_, i) => {
          if (numbers[i] || kinds[i] === "definition") return;
          push(row[i] ?? "", !entries.has(i));
        });
      continue;
    }
    for (const dt of line.matchAll(/<dt>(.*?)<\/dt>/gi)) push(dt[1]);
    const entry = entryOf(line);
    if (entry) push(entry);
    else if (definitionTermAt(n)) push(line);
  }
  return out;
}

// ── canonical serialization ──────────────────────────────────────────────

const escapeLiteral = (s) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");

function formatTerm(term, used) {
  if (term.type === "iri") return formatIri(term.value, used);
  let out = `"${escapeLiteral(term.value)}"`;
  if (term.lang) out += `@${term.lang}`;
  else if (term.datatype !== XSD_STRING) out += `^^${formatIri(term.datatype, used)}`;
  return out;
}

function formatIri(iri, used) {
  for (const [prefix, ns] of [
    ["m", MODEL],
    ["pm", PM],
    ["rdfs", RDFS],
    ["xsd", XSD],
  ]) {
    if (!iri.startsWith(ns)) continue;
    const local = iri.slice(ns.length);
    if (prefix === "m" ? isValidElementId(local) : /^[A-Za-z][A-Za-z0-9_-]*$/.test(local)) {
      used.add(prefix);
      return `${prefix}:${local}`;
    }
  }
  return `<${iri}>`;
}

const PREFIX_IRIS = { m: MODEL, pm: PM, rdfs: RDFS, xsd: XSD };

/**
 * Serialize triples as canonical Turtle: fixed prefixes, subjects ordered by
 * element type then identifier, predicates in vocabulary order, objects in
 * term order. The same graph always produces the same text, and comments are
 * not reproduced.
 */
export function serializeTurtle(triples) {
  const index = indexGraph(dedupe(triples));
  const used = new Set();
  const subjectRank = (iri) => {
    const type = index.typeOf(iri);
    return [type ? TYPE_ORDER.get(type) : TYPE_ORDER.size, iri];
  };
  const subjects = [...index.subjects.keys()].sort((a, b) => {
    const [ra, ia] = subjectRank(a);
    const [rb, ib] = subjectRank(b);
    return ra - rb || compareCodePoints(ia, ib);
  });
  const blocks = subjects.map((iri) => {
    const node = index.subjects.get(iri);
    const predicates = [...node.props.keys()].sort(
      (a, b) =>
        (PREDICATE_ORDER.get(a) ?? PREDICATE_ORDER.size) -
          (PREDICATE_ORDER.get(b) ?? PREDICATE_ORDER.size) || compareCodePoints(a, b),
    );
    const lines = predicates.map((p) => {
      const objects = node.props
        .get(p)
        .map((t) => formatTerm(t.o, used))
        .sort(compareCodePoints);
      return `${p === RDF_TYPE ? "a" : formatIri(p, used)} ${objects.join(", ")}`;
    });
    return `${formatIri(iri, used)} ${lines.join(" ;\n    ")} .`;
  });
  const header = [...used]
    .sort()
    .map((p) => `@prefix ${p}: <${PREFIX_IRIS[p]}> .`)
    .join("\n");
  return blocks.length ? `${header}\n\n${blocks.join("\n\n")}\n` : "";
}

function dedupe(triples) {
  const seen = new Map();
  for (const t of triples) if (!seen.has(tripleKey(t))) seen.set(tripleKey(t), t);
  return [...seen.values()];
}

const compareCodePoints = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ── semantic diff ──────────────────────────────────────────────────────

/**
 * Compare two model graphs triple by triple. Formatting, ordering, prefixes,
 * comments and the document an element lives in never appear; every reported
 * change carries its attribute family so callers can tell description-only
 * and lifecycle edits from business-fact changes.
 *
 * @returns {{same: boolean, elements: object[]}} one entry per changed element.
 */
export function diffGraphs(beforeTriples, afterTriples) {
  const before = new Map(dedupe(beforeTriples).map((t) => [tripleKey(t), t]));
  const after = new Map(dedupe(afterTriples).map((t) => [tripleKey(t), t]));
  const changes = new Map();
  const bucket = (s) => {
    if (!changes.has(s)) changes.set(s, { added: [], removed: [] });
    return changes.get(s);
  };
  for (const [k, t] of after) if (!before.has(k)) bucket(t.s).added.push(t);
  for (const [k, t] of before) if (!after.has(k)) bucket(t.s).removed.push(t);
  const beforeIndex = indexGraph([...before.values()]);
  const afterIndex = indexGraph([...after.values()]);
  const elements = [...changes.entries()]
    .sort(([a], [b]) => compareCodePoints(a, b))
    .map(([iri, { added, removed }]) => {
      const existedBefore = beforeIndex.subjects.has(iri);
      const existsAfter = afterIndex.subjects.has(iri);
      const byPredicate = new Map();
      for (const [side, list] of [
        ["added", added],
        ["removed", removed],
      ])
        for (const t of list) {
          if (!byPredicate.has(t.p)) byPredicate.set(t.p, { added: [], removed: [] });
          byPredicate.get(t.p)[side].push(formatTerm(t.o, new Set()));
        }
      return {
        id: elementId(iri) ?? iri,
        type: afterIndex.typeOf(iri) ?? beforeIndex.typeOf(iri),
        change: !existedBefore ? "added" : !existsAfter ? "removed" : "changed",
        properties: [...byPredicate.entries()]
          .sort(
            ([a], [b]) =>
              (PREDICATE_ORDER.get(a) ?? 99) - (PREDICATE_ORDER.get(b) ?? 99) ||
              compareCodePoints(a, b),
          )
          .map(([p, v]) => ({
            property: shortName(p),
            family: propertyFamily(p),
            added: v.added.sort(compareCodePoints),
            removed: v.removed.sort(compareCodePoints),
          })),
      };
    });
  return { same: elements.length === 0, elements };
}

/** `type`, `relation`, or an attribute family: `fact`, `description`, `lifecycle`. */
export function propertyFamily(iri) {
  if (iri === RDF_TYPE) return "type";
  if (RELATION_BY_IRI.has(iri)) return "relation";
  return ATTRIBUTE_BY_IRI.get(iri)?.kind ?? "unknown";
}

// ── lifecycle helpers shared by queries and the lifecycle workflows ─────

/** The process Status text, or null. */
export function processStatus(index, processIri) {
  return index.literal(processIri, "status")[0]?.value ?? null;
}

/** Deprecated and Superseded processes are retired: kept in the model, excluded by default. */
export function isRetired(index, processIri) {
  return /^(Deprecated|Superseded)\b/.test(processStatus(index, processIri) ?? "");
}

/**
 * Whether a step or a policy belongs to retired processes only: a step of a
 * retired process, or a policy that starts only such steps. Queries and views
 * leave these out unless retired processes are requested.
 */
export function inRetiredOnly(index, iri) {
  const type = index.typeOf(iri);
  if (type === "Step") {
    const p = processOfStep(index, iri);
    return p !== null && isRetired(index, p);
  }
  if (type === "Policy") {
    const started = index.out(iri, "starts").filter((s) => index.typeOf(s) === "Step");
    return started.length > 0 && started.every((s) => inRetiredOnly(index, s));
  }
  return false;
}

/** Whether a process is Accepted, whatever its date. */
export function isAccepted(index, processIri) {
  return /^Accepted\b/.test(processStatus(index, processIri) ?? "");
}

/** Whether a step is a system step: a target of realization, unlike an outside-system step. */
export function isSystemStep(index, stepIri) {
  return index.literal(stepIri, "stepKind")[0]?.value === "system";
}

/**
 * Whether a flow from one step to another crosses processes: each belongs to one
 * process and the two differ. Validation reports such a flow and the view marks it.
 */
export function flowCrossesProcesses(index, from, to) {
  const a = index.into(from, "hasStep");
  const b = index.into(to, "hasStep");
  return a.length === 1 && b.length === 1 && a[0] !== b[0];
}

/** The single process a step belongs to, or null when membership is broken. */
export function processOfStep(index, stepIri) {
  const owners = [...new Set(index.into(stepIri, "hasStep"))].filter(
    (p) => index.typeOf(p) === "Process",
  );
  return owners.length === 1 ? owners[0] : null;
}

const COMPOSITION_EXCLUDED = new Set([PM + "openScope"]);

/**
 * A process's business composition: its own
 * definition, start condition and outcome, its steps and criteria, events the
 * criteria pass through, actors performing its steps, policies starting its
 * steps and their triggering events, events its steps emit, concepts its steps
 * and those policies use, rules reaching its steps, and the relations among
 * them. Open scope, description and lifecycle attributes are not part of it,
 * nor is a fact-attribute text the user confirmed keeps its meaning.
 *
 * @param {{sameMeaning?: Set<string>}} [options] `element\u0000property` keys of
 *   confirmed same-meaning text changes (see `sameMeaningKeys`).
 * @returns {Set<string>} canonical triple keys, comparable across graphs.
 */
export function businessComposition(index, processIri, { sameMeaning } = {}) {
  const elements = new Set([processIri]);
  const steps = index.out(processIri, "hasStep").filter((s) => index.typeOf(s) === "Step");
  const criteria = index
    .into(processIri, "criterionOf")
    .filter((c) => index.typeOf(c) === "ObservationCriterion");
  const add = (list) => list.forEach((x) => elements.add(x));
  add(steps);
  add(criteria);
  for (const c of criteria) add(index.out(c, "passesThrough"));
  const policies = [];
  for (const s of steps) {
    add(index.into(s, "performs"));
    add(index.out(s, "emits"));
    add(index.out(s, "uses"));
    for (const p of index.into(s, "starts")) {
      policies.push(p);
      elements.add(p);
      add(index.into(p, "triggers"));
    }
  }
  for (const p of policies) add(index.out(p, "uses"));
  for (const rule of index.ofType("BusinessRule"))
    if (ruleReach(index, rule).some((s) => steps.includes(s))) elements.add(rule);

  const keys = new Set();
  for (const iri of elements) {
    const node = index.subjects.get(iri);
    if (!node) continue;
    for (const [p, list] of node.props) {
      const family = propertyFamily(p);
      if (COMPOSITION_EXCLUDED.has(p) || family === "description" || family === "lifecycle")
        continue;
      if (sameMeaning?.has(`${iri}\u0000${p}`)) continue;
      for (const t of list) {
        if (family === "relation" && !(t.o.type === "iri" && elements.has(t.o.value))) continue;
        keys.add(tripleKey(t));
      }
    }
  }
  return keys;
}

/** Open-scope items of a process and its steps, as comparable keys. */
export function openScopeKeys(index, processIri) {
  const keys = new Set();
  for (const iri of [processIri, ...index.out(processIri, "hasStep")])
    for (const t of index.subjects.get(iri)?.props.get(PM + "openScope") ?? [])
      keys.add(tripleKey(t));
  return keys;
}

export const sameKeys = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));

/**
 * A process's business composition together with its open scope: what an edit of
 * an Accepted process is flagged for, and what a renewal confirms a change of.
 */
export const compositionAndOpenScope = (index, processIri) =>
  new Set([...businessComposition(index, processIri), ...openScopeKeys(index, processIri)]);

/** Whether text names an element id as a whole: `payment.take-payment` is not named by `payment.take-payment.completed`. */
export function mentionsId(text, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w.:-])${escaped}(?![\\w-]|\\.[\\w-])`, "u").test(String(text));
}

/** The composition key of one confirmed same-meaning text change. */
export const sameMeaningKey = (id, shortProperty) =>
  `${elementIri(id)}\u0000${propertyIri(shortProperty)}`;

/** Expand `rdfs:label` / `pm:definition` to the property IRI, or null. */
function propertyIri(short) {
  if (short.startsWith("rdfs:")) return RDFS + short.slice(5);
  if (short.startsWith("pm:")) return PM + short.slice(3);
  return null;
}

/**
 * Turn confirmations `<id>=<property>` (a changed fact-attribute text the user
 * confirmed keeps its meaning) into composition keys. Only a literal fact
 * attribute of an element present in both models whose text actually changed
 * qualifies; relations, types and added or removed elements never do.
 *
 * @returns {{keys: Set<string>, errors: string[]}}
 */
export function sameMeaningKeys(confirmations, before, after) {
  const keys = new Set();
  const errors = [];
  for (const raw of confirmations ?? []) {
    const [id, short] = String(raw).split("=");
    const iri = isValidElementId(id ?? "") ? elementIri(id) : null;
    const p = short ? propertyIri(short.trim()) : null;
    const values = (index) => (index.subjects.get(iri)?.props.get(p) ?? []).map((t) => t.o);
    if (!iri || !p || propertyFamily(p) !== "fact" || ATTRIBUTE_BY_IRI.get(p)?.value !== "text") {
      errors.push(
        `"${raw}" is not <element id>=<free-text fact attribute>, e.g. ordering.submit-order=rdfs:label; a closed value such as a step kind never keeps its meaning when it changes`,
      );
      continue;
    }
    const was = before.subjects.has(iri) ? values(before) : null;
    const now = after.subjects.has(iri) ? values(after) : null;
    if (!was || !now || [...was, ...now].some((o) => o.type !== "literal")) {
      errors.push(`"${raw}" names no text of an element present before and after the change`);
      continue;
    }
    const text = (list) => list.map(termKey).sort().join("\u0001");
    if (text(was) === text(now)) {
      errors.push(`"${raw}" did not change, so there is nothing to confirm`);
      continue;
    }
    keys.add(`${iri}\u0000${p}`);
  }
  return { keys, errors };
}

// ── process lifecycle ─────────────────────────────────────────────────────

const DATED = (word) => new RegExp(`^${word} \\((\\d{4})-(\\d{2})-(\\d{2})\\)$`);

/**
 * Classify a process Status: `Proposed`, `Accepted (YYYY-MM-DD)`,
 * `Deprecated (YYYY-MM-DD)` or `Superseded`, with a real calendar date.
 *
 * @returns {{ok: boolean, state?: "Proposed"|"Accepted"|"Deprecated"|"Superseded", date?: string}}
 */
export function classifyProcessStatus(value) {
  if (value === "Proposed" || value === "Superseded") return { ok: true, state: value };
  for (const state of ["Accepted", "Deprecated"]) {
    const m = DATED(state).exec(value ?? "");
    if (!m) continue;
    const [, y, mo, d] = m.map(Number);
    const date = new Date(Date.UTC(y, mo - 1, d));
    const real =
      date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
    return real ? { ok: true, state, date: `${m[1]}-${m[2]}-${m[3]}` } : { ok: false };
  }
  return { ok: false };
}

/** Status findings inside one model: value, date, and the replacement of a Superseded process. */
export function statusFindings(index) {
  const out = [];
  for (const p of index.ofType("Process")) {
    const id = elementId(p);
    const status = processStatus(index, p);
    const where = `${index.subjects.get(p).first.doc}:${index.subjects.get(p).first.line}`;
    if (status === null) continue; // missing Status is reported as a missing attribute
    const st = classifyProcessStatus(status);
    if (!st.ok) {
      out.push({
        level: "error",
        code: "process-status",
        where,
        element: id,
        msg: `Status "${status}" is not Proposed, Accepted (YYYY-MM-DD), Deprecated (YYYY-MM-DD) or Superseded`,
      });
      continue;
    }
    const replacement = index.out(p, "replacedBy");
    if (st.state === "Superseded") {
      // The replacement's type is checked with the attribute values; here only presence and self-reference.
      if (replacement.length !== 1 || replacement[0] === p)
        out.push({
          level: "error",
          code: "process-status",
          where,
          element: id,
          msg: `a Superseded process names exactly one other process as its replacement (pm:replacedBy)`,
        });
    } else if (replacement.length)
      out.push({
        level: "error",
        code: "process-status",
        where,
        element: id,
        msg: `only a Superseded process has a replacement (pm:replacedBy)`,
      });
  }
  return out;
}

/** Allowed lifecycle transitions. Retired states are terminal. */
export const TRANSITIONS = {
  Proposed: ["Accepted", "Deprecated"],
  Accepted: ["Proposed", "Deprecated", "Superseded"],
  Deprecated: [],
  Superseded: [],
};

/**
 * The lines of `text` its base lacks, in order: the change-log lines a change added,
 * which `lifecycleFindings` reads as `changeLogAdded`. The base is split once, so the
 * cost grows with the log, not with its square.
 */
export function addedLines(text, base) {
  const had = new Set(base.split("\n"));
  return text
    .split("\n")
    .filter((l) => !had.has(l))
    .join("\n");
}

/**
 * Lifecycle changes between two models that ADR Writer's transitions cannot
 * explain: a new process that is not Proposed, a removed process, any change
 * after a retired state, a transition outside the allowed set, a re-dated
 * Accepted without a composition or open-scope change behind it (or whose gates
 * fail), Accepted→Proposed without a composition change since it became Accepted,
 * and a retirement without a change-log line naming the process. Proposed→Accepted
 * is only legitimate after an alignment review, and a re-dated Accepted after one
 * or after ADR Writer's renewal of a confirmed edit; callers must confirm which.
 *
 * @param {object} before Indexed base model.
 * @param {object} after Indexed current model.
 * @param {{changeLogAdded?: string|null, acceptedBaseline?: Map<string, {composition: Set<string>, openScope?: Set<string>, alternatives?: {composition: Set<string>, openScope: Set<string>}[]}>, promotion?: (p: string) => "holds"|"fails"|"unknown"|undefined}} [options]
 *   Lines the change log gained since the base (null: unknown); per process IRI the business
 *   composition (and open scope) where its base Accepted Status appeared (default:
 *   the base itself), with those of the commits that may have been that baseline
 *   behind commits history cannot read (`alternatives`), against any of which a
 *   change counts; and whether the mechanical alignment gates hold for a process
 *   in `after` (`unknown` when they cannot be judged; undefined when the caller does
 *   not vouch for the change at all). With gates that hold or cannot be judged, a
 *   promotion or re-dating inside the change — a new process, an approved change and
 *   its passing review saved together, or a renewal — is the warning such a change
 *   always is; with gates that fail, an error.
 * @returns {object[]} findings; `code: "process-lifecycle-needs-alignment"` marks a
 *   promotion or re-dating the caller must back with a passing alignment review or
 *   a confirmed renewal, and `"process-lifecycle-needs-approval"` a retirement the
 *   caller must back with an approved change unit.
 */
export function lifecycleFindings(
  before,
  after,
  { changeLogAdded = "", acceptedBaseline = null, promotion = () => undefined } = {},
) {
  const out = [];
  const promoted = (
    p,
    msg,
    backedBy = "only a passing alignment review makes a process Accepted",
  ) => {
    const gates = promotion(p);
    if (gates === "fails")
      add("error", "process-lifecycle", p, `${msg} while the alignment gates did not hold`);
    else add("warn", "process-lifecycle-needs-alignment", p, `${msg}; ${backedBy}`);
  };
  // The composition (and open scope) where the base's Accepted Status appeared, and
  // those that may have been its baseline behind commits history cannot read.
  const baseline = (p) => acceptedBaseline?.get(p) ?? {};
  const baselines = (p) => [baseline(p), ...(baseline(p).alternatives ?? [])];
  // A baseline nobody can see (`unseen`) may differ from every model: a demotion may
  // follow it, and so may ADR Writer's renewal once the user confirmed it, which a
  // re-dating by hand cannot be told from.
  const composed = (p) =>
    baselines(p).some(
      (b) =>
        b.unseen ||
        !sameKeys(b.composition ?? businessComposition(before, p), businessComposition(after, p)),
    );
  const scoped = (p) =>
    baselines(p).some(
      (b) =>
        b.unseen || !sameKeys(b.openScope ?? openScopeKeys(before, p), openScopeKeys(after, p)),
    );
  const add = (level, code, p, msg) => {
    const first = after.subjects.get(p)?.first ?? before.subjects.get(p)?.first;
    out.push({
      level,
      code,
      where: first ? `${first.doc}:${first.line}` : "docs/process",
      element: elementId(p),
      msg,
    });
  };
  for (const p of before.ofType("Process"))
    if (after.typeOf(p) !== "Process")
      add(
        "error",
        "process-lifecycle",
        p,
        `the process was removed; a process is retired (Deprecated or Superseded) and stays in the model`,
      );
  for (const p of after.ofType("Process")) {
    const now = classifyProcessStatus(processStatus(after, p));
    if (!now.ok) continue;
    const existed = before.typeOf(p) === "Process";
    if (!existed) {
      if (now.state === "Accepted" && promotion(p) !== undefined)
        promoted(p, "a new process was saved and became Accepted in one change");
      else if (now.state !== "Proposed")
        add(
          "error",
          "process-lifecycle",
          p,
          `a new process starts as Proposed, not ${processStatus(after, p)}`,
        );
      continue;
    }
    const was = classifyProcessStatus(processStatus(before, p));
    if (!was.ok) continue;
    const beforeReplacement = before.out(p, "replacedBy").join();
    const afterReplacement = after.out(p, "replacedBy").join();
    if (was.state === now.state) {
      if (
        (now.state === "Deprecated" || now.state === "Superseded") &&
        (was.date !== now.date || beforeReplacement !== afterReplacement)
      ) {
        add(
          "error",
          "process-lifecycle",
          p,
          `${was.state} is final; its lifecycle attributes never change`,
        );
        continue;
      }
      // An approved change and its passing review saved together re-date Accepted.
      // Re-dating Accepted is legitimate after a change that went through review
      // in the same change, or after a confirmed change that keeps the business
      // composition (open scope, same-meaning wording) — with gates that hold.
      if (now.state === "Accepted" && was.date !== now.date) {
        // A renewal records a later confirmation; an earlier date is no transition of ADR Writer's.
        if (now.date < was.date)
          add(
            "error",
            "process-lifecycle",
            p,
            `Accepted was re-dated from ${was.date} to the earlier ${now.date}; a renewal only records a later confirmation`,
          );
        else if ((composed(p) || scoped(p)) && promotion(p) !== undefined)
          promoted(
            p,
            "its composition or open scope changed and its Accepted date was renewed",
            "that is ADR Writer's renewal only when the user confirmed the change keeps the business composition, and otherwise needs a passing alignment review",
          );
        else
          add(
            "error",
            "process-lifecycle",
            p,
            `Accepted was re-dated without passing through Proposed and an alignment review`,
          );
      }
      if (beforeReplacement !== afterReplacement)
        add(
          "error",
          "process-lifecycle",
          p,
          `the replacement changed without a supersede approval`,
        );
      continue;
    }
    if (!TRANSITIONS[was.state].includes(now.state)) {
      add(
        "error",
        "process-lifecycle",
        p,
        `${was.state} → ${now.state} is not an allowed transition${TRANSITIONS[was.state].length ? "" : ` (${was.state} is final)`}`,
      );
      continue;
    }
    if (now.state === "Accepted") promoted(p, "became Accepted");
    if (now.state === "Proposed" && !composed(p))
      add(
        "error",
        "process-lifecycle",
        p,
        `Accepted → Proposed without a change to the process's business composition since it became Accepted`,
      );
    if (now.state === "Deprecated" || now.state === "Superseded") {
      // A change log nobody can see (null) leaves the line unknown, as the gates may be.
      if (changeLogAdded !== null && !mentionsId(changeLogAdded, elementId(p)))
        add(
          "error",
          "process-lifecycle",
          p,
          `${now.state} without a change-log line naming "${elementId(p)}" and the reason`,
        );
      // Like a promotion, a retirement cannot be told from one an approved save made.
      else
        add(
          "warn",
          "process-lifecycle-needs-approval",
          p,
          `the process became ${now.state}; only an approved change unit retires a process, so report it unless an approved save made it`,
        );
    }
  }
  return out;
}

/**
 * Processes whose business composition differs between two models. Retired
 * processes never change Status; open scope alone and confirmed same-meaning
 * wording never count.
 *
 * @param {{sameMeaning?: Set<string>}} [options] Keys from `sameMeaningKeys`.
 * @returns {string[]} process ids that a saved semantic change makes Proposed.
 */
export function processesToPropose(before, after, { sameMeaning } = {}) {
  const out = [];
  for (const p of after.ofType("Process")) {
    if (isRetired(after, p) || isRetired(before, p)) continue;
    if (before.typeOf(p) !== "Process") {
      out.push(elementId(p));
      continue;
    }
    if (
      !sameKeys(
        businessComposition(before, p, { sameMeaning }),
        businessComposition(after, p, { sameMeaning }),
      )
    )
      out.push(elementId(p));
  }
  return out.sort();
}

/**
 * Major-change candidates for the change log: additions and removals
 * of steps, policies, rules, events and criteria; changes of the listed
 * relations; reaction-condition and rule-definition changes; definition changes
 * of events, concepts and actors. Whether a text change keeps the same meaning
 * is a judgment for the caller; this list is only the candidates, without the
 * text changes already confirmed as same-meaning.
 */
export function majorChangeCandidates(beforeTriples, afterTriples, { sameMeaning } = {}) {
  const RELATED = new Set(
    [
      "flowsTo",
      "emits",
      "triggers",
      "starts",
      "uses",
      "constrains",
      "performs",
      "passesThrough",
    ].map((k) => `pm:${k}`),
  );
  const LOGGED_TYPES = new Set([
    "Step",
    "Policy",
    "BusinessRule",
    "BusinessEvent",
    "ObservationCriterion",
  ]);
  const out = [];
  for (const e of diffGraphs(beforeTriples, afterTriples).elements) {
    if ((e.change === "added" || e.change === "removed") && LOGGED_TYPES.has(e.type)) {
      out.push({ id: e.id, type: e.type, change: e.change });
      continue;
    }
    const confirmed = (p) =>
      sameMeaning?.has(`${elementIri(e.id)}\u0000${propertyIri(p.property)}`);
    const props = e.properties.filter(
      (p) =>
        !confirmed(p) &&
        (RELATED.has(p.property) ||
          p.property === "pm:reactionCondition" ||
          (p.property === "pm:definition" &&
            ["BusinessRule", "BusinessEvent", "BusinessConcept", "Actor"].includes(e.type))),
    );
    if (props.length)
      out.push({
        id: e.id,
        type: e.type,
        change: "changed",
        properties: props.map((p) => p.property),
      });
  }
  return out;
}
