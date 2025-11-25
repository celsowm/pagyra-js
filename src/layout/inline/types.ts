import { LayoutNode } from "../../dom/node.js";
import type { LayoutContext } from "../pipeline/strategy.js";
import { FloatContext } from "../context/float-context.js";

export interface InlineLayoutOptions {
    container: LayoutNode;
    inlineNodes: LayoutNode[];
    context: LayoutContext;
    floatContext: FloatContext;
    contentX: number;
    contentWidth: number;
    startY: number;
}

export interface InlineMetrics {
    node: LayoutNode;
    contentWidth: number;
    contentHeight: number;
    lineOffset: number;
    marginLeft: number;
    marginRight: number;
    marginTop: number;
    marginBottom: number;
    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
    paddingBottom: number;
    borderLeft: number;
    borderRight: number;
    borderTop: number;
    borderBottom: number;
    outerWidth: number;
    outerHeight: number;
}

export type InlineFragment =
    | {
        kind: "text";
        node: LayoutNode;
        style: LayoutNode["style"];
        text: string;
        preserveLeading?: boolean;
        preserveTrailing?: boolean;
    }
    | {
        kind: "box";
        metrics: InlineMetrics;
    };

export type LayoutItemKind = "word" | "space" | "box" | "newline";

export interface LayoutItemBase {
    kind: LayoutItemKind;
    width: number;
    height: number;
    lineHeight: number;
    node?: LayoutNode;
    style?: LayoutNode["style"];
    text?: string;
    spaceCount?: number;
}

export interface BoxLayoutItem extends LayoutItemBase {
    kind: "box";
    metrics: InlineMetrics;
}

export type LayoutItem = LayoutItemBase | BoxLayoutItem;

export interface InlineLayoutResult {
    newCursorY: number;
}

export function isBoxItem(item: LayoutItem): item is BoxLayoutItem {
    return item.kind === "box";
}
