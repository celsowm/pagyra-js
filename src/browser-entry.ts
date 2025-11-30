/**
 * Browser entrypoint: minimal surface that wires the BrowserEnvironment.
 * Expect callers to provide HTML/CSS strings and optional fontConfig with preloaded ArrayBuffers.
 */
import { BrowserEnvironment } from "./environment/browser-environment.js";
import { setGlobalEnvironment } from "./environment/global.js";
import type { RenderHtmlOptions } from "./html-to-pdf.js";
import { renderHtmlToPdf } from "./html-to-pdf.js";

export async function renderHtmlToPdfBrowser(options: Omit<RenderHtmlOptions, "environment">): Promise<Uint8Array> {
  const environment = new BrowserEnvironment();
  setGlobalEnvironment(environment);
  return renderHtmlToPdf({ ...options, environment });
}
