import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

// Parsing needs a DOM for Mermaid's own text sanitizer, never script execution.
const window = new Window({
  settings: {
    disableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true,
    enableFileSystemHttpRequests: false,
  },
});
globalThis.window = window;
globalThis.document = window.document;
globalThis.DOMPurify = window.DOMPurify;
const { default: mermaid } = await import("mermaid");
mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
try {
  const result = await mermaid.parse(readFileSync(0, "utf8"));
  process.stdout.write(JSON.stringify({ type: result.diagramType }));
} catch (error) {
  process.stdout.write(JSON.stringify({ error: String(error.message || error) }));
} finally {
  await window.happyDOM.close();
}
