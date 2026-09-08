import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type DocumentProfileId = "alps" | "lite";
export type InitializableDocumentProfileId = "alps" | "lite";

export interface DynamicSectionDefinition {
  section: number;
  sourceSection: number;
  sourceSubsectionId: string;
}

export interface DocumentProfile {
  id: DocumentProfileId;
  label: string;
  markdownTitle: string;
  filenameSuffix: string;
  rootProfile: string | null;
  templatesDir: string;
  chaptersDir: string;
  guidesDir: string;
  sectionTitles: Readonly<Record<number, string>>;
  sectionReferences: Readonly<Record<number, readonly number[]>>;
  authoringOrder: readonly number[];
  dynamicSection: DynamicSectionDefinition | null;
  optionalSections: readonly number[];
  sectionContextTool: string;
}

const templatesDir = path.join(__dirname, "templates");
const guidesDir = path.join(__dirname, "guides");
const liteTemplatesDir = path.join(templatesDir, "lite");

export const ALPS_PROFILE: DocumentProfile = {
  id: "alps",
  label: "ALPS",
  markdownTitle: "ALPS",
  filenameSuffix: ".alps.xml",
  rootProfile: null,
  templatesDir,
  chaptersDir: path.join(templatesDir, "chapters"),
  guidesDir,
  sectionTitles: {
    1: "Overview",
    2: "MVP Goals and Key Metrics",
    3: "Demo Scenario",
    4: "High-Level Architecture",
    5: "Design Specification",
    6: "Requirements Summary",
    7: "Feature-Level Specification",
    8: "MVP Metrics",
    9: "Out of Scope",
  },
  sectionReferences: {
    3: [2],
    5: [6],
    7: [3, 6],
    8: [2, 6],
  },
  authoringOrder: [1, 2, 3, 4, 6, 5, 7, 8, 9],
  dynamicSection: {
    section: 7,
    sourceSection: 6,
    sourceSubsectionId: "6.1",
  },
  optionalSections: [],
  sectionContextTool: "get_alps_section_context",
};

export const LITE_ALPS_PROFILE: DocumentProfile = {
  id: "lite",
  label: "Lite ALPS",
  markdownTitle: "Lite ALPS",
  filenameSuffix: ".lite.alps.xml",
  rootProfile: "lite",
  templatesDir: liteTemplatesDir,
  chaptersDir: path.join(liteTemplatesDir, "chapters"),
  guidesDir: path.join(guidesDir, "lite"),
  sectionTitles: {
    1: "Overview",
    2: "Solution and Essential User Experiences",
    3: "Out of Scope",
    4: "Demo Scenario",
  },
  sectionReferences: {
    2: [1],
    3: [1, 2],
    4: [1, 2],
  },
  authoringOrder: [1, 2, 3, 4],
  dynamicSection: null,
  optionalSections: [3],
  sectionContextTool: "get_lite_alps_section_context",
};

export const DOCUMENT_PROFILES: Readonly<Record<DocumentProfileId, DocumentProfile>> = {
  alps: ALPS_PROFILE,
  lite: LITE_ALPS_PROFILE,
};

export function isLiteProfile(profile: DocumentProfile): boolean {
  return profile.id === "lite";
}

export function sectionNumbers(profile: DocumentProfile): number[] {
  return Object.keys(profile.sectionTitles)
    .map((key) => Number.parseInt(key, 10))
    .sort((a, b) => a - b);
}

export function sectionRange(profile: DocumentProfile): string {
  const numbers = sectionNumbers(profile);
  return `${numbers[0]}-${numbers[numbers.length - 1]}`;
}
