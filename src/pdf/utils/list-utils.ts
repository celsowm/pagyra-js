import { estimateLineWidth } from "../../layout/utils/text-metrics.js";
import type { LayoutNode } from "../../dom/node.js";
import type { RenderBox, Run, RGBA, Rect } from "../types.js";

export function createListMarkerRun(
  node: LayoutNode,
  contentBox: Rect,
  children: RenderBox[],
  fallbackColor: RGBA,
): Run | undefined {
  const styleType = resolveListStyleType(node);
  if (!styleType || styleType === "none") {
    return undefined;
  }
  const markerIndex = computeListItemIndex(node);
  const markerText = formatListMarker(styleType, markerIndex);
  if (!markerText) {
    return undefined;
  }

  const firstRun = findFirstDescendantTextRun(children);
  const fontFamily = node.style.fontFamily ?? "sans-serif";
  const fontSize = node.style.fontSize;
  const fontWeight = node.style.fontWeight;
  const color = fallbackColor ?? { r: 0, g: 0, b: 0, a: 1 };

  const baseline =
    firstRun?.lineMatrix.f ??
    (node.box.baseline > 0 ? node.box.baseline : contentBox.y + fontSize);
  const textStartX = firstRun?.lineMatrix.e ?? contentBox.x;
  const markerWidth = Math.max(estimateLineWidth(markerText, node.style), 0);
  const gap = Math.max(fontSize * 0.5, 6);
  const markerX = textStartX - gap - markerWidth;

  return {
    text: markerText,
    fontFamily,
    fontSize,
    fontWeight,
    fill: color,
    lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: markerX, f: baseline },
    advanceWidth: markerWidth + gap,
  };
}

export function findFirstDescendantTextRun(children: RenderBox[]): Run | undefined {
  for (const child of children) {
    if (child.textRuns.length > 0) {
      return child.textRuns[0];
    }
    const nested = findFirstDescendantTextRun(child.children);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

export function computeListItemIndex(node: LayoutNode): number {
  const parent = node.parent;
  if (!parent) {
    return 1;
  }
  let index = 0;
  for (const sibling of parent.children) {
    if (sibling.tagName === "li") {
      index += 1;
    }
    if (sibling === node) {
      break;
    }
  }
  return Math.max(index, 1);
}

export const LIST_STYLE_MARKERS: Record<"disc" | "circle" | "square", string> = {
  disc: "\u2022", // • BULLET
  circle: "\u25E6", // ◦ WHITE BULLET
  square: "\u25AA", // ▪ BLACK SMALL SQUARE
};

const DEFAULT_MARKER = LIST_STYLE_MARKERS.disc;

export function formatListMarker(styleType: string, index: number): string | undefined {
  const normalized = styleType.trim().toLowerCase();
  switch (normalized) {
    case "none":
      return undefined;
    case "decimal":
      return `${index}.`;
    case "decimal-leading-zero":
      return `${String(index).padStart(2, "0")}.`;
    case "lower-alpha":
      return `${toAlphaSequence(index).toLowerCase()}.`;
    case "upper-alpha":
      return `${toAlphaSequence(index).toUpperCase()}.`;
    case "lower-roman": {
      const roman = toRomanNumeral(index);
      return roman ? `${roman.toLowerCase()}.` : `${index}.`;
    }
    case "upper-roman": {
      const roman = toRomanNumeral(index);
      return roman ? `${roman.toUpperCase()}.` : `${index}.`;
    }
    case "disc":
    case "circle":
    case "square":
      return LIST_STYLE_MARKERS[normalized];
    default:
      return DEFAULT_MARKER;
  }
}

function toAlphaSequence(index: number): string {
  let n = Math.max(1, Math.floor(index));
  let result = "";
  while (n > 0) {
    n -= 1;
    const charCode = 65 + (n % 26);
    result = String.fromCharCode(charCode) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function toRomanNumeral(index: number): string | undefined {
  if (!Number.isFinite(index) || index <= 0 || index >= 4000) {
    return undefined;
  }
  const romanPairs: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let remainder = Math.floor(index);
  let result = "";
  for (const [value, numeral] of romanPairs) {
    while (remainder >= value) {
      result += numeral;
      remainder -= value;
    }
    if (remainder === 0) {
      break;
    }
  }
  return result;
}

export function resolveListStyleType(node: LayoutNode): string | undefined {
  const own = normalizeListStyleType(node.style.listStyleType);
  if (own === "none") {
    return "none";
  }
  if (own && own !== "disc") {
    return own;
  }

  const parent = node.parent;
  if (parent) {
    const parentStyle = normalizeListStyleType(parent.style.listStyleType);
    if (parentStyle === "none") {
      return "none";
    }
    if (parentStyle) {
      return parentStyle;
    }
    if (parent.tagName === "ol") {
      return "decimal";
    }
    if (parent.tagName === "ul") {
      return "disc";
    }
  }

  return own ?? "disc";
}

export function normalizeListStyleType(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}
