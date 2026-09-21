import { DocumentService } from "./service.js";

export class DocumentController {
  constructor(private service: DocumentService) {}

  initAlpsDocument(projectName: string, outputPath: string): string {
    return this.service.initDocument(projectName, outputPath);
  }

  initLiteAlpsDocument(projectName: string, outputPath: string): string {
    return this.service.initDocument(projectName, outputPath, "lite");
  }

  loadAlpsDocument(docPath: string): string {
    return this.service.loadDocument(docPath);
  }

  saveAlpsSection(section: number, subsectionId: string, title: string, content: string): string {
    return this.service.saveSection(section, subsectionId, title, content);
  }

  readAlpsSection(section: number, subsectionId?: string): string {
    return this.service.readSection(section, subsectionId);
  }

  /** Expose approved term updates for the active Full or Lite document. */
  saveAlpsGlossaryEntry(term: string, definition: string): string {
    return this.service.saveGlossaryEntry(term, definition);
  }

  /** Expose existing definitions without creating an optional appendix. */
  readAlpsGlossary(): string {
    return this.service.readGlossary();
  }

  getAlpsDocumentStatus(): string {
    return this.service.getStatus();
  }

  exportAlpsMarkdown(outputPath?: string): string {
    return this.service.exportMarkdown(outputPath);
  }
}
