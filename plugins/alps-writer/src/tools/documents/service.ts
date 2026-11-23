import { createHash } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { NOT_STARTED } from "../../constants.js";
import {
  ALPS_PROFILE,
  DOCUMENT_PROFILES,
  LITE_ALPS_PROFILE,
  type DocumentProfile,
  type DocumentProfileId,
  type InitializableDocumentProfileId,
  isLiteProfile,
  sectionNumbers,
  sectionRange,
} from "../../profiles.js";
import { attribute, decodeXml, escapeXmlAttribute, escapeXmlText } from "../../xml.js";
import { TemplateRegistry } from "../templates/registry.js";
import { featureCoverage } from "./feature-coverage.js";
import {
  requirementDefinitions,
  requirementReferences,
  sortRequirementIds,
} from "./requirement-ids.js";
import {
  buildGlossary,
  glossaryKey,
  glossaryMarkdown,
  parseGlossary,
  type GlossaryEntry,
} from "./glossary.js";

// Subsection IDs sort by their numeric components ("7.10" after "7.9"), not
// lexically. Used wherever subsections are rendered in order.
const bySubsectionId = ([a]: [string, unknown], [b]: [string, unknown]) =>
  a.localeCompare(b, undefined, { numeric: true });

const ALLOWED_ARCHITECTURE_DIAGRAMS = new Set(["C4Context", "C4Container"]);

function mermaidDiagramTypes(content: string): string[] {
  return [...content.matchAll(/```mermaid\s*\r?\n([\s\S]*?)```/g)]
    .map(
      (match) =>
        match[1]
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find((line) => line && !line.startsWith("%%"))
          ?.split(/\s+/)[0],
    )
    .filter((type): type is string => Boolean(type));
}

function architectureDiagramError(content: string): string | null {
  const diagramTypes = mermaidDiagramTypes(content);

  for (const required of ALLOWED_ARCHITECTURE_DIAGRAMS) {
    if (!diagramTypes.includes(required)) {
      return `Section 4.1 requires a Mermaid ${required} diagram.`;
    }
  }

  const disallowed = diagramTypes.find((type) => !ALLOWED_ARCHITECTURE_DIAGRAMS.has(type));
  if (disallowed) {
    return `Section 4.1 allows only Mermaid C4Context and C4Container diagrams; found ${disallowed}.`;
  }

  return null;
}

const LITE_CONTEXT_DIAGRAM_SUBSECTION = "3.2";

function liteBusinessContextDiagramError(content: string): string | null {
  const diagramTypes = mermaidDiagramTypes(content);
  const contextCount = diagramTypes.filter((type) => type === "C4Context").length;
  if (contextCount !== 1) {
    return `Lite ALPS Section ${LITE_CONTEXT_DIAGRAM_SUBSECTION} requires exactly one Mermaid C4Context diagram.`;
  }

  const disallowed = diagramTypes.find((type) => type.startsWith("C4") && type !== "C4Context");
  if (disallowed) {
    return `Lite ALPS Section ${LITE_CONTEXT_DIAGRAM_SUBSECTION} allows only Mermaid C4Context diagrams; found ${disallowed}.`;
  }

  return null;
}

/** Content identity of a Lite source, used to notice changes after the last Full save. */
function sourceFingerprint(content: string): string {
  return createHash("sha256").update(content.replace(/\r\n/g, "\n").trim()).digest("hex");
}

type LoadedDocument = { content: string; profile: DocumentProfile };

/** Root attributes a Full document derived from Lite carries across every rebuild. */
type SourceLink = { source: string; fingerprint: string | null };

type SectionState = { section: number; title: string; status: string; complete: boolean };

type LiteRequirementState = {
  defined: Set<string>;
  duplicates: string[];
  undefinedReferences: string[];
};

type LiteSource =
  | { ok: true; link: SourceLink; content: string; defined: Set<string> }
  | { ok: false; link: SourceLink; reason: string };

export class DocumentService {
  private workingDoc: string | null = null;
  private readonly templates: Readonly<Record<DocumentProfileId, TemplateRegistry>>;

  constructor(
    alpsTemplates = new TemplateRegistry(),
    liteTemplates = new TemplateRegistry(
      LITE_ALPS_PROFILE.chaptersDir,
      LITE_ALPS_PROFILE.dynamicSection?.section ?? null,
    ),
  ) {
    this.templates = {
      alps: alpsTemplates,
      lite: liteTemplates,
    };
  }

  /** Bind one tool operation to its explicit document, sharing only immutable templates. */
  forDocument(docPath: string): DocumentService {
    const scoped = new DocumentService(this.templates.alps, this.templates.lite);
    scoped.selectDocument(docPath);
    return scoped;
  }

