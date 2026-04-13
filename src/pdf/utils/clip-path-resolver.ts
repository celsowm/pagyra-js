import type { LayoutNode } from "../../dom/node.js";
import type { ClipPath, Rect } from "../types.js";
import type { BackgroundBoxes } from "./background-layer-resolver.js";
import type { ClipPath as CssClipPath, ClipPathLength, ClipPathReferenceBox } from "../../css/clip-path-types.js";
import { parsePathData } from "../../svg/path-data.js";
import type { PathCommand } from "../renderers/shape-renderer.js";

export function resolveClipPath(node: LayoutNode, boxes: BackgroundBoxes): ClipPath | undefined {
  const clip = node.style.clipPath as CssClipPath | undefined;
  if (!clip) {
    return undefined;
  }

  const referenceRect = selectReferenceRect(clip.referenceBox, boxes);
  if (!referenceRect || referenceRect.width <= 0 || referenceRect.height <= 0) {
    return undefined;
  }

  if (clip.type === "polygon") {
    if (!clip.points.length) return undefined;
    const points = clip.points.map((point) => {
      const x = resolveClipLength(point.x, referenceRect.width);
      const y = resolveClipLength(point.y, referenceRect.height);
      return {
        x: referenceRect.x + x,
        y: referenceRect.y + y,
      };
    });

    if (points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      return undefined;
    }

    return { type: "polygon", points };
  }

  if (clip.type === "path") {
    const segments = parsePathData(clip.commands);
    if (!segments.length) return undefined;

    const commands: PathCommand[] = [];
    for (const seg of segments) {
      switch (seg.type) {
        case "M":
          commands.push({ type: "moveTo", x: referenceRect.x + seg.x, y: referenceRect.y + seg.y });
          break;
        case "L":
          commands.push({ type: "lineTo", x: referenceRect.x + seg.x, y: referenceRect.y + seg.y });
          break;
        case "C":
          commands.push({
            type: "curveTo",
            x1: referenceRect.x + seg.x1,
            y1: referenceRect.y + seg.y1,
            x2: referenceRect.x + seg.x2,
            y2: referenceRect.y + seg.y2,
            x: referenceRect.x + seg.x,
            y: referenceRect.y + seg.y
          });
          break;
        case "Z":
          commands.push({ type: "closePath" });
          break;
      }
    }

    return commands.length > 0 ? { type: "path", commands } : undefined;
  }

  return undefined;
}

function selectReferenceRect(box: ClipPathReferenceBox | undefined, boxes: BackgroundBoxes): Rect {
  switch (box) {
    case "padding-box":
      return boxes.paddingBox;
    case "content-box":
      return boxes.contentBox;
    case "border-box":
    default:
      return boxes.borderBox;
  }
}

function resolveClipLength(length: ClipPathLength, reference: number): number {
  if (length.unit === "percent") {
    return length.value * reference;
  }
  return length.value;
}
