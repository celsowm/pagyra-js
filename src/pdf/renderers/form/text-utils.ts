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

export function resolveFormTextPosition(
  node: RenderBox,
  fontSize: number,
  coordinateTransformer: { convertPxToPt(value: number): number; pageOffsetPx: number; pageHeightPt: number },
  mode: "center" | "top",
): { xPt: number; yPt: number } {
  const box = node.contentBox ?? node.borderBox;
  const contentTop = box.y;
  const contentHeight = box.height;
  const lineHeight = fontSize * 1.2;
  const ascent = fontSize * 0.8;

  let baselinePx: number;
  if (mode === "center") {
    const lineTop = contentTop + Math.max(0, (contentHeight - lineHeight) / 2);
    baselinePx = lineTop + ascent;
  } else {
    baselinePx = contentTop + ascent;
  }

  const localBaseline = baselinePx - coordinateTransformer.pageOffsetPx;
  return {
    xPt: coordinateTransformer.convertPxToPt(box.x),
    yPt: coordinateTransformer.pageHeightPt - coordinateTransformer.convertPxToPt(localBaseline),
  };
}
