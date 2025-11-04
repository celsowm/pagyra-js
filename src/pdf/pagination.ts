import type {
  LayoutPageTree,
  RenderBox,
  PositionedLayer,
  DecorationCommand,
  Link,
} from "./types.js";

export interface PaginationOptions {
  pageHeight: number;
}

export function paginateTree(root: RenderBox, options: PaginationOptions): LayoutPageTree[] {
  const pageHeight = Number.isFinite(options.pageHeight) && options.pageHeight > 0 ? options.pageHeight : 1;

  const paintOrderAll = collectPaintOrder(root);
  const flowOrderAll = collectFlowOrder(root);
  const positionedAll = collectPositionedLayers(root);
  const linksAll = collectLinks(root);

  const documentHeight = resolveDocumentHeight(paintOrderAll);
  const totalPages = Math.max(1, Math.ceil(documentHeight / pageHeight));

  const pages: LayoutPageTree[] = [];

  for (let index = 0; index < totalPages; index++) {
    const pageTop = index * pageHeight;
    const pageBottom = pageTop + pageHeight;

    const paintOrder = paintOrderAll.filter((box) => intersectsVerticalSlice(box, pageTop, pageBottom));
    const flowContentOrder = flowOrderAll.filter((box) => intersectsVerticalSlice(box, pageTop, pageBottom));
    const positionedLayersSortedByZ = filterPositionedLayers(positionedAll, pageTop, pageBottom);
    const links = filterLinks(linksAll, pageTop, pageBottom, pageTop);

    const decorations: DecorationCommand[] = []; // Placeholder until decoration pagination is implemented

    const pageRoot: RenderBox = {
      ...root,
      children: paintOrder,
    };

    pages.push({
      root: pageRoot,
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

function collectPaintOrder(root: RenderBox): RenderBox[] {
  const result: RenderBox[] = [];
  dfs(root, (box) => {
    result.push(box);
    return true;
  });
  return result;
}

function collectFlowOrder(root: RenderBox): RenderBox[] {
  const result: RenderBox[] = [];
  dfs(root, (box) => {
    result.push(box);
    return box.positioning.type === "normal";
  });
  return result;
}

function collectPositionedLayers(_root: RenderBox): PositionedLayer[] {
  // Positioned layers are not yet implemented; return empty array to keep the pipeline stable.
  return [];
}

function collectLinks(root: RenderBox): Link[] {
  const links: Link[] = [];
  dfs(root, (box) => {
    links.push(...box.links);
    return true;
  });
  return links;
}

function filterPositionedLayers(layers: PositionedLayer[], top: number, bottom: number): PositionedLayer[] {
  const result: PositionedLayer[] = [];
  for (const layer of layers) {
    const boxes = layer.boxes.filter((box) => intersectsVerticalSlice(box, top, bottom));
    if (boxes.length > 0) {
      result.push({ z: layer.z, boxes });
    }
  }
  return result;
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
  let bottom = referenceRect ? referenceRect.y + Math.max(referenceRect.height, 0) : box.contentBox.y + Math.max(box.contentBox.height, 0);

  if (!Number.isFinite(top)) {
    top = 0;
  }
  if (!Number.isFinite(bottom)) {
    bottom = top;
  }

  if (box.textRuns.length > 0) {
    for (const run of box.textRuns) {
      const baseline = run.lineMatrix?.f ?? 0;
      const ascent = run.fontSize;
      const descent = Math.max(run.fontSize * 0.2, 0);
      top = Math.min(top, baseline - ascent);
      bottom = Math.max(bottom, baseline + descent);
    }
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
