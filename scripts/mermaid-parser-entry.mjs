import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

// Parsing needs a DOM for Mermaid's own text sanitizer, never script execution.
const window = new Window({
  settings: {
    disableJavaScriptEvaluation: true,
    disableJavaScriptFileLoading: true,
    enableCSSFileLoading: false,
    enableIframePageLoading: false,
    enableFileSystemHttpRequests: false,
  },
});
globalThis.window = window;
globalThis.document = window.document;
globalThis.DOMPurify = window.DOMPurify;
const { default: mermaid } = await import("mermaid");
mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });

/** The diagram type of the source `read` returns, or the error that reading or parsing raised. */
async function parse(read) {
  try {
    const result = await mermaid.parse(read());
    return { type: result.diagramType };
  } catch (error) {
    return { error: String(error.message || error) };
  }
}

try {
  // `--batch` reads a JSON array of sources and answers each, in order, from one process.
  if (process.argv.includes("--batch")) {
    const answers = [];
    for (const source of JSON.parse(readFileSync(0, "utf8")))
      answers.push(await parse(() => source));
    process.stdout.write(JSON.stringify(answers));
  } else process.stdout.write(JSON.stringify(await parse(() => readFileSync(0, "utf8"))));
} finally {
  await window.happyDOM.close();
}
