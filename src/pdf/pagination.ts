import type { LayoutPageTree, RenderBox, PositionedLayer, DecorationCommand, Link } from "./types.js";

export function paginateTree(root: RenderBox): LayoutPageTree[] {
  const paintOrder = collectPaintOrder(root);
  const flowOrder = collectFlowOrder(root);
  const decorations: DecorationCommand[] = [];
  const links = collectLinks(root);

  return [
    {
      paintOrder,
      floatLayerOrder: [],
      flowContentOrder: flowOrder,
      positionedLayersSortedByZ: collectPositionedLayers(root),
      decorations,
      links,
    },
  ];
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

function dfs(node: RenderBox, visitor: (box: RenderBox) => boolean): void {
  const descend = visitor(node);
  if (!descend) {
    return;
  }
  for (const child of node.children) {
    dfs(child, visitor);
  }
}

