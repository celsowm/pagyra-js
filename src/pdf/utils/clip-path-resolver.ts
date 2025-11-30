import type { LayoutNode } from "../../dom/node.js";
import type { ClipPath, Rect } from "../types.js";
import type { BackgroundBoxes } from "./background-layer-resolver.js";
import type { ClipPath as CssClipPath, ClipPathLength, ClipPathReferenceBox } from "../../css/clip-path-types.js";

export function resolveClipPath(node: LayoutNode, boxes: BackgroundBoxes): ClipPath | undefined {
  const clip = node.style.clipPath as CssClipPath | undefined;
  if (!clip || clip.type !== "polygon" || !clip.points.length) {
    return undefined;
  }

  const referenceRect = selectReferenceRect(clip.referenceBox, boxes);
  if (!referenceRect || referenceRect.width <= 0 || referenceRect.height <= 0) {
    return undefined;
  }

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
