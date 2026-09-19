import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { coverageDiagrams } from "./coverage.mjs";

export function browserPath() {
  const explicit = process.env.MERMAID_BROWSER_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  if (explicit) {
    if (!existsSync(explicit)) throw new Error("Mermaid browser executable does not exist");
    return explicit;
  }
  return [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].find((candidate) => existsSync(candidate));
}

async function renderLocal(sourceFile, svgFile, id) {
  const { run } = await import("@mermaid-js/mermaid-cli");
  const executablePath = browserPath();
  await run(sourceFile, svgFile, {
    quiet: true,
    outputFormat: "svg",
    puppeteerConfig: {
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      timeout: 30_000,
    },
    parseMMDOptions: {
      svgId: id,
      viewport: { width: 1600, height: 1100, deviceScaleFactor: 1 },
      backgroundColor: "transparent",
      mermaidConfig: {
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        themeVariables: {
          fontFamily: "-apple-system, BlinkMacSystemFont, Arial, sans-serif",
          fontSize: "17px",
          primaryColor: "#edf2f7",
          primaryTextColor: "#183046",
          primaryBorderColor: "#8098ac",
          lineColor: "#607b93",
        },
        flowchart: { htmlLabels: false, nodeSpacing: 40, rankSpacing: 55 },
      },
    },
  });
  const svg = readFileSync(svgFile, "utf8");
  if (!svg.includes("<svg")) throw new Error("Mermaid did not produce an SVG");
  return svg;
}

// Rebuild from trusted stage definitions and the selected case/obligation IDs.
// Saved SVGs are not accepted as an alternative source of coverage truth.
export async function prepareCoverageVisuals(report, directory, { render = renderLocal } = {}) {
  const folder = path.join(directory, "coverage");
  mkdirSync(folder, { recursive: true });
  const visuals = [];
  for (const diagram of coverageDiagrams(report)) {
    const sourceFile = path.join(folder, `${diagram.id}.mmd`);
    const svgFile = path.join(folder, `${diagram.id}.svg`);
    writeFileSync(sourceFile, diagram.source + "\n");
    const svg = await render(sourceFile, svgFile, diagram.id);
    visuals.push({ ...diagram, svg });
  }
  report.coverageVisuals = visuals;
  return visuals;
}
