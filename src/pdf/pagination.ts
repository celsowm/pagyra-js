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

  const documentHeight = resolveDocumentHeight([root]);
  const totalPages = Math.max(1, Math.ceil(documentHeight / pageHeight));

  const pages: LayoutPageTree[] = [];

  for (let i = 0; i < totalPages; i++) {
    const pageTop = i * pageHeight;
    const pageBottom = pageTop + pageHeight;

    const pageRoot = cloneAndFilterForPage(root, pageTop, pageBottom);

    if (!pageRoot) {
      // Should not happen if totalPages is calculated correctly
      continue;
    }

    const linksAll = collectLinks(pageRoot);

    pages.push({
      root: pageRoot,
      paintOrder: [], // No longer used by painter
      floatLayerOrder: [], // No longer used by painter
      flowContentOrder: [], // No longer used by painter
      decorations: [], // Placeholder
      links: filterLinks(linksAll, pageTop, pageBottom, pageTop),
      pageOffsetY: pageTop,
    });
  }

  return pages;
}

function cloneAndFilterForPage(box: RenderBox, pageTop: number, pageBottom: number): RenderBox | null {
  // A box is visible on the page if its visual bounds intersect the page's vertical range.
  if (!intersectsVerticalSlice(box, pageTop, pageBottom)) {
    return null;
  }

  // Recursively clone and filter children.
  const visibleChildren: RenderBox[] = [];
  for (const child of box.children) {
    const visibleChild = cloneAndFilterForPage(child, pageTop, pageBottom);
    if (visibleChild) {
      visibleChildren.push(visibleChild);
    }
  }

  // Create a clone of the current box, but with only the visible children.
  // This preserves the stacking context structure.
  return {
    ...box,
    children: visibleChildren,
  };
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


function collectLinks(root: RenderBox): Link[] {
  const links: Link[] = [];
  dfs(root, (box) => {
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
