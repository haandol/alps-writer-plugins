import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { evaluateEvidence, deepEvalInput } from "../deepeval/engine.mjs";
import { catalog, PLUGIN } from "./catalog.mjs";
import { capturedChecks } from "./mechanical-checks.mjs";
import { confined, sha, listFiles } from "../regression/workspace.mjs";
import { executionChecks } from "../lib/execution-checks.mjs";
import { saveSkillsReport } from "./report.mjs";

const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const json = (root, file, data) =>
  writeFileSync(path.join(root, file), JSON.stringify(data, null, 2) + "\n");

/** Restore only recorded bytes inside a fresh check workspace; never execute captured commands. */
function restore(root, files) {
  for (const [file, value] of Object.entries(files)) {
    if (typeof value !== "string") throw new Error("Captured file content must be text");
    const target = confined(root, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, value);
  }
}

/** Validate explicitly named native review artifacts without relying on natural-language success words. */
export function nativeReviewChecks(root, item) {
  if (
    !item.artifactPaths?.includes(".adr-review/findings.json") ||
    !item.artifactPaths?.includes(".adr-review/implementation-review.md")
  )
    return [];
  const checks = [];
  const folder = path.join(root, ".adr-review");
  try {
    const data = read(path.join(folder, "findings.json"));
    // Model-authored paths must not turn replay validation into host file access.
    for (const value of [
      data.adr,
      data.report,
      data.explanation,
      ...(data.relatedAdrComparisons ?? []).map((c) => c.adr),
    ].filter(Boolean)) {
      const resolved = path.resolve(folder, value);
      confined(root, path.relative(root, resolved));
    }
    for (const name of ["adr-impl-review-materialize.mjs", "adr-impl-review-validate.mjs"]) {
      const result = spawnSync(process.execPath, [path.join(PLUGIN, "scripts", name), folder], {
        cwd: root,
        encoding: "utf8",
      });
      checks.push({
        label: name,
        pass: result.status === 0,
        detail: result.stderr || result.stdout,
      });
      if (result.status !== 0) break;
    }
  } catch (error) {
    checks.push({ label: "native review artifact", pass: false, detail: error.message });
  }
  return checks;
}

