import { createDefaultLayoutEngine } from "./default-engine.js";
export function layoutTree(root, viewport) {
    const engine = createDefaultLayoutEngine();
    return engine.layoutTree(root, viewport);
}
