import { log } from "../../logging/debug.js";
import { paintBoxShadows } from "./paint-box-shadows.js";
import { shrinkRadius } from "./radius.js";
import { renderSvgBox } from "../svg/render-svg.js";
import { NodeKind, type RenderBox, type RGBA, type Rect, type Radius, type BorderStyles } from "../types.js";
import type { PagePainter } from "../page-painter.js";
import { computeBackgroundTileRects, rectEquals } from "../utils/background-tiles.js";
import { computeBorderSideStrokes } from "../utils/border-dashes.js";
import { roundedRectToPath } from "../utils/rounded-rect-to-path.js";
import type { PathCommand } from "../renderers/shape-renderer.js";
import { defaultFormRendererFactory } from "../renderers/form/factory.js";
import {
  extractDropShadowLayers,
  warnUnsupportedFilters,
} from "../utils/filter-utils.js";

export async function paintBoxAtomic(painter: PagePainter, box: RenderBox): Promise<void> {
  log("paint", "debug", `paintBoxAtomic: ${box.tagName} id:${box.id} opacity:${box.opacity}`, { id: box.id, opacity: box.opacity });

  const hasTransform = box.transform && (box.transform.b !== 0 || box.transform.c !== 0);

  // Filter opacity and stacking context opacity are handled at the scope level
  // in the paint instruction loop. Only apply per-box opacity for boxes
  // that don't establish stacking contexts.
  const effectiveOpacity = box.establishesStackingContext ? 1 : box.opacity;
  const hasOpacity = effectiveOpacity < 1;

  if (hasTransform) {
    painter.beginTransformScope(box.transform!, box.borderBox);
  }

  if (hasOpacity) {
    painter.beginOpacityScope(effectiveOpacity);
  }

  // ★ Warnings para filtros não renderizáveis
  warnUnsupportedFilters(box.filter, "filter", box.id);
  warnUnsupportedFilters(box.backdropFilter, "backdrop-filter", box.id);

  // ★ drop-shadow do filter (pintado como outer shadow antes dos box-shadows)
  if (box.filter) {
    const fallbackColor = box.color ?? { r: 0, g: 0, b: 0, a: 1 };
    const dropShadows = extractDropShadowLayers(box.filter, fallbackColor);
    if (dropShadows.length > 0) {
      paintDropShadows(painter, box, dropShadows);
    }
  }

  paintBoxShadows(painter, [box], false);

  // Overflow clipping
  const hasOverflowClip = box.overflow === "hidden" || box.overflow === "clip";
  if (hasOverflowClip) {
    const clipArea = determineOverflowClipArea(box);
    if (clipArea) {
      const clipCommands = roundedRectToPath(clipArea.rect, clipArea.radius);
      painter.beginClipPath(clipCommands);
    }
  }

  let clipCommands = buildClipPathCommands(box.clipPath);
  if (!clipCommands && box.maskLayers && box.maskLayers.length > 0) {
    const masks = box.maskLayers.filter(l => l.gradient.type === "radial");
    if (masks.length > 0) {
      clipCommands = [];
      for (const m of masks) {
        clipCommands.push(...buildCircularClipPath(m.rect));
      }
    }
  }

  const hasClip = !!clipCommands && clipCommands.length > 0;
  if (hasClip && clipCommands) {
    painter.beginClipPath(clipCommands);
  }

  if (box.backgroundClip !== "text") {
    paintBackground(painter, box);
  }
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

  if (hasOverflowClip) {
    painter.endClipPath();
  }

  if (hasOpacity) {
    painter.endOpacityScope(effectiveOpacity);
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

      // Type guard to handle gradient type conversion
      const g = gradient.gradient;
      if (g.type === "radial") {
        painter.fillRoundedRect(tile, radius, g as import("../../css/parsers/gradient-parser.js").RadialGradient);
      } else {
        painter.fillRoundedRect(tile, radius, g as import("../../css/parsers/gradient-parser.js").LinearGradient);
      }
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

function determineOverflowClipArea(box: RenderBox): { rect: Rect; radius: Radius } | null {
  const rect = box.paddingBox ?? box.contentBox;
  if (!rect) {
    return null;
  }

  let radius = shrinkRadius(box.borderRadius, box.border.top, box.border.right, box.border.bottom, box.border.left);
  if (rect === box.contentBox) {
    radius = shrinkRadius(radius, box.padding.top, box.padding.right, box.padding.bottom, box.padding.left);
  }

  return { rect, radius };
}

function buildCircularClipPath(rect: Rect): PathCommand[] {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  const k = 0.5522847498307936;

  return [
    { type: "moveTo", x: cx + rx, y: cy },
    { type: "curveTo", x1: cx + rx, y1: cy + ry * k, x2: cx + rx * k, y2: cy + ry, x: cx, y: cy + ry },
    { type: "curveTo", x1: cx - rx * k, y1: cy + ry, x2: cx - rx, y2: cy + ry * k, x: cx - rx, y: cy },
    { type: "curveTo", x1: cx - rx, y1: cy - ry * k, x2: cx - rx * k, y2: cy - ry, x: cx, y: cy - ry },
    { type: "curveTo", x1: cx + rx * k, y1: cy - ry, x2: cx + rx, y2: cy - ry * k, x: cx + rx, y: cy },
    { type: "closePath" }
  ];
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

function paintDropShadows(painter: PagePainter, box: RenderBox, shadows: import("../types.js").ShadowLayer[]): void {
  // Para drop-shadow em caminhos complexos (clip-path), precisamos de uma abordagem baseada em path
  const clipCommands = buildClipPathCommands(box.clipPath);

  if (clipCommands && clipCommands.length > 0) {
    for (const shadow of shadows) {
      if (shadow.color.a <= 0) continue;

      const blur = Math.max(0, shadow.blur);
      const steps = blur > 0 ? Math.max(3, Math.ceil(blur / 1.5)) : 1;
      const baseAlpha = shadow.color.a;

      // Pintamos várias vezes com offsets variados para simular blur (distribuição radial)
      for (let i = 0; i < steps; i++) {
        const fraction = steps > 1 ? i / (steps - 1) : 0;
        const angle = (i / steps) * Math.PI * 2;
        const blurRadius = (blur * 0.5) * fraction;
        const dx = shadow.offsetX + Math.cos(angle) * blurRadius;
        const dy = shadow.offsetY + Math.sin(angle) * blurRadius;

        // Distribuição de opacidade: dividimos a opacidade total pelos steps
        // mas damos um pouco mais de peso para as camadas internas.
        const weight = (steps - i) / ((steps * (steps + 1)) / 2);
        const opacity = baseAlpha * weight * (steps / 1.5);

        const offsetCommands = clipCommands.map(cmd => {
          if (cmd.type === "moveTo" || cmd.type === "lineTo") {
            return { ...cmd, x: cmd.x + dx, y: cmd.y + dy };
          }
          if (cmd.type === "curveTo") {
            return {
              ...cmd,
              x1: cmd.x1 + dx,
              y1: cmd.y1 + dy,
              x2: cmd.x2 + dx,
              y2: cmd.y2 + dy,
              x: cmd.x + dx,
              y: cmd.y + dy
            };
          }
          return cmd;
        });

        painter.beginOpacityScope(Math.min(1, opacity));
        painter.fillPath(offsetCommands, shadow.color);
        painter.endOpacityScope(Math.min(1, opacity));
      }
    }
    return;
  }

  // Usa o borderBox como base da sombra (aproximação para drop-shadow retangular)
  const virtualBox: Partial<RenderBox> = {
    borderBox: box.borderBox,
    borderRadius: box.borderRadius,
    boxShadows: shadows,
  };
  paintBoxShadows(painter, [virtualBox as RenderBox], false);
}
