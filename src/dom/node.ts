import { ComputedStyle } from "../css/style.js";
import { Box } from "../geometry/box.js";

export interface NodeVisitor {
  (node: LayoutNode): void;
}

export class LayoutNode {
  readonly box = new Box();
  parent: LayoutNode | null = null;
  private readonly childrenInternal: LayoutNode[] = [];

  establishesBFC = false;
  establishesIFC = false;
  establishesFFC = false;
  establishesGFC = false;
  establishesTFC = false;

  constructor(public readonly style: ComputedStyle, children: Iterable<LayoutNode> = []) {
    for (const child of children) {
      this.appendChild(child);
    }
  }

  get children(): readonly LayoutNode[] {
    return this.childrenInternal;
  }

  appendChild(child: LayoutNode): this {
    child.parent = this;
    this.childrenInternal.push(child);
    return this;
  }

  removeChild(child: LayoutNode): void {
    const idx = this.childrenInternal.indexOf(child);
    if (idx >= 0) {
      this.childrenInternal.splice(idx, 1);
      child.parent = null;
    }
  }

  nearestAncestor(predicate: (node: LayoutNode) => boolean): LayoutNode | null {
    let current: LayoutNode | null = this.parent;
    while (current) {
      if (predicate(current)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  walk(visitor: NodeVisitor, includeSelf = true): void {
    if (includeSelf) {
      visitor(this);
    }
    for (const child of this.childrenInternal) {
      child.walk(visitor, true);
    }
  }

  postOrder(visitor: NodeVisitor): void {
    for (const child of this.childrenInternal) {
      child.postOrder(visitor);
    }
    visitor(this);
  }
}
