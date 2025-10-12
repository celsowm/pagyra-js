import { LayoutEnvironment } from "../context/layout-environment.js";
import { Position } from "../../css/enums.js";
import { containingBlock } from "../utils/node-math.js";
import { assignIntrinsicTextMetrics } from "../utils/text-metrics.js";
export class LayoutEngine {
    strategies;
    constructor(options) {
        this.strategies = options.strategies;
    }
    layoutTree(root, viewport) {
        const environment = new LayoutEnvironment({ viewport });
        const context = {
            env: environment,
            layoutChild: (node) => {
                this.layoutNodeInternal(node, context);
            },
        };
        assignIntrinsicTextMetrics(root);
        root.box.x = 0;
        root.box.y = 0;
        root.box.contentWidth = viewport.width;
        root.box.contentHeight = viewport.height;
        this.layoutNodeInternal(root, context);
        this.layoutOutOfFlowNodes(root, context);
        // Fragmentation is not yet implemented - placeholder for future expansion.
        return root;
    }
    layoutNodeInternal(node, context) {
        const strategy = this.strategies.find((s) => s.canLayout(node));
        if (!strategy) {
            throw new Error(`No layout strategy available for display: ${node.style.display}`);
        }
        strategy.layout(node, context);
    }
    layoutOutOfFlowNodes(root, context) {
        const positionedNodes = [];
        root.walk((node) => {
            if (node.style.position === Position.Absolute || node.style.position === Position.Fixed) {
                positionedNodes.push(node);
            }
        });
        for (const node of positionedNodes) {
            this.layoutAbsoluteOrFixed(node, context);
        }
    }
    layoutAbsoluteOrFixed(node, context) {
        const cb = containingBlock(node, context.env.viewport);
        node.box.x = cb.x;
        node.box.y = cb.y;
        node.box.contentWidth = cb.width;
        node.box.contentHeight = cb.height;
    }
}
