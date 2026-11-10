import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sessionFiles, startServer } from "../scripts/ontology-ask.mjs";

export const QUESTIONS = {
  version: 1,
  title: "Model review",
  questions: [
    {
      id: "Q1",
      text: "Keep this boundary?",
      diagram: { source: "flowchart LR\n  Input --> Boundary --> Result" },
      options: [
        { id: "yes", label: "Keep", diagram: { source: "flowchart LR\n  Input --> Boundary" } },
        {
          id: "no",
          label: "Change",
          diagram: { source: "flowchart LR\n  Input --> RevisedBoundary" },
        },
      ],
    },
    {
      id: "Q2",
      text: "Use this policy?",
      options: [
        { id: "yes", label: "Use" },
        { id: "no", label: "Replace" },
      ],
    },
  ],
};

/** Each test owns its loopback server and disposable files; no project model is used. */
export function questionSession(questions = QUESTIONS) {
  const run = mkdtempSync(path.join(tmpdir(), "ontology-question-ui-"));
  const files = sessionFiles(run);
  mkdirSync(files.dir, { recursive: true });
  writeFileSync(files.questions, JSON.stringify(questions));
  writeFileSync(path.join(run, "report.json"), "{}\n");
  const serving = startServer(run, { lang: "en" });
  const origin = new URL(serving.url).origin;
  return {
    ...serving,
    run,
    files,
    origin,
    post: (route, body, extra = {}) =>
      fetch(new URL(`api/${route}`, serving.url), {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin, ...extra },
        body: JSON.stringify(body),
      }),
    state: async () => (await fetch(new URL("api/state", serving.url))).json(),
    done: () => {
      serving.server.stop(true);
      rmSync(run, { recursive: true, force: true });
    },
  };
}
