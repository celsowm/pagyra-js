import type { StyleAccumulator } from "../style.js";
import type { ClipPath, ClipPathLength, ClipPathPolygon, ClipPathReferenceBox } from "../clip-path-types.js";
import { parseLengthOrPercent } from "./length-parser.js";

// Parses clip-path values. Currently supports polygon() with px or % coordinates.
export function parseClipPath(value: string, target: StyleAccumulator): void {
  const parsed = parseClipPathValue(value);
  if (!parsed) {
    return;
  }
  target.clipPath = parsed;
}

function parseClipPathValue(value: string): ClipPath | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  if (normalized === "none") {
    return undefined;
  }

  const polygon = parsePolygon(normalized);
  if (polygon) {
    return polygon;
  }
  return undefined;
}

function parsePolygon(input: string): ClipPathPolygon | undefined {
  const match = /^polygon\s*\((.+)\)$/i.exec(input);
  if (!match) {
    return undefined;
  }
  const body = match[1].trim();
  if (!body) {
    return undefined;
  }

  // Split points by commas; if no commas, fall back to whitespace grouping.
  const rawPoints = body.includes(",") ? body.split(/\s*,\s*/) : splitEvenTokens(body.split(/\s+/));
  const points: ClipPathPolygon["points"] = [];

  for (const raw of rawPoints) {
    const coords = raw.trim().split(/\s+/).filter(Boolean);
    if (coords.length < 2) {
      return undefined;
    }
    const x = parseClipLength(coords[0]);
    const y = parseClipLength(coords[1]);
    if (!x || !y) {
      return undefined;
    }
    points.push({ x, y });
  }

  if (points.length < 3) {
    return undefined;
  }

  const referenceBox: ClipPathReferenceBox = "border-box";
  return {
    type: "polygon",
    points,
    referenceBox,
  };
}

function splitEvenTokens(tokens: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (!a || !b) {
      break;
    }
    result.push(`${a} ${b}`);
  }
  return result;
}

function parseClipLength(token: string): ClipPathLength | undefined {
  const parsed = parseLengthOrPercent(token);
  if (parsed === undefined) {
    return undefined;
  }
  if (typeof parsed === "number") {
    return { unit: "px", value: parsed };
  }
  if (typeof parsed === "object" && parsed.kind === "absolute" && parsed.unit === "percent") {
    return { unit: "percent", value: parsed.value };
  }
  return undefined;
}
