import { attribute, decodeXml, escapeXmlAttribute, escapeXmlText } from "../../xml.js";

export interface GlossaryEntry {
  term: string;
  definition: string;
}

/** Normalize surrounding whitespace and equivalent Unicode spelling, preserving meaningful case. */
export function glossaryKey(term: string): string {
  return term.trim().normalize("NFC");
}

/**
 * Read the optional trailing glossary without interpreting prose as terminology.
 * Reject malformed, empty, or duplicate entries before a document can be selected or rewritten.
 */
export function parseGlossary(content: string): GlossaryEntry[] {
  const blocks = [...content.matchAll(/<glossary\b[^>]*>[\s\S]*?<\/glossary>/g)];
  if (!/<\/?glossary\b/.test(content)) return [];
  if (
    blocks.length !== 1 ||
    !blocks[0][0].startsWith("<glossary>") ||
    !/^\s*<\/(?:alps-document|prd-document)>\s*$/.test(
      content.slice(blocks[0].index! + blocks[0][0].length),
    ) ||
    /<\/?glossary\b/.test(content.slice(0, blocks[0].index))
  ) {
    throw new Error("Glossary must appear exactly once, after all sections.");
  }

  const body = blocks[0][0].slice("<glossary>".length, -"</glossary>".length);
  const entries: GlossaryEntry[] = [];
  const seen = new Set<string>();
  const remainder = body.replace(/<entry\b([^>]*)>([\s\S]*?)<\/entry>/g, (_, attrs, value) => {
    const term = attribute(attrs, "term")?.trim();
    const definition = decodeXml(value.trim()).trim();
    if (!term || !definition || /[<>]/.test(value)) {
      throw new Error("Glossary entries require a term and an escaped, non-empty definition.");
    }
    const key = glossaryKey(term);
    if (seen.has(key)) throw new Error(`Duplicate glossary term: ${term}`);
    seen.add(key);
    entries.push({ term, definition });
    return "";
  });
  if (remainder.trim() || entries.length === 0) {
    throw new Error("Glossary must contain only non-empty term definitions.");
  }
  return entries;
}

/** Persist only actual definitions; new documents have no empty appendix placeholder. */
export function buildGlossary(entries: readonly GlossaryEntry[]): string {
  if (entries.length === 0) return "";
  return [
    "<glossary>",
    ...entries.map(
      ({ term, definition }) =>
        `<entry term="${escapeXmlAttribute(term)}">${escapeXmlText(definition)}</entry>`,
    ),
    "</glossary>",
  ].join("\n");
}

/** Render the shared two-column appendix after the profile's unchanged numbered sections. */
export function glossaryMarkdown(entries: readonly GlossaryEntry[]): string {
  const cell = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
  return [
    "## Appendix: Glossary",
    "",
    "| Term | Meaning in this document |",
    "| --- | --- |",
    ...entries.map(({ term, definition }) => `| ${cell(term)} | ${cell(definition)} |`),
  ].join("\n");
}
