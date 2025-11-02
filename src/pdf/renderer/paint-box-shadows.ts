import { rasterizeDropShadowForRect } from "../utils/drop-shadow-raster.js";
import type { PagePainter } from "../page-painter.js";
import type { RenderBox, Rect, Radius, ShadowLayer, RGBA } from "../types.js";
import { adjustRadius, clampNonNegative, cloneRadius, shrinkRadius } from "./radius.js";

export function paintBoxShadows(painter: PagePainter, boxes: RenderBox[], inset: boolean): void {
  for (const box of boxes) {
    if (!box.boxShadows?.length) {
      continue;
    }
    for (const shadow of box.boxShadows) {
      if (shadow.inset !== inset) {
        continue;
      }
      if (!isRenderableShadow(shadow)) {
        continue;
      }
      if (inset) {
        renderInsetShadow(painter, box, shadow);
      } else {
        renderOuterShadow(painter, box, shadow);
      }
    }
  }
}

function isRenderableShadow(shadow: ShadowLayer): boolean {
  const alpha = clampUnit(shadow.color.a ?? 1);
  return alpha > 0;
}

function renderOuterShadow(painter: PagePainter, box: RenderBox, shadow: ShadowLayer): void {
  const baseRect = translateRect(box.borderBox, shadow.offsetX, shadow.offsetY);
  const baseRadius = cloneRadius(box.borderRadius);
  const blur = clampNonNegative(shadow.blur);
  const spread = shadow.spread;
  if (blur > 0) {
    const raster = rasterizeDropShadowForRect(baseRect, baseRadius, shadow.color, blur, spread);
    if (raster) {
      painter.drawShadowImage(raster.image, raster.drawRect);
      return;
    }
  }
  drawShadowLayers(painter, {
    mode: "outer",
    baseRect,
    baseRadius,
    color: shadow.color,
    blur,
    spread,
  });
}

function renderInsetShadow(painter: PagePainter, box: RenderBox, shadow: ShadowLayer): void {
  const container = box.paddingBox ?? box.contentBox;
  if (!container) {
    return;
  }
  const baseRect = translateRect(container, shadow.offsetX, shadow.offsetY);
  const baseRadius = shrinkRadius(cloneRadius(box.borderRadius), box.border.top, box.border.right, box.border.bottom, box.border.left);
  const blur = clampNonNegative(shadow.blur);
  const spread = shadow.spread;
  if (blur === 0 && spread === 0) {
    painter.fillRoundedRect(baseRect, baseRadius, shadow.color);
    return;
  }
  drawShadowLayers(painter, {
    mode: "inset",
    baseRect,
    baseRadius,
    color: shadow.color,
    blur,
    spread,
  });
}

interface ShadowRenderParams {
  mode: "outer" | "inset";
  baseRect: Rect;
  baseRadius: Radius;
  color: RGBA;
  blur: number;
  spread: number;
}

interface ShadowIteration {
  expansion: number;
  color: RGBA;
}

function drawShadowLayers(painter: PagePainter, params: ShadowRenderParams): void {
  const iterations = buildShadowIterations(params);
  if (!iterations.length) {
    return;
  }

  if (params.mode === "outer") {
    renderOuterShadowIterations(painter, params.baseRect, params.baseRadius, iterations);
    return;
  }

  renderInsetShadowIterations(painter, params.baseRect, params.baseRadius, iterations);
}

function buildShadowIterations(params: ShadowRenderParams): ShadowIteration[] {
  const { mode, color, blur, spread } = params;
  const steps = blur > 0 ? Math.max(2, Math.ceil(blur / 2)) : 1;
  const weights = buildShadowWeights(steps);
  const baseAlpha = clampUnit(color.a ?? 1);
  const iterations: ShadowIteration[] = [];
  for (let index = 0; index < steps; index++) {
    const fraction =
      steps === 1
        ? 0
        : mode === "outer"
          ? index / (steps - 1)
          : (index + 1) / steps;
    const expansion = spread + blur * fraction;
    const weight = weights[index] ?? 0;
    if (weight <= 0) {
      continue;
    }
    iterations.push({
      expansion,
      color: {
        r: color.r,
        g: color.g,
        b: color.b,
        a: clampUnit(baseAlpha * weight),
      },
    });
  }
  return iterations;
}

function renderOuterShadowIterations(
  painter: PagePainter,
  baseRect: Rect,
  baseRadius: Radius,
  iterations: ShadowIteration[],
): void {
  for (const iteration of iterations) {
    const rect = inflateRect(baseRect, iteration.expansion);
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    const radius = adjustRadius(baseRadius, iteration.expansion);
    painter.fillRoundedRect(rect, radius, iteration.color);
  }
}

function renderInsetShadowIterations(
  painter: PagePainter,
  baseRect: Rect,
  baseRadius: Radius,
  iterations: ShadowIteration[],
): void {
  for (const iteration of iterations) {
    const contraction = Math.max(0, iteration.expansion);
    const innerRect = inflateRect(baseRect, -contraction);
    if (innerRect.width <= 0 || innerRect.height <= 0) {
      continue;
    }
    const outerRadius = cloneRadius(baseRadius);
    const innerRadius = adjustRadius(baseRadius, -contraction);
    painter.fillRoundedRectDifference(baseRect, outerRadius, innerRect, innerRadius, iteration.color);
  }
}

function translateRect(rect: Rect, dx: number, dy: number): Rect {
  return { x: rect.x + dx, y: rect.y + dy, width: rect.width, height: rect.height };
}

function inflateRect(rect: Rect, amount: number): Rect {
  const width = rect.width + amount * 2;
  const height = rect.height + amount * 2;
  if (width <= 0 || height <= 0) {
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      width: 0,
      height: 0,
    };
  }
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width,
    height,
  };
}

function buildShadowWeights(steps: number): number[] {
  if (steps <= 1) {
    return [1];
  }
  const weights: number[] = [];
  let total = 0;
  for (let index = 0; index < steps; index++) {
    const weight = steps - index;
    weights.push(weight);
    total += weight;
  }
  return weights.map((weight) => weight / total);
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}
