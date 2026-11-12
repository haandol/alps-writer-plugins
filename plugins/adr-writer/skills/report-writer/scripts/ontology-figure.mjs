#!/usr/bin/env bun
/**
 * Turn ontology-writer's `query --overview` output into a Mermaid Overview figure for the
 * bounded contexts a report covers. It reads only the query's JSON lines (never the model
 * documents), so labels and collaborations match the business ontology exactly.
 *
 * Usage: bun ontology-figure.mjs --contexts id1,id2[,..] [--neighbors] [--direction LR|TB] < overview.txt
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Parse the overview's JSON lines; prose lines around them are ignored. */
export function parseOverview(text) {
  const contexts = new Map();
  const collaborations = [];
  const neighborLabels = new Map();
  const neighbors = new Map();
  for (const line of String(text).split("\n")) {
    if (!line.startsWith("{")) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.kind === "context" && record.id) contexts.set(record.id, record.label ?? record.id);
    else if (record.kind === "collaboration" && record.from?.id && record.to?.id) {
      collaborations.push([record.from.id, record.to.id]);
      // A search can return a collaboration whose other end is not listed; keep the query's label.
      for (const end of [record.from, record.to])
        if (end.label) neighborLabels.set(end.id, end.label);
    }
  }
  for (const [id, name] of neighborLabels) if (!contexts.has(id)) neighbors.set(id, name);
  return { contexts, collaborations, neighbors };
}

const nodeId = (id) => `bc_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
const label = (text) => String(text).replace(/["\\]/g, "'");

/**
 * Build a flowchart of the selected contexts and the collaborations among them. With
 * `neighbors`, directly collaborating contexts are drawn too, marked as outside the topic.
 */
export function overviewFigure(
  text,
  { contexts: selected, neighbors = false, direction = "LR" } = {},
) {
  const { contexts, collaborations, neighbors: unlisted } = parseOverview(text);
  const nameOf = (id) => contexts.get(id) ?? unlisted.get(id) ?? id;
  if (!contexts.size) throw new Error("No bounded contexts found in the query output");
  const chosen = new Set(selected ?? []);
  const unknown = [...chosen].filter((id) => !contexts.has(id));
  if (!chosen.size) throw new Error("--contexts must name at least one bounded-context id");
  if (unknown.length) throw new Error(`Unknown bounded-context ids: ${unknown.join(", ")}`);
  const outside = new Set();
  if (neighbors)
    for (const [from, to] of collaborations) {
      if (chosen.has(from) && !chosen.has(to)) outside.add(to);
      if (chosen.has(to) && !chosen.has(from)) outside.add(from);
    }
  const drawn = new Set([...chosen, ...outside]);
  const lines = [`flowchart ${direction === "TB" ? "TB" : "LR"}`];
  for (const id of chosen) lines.push(`  ${nodeId(id)}["${label(contexts.get(id))}"]`);
  for (const id of outside) lines.push(`  ${nodeId(id)}["${label(nameOf(id))}"]:::outside`);
  const seen = new Set();
  for (const [from, to] of collaborations) {
    if (!drawn.has(from) || !drawn.has(to)) continue;
    if (outside.has(from) && outside.has(to)) continue;
    // Collaboration is symmetric and asserts no order, so draw one undirected line per pair.
    const key = [from, to].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`  ${nodeId(from)} --- ${nodeId(to)}`);
  }
  if (outside.size) lines.push("  classDef outside stroke-dasharray: 4 3,opacity:0.7");
  return lines.join("\n");
}

function main(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--neighbors") opts.neighbors = true;
    else if (argv[i] === "--contexts") opts.contexts = (argv[++i] ?? "").split(",").filter(Boolean);
    else if (argv[i] === "--direction") opts.direction = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  process.stdout.write(overviewFigure(readFileSync(0, "utf8"), opts) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
