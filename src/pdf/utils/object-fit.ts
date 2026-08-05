import type { ObjectPosition } from "../../css/properties/misc.js";
import { ObjectFit, type ImageRef, type Rect } from "../types.js";

const CENTER: ObjectPosition = { x: 0.5, y: 0.5 };

export function resolveObjectFitRect(
  image: ImageRef,
  contentBox: Rect,
  fit: ObjectFit = ObjectFit.Fill,
  position: ObjectPosition = CENTER,
): Rect {
  const intrinsicWidth = Math.max(0, image.width);
  const intrinsicHeight = Math.max(0, image.height);
  const containerWidth = Math.max(0, contentBox.width);
  const containerHeight = Math.max(0, contentBox.height);

  if (
    fit === ObjectFit.Fill
    || intrinsicWidth === 0
    || intrinsicHeight === 0
    || containerWidth === 0
    || containerHeight === 0
  ) {
    return { ...contentBox };
  }

  const containScale = Math.min(
    containerWidth / intrinsicWidth,
    containerHeight / intrinsicHeight,
  );
  const coverScale = Math.max(
    containerWidth / intrinsicWidth,
    containerHeight / intrinsicHeight,
  );

  let scale = 1;
  switch (fit) {
    case ObjectFit.Contain:
      scale = containScale;
      break;
    case ObjectFit.Cover:
      scale = coverScale;
      break;
    case ObjectFit.ScaleDown:
      scale = Math.min(1, containScale);
      break;
    case ObjectFit.None:
      scale = 1;
      break;
    default:
      return { ...contentBox };
  }

  const width = intrinsicWidth * scale;
  const height = intrinsicHeight * scale;
  return {
    x: contentBox.x + (containerWidth - width) * position.x,
    y: contentBox.y + (containerHeight - height) * position.y,
    width,
    height,
  };
}

export function objectFitNeedsClip(rect: Rect, contentBox: Rect): boolean {
  return rect.x < contentBox.x
    || rect.y < contentBox.y
    || rect.x + rect.width > contentBox.x + contentBox.width
    || rect.y + rect.height > contentBox.y + contentBox.height;
}
