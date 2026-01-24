import type { RenderBox } from "../../types.js";
import type { FontResource } from "../../font/font-registry.js";
import { encodeTextPayload } from "../text-encoder.js";
import type { FontProvider } from "./irenderer.js";

export interface ResolvedFormFont {
  readonly font: FontResource;
  readonly fontSize: number;
}

export function resolveFormFont(node: RenderBox, fontProvider: FontProvider): ResolvedFormFont {
  const customData = node.customData ?? {};
  const fontFamily = typeof customData.fontFamily === "string" ? customData.fontFamily : undefined;
  const fontWeight = typeof customData.fontWeight === "number" ? customData.fontWeight : undefined;
  const fontStyle = typeof customData.fontStyle === "string" ? customData.fontStyle : undefined;
  const customFontSize =
    typeof customData.fontSize === "number" && Number.isFinite(customData.fontSize) ? customData.fontSize : undefined;

  const fontSize = customFontSize ?? node.textRuns[0]?.fontSize ?? 14;
  const font = fontProvider.ensureFontResourceSync(fontFamily, fontWeight, fontStyle);

  return { font, fontSize };
}

export function encodeFormText(text: string, font: FontResource): string {
  return encodeTextPayload(text, font).encoded;
}
