#!/usr/bin/env bun
// Read-only evidence for deciding which previously reviewed inputs to revisit.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Compare literal review inputs to a previously verified commit, including pending work. */
export function reviewChanges(base, inputs = [], cwd = process.cwd()) {
  const unknown = (reason) => ({ status: "unverified", base, reason });
  if (
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(base ?? "") ||
    !inputs.length ||
    inputs.some((p) => typeof p !== "string" || !p.length)
  )
    return unknown("Supply the verified commit ID and its relevant files or directories.");
  const git = (args, directory = cwd) => {
    const result = spawnSync(
      "git",
      ["--no-optional-locks", "--literal-pathspecs", "-c", "core.fsmonitor=false", ...args],
      {
        cwd: directory,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          GIT_ALLOW_PROTOCOL: "",
          GIT_NO_LAZY_FETCH: "1",
          GIT_TERMINAL_PROMPT: "0",
        },
      },
    );
    if (result.status !== 0)
      throw new Error("Git could not verify the local history or the selected inputs.");
    return result.stdout;
  };
  try {
    const top = git(["rev-parse", "--show-toplevel"]).replace(/\r?\n$/, "");
    const paths = [
      ...new Set(
        inputs.map(
          (input) => path.relative(top, path.resolve(cwd, input)).split(path.sep).join("/") || ".",
        ),
      ),
    ];
    if (paths.some((p) => p === ".." || p.startsWith("../") || path.isAbsolute(p)))
      return unknown("A selected input is outside this worktree.");
    const readHead = () => git(["rev-parse", "--verify", "HEAD^{commit}"], top).trim();
    const head = readHead();
    if (base !== head) git(["merge-base", "--is-ancestor", base, head], top);
    const names = (args) =>
      git([...args, "--", ...paths], top)
        .split("\0")
        .filter(Boolean);
    const committed =
      base === head
        ? []
        : names(["diff", "--no-ext-diff", "--no-renames", "--name-only", "-z", base, head]);
    const pending = names([
      "status",
      "--porcelain=v1",
      "-z",
      "--no-renames",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ]).map((line) => line.slice(3));
    const changed = [...new Set([...committed, ...pending])].sort();
    const entries = names(["ls-files", "-v", "--stage", "-z"]);
    if (readHead() !== head)
      return {
        ...unknown("HEAD changed during the comparison; compare the current worktree again."),
        paths: changed,
      };
    const entryPath = (entry) => entry.slice(entry.indexOf("\t") + 1);
    const visible = new Set([...changed, ...entries.map(entryPath)]);
    const unchecked = entries
      .filter((entry) => !/^H 100(?:644|755) [0-9a-f]+ 0\t/.test(entry))
      .map(entryPath);
    const visibleNames = [...visible];
    const missing = paths.filter(
      (p) => !visible.has(p) && !visibleNames.some((file) => p === "." || file.startsWith(p + "/")),
    );
    const prefix = path.relative(top, path.resolve(cwd)).split(path.sep).join("/");
    // Keep the overall result unverified. An exact file batch can still distinguish
    // its unaffected members from missing paths and unchecked index entries.
    if (unchecked.length || missing.length)
      return {
        ...unknown(
          unchecked.length
            ? "A selected input has contents that this Git comparison cannot verify."
            : "A selected input has no Git-visible files at this revision.",
        ),
        paths: changed,
        unverifiedPaths: [...new Set([...unchecked, ...missing])].sort(),
        ...(prefix ? { prefix } : {}),
      };
    return {
      status: changed.length ? "changed" : "unchanged",
      base,
      paths: changed,
      ...(prefix ? { prefix } : {}),
    };
  } catch (error) {
    return unknown(error.message);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [base, ...paths] = process.argv.slice(2);
  const result = reviewChanges(base, paths);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.status === "unverified") process.exitCode = 1;
}
