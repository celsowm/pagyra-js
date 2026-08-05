import type {
  Background,
  ClipPath,
  GradientBackground,
  PositionedLayer,
  Rect,
  RenderBox,
  Run,
} from "./types.js";
import type { PaintInstruction } from "./stacking/types.js";
import { resolvePaintOrder } from "./stacking/resolve-paint-order.js";

export interface FixedLayerCollection {
  layers: PositionedLayer[];
  boxes: Set<RenderBox>;
}

export function collectFixedLayers(root: RenderBox): FixedLayerCollection {
  const fixedRoots: RenderBox[] = [];
  collectFixedRoots(root, false, fixedRoots);

  const boxes = new Set<RenderBox>();
  const layers = fixedRoots.map((fixedRoot) => {
    const paintOrder = resolvePaintOrder(fixedRoot);
    const layerBoxes = paintOrder
      .filter((instruction): instruction is PaintInstruction & { type: "box" } => instruction.type === "box")
      .map((instruction) => instruction.box);
    for (const box of layerBoxes) {
      boxes.add(box);
    }
    return {
      z: fixedRoot.zIndexComputed,
      boxes: layerBoxes,
      paintOrder,
    };
  });

  layers.sort((left, right) => left.z - right.z);
  return { layers, boxes };
}

export function translatePositionedLayer(
  layer: PositionedLayer,
  dx: number,
  dy: number,
): PositionedLayer {
  const originalPaintOrder = layer.paintOrder
    ?? layer.boxes.map((box): PaintInstruction => ({ type: "box", box }));
  const originals = originalPaintOrder
    .filter((instruction): instruction is PaintInstruction & { type: "box" } => instruction.type === "box")
    .map((instruction) => instruction.box);
  const clones = new Map<RenderBox, RenderBox>();

  for (const original of originals) {
    if (!clones.has(original)) {
      clones.set(original, cloneRenderBox(original, dx, dy));
    }
  }
  for (const [original, clone] of clones) {
    clone.children = original.children.map((child) => clones.get(child) ?? child);
    clone.tableCaption = original.tableCaption
      ? clones.get(original.tableCaption) ?? original.tableCaption
      : original.tableCaption;
    clone.colgroups = original.colgroups?.map((box) => clones.get(box) ?? box);
    clone.cols = original.cols?.map((box) => clones.get(box) ?? box);
    clone.containingBlockForAbs = original.containingBlockForAbs
      ? clones.get(original.containingBlockForAbs) ?? original.containingBlockForAbs
      : original.containingBlockForAbs;
  }

  const paintOrder = originalPaintOrder.map((instruction): PaintInstruction => {
    if (instruction.type !== "box") {
      return { ...instruction };
    }
    return {
      type: "box",
      box: clones.get(instruction.box) ?? cloneRenderBox(instruction.box, dx, dy),
    };
  });

  return {
    z: layer.z,
    boxes: paintOrder
      .filter((instruction): instruction is PaintInstruction & { type: "box" } => instruction.type === "box")
      .map((instruction) => instruction.box),
    paintOrder,
  };
}

function collectFixedRoots(
  box: RenderBox,
  insideFixed: boolean,
  result: RenderBox[],
): void {
  const isFixed = box.positioning.type === "fixed";
  if (isFixed && !insideFixed) {
    result.push(box);
    return;
  }
  for (const child of box.children) {
    collectFixedRoots(child, insideFixed || isFixed, result);
  }
}

function cloneRenderBox(box: RenderBox, dx: number, dy: number): RenderBox {
  return {
    ...box,
    contentBox: translateRect(box.contentBox, dx, dy),
    paddingBox: translateRect(box.paddingBox, dx, dy),
    borderBox: translateRect(box.borderBox, dx, dy),
    visualOverflow: translateRect(box.visualOverflow, dx, dy),
    clipPath: translateClipPath(box.clipPath, dx, dy),
    background: translateBackground(box.background, dx, dy),
    textRuns: box.textRuns.map((run) => translateRun(run, dx, dy)),
    markerRect: box.markerRect ? translateRect(box.markerRect, dx, dy) : undefined,
    links: box.links.map((link) => ({
      rect: translateRect(link.rect, dx, dy),
      target: { ...link.target },
    })),
    maskGradient: box.maskGradient
      ? translateGradientBackground(box.maskGradient, dx, dy)
      : undefined,
    children: [],
  };
}

function translateRun(run: Run, dx: number, dy: number): Run {
  return {
    ...run,
    lineMatrix: {
      ...run.lineMatrix,
      e: run.lineMatrix.e + dx,
      f: run.lineMatrix.f + dy,
    },
    textGradient: run.textGradient
      ? translateGradientBackground(run.textGradient, dx, dy)
      : undefined,
    textBackground: run.textBackground
      ? translateBackground(run.textBackground, dx, dy)
      : undefined,
    textShadows: run.textShadows ? [...run.textShadows] : undefined,
    decorations: run.decorations ? { ...run.decorations } : undefined,
  };
}

function translateBackground(
  background: Background,
  dx: number,
  dy: number,
): Background {
  return {
    ...background,
    image: background.image
      ? {
          ...background.image,
          rect: translateRect(background.image.rect, dx, dy),
          originRect: translateRect(background.image.originRect, dx, dy),
        }
      : undefined,
    gradient: background.gradient
      ? translateGradientBackground(background.gradient, dx, dy)
      : undefined,
  };
}

function translateGradientBackground(
  gradient: GradientBackground,
  dx: number,
  dy: number,
): GradientBackground {
  return {
    ...gradient,
    rect: translateRect(gradient.rect, dx, dy),
    originRect: translateRect(gradient.originRect, dx, dy),
  };
}

function translateClipPath(
  clipPath: ClipPath | undefined,
  dx: number,
  dy: number,
): ClipPath | undefined {
  if (!clipPath) {
    return undefined;
  }
  if (clipPath.type === "polygon") {
    return {
      type: "polygon",
      points: clipPath.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    };
  }
  return {
    ...clipPath,
    cx: clipPath.cx + dx,
    cy: clipPath.cy + dy,
  };
}

function translateRect(rect: Rect, dx: number, dy: number): Rect {
  return {
    ...rect,
    x: rect.x + dx,
    y: rect.y + dy,
  };
}
