export class FallbackStrategy {
    canLayout() {
        return true;
    }
    layout(node, _context) {
        node.box.contentWidth = 0;
        node.box.contentHeight = 0;
        node.box.borderBoxWidth = 0;
        node.box.borderBoxHeight = 0;
    }
}
