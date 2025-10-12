import { Display } from "../../css/enums.js";
export class InlineLayoutStrategy {
    canLayout(node) {
        return node.style.display === Display.Inline;
    }
    layout(node, _context) {
        node.box.contentWidth = 0;
        node.box.contentHeight = 0;
        node.box.borderBoxWidth = 0;
        node.box.borderBoxHeight = 0;
    }
}
