export function paginateTree(root) {
    const paintOrder = collectPaintOrder(root);
    const flowOrder = collectFlowOrder(root);
    const decorations = [];
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
function collectPaintOrder(root) {
    const result = [];
    dfs(root, (box) => {
        result.push(box);
        return true;
    });
    return result;
}
function collectFlowOrder(root) {
    const result = [];
    dfs(root, (box) => {
        result.push(box);
        return box.positioning.type === "normal";
    });
    return result;
}
function collectPositionedLayers(_root) {
    // Positioned layers are not yet implemented; return empty array to keep the pipeline stable.
    return [];
}
function collectLinks(root) {
    const links = [];
    dfs(root, (box) => {
        links.push(...box.links);
        return true;
    });
    return links;
}
function dfs(node, visitor) {
    const descend = visitor(node);
    if (!descend) {
        return;
    }
    for (const child of node.children) {
        dfs(child, visitor);
    }
}
