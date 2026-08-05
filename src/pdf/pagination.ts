import type {
  LayoutPageTree,
  RenderBox,
  DecorationCommand,
  Link,
} from "./types.js";
import type { PaintInstruction } from "./stacking/types.js";
import { resolvePaintOrder } from "./stacking/resolve-paint-order.js";
import {
  collectFixedLayers,
  translatePositionedLayer,
} from "./fixed-position-layer.js";
import {
  resolvePageMarginsForIndex,
  type PageMarginProfile,
} from "../layout/fragmentation/page-flow.js";

export interface PaginationOptions {
  pageHeight: number;
  pageMargins?: PageMarginProfile;
}

export function paginateTree(root: RenderBox, options: PaginationOptions): LayoutPageTree[] {
  const pageHeight = Number.isFinite(options.pageHeight) && options.pageHeight > 0 ? options.pageHeight : 1;
  const fixed = collectFixedLayers(root);
  const paintOrderAll = resolvePaintOrder(root);
  const flowOrderAll = collectFlowOrder(root, fixed.boxes);
  const linksAll = collectLinks(root, fixed.boxes);

  const documentBoxes = paintOrderAll
    .filter((instruction): instruction is PaintInstruction & { type: "box" } => instruction.type === "box")
    .map((instruction) => instruction.box)
    .filter((box) => !fixed.boxes.has(box));
  const documentHeight = resolveDocumentHeight(documentBoxes);
  const totalPages = Math.max(1, Math.ceil(documentHeight / pageHeight));
  const pages: LayoutPageTree[] = [];
  const firstMargins = options.pageMargins
    ? resolvePageMarginsForIndex(options.pageMargins, 0)
    : undefined;

  for (let index = 0; index < totalPages; index++) {
    const pageTop = index * pageHeight;
    const pageBottom = pageTop + pageHeight;
    const pageMargins = options.pageMargins
      ? resolvePageMarginsForIndex(options.pageMargins, index)
      : undefined;
    const fixedDx = pageMargins && firstMargins ? pageMargins.left - firstMargins.left : 0;
    const fixedDy = pageTop + (pageMargins && firstMargins ? pageMargins.top - firstMargins.top : 0);

    const paintOrder = paintOrderAll.filter((item) =>
      item.type !== "box"
      || (!fixed.boxes.has(item.box) && intersectsVerticalSlice(item.box, pageTop, pageBottom)),
    );
    const flowContentOrder = flowOrderAll.filter((box) => intersectsVerticalSlice(box, pageTop, pageBottom));
    const positionedLayersSortedByZ = fixed.layers.map((layer) =>
      translatePositionedLayer(layer, fixedDx, fixedDy),
    );
    const links = filterLinks(linksAll, pageTop, pageBottom, pageTop);
    const decorations: DecorationCommand[] = [];

    pages.push({
      paintOrder,
      floatLayerOrder: [],
      flowContentOrder,
      positionedLayersSortedByZ,
      decorations,
      links,
      pageOffsetY: pageTop,
    });
  }

  return pages;
}

function collectFlowOrder(root: RenderBox, fixedBoxes: ReadonlySet<RenderBox>): RenderBox[] {
  const result: RenderBox[] = [];
  dfs(root, (box) => {
    if (fixedBoxes.has(box)) {
      return false;
    }
    result.push(box);
    return box.positioning.type === "normal";
  });
  return result;
}

function collectLinks(root: RenderBox, fixedBoxes: ReadonlySet<RenderBox>): Link[] {
  const links: Link[] = [];
  dfs(root, (box) => {
    if (fixedBoxes.has(box)) {
      return false;
    }
    links.push(...box.links);
    return true;
  });
  return links;
}

function filterLinks(links: Link[], top: number, bottom: number, offset: number): Link[] {
  const result: Link[] = [];
  for (const link of links) {
    const linkTop = link.rect.y;
    const linkBottom = link.rect.y + Math.max(link.rect.height, 0);
    if (linkBottom <= top || linkTop >= bottom) {
      continue;
    }
    result.push({
      rect: {
        x: link.rect.x,
        y: link.rect.y - offset,
        width: link.rect.width,
        height: link.rect.height,
      },
      target: { ...link.target },
    });
  }
  return result;
}

function resolveDocumentHeight(boxes: RenderBox[]): number {
  let maxBottom = 0;
  for (const box of boxes) {
    const span = getBoxVerticalSpan(box);
    maxBottom = Math.max(maxBottom, span.bottom);
  }
  return maxBottom;
}

function intersectsVerticalSlice(box: RenderBox, sliceTop: number, sliceBottom: number): boolean {
  const span = getBoxVerticalSpan(box);
  return span.bottom > sliceTop && span.top < sliceBottom;
}

function getBoxVerticalSpan(box: RenderBox): { top: number; bottom: number } {
  const referenceRect = box.visualOverflow ?? box.borderBox ?? box.contentBox;
  let top = referenceRect ? referenceRect.y : box.contentBox.y;
  let bottom = referenceRect
    ? referenceRect.y + Math.max(referenceRect.height, 0)
    : box.contentBox.y + Math.max(box.contentBox.height, 0);

  if (!Number.isFinite(top)) {
    top = 0;
  }
  if (!Number.isFinite(bottom)) {
    bottom = top;
  }

  for (const run of box.textRuns) {
    const baseline = run.lineMatrix?.f ?? 0;
    const ascent = run.fontSize;
    const descent = Math.max(run.fontSize * 0.2, 0);
    top = Math.min(top, baseline - ascent);
    bottom = Math.max(bottom, baseline + descent);
  }

  return { top, bottom };
}

function dfs(node: RenderBox, visitor: (box: RenderBox) => boolean): void {
  const descend = visitor(node);
  if (!descend) {
    return;
  }
  for (const child of node.children) {
    dfs(child, visitor);
  }
}
