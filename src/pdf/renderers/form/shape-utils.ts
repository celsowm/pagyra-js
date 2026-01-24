import type { RGBA } from "../../types.js";
import { formatNumber } from "../text-renderer-utils.js";
import { formatPdfRgb } from "./color-utils.js";
// import type { Rect } from "../../types.js";

export interface ShapePoint {
  x: number;
  y: number;
}

export function drawCheckbox(
  x: number, 
  y: number, 
  size: number, 
  isChecked: boolean, 
  color: RGBA,
  strokeColor?: RGBA
): string[] {
  const commands: string[] = [];
  // const half = size / 2;
  
  commands.push(`${formatNumber(x)} ${formatNumber(y)} ${formatNumber(size)} ${formatNumber(size)} re`);
  
  if (isChecked) {
    commands.push(`${formatPdfRgb(color)} rg`);
    commands.push("f");
  } else {
    if (strokeColor) {
      commands.push(`${formatPdfRgb(strokeColor)} RG`);
    }
    commands.push("S");
  }
  
  if (isChecked && strokeColor) {
    const strokeSize = Math.max(1, size * 0.05);
    commands.push(`${formatNumber(x)} ${formatNumber(y)} ${formatNumber(size)} ${formatNumber(size)} re`);
    commands.push(`${formatPdfRgb(strokeColor)} RG`);
    commands.push(`${formatNumber(strokeSize)} w`);
    commands.push("S");
    
    commands.push(`${formatNumber(x)} ${formatNumber(y)} ${formatNumber(size)} ${formatNumber(size)} re`);
    commands.push(`${formatPdfRgb(color)} rg`);
    commands.push("f");
  }
  
  return commands;
}

export function drawCheckmark(
  startX: number,
  startY: number,
  size: number,
  color: RGBA
): string[] {
  const commands: string[] = [];
  
  const p1x = startX + size * 0.2;
  const p1y = startY + size * 0.55;
  const p2x = startX + size * 0.45;
  const p2y = startY + size * 0.85;
  const p3x = startX + size * 0.85;
  const p3y = startY + size * 0.3;
  
  commands.push(`${formatNumber(p1x)} ${formatNumber(p1y)} m`);
  commands.push(`${formatNumber(p2x)} ${formatNumber(p2y)} l`);
  commands.push(`${formatNumber(p3x)} ${formatNumber(p3y)} l`);
  
  commands.push("h");
  commands.push(`${formatPdfRgb(color)} rg`);
  commands.push("f");
  
  return commands;
}

export function drawRadio(
  x: number, 
  y: number, 
  size: number, 
  isChecked: boolean, 
  fillColor: RGBA,
  strokeColor?: RGBA
): string[] {
  const commands: string[] = [];
  const radius = size / 2;
  const centerX = x + radius;
  const centerY = y + radius;
  
  const strokeW = strokeColor ? Math.max(1, size * 0.06) : 0;
  const innerRadius = radius - strokeW - 1;
  
  commands.push(`${formatNumber(centerX)} ${formatNumber(centerY)} ${formatNumber(radius)} ${formatNumber(radius)} c`);
  commands.push("h");
  
  if (strokeColor) {
    commands.push(`${formatPdfRgb(strokeColor)} RG`);
    commands.push(`${formatNumber(strokeW)} w`);
    commands.push("S");
  }
  
  if (isChecked) {
    commands.push(`${formatNumber(centerX)} ${formatNumber(centerY)} ${formatNumber(innerRadius)} ${formatNumber(innerRadius)} c`);
    commands.push("h");
    commands.push(`${formatPdfRgb(fillColor)} rg`);
    commands.push("f");
  }
  
  return commands;
}

export function drawDropdownArrow(
  x: number,
  y: number,
  width: number,
  color: RGBA
): string[] {
  const commands: string[] = [];
  const halfWidth = width / 2;
  const height = width * 0.6;
  
  const tipX = x + halfWidth;
  const tipY = y + height * 0.3;
  const leftX = x + width * 0.15;
  const rightX = x + width * 0.85;
  const baseY = y + height;
  
  commands.push(`${formatNumber(tipX)} ${formatNumber(tipY)} m`);
  commands.push(`${formatNumber(rightX)} ${formatNumber(baseY)} l`);
  commands.push(`${formatNumber(leftX)} ${formatNumber(baseY)} l`);
  commands.push("h");
  commands.push(`${formatPdfRgb(color)} rg`);
  commands.push("f");
  
  return commands;
}

export function drawFocusRing(
  x: number,
  y: number,
  width: number,
  height: number,
  color: RGBA,
  offset: number = 2
): string[] {
  const commands: string[] = [];
  const ox = x - offset;
  const oy = y - offset;
  const ow = width + offset * 2;
  const oh = height + offset * 2;
  
  commands.push(`${formatNumber(ox)} ${formatNumber(oy)} ${formatNumber(ow)} ${formatNumber(oh)} re`);
  commands.push(`${formatPdfRgb(color)} RG`);
  commands.push("S");
  
  return commands;
}

export function drawPlaceholderText(
  text: string,
  x: number,
  y: number,
  width: number,
  color: RGBA,
  fontSize: number,
  _fontFamily: string
): string[] {
  const commands: string[] = [];
  
  commands.push("BT");
  commands.push(`/F1 ${formatNumber(fontSize)} Tf`);
  commands.push(`${formatPdfRgb(color)} rg`);
  commands.push(`${formatNumber(x)} ${formatNumber(y)} Td`);
  
  const truncatedText = truncateText(text, width, fontSize);
  commands.push(`(${escapePdfString(truncatedText)}) Tj`);
  commands.push("ET");
  
  return commands;
}

function truncateText(text: string, maxWidth: number, fontSize: number): string {
  const charWidth = fontSize * 0.5;
  const maxChars = Math.floor(maxWidth / charWidth) - 3;
  
  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars) + "...";
}

function escapePdfString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F]/g, "");
}