/** Rejudge captured replies with current semantic policy; previous grades never enter model input. */
export async function rejudge(options, injected = {}) {
  const source = path.resolve(options.rejudge);
  const originalBytes = readFileSync(confined(source, "results.json"));
  const original = JSON.parse(originalBytes);
  if (
    original.framework !== "skill-evals" ||
    !Array.isArray(original.cases) ||
    !Array.isArray(original.runs)
  )
    throw new Error("--rejudge requires a saved unified Skill evaluation");
  if (original.runs.some((r) => r.verdict === "NOT_RUN") && original.mode === "LIVE")
    throw new Error("Wait for the source run to finish before rejudging");
  const cases = original.cases.filter(
    (c) =>
      c.type !== "routing" &&
      (options.suite === "all" || options.suite === c.type) &&
      (!options.only || c.id.includes(options.only)),
  );
  if (!cases.length) throw new Error("No captured semantic cases match");
  const ids = new Set(cases.map((c) => c.id));
  if (ids.size !== cases.length) throw new Error("Duplicate captured case identity");
  const runs = original.runs.filter((r) => ids.has(r.caseId));
  const identities = new Set();
  for (const run of runs) {
    const key = JSON.stringify([run.caseId, run.repeat, run.variant]);
    if (!Number.isInteger(run.repeat) || run.repeat < 1 || identities.has(key))
      throw new Error("Invalid or duplicate captured trial");
    identities.add(key);
  }
  const output = path.resolve(options.out ?? path.join(source, `rejudged-${Date.now()}`));
  if (existsSync(output) && readdirSync(output).length)
    throw new Error("--out must be new or empty");
  mkdirSync(output, { recursive: true });
  const current = new Map((injected.cases ?? (await catalog())).map((c) => [c.id, c]));
  const verifierFiles = ["evals", "scripts"].flatMap((folder) =>
    listFiles(PLUGIN, folder).filter((file) => file.endsWith(".mjs")),
  );
  const verifierHash = sha(
    verifierFiles.map((file) => [file, sha(readFileSync(path.join(PLUGIN, file), "utf8"))]),
  );
  const report = {
    ...original,
    generatedAt: new Date().toISOString(),
    mode: options.live ? "REJUDGED" : "PREPARED",
    scoringPolicy: "semantic-v1",
    sourceScoringPolicy: original.scoringPolicy ?? "legacy-mixed",
    sourceDatasetHash: original.datasetHash,
    datasetHash: sha({ cases, scoringPolicy: "semantic-v1" }),
    sourceReport: source,
    sourceReportHash: sha(originalBytes),
    rejudgeVerifierHash: verifierHash,
    targetReexecuted: false,
    selection: { suite: "all", compare: "none", only: options.only ?? null, rejudge: source },
    runtime: {
      ...original.runtime,
      judge: options.judge,
      requestedModel: original.runtime.requestedModel,
    },
    cases,
    runs: runs.map((r, i) => ({
      caseId: r.caseId,
      type: r.type,
      repeat: r.repeat,
      variant: r.variant,
      artifactDirectory: `runs/rejudge-${i + 1}`,
      sourceArtifactDirectory: r.artifactDirectory,
      previousVerdict: r.verdict,
      verdict: "NOT_RUN",
      targetModels: r.targetModels,
      modelIdentityIncomplete: r.modelIdentityIncomplete,
      judgeModels: [],
      calls: [],
      referenceDate: r.referenceDate,
    })),
  };
  const save = () => {
    json(output, "results.json", report);
    return saveSkillsReport(output, report);
  };
  save();
  let next = 0;
  const worker = async () => {
    while (next < report.runs.length) {
      const record = report.runs[next++];
      const started = Date.now();
      const item = cases.find((c) => c.id === record.caseId);
      const folder = path.join(output, record.artifactDirectory);
      mkdirSync(folder, { recursive: true });
      try {
        const sourceFolder = confined(source, record.sourceArtifactDirectory);
        let evidence;
        if (existsSync(path.join(sourceFolder, "judge-input-evidence.json")))
          evidence = read(path.join(sourceFolder, "judge-input-evidence.json"));
        else {
          const captured = read(path.join(sourceFolder, "evidence.json"));
          if (captured.before && captured.after) evidence = captured;
          else {
            const input = read(path.join(sourceFolder, "input.json"));
            if (!captured.reply || captured.executionError)
              throw new Error("No completed target reply to rejudge");
            evidence = {
              before: input.files,
              after: captured.files,
              replies: [captured.reply],
              turns: [input.prompt],
              events:
                typeof captured.events === "string"
                  ? captured.events.split("\n").filter(Boolean).map(JSON.parse)
                  : captured.events,
              referenceDate: record.referenceDate,
            };
          }
        }
        const definition = {
          ...item,
          obligations: item.semanticObligations ?? item.obligations,
          turns: evidence.turns,
        };
        const inputs = deepEvalInput(definition, evidence);
        json(folder, "judge-input-evidence.json", evidence);
        json(folder, "test-case.json", inputs);
        record.inputHash = sha(inputs);
        record.evidenceHash = sha(evidence);
        for (const file of ["response.json", "input.json", "evidence.json"])
          if (existsSync(path.join(sourceFolder, file)))
            copyFileSync(path.join(sourceFolder, file), path.join(folder, file));
        if (!options.live) continue;
        const workspace = path.join(folder, "workspace");
        mkdirSync(workspace);
        record.checks = capturedChecks(item, {
          before: evidence.before,
          files: evidence.after,
          events: evidence.events,
        });
        const currentCase = current.get(item.id);
        if (item.type === "execution")
          record.checks.push(...executionChecks(workspace, item, currentCase, evidence, PLUGIN));
        else restore(workspace, evidence.after);
        if (
          item.artifactPaths?.length &&
          !currentCase &&
          !item.artifactPaths.includes(".adr-review/findings.json")
        )
          throw new Error("No current structural checker is registered for the captured artifact");
        if (currentCase?.supplementalChecks && currentCase.score) {
          const extra = await currentCase.score({
            dir: workspace,
            before: evidence.before,
            files: evidence.after,
            events: evidence.events,
            output: evidence.replies.at(-1),
            tail: { findings: [] },
          });
          record.checks.push(...extra);
        }
        record.checks.push(...nativeReviewChecks(workspace, item));
        if (record.checks.some((check) => typeof check.pass !== "boolean"))
          throw new Error("Invalid mechanical evidence checks");
        const result = await (injected.evaluate ?? evaluateEvidence)({
          item: definition,
          evidence,
          name: `rejudge/${item.id}/${record.repeat}`,
          cwd: folder,
          ...options.judge,
          timeoutMs: options.timeout * 1000,
          invoke: injected.judge,
          onCall(response) {
            if (
              !response.models?.length ||
              response.modelEvidence === "requested-bedrock-inference-profile"
            )
              record.modelIdentityIncomplete = true;
            record.calls.push({
              stage: "judge",
              models: response.models,
              ms: response.ms,
              usage: response.usage,
              costUSD: response.costUSD,
            });
            record.judgeModels = [...new Set([...record.judgeModels, ...(response.models ?? [])])];
            json(folder, `judge-response-${record.calls.length}.json`, response);
          },
        });
        Object.assign(record, result);
        json(folder, "deepeval-result.json", result);
        if (record.verdict === "PASS" && record.checks.some((c) => !c.pass))
          record.verdict = "NOT_PROVEN";
      } catch (error) {
        record.verdict = "ERROR";
        record.error = error.message;
      }
      record.elapsedMs = Date.now() - started;
      save();
      process.stdout.write(`${record.caseId} #${record.repeat}: ${record.verdict}\n`);
    }
  };
  await Promise.all(Array.from({ length: options.jobs }, worker));
  if (sha(readFileSync(path.join(source, "results.json"))) !== report.sourceReportHash)
    throw new Error("Source results changed during rejudge");
  report.finishedAt = new Date().toISOString();
  const html = save();
  process.stdout.write(`HTML: ${html}\nResults: ${path.join(output, "results.json")}\n`);
  return {
    status:
      report.runs.some((r) => ["PASS", "NOT_PROVEN"].includes(r.verdict)) || !options.live ? 0 : 2,
    report,
    html,
    output,
  };
}
