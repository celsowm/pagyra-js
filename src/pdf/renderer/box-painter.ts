import { log } from "../../logging/debug.js";
import { paintBoxShadows } from "./paint-box-shadows.js";
import { shrinkRadius } from "./radius.js";
import { renderSvgBox } from "../svg/render-svg.js";
import { NodeKind, type RenderBox, type RGBA, type Rect, type Radius, type BorderStyles } from "../types.js";
import type { PagePainter } from "../page-painter.js";
import { computeBackgroundTileRects, rectEquals } from "../utils/background-tiles.js";
import { computeBorderSideStrokes } from "../utils/border-dashes.js";
import type { PathCommand } from "../renderers/shape-renderer.js";
import { defaultFormRendererFactory } from "../renderers/form/factory.js";

export async function paintBoxAtomic(painter: PagePainter, box: RenderBox): Promise<void> {
  log("paint", "debug", `paintBoxAtomic: ${box.tagName} id:${box.id} opacity:${box.opacity}`, { id: box.id, opacity: box.opacity });

  const hasTransform = box.transform && (box.transform.b !== 0 || box.transform.c !== 0);
  const hasOpacity = box.opacity < 1;

  if (hasTransform) {
    painter.beginTransformScope(box.transform!, box.borderBox);
  }

  if (hasOpacity) {
    painter.beginOpacityScope(box.opacity);
  }

  paintBoxShadows(painter, [box], false);

  const clipCommands = buildClipPathCommands(box.clipPath);
  const hasClip = !!clipCommands;
  if (hasClip && clipCommands) {
    painter.beginClipPath(clipCommands);
  }

  paintBackground(painter, box);
  paintBorder(painter, box);
  paintBoxShadows(painter, [box], true);

  if (box.kind === NodeKind.Svg || (box.tagName === "svg" && box.customData?.svg)) {
    await renderSvgBox(painter, box, painter.environment);
  } else if (box.image) {
    painter.drawImage(box.image, box.contentBox);
  } else if (defaultFormRendererFactory.canRender(box)) {
    painter.renderFormControl(box);
  }

  await paintText(painter, box);

  if (hasClip) {
    painter.endClipPath();
  }

  if (hasOpacity) {
    painter.endOpacityScope(box.opacity);
  }

  if (hasTransform) {
    painter.endTransformScope();
  }
}

export function paintPageBackground(painter: PagePainter, color: RGBA | undefined, widthPx: number, heightPx: number, offsetY: number): void {
  if (!color) {
    return;
  }
  if (!Number.isFinite(widthPx) || widthPx <= 0 || !Number.isFinite(heightPx) || heightPx <= 0) {
    return;
  }
  const rect: Rect = { x: 0, y: offsetY, width: widthPx, height: heightPx };
  painter.fillRect(rect, color);
}

async function paintText(painter: PagePainter, box: RenderBox): Promise<void> {
  if (!box.textRuns || box.textRuns.length === 0) {
    return;
  }
  for (const run of box.textRuns) {
    if (box.textShadows && box.textShadows.length > 0) {
      run.textShadows = [...(box.textShadows ?? []), ...(run.textShadows ?? [])];
    }
    await painter.drawTextRun(run);
  }
}

function paintBackground(painter: PagePainter, box: RenderBox): void {
  const background = box.background;
  if (!background) {
    return;
  }

  const paintArea = determineBackgroundPaintArea(box);
  if (!paintArea) {
    return;
  }

  log("paint", "debug", `painting background z:${box.zIndexComputed ?? 0}`, {
    tagName: box.tagName,
    zIndex: box.zIndexComputed ?? 0,
    id: box.id,
    background: background.color ? "color" : background.gradient ? "gradient" : background.image ? "image" : "none",
  });

  if (background.color) {
    painter.fillRoundedRect(paintArea.rect, paintArea.radius, background.color);
  }

  if (background.gradient) {
    const gradient = background.gradient;
    const clipRect = paintArea.rect;

    const gradientRect = gradient.rect ?? clipRect;
    const repeatMode = gradient.repeat ?? "no-repeat";
    const tiles = computeBackgroundTileRects(gradientRect, clipRect, repeatMode);

    for (const tile of tiles) {
      const radius =
        rectEquals(tile, clipRect) || rectEquals(tile, gradient.originRect)
          ? paintArea.radius
          : zeroRadius();

      painter.fillRoundedRect(tile, radius, gradient.gradient as any);
    }
  }

  if (background.image) {
    paintBackgroundImageLayer(painter, background.image, paintArea.rect, paintArea.radius);
  }
}

