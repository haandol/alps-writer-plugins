// The business-model change surface of execution cases that set `modelChange`.
//
// Such a case runs in a fixture with ADR Writer and Ontology Writer installed. It
// adds one fixture tool, change_business_model, that runs Ontology Writer's real
// `ontology.mjs impact` on a draft under `.adr-review/` and, from the case's
// approval turn on, `ontology.mjs apply` with the base hash. The document tools
// refuse docs/ontology/, so apply is the only way the model changes. Ontology
// Writer's read-only guidance is served under `ontology-plugin/`. A case without
// the flag gets the fixture tools unchanged.
import {
  appendFileSync,
  closeSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { confined, listFiles } from "./workspace.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ONTOLOGY_ROOT = path.resolve(HERE, "../../../ontology-writer");
const ADR_HOOK = path.resolve(HERE, "../../hooks/surface-adr-context.mjs");
const ONTOLOGY_HOOK = path.join(ONTOLOGY_ROOT, "hooks/surface-business-context.mjs");
const CLI = path.join(ONTOLOGY_ROOT, "scripts/ontology.mjs");

/** The model, the change tool's draft of it and the virtual root of Ontology Writer's guidance. */
export const MODEL_DIR = "docs/ontology";
export const MODEL_DRAFT = ".adr-review/model-change/draft";
export const ONTOLOGY_GUIDANCE = "ontology-plugin/";
export const MODEL_TOOL = "change_business_model";
const GUIDANCE_FOLDERS = /^(skills|references|templates)\//;
const DOCUMENT_TOOLS = ["write_file", "delete_file", "move_file", "demote_adr_status"];

/** `{}` (no model approval in the conversation) or `{ approvalTurn }`, the user turn that approves. */
export function validateModelChange(config, turns) {
  if (
    !config ||
    typeof config !== "object" ||
    Array.isArray(config) ||
    Object.keys(config).some((key) => key !== "approvalTurn") ||
    (config.approvalTurn !== undefined &&
      !(
        Number.isInteger(config.approvalTurn) &&
        config.approvalTurn > 1 &&
        (turns === undefined || config.approvalTurn <= turns)
      ))
  )
    throw new Error("modelChange must be {} or { approvalTurn } naming a later user turn");
}

/** The fixture's documents as committed, so the query reports a settled model. */
export function commitWorkspace(root) {
  const when = "2026-10-01T00:00:00Z";
  const env = { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when };
  for (const args of [
    ["add", "-A"],
    [
      "-c",
      "user.name=eval",
      "-c",
      "user.email=eval@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-q",
      "--no-verify",
      "-m",
      "fixture",
    ],
  ]) {
    const result = spawnSync("git", args, { cwd: root, env, encoding: "utf8" });
    if (result.status !== 0)
      throw new Error(
        `fixture git ${args.includes("commit") ? "commit" : "add"} failed: ${result.stderr}`,
      );
  }
}

/** The environment of a real entry point in the fixture: no host index override. */
function fixtureEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ALPS_ADR_MAPPING;
  return env;
}

/**
 * The context both installed plugins' SessionStart hooks give a new session in the
 * fixture. Ontology Writer reads an isolated, empty preference store.
 */
export function sessionStartContext(root) {
  const preferences = mkdtempSync(path.join(tmpdir(), "adr-eval-ontology-preferences-"));
  try {
    return [ADR_HOOK, ONTOLOGY_HOOK]
      .map((hook) => {
        const result = spawnSync(process.execPath, [hook], {
          cwd: root,
          input: JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: root }),
          encoding: "utf8",
          env: fixtureEnv({
            CLAUDE_PROJECT_DIR: root,
            ONTOLOGY_WRITER_PREFERENCES_DIR: preferences,
          }),
        });
        if (result.status !== 0) throw new Error(`session hook failed: ${result.stderr}`);
        const out = result.stdout.trim();
        return out ? (JSON.parse(out).hookSpecificOutput?.additionalContext ?? "") : "";
      })
      .filter(Boolean)
      .join("\n\n");
  } finally {
    rmSync(preferences, { recursive: true, force: true });
  }
}

