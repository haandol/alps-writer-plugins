import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
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

const PUPPETEER_CONFIG = () => {
  const executablePath = browserPath();
  return { ...(executablePath ? { executablePath } : {}), headless: true, timeout: 30_000 };
};

/** One headless browser for a report's diagrams, from the puppeteer mermaid-cli ships with. */
async function launchBrowser() {
  const cli = createRequire(createRequire(import.meta.url).resolve("@mermaid-js/mermaid-cli"));
  const { default: puppeteer } = await import(cli.resolve("puppeteer"));
  return puppeteer.launch(PUPPETEER_CONFIG());
}

async function renderLocal(sourceFile, svgFile, id, browser) {
  const { run } = await import("@mermaid-js/mermaid-cli");
  await run(sourceFile, svgFile, {
    // A browser the caller launched is reused and left open; without one, run launches its own.
    ...(browser ? { browser } : {}),
    quiet: true,
    outputFormat: "svg",
    puppeteerConfig: PUPPETEER_CONFIG(),
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
export async function prepareCoverageVisuals(report, directory, { render } = {}) {
  report.coverageVisuals = await renderDiagrams(coverageDiagrams(report), directory, { render });
  return report.coverageVisuals;
}

export async function renderDiagrams(diagrams, directory, { render } = {}) {
  const folder = path.join(directory, "coverage");
  mkdirSync(folder, { recursive: true });
  // The local renderer draws all of a report's diagrams in one browser.
  const browser = render || !diagrams.length ? null : await launchBrowser();
  const draw = render ?? ((source, svg, id) => renderLocal(source, svg, id, browser));
  try {
    const visuals = [];
    for (const diagram of diagrams) {
      if (!/^[a-z][a-z0-9-]*$/.test(diagram.id)) throw new Error("Invalid diagram ID");
      const sourceFile = path.join(folder, `${diagram.id}.mmd`);
      const svgFile = path.join(folder, `${diagram.id}.svg`);
      writeFileSync(sourceFile, diagram.source + "\n");
      const svg = await draw(sourceFile, svgFile, diagram.id);
      visuals.push({ ...diagram, svg });
    }
    return visuals;
  } finally {
    await browser?.close();
  }
}
