import type { Outline, Rect, Radius, StrokeOptions } from "../types.js";
import type { PathCommand } from "../renderers/shape-renderer.js";
import { roundedRectToPath } from "./rounded-rect-to-path.js";

export interface OutlineStroke {
  path: PathCommand[];
  color: Outline["color"];
  options: StrokeOptions;
}

export function resolveOutlineStrokes(
  borderBox: Rect,
  borderRadius: Radius,
  outline: Outline | undefined,
): OutlineStroke[] {
  if (!outline || outline.width <= 0 || outline.style === "none") {
    return [];
  }

  if (outline.style === "double") {
    const strokeWidth = outline.width / 3;
    return [
      createStroke(borderBox, borderRadius, outline, strokeWidth, outline.offset + strokeWidth / 2),
      createStroke(
        borderBox,
        borderRadius,
        outline,
        strokeWidth,
        outline.offset + outline.width - strokeWidth / 2,
      ),
    ];
  }

  const dash = outline.style === "dashed"
    ? { pattern: [outline.width * 3, outline.width * 3] }
    : outline.style === "dotted"
      ? { pattern: [outline.width, outline.width * 2] }
      : undefined;

  return [
    createStroke(
      borderBox,
      borderRadius,
      outline,
      outline.width,
      outline.offset + outline.width / 2,
      dash,
      outline.style === "dotted" ? "round" : "butt",
    ),
  ];
}

function createStroke(
  borderBox: Rect,
  borderRadius: Radius,
  outline: Outline,
  lineWidth: number,
  expansion: number,
  dash?: StrokeOptions["dash"],
  lineCap: NonNullable<StrokeOptions["lineCap"]> = "butt",
): OutlineStroke {
  const rect = expandRect(borderBox, expansion);
  const radius = expandRadius(borderRadius, expansion);
  return {
    path: roundedRectToPath(rect, radius),
    color: outline.color,
    options: {
      lineWidth,
      lineCap,
      lineJoin: "round",
      dash,
    },
  };
}

function expandRect(rect: Rect, expansion: number): Rect {
  return {
    x: rect.x - expansion,
    y: rect.y - expansion,
    width: Math.max(0, rect.width + expansion * 2),
    height: Math.max(0, rect.height + expansion * 2),
  };
}

function expandRadius(radius: Radius, expansion: number): Radius {
  const amount = Math.max(0, expansion);
  return {
    topLeft: {
      x: Math.max(0, radius.topLeft.x + amount),
      y: Math.max(0, radius.topLeft.y + amount),
    },
    topRight: {
      x: Math.max(0, radius.topRight.x + amount),
      y: Math.max(0, radius.topRight.y + amount),
    },
    bottomRight: {
      x: Math.max(0, radius.bottomRight.x + amount),
      y: Math.max(0, radius.bottomRight.y + amount),
    },
    bottomLeft: {
      x: Math.max(0, radius.bottomLeft.x + amount),
      y: Math.max(0, radius.bottomLeft.y + amount),
    },
  };
}