/** The prompt lines a model-change case adds; empty for every other case. */
export function modelChangePrompt(item, guidance, sessionContext) {
  if (item.modelChange === undefined) return { lines: "", session: "" };
  const lines = [
    guidance
      ? "Ontology Writer is also installed. Its read-only guidance is addressed as ontology-plugin/skills/..., ontology-plugin/references/... and ontology-plugin/templates/...; inside Ontology Writer files CLAUDE_PLUGIN_ROOT corresponds to the virtual ontology-plugin/ directory."
      : "Ontology Writer is also installed; its guidance is unavailable in this condition.",
    // A real client lists each installed skill's name and description, so the agent can
    // find the entry point a session directive names only by its purpose.
    ...(guidance ? ["The client lists Ontology Writer's skills:", ...ontologySkillListing()] : []),
    "A slash command named in this conversation is a shipped skill: read its SKILL.md and run the shell commands it names through the matching fixture tool.",
    ...(item.businessContext
      ? [
          "query_business_context runs Ontology Writer's read-only `ontology.mjs query --category|--process|--step <id>` in this fixture.",
        ]
      : []),
    ...(item.draftRoot
      ? [
          `prepare_draft creates the disposable ADR candidate tree at ${item.draftRoot}; run_check(kind=structure, draft=true) checks it.`,
        ]
      : []),
    `${MODEL_TOOL} runs Ontology Writer's model change commands in this fixture: prepare copies the model documents into ${MODEL_DRAFT}/, write replaces one draft Turtle document there, impact runs \`ontology.mjs impact --draft ${MODEL_DRAFT} --json\`, and apply runs \`ontology.mjs apply --draft ${MODEL_DRAFT} --base-hash <hash>\` with optional --log lines. Only apply changes ${MODEL_DIR}/; the document tools refuse that directory.`,
  ];
  return {
    lines: lines.join("\n") + "\n",
    session: sessionContext
      ? `<session-start-context>\n${sessionContext}\n</session-start-context>\n\n`
      : "",
  };
}

/** `- /<name> (ontology-plugin/skills/<name>/SKILL.md): <description>` per shipped skill, as a client lists them. */
export function ontologySkillListing() {
  return listFiles(ONTOLOGY_ROOT, "skills")
    .filter((file) => /^skills\/[^/]+\/SKILL\.md$/.test(file))
    .sort()
    .map((file) => {
      const front = readFileSync(path.join(ONTOLOGY_ROOT, file), "utf8").match(
        /^---\n([\s\S]*?)\n---\n/,
      )?.[1];
      const field = (key) =>
        front
          ?.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1]
          .trim()
          .replace(/^"(.*)"$/, "$1");
      const name = field("name");
      const description = field("description");
      if (!name || !description) throw new Error(`${file} lacks a name or description`);
      return `- /${name} (${ONTOLOGY_GUIDANCE}${file}): ${description}`;
    });
}

/** Appends to a trial's event log in the format and order the fixture tools use. */
function eventRecorder(logPath, turn) {
  let logSize = -1;
  let logInode;
  let sequence = 0;
  return function record(event) {
    const fd = openSync(logPath, "a+");
    try {
      const stat = fstatSync(fd);
      if (stat.ino !== logInode || stat.size !== logSize) {
        sequence = stat.size
          ? readFileSync(fd, "utf8").split("\n").filter(Boolean).map(JSON.parse).length
          : 0;
      }
      const entry = { seq: sequence + 1, turn, ...event };
      const line = JSON.stringify(entry) + "\n";
      appendFileSync(fd, line);
      sequence = entry.seq;
      logSize = stat.size + Buffer.byteLength(line);
      logInode = stat.ino;
      return entry;
    } finally {
      closeSync(fd);
    }
  };
}

/** The document a document-tool path names: inside the ADR draft tree, the part after its root. */
function documentOf(file, draftRoot) {
  return draftRoot && typeof file === "string" && file.startsWith(`${draftRoot}/`)
    ? file.slice(draftRoot.length + 1)
    : file;
}

const isModelDocument = (file) =>
  typeof file === "string" && (file === MODEL_DIR || file.startsWith(`${MODEL_DIR}/`));

/** Whether a document-tool request would write the model, directly or in the ADR draft tree. */
export function targetsModel(event, draftRoot) {
  return (
    DOCUMENT_TOOLS.includes(event.tool) &&
    [event.arguments?.path, event.arguments?.from, event.arguments?.to].some((file) =>
      isModelDocument(documentOf(file, draftRoot)),
    )
  );
}

