// The browser the integration tests drive: the one MERMAID_BROWSER_PATH or
// PUPPETEER_EXECUTABLE_PATH names, or an installed Chrome, Edge or Chromium.
import { existsSync } from "node:fs";

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