  private isNotStarted(sectionContent: string): boolean {
    return !sectionContent || sectionContent.includes(NOT_STARTED);
  }

  private parseSections(content: string): Map<number, string> {
    const sections = new Map<number, string>();
    const re = /<section\b([^>]*)>\s*([\s\S]*?)<\/section>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const id = attribute(match[1], "id");
      if (id && /^\d+$/.test(id)) {
        sections.set(Number.parseInt(id, 10), match[2].trim());
      }
    }
    return sections;
  }

  private parseSectionHeaders(content: string): { id: number; title: string | null }[] {
    const headers: { id: number; title: string | null }[] = [];
    const re = /<section\b([^>]*)>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const id = attribute(match[1], "id");
      const title = attribute(match[1], "title");
      if (id && /^\d+$/.test(id)) {
        headers.push({ id: Number.parseInt(id, 10), title });
      }
    }
    return headers;
  }

  private parseSubsections(
    sectionContent: string,
    sectionId: number,
  ): Map<string, { title: string; content: string }> {
    const subsections = new Map<string, { title: string; content: string }>();
    const re = /<subsection\b([^>]*)>\s*([\s\S]*?)\s*<\/subsection>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(sectionContent)) !== null) {
      const id = attribute(match[1], "id");
      const title = attribute(match[1], "title");
      if (!id || title == null || !id.startsWith(`${sectionId}.`)) continue;
      subsections.set(id, { title, content: decodeXml(match[2].trim()) });
    }
    return subsections;
  }

  private hasUnparsedContent(sectionContent: string): boolean {
    const remainder = sectionContent
      .replace(/<subsection\b[^>]*>\s*[\s\S]*?\s*<\/subsection>/g, "")
      .replace(/<!--\s*Not started\s*-->/g, "")
      .trim();
    return remainder.length > 0;
  }

  private fixedSubsectionError(
    profile: DocumentProfile,
    section: number,
    sectionContent: string,
  ): string | null {
    if (this.hasUnparsedContent(sectionContent)) {
      return `Lite ALPS Section ${section} contains unrecognized content.`;
    }

    const seen = new Set<string>();
    const subsectionRe = /<subsection\b([^>]*)>\s*[\s\S]*?\s*<\/subsection>/g;
    let subsectionMatch: RegExpExecArray | null;
    while ((subsectionMatch = subsectionRe.exec(sectionContent)) !== null) {
      const id = attribute(subsectionMatch[1], "id");
      const title = attribute(subsectionMatch[1], "title");
      const prefix = `${section}.`;
      if (!id || title == null || !id.startsWith(prefix)) {
        return `Lite ALPS Section ${section} contains a subsection with an invalid id or title.`;
      }
      if (seen.has(id)) {
        return `Lite ALPS subsection ${id} must appear exactly once.`;
      }
      seen.add(id);

      const validation = this.templates[profile.id].validateSubsection(
        section,
        id.slice(prefix.length),
        title,
      );
      if (!validation.ok) return `Lite ALPS ${validation.message}`;
    }
    return null;
  }

  private buildSubsection(subId: string, title: string, content: string): string {
    return `<subsection id="${escapeXmlAttribute(subId)}" title="${escapeXmlAttribute(title)}">\n${escapeXmlText(content)}\n</subsection>`;
  }

  private buildSection(profile: DocumentProfile, sectionId: number, content: string): string {
    return `<section id="${sectionId}" title="${escapeXmlAttribute(profile.sectionTitles[sectionId])}">\n${content}\n</section>`;
  }

  /** Rebuild numbered sections while preserving the optional trailing term definitions. */
  private buildDocument(
    profile: DocumentProfile,
    projectName: string,
    sections: Map<number, string>,
    glossary: readonly GlossaryEntry[] = [],
    sourceLink: SourceLink | null = null,
  ): string {
    const profileAttribute = profile.rootProfile
      ? ` profile="${escapeXmlAttribute(profile.rootProfile)}"`
      : "";
    const sourceAttributes = sourceLink
      ? ` source="${escapeXmlAttribute(sourceLink.source)}"${
          sourceLink.fingerprint
            ? ` source-fingerprint="${escapeXmlAttribute(sourceLink.fingerprint)}"`
            : ""
        }`
      : "";
    const lines = [
      `<alps-document project="${escapeXmlAttribute(projectName)}"${profileAttribute}${sourceAttributes}>`,
    ];
    for (const section of sectionNumbers(profile)) {
      lines.push(this.buildSection(profile, section, sections.get(section) || NOT_STARTED));
    }
    if (glossary.length > 0) lines.push(buildGlossary(glossary));
    lines.push("</alps-document>");
    return lines.join("\n\n");
  }

  /** Read the Lite source a Full document records, if any. */
  private extractSourceLink(content: string): SourceLink | null {
    const root = content.match(/<(?:alps-document|prd-document)\b([^>]*)>/);
    const source = root ? attribute(root[1], "source") : null;
    if (!source) return null;
    return { source, fingerprint: attribute(root![1], "source-fingerprint") };
  }

  private extractProjectName(content: string): string {
    const root = content.match(/<(?:alps-document|prd-document)\b([^>]*)>/);
    if (root) {
      const project = attribute(root[1], "project");
      if (project) return project;
    }
    const match = content.match(/^# (.+?) (?:Lite )?(?:ALPS|PRD)/m);
    return match ? match[1] : "Untitled";
  }

  /** Validate the active profile and glossary before selecting or mutating a document. */
  private inspectDocument(content: string): { profile: DocumentProfile } | { error: string } {
    const root = content.match(/^\s*<(alps-document|prd-document)\b([^>]*)>/);
    if (!root) return { error: "Missing <alps-document> root element." };
    if (!new RegExp(`</${root[1]}>\\s*$`).test(content)) {
      return { error: `Missing closing </${root[1]}> element.` };
    }
    try {
      parseGlossary(content);
    } catch (error) {
      return { error: (error as Error).message };
    }

    const profileValue = attribute(root[2], "profile");
    const headers = this.parseSectionHeaders(content);
    let profile: DocumentProfile | null = null;
    if (profileValue == null || profileValue === "" || profileValue === "alps") {
      profile = ALPS_PROFILE;
    } else if (profileValue === LITE_ALPS_PROFILE.rootProfile) {
      const headerIds = headers.map(({ id }) => id);
      const currentIds = sectionNumbers(LITE_ALPS_PROFILE);
      if (
        currentIds.length === headerIds.length &&
        currentIds.every((section, index) => section === headerIds[index])
      ) {
        profile = LITE_ALPS_PROFILE;
      } else {
        return {
          error: `Lite ALPS documents must contain Sections ${sectionRange(LITE_ALPS_PROFILE)} exactly once and in order.`,
        };
      }
    }
    if (!profile) return { error: `Unknown ALPS document profile: ${profileValue}.` };

    const sections = this.parseSections(content);
    if (sections.size === 0) return { error: "Document contains no valid sections." };
    if (isLiteProfile(profile)) {
      // The section ids were matched when the Lite profile was chosen above.
      const expected = sectionNumbers(profile);
      const titleMismatch = expected.find(
        (section, index) => headers[index]?.title !== profile.sectionTitles[section],
      );
      if (titleMismatch != null) {
        return {
          error: `Lite ALPS Section ${titleMismatch} title must be "${profile.sectionTitles[titleMismatch]}".`,
        };
      }
      for (const section of expected) {
        const subsectionError = this.fixedSubsectionError(
          profile,
          section,
          sections.get(section) || "",
        );
        if (subsectionError) return { error: subsectionError };
      }
    }
    return { profile };
  }

  private readWorkingDocument(): LoadedDocument {
    if (!this.workingDoc) {
      throw new Error(
        "No document loaded. Call alps_document(action: 'init', profile: 'full', project_name, output_path), alps_document(action: 'init', profile: 'lite', project_name, output_path), or alps_document(action: 'load', doc_path) first.",
      );
    }

    let content: string;
    try {
      content = fs.readFileSync(this.workingDoc, "utf-8");
    } catch (error) {
      throw new Error(`Unable to read ${this.workingDoc}: ${(error as Error).message}`, {
        cause: error,
      });
    }

    const inspection = this.inspectDocument(content);
    if ("error" in inspection) {
      throw new Error(`Invalid ALPS document at ${this.workingDoc}: ${inspection.error}`);
    }
    return { content, profile: inspection.profile };
  }

  private writeAtomic(filepath: string, content: string): void {
    const temporary = `${filepath}.tmp-${process.pid}-${Date.now()}`;
    try {
      fs.writeFileSync(temporary, content, "utf-8");
      fs.renameSync(temporary, filepath);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  private expandHome(value: string): string {
    return value.startsWith("~") ? path.join(os.homedir(), value.slice(1)) : value;
  }

  private get outputDir(): string {
    const dir =
      process.env.ALPS_OUTPUT_DIR || process.env.PRD_OUTPUT_DIR || path.join(process.cwd(), "prd");
    return this.expandHome(dir);
  }

  private expandPath(value: string): string {
    if (value.startsWith("~")) return this.expandHome(value);
    if (path.isAbsolute(value)) return value;
    return path.resolve(this.outputDir, value);
  }

  private pathError(filepath: string, profile: DocumentProfile): string | null {
    const lower = filepath.toLowerCase();
    if (isLiteProfile(profile)) {
      return lower.endsWith(profile.filenameSuffix)
        ? null
        : `Invalid document path: ${filepath}. Lite ALPS documents must use the ${profile.filenameSuffix} extension.`;
    }
    if (
      !lower.endsWith(profile.filenameSuffix) ||
      lower.endsWith(LITE_ALPS_PROFILE.filenameSuffix)
    ) {
      return `Invalid document path: ${filepath}. ALPS documents must use the ${profile.filenameSuffix} extension.`;
    }
    return null;
  }

  initDocument(
    projectName: string,
    outputPath: string,
    profileId: InitializableDocumentProfileId = "alps",
    sourceDocPath?: string,
  ): string {
    this.workingDoc = null;
    const profile = DOCUMENT_PROFILES[profileId];
    if (sourceDocPath != null && isLiteProfile(profile)) {
      throw new Error(
        "A Lite source applies only to Full ALPS initialization; Lite ALPS documents have no source.",
      );
    }
    let filepath = this.expandPath(outputPath);
    if (!path.extname(filepath)) filepath += profile.filenameSuffix;

    const pathError = this.pathError(filepath, profile);
    if (pathError) throw new Error(pathError);
    if (fs.existsSync(filepath)) {
      throw new Error(
        `Document already exists at ${filepath}. Use alps_document(action: 'load', doc_path) to resume.`,
      );
    }
    const sourceLink =
      sourceDocPath == null ? null : this.completedLiteSource(sourceDocPath, filepath);

    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    try {
      fs.writeFileSync(
        filepath,
        this.buildDocument(profile, projectName, new Map(), [], sourceLink),
        {
          encoding: "utf-8",
          flag: "wx",
        },
      );
    } catch (error) {
      if ((error as Error & { code?: string }).code === "EEXIST") {
        throw new Error(
          `Document already exists at ${filepath}. Use alps_document(action: 'load', doc_path) to resume.`,
          { cause: error },
        );
      }
      throw error;
    }
    this.workingDoc = filepath;
    return sourceLink
      ? `Created ${profile.label} document at ${filepath}\nLite source: ${sourceLink.source}`
      : `Created ${profile.label} document at ${filepath}`;
  }

  /**
   * Accept only a completed current-format Lite document as a Full source and
   * return the link recorded relative to the Full document. Nothing is written.
   */
  private completedLiteSource(sourceDocPath: string, fullPath: string): SourceLink {
    const sourcePath = this.expandPath(sourceDocPath);
    if (!sourcePath.toLowerCase().endsWith(LITE_ALPS_PROFILE.filenameSuffix)) {
      throw new Error(
        `Invalid Lite source: ${sourcePath}. A Full ALPS source must be a ${LITE_ALPS_PROFILE.filenameSuffix} document.`,
      );
    }
    let content: string;
    try {
      content = fs.readFileSync(sourcePath, "utf-8");
    } catch (error) {
      throw new Error(`Lite source not readable at ${sourcePath}: ${(error as Error).message}`, {
        cause: error,
      });
    }
    const inspection = this.inspectDocument(content);
    if ("error" in inspection)
      throw new Error(`Invalid Lite source at ${sourcePath}: ${inspection.error}`);
    if (!isLiteProfile(inspection.profile)) {
      throw new Error(`Invalid Lite source at ${sourcePath}: the document is not Lite ALPS.`);
    }
    const incomplete = this.liteIncompleteReasons(content);
    if (incomplete.length > 0) {
      throw new Error(
        `Lite source at ${sourcePath} is not complete: ${incomplete.join("; ")}. Complete the Lite document before deriving Full ALPS.`,
      );
    }
    const relative = path.relative(path.dirname(fullPath), sourcePath).split(path.sep).join("/");
    return { source: relative, fingerprint: sourceFingerprint(content) };
  }

  /** Resolve the recorded Lite source and its defined identifiers without failing the Full request. */
  private readLiteSource(link: SourceLink): LiteSource {
    const sourcePath = path.resolve(path.dirname(this.workingDoc!), link.source);
    let content: string;
    try {
      content = fs.readFileSync(sourcePath, "utf-8");
    } catch (error) {
      return { ok: false, link, reason: `not readable (${(error as Error).message})` };
    }
    const inspection = this.inspectDocument(content);
    if ("error" in inspection) return { ok: false, link, reason: inspection.error };
    if (!isLiteProfile(inspection.profile)) {
      return { ok: false, link, reason: "the document is not Lite ALPS" };
    }
    return { ok: true, link, content, defined: this.liteRequirements(content).defined };
  }

  /** Requirement identifiers a Lite document defines, duplicates and dangling references. */
  private liteRequirements(content: string): LiteRequirementState {
    const owners = LITE_ALPS_PROFILE.requirementOwners ?? {};
    const sections = this.parseSections(content);
    const defined = new Set<string>();
    const duplicates = new Set<string>();
    const referenced = new Set<string>();
    for (const [section, sectionContent] of sections) {
      for (const [id, subsection] of this.parseSubsections(sectionContent, section)) {
        for (const reference of requirementReferences(subsection.content))
          referenced.add(reference);
        const owned = owners[id];
        if (!owned) continue;
        for (const [definition, count] of requirementDefinitions(subsection.content, owned)) {
          defined.add(definition);
          if (count > 1) duplicates.add(definition);
        }
      }
    }
    const undefinedReferences = [...referenced].filter((id) => !defined.has(id));
    return {
      defined,
      duplicates: sortRequirementIds(duplicates),
      undefinedReferences: sortRequirementIds(undefinedReferences),
    };
  }

  /** Reasons a Lite document is not complete; empty when it is. */
  private liteIncompleteReasons(content: string): string[] {
    const reasons: string[] = [];
    const pending = this.sectionStates(content, LITE_ALPS_PROFILE).filter(
      (state) => !state.complete,
    );
    if (pending.length > 0) {
      reasons.push(
        `required Sections not written: ${pending.map((state) => state.section).join(", ")}`,
      );
    }
    const requirements = this.liteRequirements(content);
    if (requirements.duplicates.length > 0) {
      reasons.push(`duplicate requirement definitions: ${requirements.duplicates.join(", ")}`);
    }
    if (requirements.undefinedReferences.length > 0) {
      reasons.push(
        `undefined requirement references: ${requirements.undefinedReferences.join(", ")}`,
      );
    }
    return reasons;
  }

  /**
   * Keeps resume guidance aligned with each profile's authoring contract.
   * Full ALPS remains question-first, while Lite asks only for missing or
   * protected context and preserves proposal-first Sections 2 and 4.
   */
  private resumeGuidance(profile: DocumentProfile): string {
    const steps = isLiteProfile(profile)
      ? `1. Call alps_template(action: 'guide', profile: '${isLiteProfile(profile) ? "lite" : "full"}', section: N) before working on any section
2. Follow the guide: ask only for missing user-owned context, undefined terms or protected decisions, but propose Sections 2-6 and 8 before asking the user to design them
3. Wait for a user response only when the guide requires a focused question; otherwise present the proposal for approval
4. Get explicit "yes" confirmation before calling alps_section(action: 'save', doc_path, section, subsection_id, title, content)`
      : `1. Call alps_template(action: 'guide', profile: '${isLiteProfile(profile) ? "lite" : "full"}', section: N) before working on any section
2. Reuse supplied context. Ask 1-2 focused questions at a time only for missing information. DO NOT auto-generate content that invents missing product decisions
3. Wait when a question needs an answer; otherwise present the section's approval digest
4. Get explicit "yes" confirmation before calling alps_section(action: 'save', doc_path, section, subsection_id, title, content)`;

    return `⚠️ CONVERSATION MODE REQUIRED:
${steps}
Read alps_glossary(action: 'read', doc_path) when terminology is needed. Require the user's meaning for undefined jargon or acronyms before finalizing dependent content; reuse supplied definitions. Save confirmed definitions with alps_glossary(action: 'save', doc_path, term, definition) under the current section approval. The optional appendix stays after the numbered sections and is absent when unnecessary.
NEVER save generated content without user approval.`;
  }

  /**
   * Selects only structurally valid ALPS documents and returns the matching
   * profile's conversation rules so resume cannot cross document boundaries.
   */
  loadDocument(docPath: string): string {
    const profile = this.selectDocument(docPath);
    return `${this.getStatus()}

---
${this.resumeGuidance(profile)}`;
  }

  /**
   * Select a structurally valid ALPS document at a path its profile allows. Every
   * request selects its document this way; only loading also reports the status.
   */
  private selectDocument(docPath: string): DocumentProfile {
    this.workingDoc = null;
    const filepath = this.expandPath(docPath);
    if (!filepath.toLowerCase().endsWith(ALPS_PROFILE.filenameSuffix)) {
      throw new Error(
        `Invalid document path: ${filepath}. ALPS documents must use the .alps.xml extension.`,
      );
    }
    if (!fs.existsSync(filepath)) throw new Error(`Document not found at ${filepath}`);

    let content: string;
    try {
      content = fs.readFileSync(filepath, "utf-8");
    } catch (error) {
      throw new Error(`Unable to read ${filepath}: ${(error as Error).message}`, { cause: error });
    }

    const inspection = this.inspectDocument(content);
    if ("error" in inspection)
      throw new Error(`Invalid ALPS document at ${filepath}: ${inspection.error}`);
    const pathError = this.pathError(filepath, inspection.profile);
    if (pathError) throw new Error(pathError);

    this.workingDoc = filepath;
    return inspection.profile;
  }

  /** Save one approved subsection without dropping definitions collected elsewhere in the document. */
  saveSection(section: number, subsectionId: string, title: string, content: string): string {
    const document = this.readWorkingDocument();

    const { profile } = document;
    if (!(section in profile.sectionTitles)) {
      throw new Error(
        `Invalid section number: ${section}. Must be ${sectionRange(profile)} for ${profile.label}.`,
      );
    }

    const subsection = this.templates[profile.id].validateSubsection(section, subsectionId, title);
    if (!subsection.ok) throw new Error(`Invalid subsection: ${subsection.message}`);
    if (profile.id === "alps" && subsection.fullId === "4.1") {
      const diagramError = architectureDiagramError(content);
      if (diagramError) throw new Error(`Invalid subsection content: ${diagramError}`);
    }
    if (profile.id === "lite" && subsection.fullId === LITE_CONTEXT_DIAGRAM_SUBSECTION) {
      const diagramError = liteBusinessContextDiagramError(content);
      if (diagramError) throw new Error(`Invalid subsection content: ${diagramError}`);
    }
    const owned = profile.requirementOwners?.[subsection.fullId];
    if (owned) {
      const duplicates = [...requirementDefinitions(content, owned)]
        .filter(([, count]) => count > 1)
        .map(([id]) => id);
      if (duplicates.length > 0) {
        throw new Error(
          `Invalid subsection content: requirement identifiers must be defined once in ${subsection.fullId}; duplicated: ${sortRequirementIds(duplicates).join(", ")}.`,
        );
      }
    }

    const projectName = this.extractProjectName(document.content);
    const sections = this.parseSections(document.content);
    const sectionContent = sections.get(section) || "";
    if (this.hasUnparsedContent(sectionContent)) {
      throw new Error(
        `Cannot safely update Section ${section}: it contains unrecognized content. Export or migrate it before saving a subsection.`,
      );
    }

    const existing = this.parseSubsections(sectionContent, section);
    existing.set(subsection.fullId, { title, content });
    const parts = [...existing.entries()]
      .sort(bySubsectionId)
      .map(([id, value]) => this.buildSubsection(id, value.title, value.content));
    sections.set(section, parts.join("\n"));

    const sourceLink = this.extractSourceLink(document.content);
    if (sourceLink) {
      // Record the Lite content this save was written against; an unreadable source keeps its last fingerprint.
      const source = this.readLiteSource(sourceLink);
      if (source.ok) sourceLink.fingerprint = sourceFingerprint(source.content);
    }

    this.writeAtomic(
      this.workingDoc!,
      this.buildDocument(
        profile,
        projectName,
        sections,
        parseGlossary(document.content),
        sourceLink,
      ),
    );
    return `Saved ${subsection.fullId}. ${title}`;
  }

  /**
   * Save one user-confirmed meaning while preserving all other entries and section content.
   * Semantic confirmation belongs to the conversation; blank input is rejected without a write.
   */
  saveGlossaryEntry(term: string, definition: string): string {
    const document = this.readWorkingDocument();
    term = term.trim();
    definition = definition.trim();
    if (!term || !definition)
      throw new Error("Glossary term and definition must both be non-empty.");

    const entries = parseGlossary(document.content);
    const existing = entries.find((entry) => glossaryKey(entry.term) === glossaryKey(term));
    if (existing?.definition === definition) return `Glossary unchanged: ${existing.term}`;
    if (existing) existing.definition = definition;
    else entries.push({ term, definition });

    const glossary = buildGlossary(entries);
    const content = document.content.includes("<glossary>")
      ? document.content.replace(/<glossary>[\s\S]*?<\/glossary>/, () => glossary)
      : document.content.replace(
          /<\/(?:alps-document|prd-document)>\s*$/,
          (closing) => `${glossary}\n\n${closing}`,
        );
    this.writeAtomic(this.workingDoc!, content);
    return `Saved glossary term: ${existing?.term ?? term}`;
  }

  /** Return definitions for reuse without creating an appendix or changing completion state. */
  readGlossary(): string {
    const document = this.readWorkingDocument();
    const entries = parseGlossary(document.content);
    return entries.length
      ? glossaryMarkdown(entries)
      : "No glossary: no term definitions recorded.";
  }

  readSection(section: number, subsectionId?: string): string {
    const document = this.readWorkingDocument();
    if (!(section in document.profile.sectionTitles))
      throw new Error(`Section ${section} not found.`);

    const sections = this.parseSections(document.content);
    const content = sections.get(section) || "";
    if (subsectionId != null) {
      const subId = `${section}.${subsectionId}`;
      const subsection = this.parseSubsections(content, section).get(subId);
      if (subsection) return `### ${subId}. ${subsection.title}\n\n${subsection.content}`;
      throw new Error(`Subsection ${subId} not found.`);
    }

    const display = this.sectionIsUnwritten(content, section)
      ? "*Not yet written*"
      : this.contentToMarkdown(content, section);
    return `## Section ${section}. ${document.profile.sectionTitles[section]}\n\n${display}`;
  }

  getStatus(): string {
    const document = this.readWorkingDocument();

    const { content: docContent, profile } = document;
    const projectName = this.extractProjectName(docContent);
    const lines = [`${profile.label} Document: ${projectName}`, `Location: ${this.workingDoc}`, ""];
    const states = this.sectionStates(docContent, profile);
    for (const state of states) {
      lines.push(`Section ${state.section} (${state.title}): ${state.status}`);
    }
    const glossary = parseGlossary(docContent);
    if (glossary.length > 0) lines.push(`Appendix (Glossary): ${glossary.length} defined terms`);

    const pending = states.filter((state) => !state.complete).map((state) => state.section);
    if (isLiteProfile(profile)) {
      lines.push("", ...this.liteRequirementLines(docContent, pending));
    } else {
      const sourceLink = this.extractSourceLink(docContent);
      if (sourceLink) lines.push("", ...this.liteSourceLines(docContent, sourceLink, pending));
    }
    return lines.join("\n");
  }

  private liteRequirementLines(content: string, pending: number[]): string[] {
    const requirements = this.liteRequirements(content);
    const reasons: string[] = [];
    if (pending.length > 0) reasons.push(`Sections not written: ${pending.join(", ")}`);
    const lines = [
      `Requirement IDs: ${requirements.defined.size} defined${
        requirements.defined.size > 0
          ? ` (${sortRequirementIds(requirements.defined).join(", ")})`
          : ""
      }`,
    ];
    if (requirements.duplicates.length > 0) {
      lines.push(`Duplicate requirement definitions: ${requirements.duplicates.join(", ")}`);
      reasons.push("duplicate requirement definitions");
    }
    if (requirements.undefinedReferences.length > 0) {
      lines.push(
        `Undefined requirement references: ${requirements.undefinedReferences.join(", ")}`,
      );
      reasons.push("undefined requirement references");
    }
    lines.push(
      reasons.length === 0
        ? "Completion: ✅ Complete"
        : `Completion: 🟡 Incomplete — ${reasons.join("; ")}`,
    );
    return lines;
  }

  /** Report Lite coverage, dangling references and source changes for a derived Full document. */
  private liteSourceLines(content: string, link: SourceLink, pending: number[]): string[] {
    const reasons: string[] = [];
    if (pending.length > 0) reasons.push(`Sections not written: ${pending.join(", ")}`);
    const lines = [`Lite source: ${link.source}`];
    const source = this.readLiteSource(link);
    if (!source.ok) {
      lines.push(`Lite source unavailable: ${source.reason}. Lite coverage is unverified.`);
      reasons.push("Lite source unavailable");
    } else {
      const sections = this.parseSections(content);
      const referenced = new Set<string>();
      for (const [section, sectionContent] of sections) {
        for (const [, subsection] of this.parseSubsections(sectionContent, section)) {
          for (const id of requirementReferences(subsection.content)) referenced.add(id);
        }
      }
      const missing = sortRequirementIds([...source.defined].filter((id) => !referenced.has(id)));
      const dangling = sortRequirementIds([...referenced].filter((id) => !source.defined.has(id)));
      const covered = source.defined.size - missing.length;
      lines.push(
        missing.length === 0
          ? `Lite coverage: ✅ ${covered}/${source.defined.size} requirement IDs referenced`
          : `Lite coverage: 🟡 ${covered}/${source.defined.size} requirement IDs referenced — missing: ${missing.join(", ")}`,
      );
      if (missing.length > 0) reasons.push("Lite requirement IDs not referenced");
      if (dangling.length > 0) {
        lines.push(`References to IDs not defined in the Lite source: ${dangling.join(", ")}`);
        reasons.push("references to IDs not defined in the Lite source");
      }
      if (link.fingerprint !== sourceFingerprint(source.content)) {
        lines.push(
          "Lite source changed since the last Full save: offer one explicit re-derivation; this notice does not block completion.",
        );
      }
    }
    lines.push(
      reasons.length === 0
        ? "Completion: ✅ Complete"
        : `Completion: 🟡 Incomplete — ${reasons.join("; ")}`,
    );
    return lines;
  }

  /**
   * Count required entries with an actual body, not merely saved XML tags.
   * Empty saves still clear content, but cannot make a section complete on resume.
   * Reading status never rewrites older documents containing empty entries.
   */
  private sectionStates(docContent: string, profile: DocumentProfile): SectionState[] {
    const sections = this.parseSections(docContent);
    const registry = this.templates[profile.id];
    const states: SectionState[] = [];

    for (const [number, title] of Object.entries(profile.sectionTitles)) {
      const section = Number.parseInt(number, 10);
      const content = sections.get(section) || "";
      const savedSubsections = this.parseSubsections(content, section);
      const subsections = new Map(
        [...savedSubsections].filter(([, subsection]) => subsection.content.trim().length > 0),
      );
      const optional = profile.optionalSections.includes(section);
      let status: string;

      if (subsections.size === 0 && (savedSubsections.size > 0 || this.isNotStarted(content))) {
        status = optional ? "⬜ Optional — not written" : "⬜ Not started";
      } else if (section === profile.dynamicSection?.section) {
        const source =
          this.parseSubsections(
            sections.get(profile.dynamicSection.sourceSection) || "",
            profile.dynamicSection.sourceSection,
          ).get(profile.dynamicSection.sourceSubsectionId)?.content ?? "";
        const coverage = featureCoverage(source, subsections);
        if (coverage.expected > 0 && coverage.missing.length === 0) {
          status = `✅ Written (${coverage.written}/${coverage.expected} features)`;
        } else if (coverage.expected > 0) {
          status = `🟡 In progress (${coverage.written}/${coverage.expected} features) — missing: ${coverage.missing.join(", ")}`;
        } else {
          status = `🟡 In progress (${subsections.size} dynamic feature${subsections.size === 1 ? "" : "s"} saved)`;
        }
      } else {
        const expected = registry
          .expectedSubsections(section)
          .filter((definition) => definition.required);
        const written = expected.filter((definition) => subsections.has(definition.id)).length;
        if (expected.length === 0 && optional) {
          status = `✅ Written (${subsections.size} optional subsection${subsections.size === 1 ? "" : "s"})`;
        } else {
          status =
            expected.length > 0 && written === expected.length
              ? `✅ Written (${written}/${expected.length} subsections)`
              : `🟡 In progress (${written}/${expected.length} subsections)`;
        }
      }
      states.push({
        section,
        title,
        status,
        complete: status.startsWith("✅") || (optional && status.startsWith("⬜")),
      });
    }
    return states;
  }

  private contentToMarkdown(content: string, section: number): string {
    const subsections = this.parseSubsections(content, section);
    if (subsections.size === 0) return content;
    return [...subsections.entries()]
      .sort(bySubsectionId)
      .map(([id, data]) => `### ${id}. ${data.title}\n\n${data.content}`)
      .join("\n\n");
  }

  /**
   * Keep reads and exports consistent with completion after an empty save.
   * Meaningful legacy prose is preserved even when it has no structured entries.
   */
  private sectionIsUnwritten(content: string, section: number): boolean {
    if (this.isNotStarted(content)) return true;
    const subsections = this.parseSubsections(content, section);
    return (
      subsections.size > 0 &&
      [...subsections.values()].every((subsection) => subsection.content.trim().length === 0)
    );
  }

  /** Export numbered content followed by the glossary only when actual definitions exist. */
  exportMarkdown(outputPath?: string): string {
    const document = this.readWorkingDocument();

    const { content: docContent, profile } = document;
    const projectName = this.extractProjectName(docContent);
    const sections = this.parseSections(docContent);
    const lines = [`# ${projectName} ${profile.markdownTitle}\n`];
    const sourceLink = isLiteProfile(profile) ? null : this.extractSourceLink(docContent);
    if (sourceLink) lines.push(`> Lite source: ${sourceLink.source}\n`);

    for (const section of sectionNumbers(profile)) {
      const content = sections.get(section) || "";
      const unwritten = this.sectionIsUnwritten(content, section);
      if (profile.optionalSections.includes(section) && unwritten) continue;
      const markdown = unwritten ? "*Not yet written*" : this.contentToMarkdown(content, section);
      lines.push(
        `## Section ${section}. ${profile.sectionTitles[section]}\n\n${markdown}\n\n---\n`,
      );
    }
    const glossary = parseGlossary(docContent);
    if (glossary.length > 0) lines.push(glossaryMarkdown(glossary));

    const result = lines.join("\n");
    if (outputPath) {
      const out = this.expandPath(outputPath);
      // Compare file identity so relative paths and links cannot export over the source.
      const source = fs.statSync(this.workingDoc!);
      let target: fs.Stats | undefined;
      try {
        target = fs.statSync(out);
      } catch (error) {
        if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? ""))
          throw error;
      }
      if (target && source.dev === target.dev && source.ino === target.ino)
        throw new Error("Markdown output must not replace the source ALPS document.");
      fs.mkdirSync(path.dirname(out), { recursive: true });
      this.writeAtomic(out, result);
      return `Exported to ${out}`;
    }
    return result;
  }
}