/** Run Ontology Writer's real command line in the fixture. */
function ontology(root, args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: root,
    encoding: "utf8",
    env: fixtureEnv(),
    timeout: 60_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return { exitCode: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function modelFiles(root, prefix) {
  return Object.fromEntries(
    listFiles(root, prefix).map((file) => [file, readFileSync(confined(root, file), "utf8")]),
  );
}

/**
 * Add the model change tool and its boundaries to a trial's fixture tools.
 * `turn` is the user turn the tool server serves; apply runs only from
 * `modelChange.approvalTurn` on, and never without one.
 */
export function withModelChange(
  tools,
  { root, logPath, turn, guidance = true, modelChange, draftRoot },
) {
  if (modelChange === undefined) return tools;
  validateModelChange(modelChange);
  if (
    draftRoot &&
    (MODEL_DRAFT.startsWith(`${draftRoot}/`) ||
      draftRoot.startsWith(path.posix.dirname(MODEL_DRAFT)))
  )
    throw new Error("the ADR draft tree cannot overlap the model draft");
  const record = eventRecorder(logPath, turn);
  const draft = () => confined(root, MODEL_DRAFT);
  const requireDraft = () => {
    if (!existsSync(draft())) throw new Error(`no model draft; run ${MODEL_TOOL} prepare first`);
  };
  const own = {
    [MODEL_TOOL]: {
      description: `Ontology Writer's model change unit in this fixture. prepare: copy every ${MODEL_DIR}/ document into ${MODEL_DRAFT}/ (never overwrites an existing draft). write: replace one draft Turtle document (document, content). impact: run \`ontology.mjs impact --draft ${MODEL_DRAFT} --json\` for the approval summary and its baseHash. apply: run \`ontology.mjs apply --draft ${MODEL_DRAFT} --base-hash <baseHash>\` with optional change-log lines; it is refused before the user's approval turn and is the only way ${MODEL_DIR}/ changes. The index, glossary and new-ADR drafts are outside this tool.`,
      fields: {
        action: { type: "string", enum: ["prepare", "write", "impact", "apply"] },
        document: {
          type: "string",
          description: "write: the draft document's path inside the draft, such as enrollment.ttl",
        },
        content: { type: "string", description: "write: the complete Turtle text" },
        baseHash: {
          type: "string",
          description: "apply: the baseHash of the impact run the approval summary showed",
        },
        log: {
          type: "array",
          items: { type: "string" },
          description: 'apply: change-log lines, each "<id>: <change> — <reason>"',
        },
      },
      required: ["action"],
      run({ action, document, content, baseHash, log }) {
        const extra = Object.entries({ document, content, baseHash, log })
          .filter(([, value]) => value !== undefined)
          .map(([key]) => key);
        const allowed = {
          prepare: [],
          write: ["document", "content"],
          impact: [],
          apply: ["baseHash", "log"],
        };
        if (typeof action !== "string" || !Object.hasOwn(allowed, action))
          throw new Error("expected action prepare, write, impact or apply");
        if (extra.some((key) => !allowed[action].includes(key)))
          throw new Error(`${action} takes only ${allowed[action].join(", ") || "no other field"}`);
        if (action === "prepare") {
          if (existsSync(draft()))
            throw new Error("the model draft already exists; preserve and reuse it");
          const documents = Object.entries(modelFiles(root, MODEL_DIR)).filter(([file]) =>
            file.endsWith(".ttl"),
          );
          if (!documents.length) throw new Error(`no model documents in ${MODEL_DIR}/`);
          for (const [file, text] of documents) {
            const target = confined(root, `${MODEL_DRAFT}/${file.slice(MODEL_DIR.length + 1)}`);
            mkdirSync(path.dirname(target), { recursive: true });
            writeFileSync(target, text);
          }
          return {
            draft: MODEL_DRAFT,
            documents: documents.map(
              ([file]) => `${MODEL_DRAFT}/${file.slice(MODEL_DIR.length + 1)}`,
            ),
          };
        }
        if (action === "write") {
          requireDraft();
          if (
            typeof document !== "string" ||
            !/^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_-]*)*\.ttl$/i.test(document)
          )
            throw new Error("document must be a relative .ttl path inside the draft");
          if (typeof content !== "string" || !content.trim() || content.length > 200_000)
            throw new Error("invalid Turtle document size");
          const target = confined(root, `${MODEL_DRAFT}/${document}`);
          if (existsSync(target) && lstatSync(target).isDirectory())
            throw new Error("document names a directory");
          mkdirSync(path.dirname(target), { recursive: true });
          writeFileSync(target, content);
          return { path: `${MODEL_DRAFT}/${document}`, bytes: Buffer.byteLength(content) };
        }
        if (action === "impact") {
          requireDraft();
          return ontology(root, ["impact", "--draft", MODEL_DRAFT, "--json"]);
        }
        if (modelChange.approvalTurn === undefined || turn < modelChange.approvalTurn)
          throw new Error(
            "apply is refused before the user's approval turn in this evaluation; nothing was written",
          );
        requireDraft();
        if (typeof baseHash !== "string" || !/^[0-9a-f]{64}$/.test(baseHash))
          throw new Error("baseHash must be the 64-hex baseHash an impact run returned");
        const lines = log ?? [];
        if (
          !Array.isArray(lines) ||
          lines.length > 10 ||
          lines.some(
            (line) =>
              typeof line !== "string" ||
              !line.trim() ||
              line.length > 500 ||
              /[\u0000-\u001f]/.test(line),
          )
        )
          throw new Error("log takes at most 10 single-line change-log entries");
        const before = modelFiles(root, MODEL_DIR);
        const result = ontology(root, [
          "apply",
          "--draft",
          MODEL_DRAFT,
          "--base-hash",
          baseHash,
          ...lines.flatMap((line) => ["--log", line]),
        ]);
        const after = modelFiles(root, MODEL_DIR);
        return {
          ...result,
          changed: [...new Set([...Object.keys(before), ...Object.keys(after)])]
            .filter((file) => before[file] !== after[file])
            .sort(),
        };
      },
    },
  };
  const definitions = [
    ...tools.definitions,
    ...Object.entries(own).map(([name, item]) => ({
      name,
      description: item.description,
      inputSchema: {
        type: "object",
        properties: item.fields,
        required: item.required,
        additionalProperties: false,
      },
    })),
  ];
  /** Record a request this wrapper answers itself, and its result, as the fixture tools do. */
  function answer(name, args, perform, { read = false } = {}) {
    const request = record({ kind: "request", tool: name, arguments: args });
    try {
      const result = perform();
      record({
        kind: "result",
        request: request.seq,
        tool: name,
        ok: true,
        result: read ? "(read completed)" : result,
      });
      return result;
    } catch (error) {
      record({ kind: "result", request: request.seq, tool: name, ok: false, error: error.message });
      throw error;
    }
  }
  /** A read-only Ontology Writer guidance path, relative to its plugin root. */
  function guidancePath(relative, { folder = false } = {}) {
    if (!guidance) throw new Error("skill guidance is unavailable in this condition");
    const plain = relative.replace(/\/+$/, "");
    if (!(folder && !plain) && !GUIDANCE_FOLDERS.test(`${plain}/`))
      throw new Error("Ontology Writer read outside advertised directories");
    return plain;
  }
  const only = (args, key) => {
    for (const name of Object.keys(args))
      if (name !== key) throw new Error(`unexpected argument ${name}`);
  };
  return {
    definitions,
    call(name, args = {}) {
      if (!args || typeof args !== "object" || Array.isArray(args))
        throw new Error("invalid arguments");
      const item = own[name];
      if (item) {
        for (const key of Object.keys(args))
          if (!Object.hasOwn(item.fields, key)) throw new Error(`unexpected argument ${key}`);
        return answer(name, args, () => item.run(args));
      }
      if (DOCUMENT_TOOLS.includes(name) && targetsModel({ tool: name, arguments: args }, draftRoot))
        return answer(name, args, () => {
          throw new Error(`${MODEL_DIR}/ changes only through ${MODEL_TOOL} apply`);
        });
      if (
        name === "read_file" &&
        typeof args.path === "string" &&
        args.path.startsWith(ONTOLOGY_GUIDANCE)
      ) {
        only(args, "path");
        return answer(
          name,
          args,
          () => {
            const file = confined(
              ONTOLOGY_ROOT,
              guidancePath(args.path.slice(ONTOLOGY_GUIDANCE.length)),
            );
            if (lstatSync(file).size > 200_000)
              throw new Error("file exceeds evaluation read limit");
            return readFileSync(file, "utf8");
          },
          { read: true },
        );
      }
      if (
        name === "list_files" &&
        typeof args.prefix === "string" &&
        args.prefix.startsWith(ONTOLOGY_GUIDANCE)
      ) {
        only(args, "prefix");
        return answer(
          name,
          args,
          () =>
            listFiles(
              ONTOLOGY_ROOT,
              guidancePath(args.prefix.slice(ONTOLOGY_GUIDANCE.length), { folder: true }),
            )
              .filter((file) => GUIDANCE_FOLDERS.test(file))
              .map((file) => `${ONTOLOGY_GUIDANCE}${file}`),
          { read: true },
        );
      }
      return tools.call(name, args);
    },
  };
}

/**
 * The case as the shared execution checks see it. Every model surface — the
 * model itself, the change tool's draft and the ADR draft tree's copy of the
 * model — counts as an authorized output: the document tools refuse them, so
 * only the change tool or the draft copy can have written them, and each case's
 * own verifier judges when and how.
 */
export function modelChangeScope(item, { before = {}, after = {} } = {}) {
  if (item.modelChange === undefined) return item;
  const surfaces = [
    `${MODEL_DIR}/`,
    `${MODEL_DRAFT}/`,
    ...(item.draftRoot ? [`${item.draftRoot}/${MODEL_DIR}/`] : []),
  ];
  const files = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((file) =>
    surfaces.some((surface) => file.startsWith(surface)),
  );
  return {
    ...item,
    artifactPaths: [...(item.artifactPaths ?? []), ...files],
    requiredArtifactPaths: item.requiredArtifactPaths ?? item.artifactPaths ?? [],
  };
}
