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

  saveAlpsSection(
    docPath: string,
    section: number,
    subsectionId: string,
    title: string,
    content: string,
  ): string {
    return this.service.forDocument(docPath).saveSection(section, subsectionId, title, content);
  }

  readAlpsSection(docPath: string, section: number, subsectionId?: string): string {
    return this.service.forDocument(docPath).readSection(section, subsectionId);
  }

  /** Expose approved term updates only for the explicitly selected document. */
  saveAlpsGlossaryEntry(docPath: string, term: string, definition: string): string {
    return this.service.forDocument(docPath).saveGlossaryEntry(term, definition);
  }

  /** Expose existing definitions without creating an optional appendix. */
  readAlpsGlossary(docPath: string): string {
    return this.service.forDocument(docPath).readGlossary();
  }

  getAlpsDocumentStatus(docPath: string): string {
    return this.service.forDocument(docPath).getStatus();
  }

  exportAlpsMarkdown(docPath: string, outputPath?: string): string {
    return this.service.forDocument(docPath).exportMarkdown(outputPath);
  }
}