function paintBackgroundImageLayer(
  painter: PagePainter,
  layer: RenderBox["background"]["image"],
  clipRect: Rect,
  clipRadius: Radius,
): void {
  if (!layer || !layer.rect) {
    return;
  }

  const repeatMode = layer.repeat ?? "repeat";
  const tiles = computeBackgroundTileRects(layer.rect, clipRect, repeatMode);

  for (const tile of tiles) {
    painter.drawBackgroundImage(layer.image, tile, clipRect, clipRadius);
  }
}

function paintBorder(painter: PagePainter, box: RenderBox): void {
  const color = box.borderColor;
  if (!color) {
    return;
  }
  const { border } = box;
  if (!hasVisibleBorder(border)) {
    return;
  }

  const styles: BorderStyles | undefined = box.borderStyle;
  const allSolid =
    !styles ||
    (styles.top === "solid" && styles.right === "solid" && styles.bottom === "solid" && styles.left === "solid");

  if (allSolid) {
    const outerRect = box.borderBox;
    const innerRect = {
      x: outerRect.x + border.left,
      y: outerRect.y + border.top,
      width: Math.max(outerRect.width - border.left - border.right, 0),
      height: Math.max(outerRect.height - border.top - border.bottom, 0),
    };
    const innerRadius = shrinkRadius(box.borderRadius, border.top, border.right, border.bottom, border.left);
    if (innerRect.width <= 0 || innerRect.height <= 0) {
      painter.fillRoundedRect(outerRect, box.borderRadius, color);
    } else {
      painter.fillRoundedRectDifference(outerRect, box.borderRadius, innerRect, innerRadius, color);
    }
    return;
  }

  const effectiveStyles: BorderStyles = styles ?? {
    top: "solid",
    right: "solid",
    bottom: "solid",
    left: "solid",
  };

  const strokes = computeBorderSideStrokes(box.borderBox, border, effectiveStyles, color, box.borderRadius);
  for (const stroke of strokes) {
    painter.strokePolyline(stroke.points, stroke.color, {
      lineWidth: stroke.lineWidth,
      lineCap: "butt",
      lineJoin: "miter",
      dash: stroke.dash,
    });
  }
}

function determineBackgroundPaintArea(box: RenderBox): { rect: Rect; radius: Radius } | null {
  const rect = box.borderBox ?? box.paddingBox ?? box.contentBox;
  if (!rect) {
    return null;
  }

  if (rect === box.borderBox) {
    return { rect, radius: box.borderRadius };
  }

  let radius = shrinkRadius(box.borderRadius, box.border.top, box.border.right, box.border.bottom, box.border.left);
  if (rect === box.contentBox) {
    radius = shrinkRadius(radius, box.padding.top, box.padding.right, box.padding.bottom, box.padding.left);
  }

  return { rect, radius };
}

function hasVisibleBorder(border: RenderBox["border"]): boolean {
  return border.top > 0 || border.right > 0 || border.bottom > 0 || border.left > 0;
}

function zeroRadius(): Radius {
  return {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 0, y: 0 },
    bottomRight: { x: 0, y: 0 },
    bottomLeft: { x: 0, y: 0 },
  };
}

function buildClipPathCommands(clipPath: RenderBox["clipPath"]): PathCommand[] | null {
  if (!clipPath || clipPath.type !== "polygon" || clipPath.points.length < 3) {
    return null;
  }
  const [first, ...rest] = clipPath.points;
  const commands: PathCommand[] = [{ type: "moveTo", x: first.x, y: first.y }];
  for (const point of rest) {
    commands.push({ type: "lineTo", x: point.x, y: point.y });
  }
  commands.push({ type: "closePath" });
  return commands;
}
