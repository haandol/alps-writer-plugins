// The browser the integration tests drive: the one MERMAID_BROWSER_PATH or
// PUPPETEER_EXECUTABLE_PATH names, or an installed Chrome, Edge or Chromium.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

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

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve("@mermaid-js/mermaid-cli"));
const { default: puppeteer } = await import(cliRequire.resolve("puppeteer"));

/** A headless browser on this machine's Chrome. */
export const launch = (userDataDir) =>
  puppeteer.launch({
    headless: true,
    userDataDir,
    executablePath: browserPath(),
    args: process.env.CI ? ["--no-sandbox"] : [],
  });

/** Abort and record in `requests` every request that would leave the machine: the view opens offline. */
export async function offline(p, requests) {
  await p.setRequestInterception(true);
  p.on("request", (request) => {
    if (/^https?:/.test(request.url())) {
      requests.push(request.url());
      request.abort();
    } else request.continue();
  });
}

/** Keep the page hidden for the check and return focus even if the check fails. */
export async function whilePageHidden(page, check) {
  const other = await page.browserContext().newPage();
  try {
    await other.bringToFront();
    await page.waitForFunction(() => document.hidden);
    await check();
  } finally {
    await other.close();
    await page.bringToFront();
  }
}
