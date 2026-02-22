import { renderPdf } from "../pdf/render.js";
import { loadBuiltinFontConfig } from "../pdf/font/builtin-fonts.js";
import { NodeEnvironment } from "../environment/node-environment.js";
import { encodeUint8ArrayToBase64 } from "../utils/base64.js";
import { prepareHtmlRender } from "./prepare-html-render.js";
import type { RenderHtmlOptions } from "./types.js";

export async function renderHtmlToPdf(options: RenderHtmlOptions): Promise<Uint8Array> {
  const environment = options.environment ?? new NodeEnvironment(options.assetRootDir ?? options.resourceBaseDir);
  const resolvedResourceBaseDir = options.resourceBaseDir ?? options.assetRootDir ?? "";
  const resolvedAssetRootDir = options.assetRootDir ?? resolvedResourceBaseDir;
  const resolvedFontConfig = options.fontConfig ?? (await loadBuiltinFontConfig(environment));
  const preparedOptions = resolvedFontConfig ? { ...options, fontConfig: resolvedFontConfig, environment } : { ...options, environment };
  const prepared = await prepareHtmlRender(preparedOptions);

  return renderPdf(prepared.renderTree, {
    pageSize: prepared.pageSize,
    fontConfig: resolvedFontConfig ?? undefined,
    margins: prepared.margins,
    environment,
    resourceBaseDir: resolvedResourceBaseDir,
    assetRootDir: resolvedAssetRootDir,
  });
}

export async function renderHtmlToPdfBase64(options: RenderHtmlOptions): Promise<string> {
  const pdfBuffer = await renderHtmlToPdf(options);
  return encodeUint8ArrayToBase64(pdfBuffer);
}

