import { Box } from "../geometry/box.js";
export class LayoutNode {
    style;
    box = new Box();
    parent = null;
    childrenInternal = [];
    establishesBFC = false;
    establishesIFC = false;
    establishesFFC = false;
    establishesGFC = false;
    establishesTFC = false;
    intrinsicInlineSize;
    intrinsicBlockSize;
    textContent;
    tagName;
    constructor(style, children = [], options) {
        this.style = style;
        this.intrinsicInlineSize = options?.intrinsicInlineSize;
        this.intrinsicBlockSize = options?.intrinsicBlockSize;
        this.textContent = options?.textContent;
        this.tagName = options?.tagName;
        for (const child of children) {
            this.appendChild(child);
        }
    }
    get children() {
        return this.childrenInternal;
    }
    appendChild(child) {
        child.parent = this;
        this.childrenInternal.push(child);
        return this;
    }
    removeChild(child) {
        const idx = this.childrenInternal.indexOf(child);
        if (idx >= 0) {
            this.childrenInternal.splice(idx, 1);
            child.parent = null;
        }
    }
    nearestAncestor(predicate) {
        let current = this.parent;
        while (current) {
            if (predicate(current)) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }
    walk(visitor, includeSelf = true) {
        if (includeSelf) {
            visitor(this);
        }
        for (const child of this.childrenInternal) {
            child.walk(visitor, true);
        }
    }
    postOrder(visitor) {
        for (const child of this.childrenInternal) {
            child.postOrder(visitor);
        }
        visitor(this);
    }
}
