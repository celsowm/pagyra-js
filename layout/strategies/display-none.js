import { Display } from "../../css/enums.js";
export class DisplayNoneStrategy {
    canLayout(node) {
        return node.style.display === Display.None;
    }
    layout(node, _context) {
        node.box.contentWidth = 0;
        node.box.contentHeight = 0;
    }
}
