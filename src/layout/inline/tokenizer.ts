import { LayoutNode } from "../../dom/node.js";
import { Display, FloatMode, WhiteSpace } from "../../css/enums.js";
import { resolvedLineHeight } from "../../css/style.js";
import { applyTextTransform } from "../../text/text-transform.js";
import type { LayoutContext } from "../pipeline/strategy.js";
import { FontEmbedder } from "../../pdf/font/embedder.js";
import type { InlineFragment, LayoutItem } from "./types.js";
import { measureInlineNode, measureSegment, countSpaces, type LayoutCallback } from "./measurement.js";
import { estimateLineWidth } from "../utils/text-metrics.js";

export function collectInlineFragments(
    nodes: LayoutNode[],
    containerWidth: number,
    context: LayoutContext,
    layoutCallback: LayoutCallback,
): InlineFragment[] {
    const fragments: InlineFragment[] = [];

    const recurse = (node: LayoutNode) => {
        if (node.style.display === Display.None) {
            return;
        }
        if (node.style.float !== FloatMode.None) {
            return;
        }

        if (isAtomicInline(node.style.display)) {
            const metrics = measureInlineNode(node, containerWidth, context, layoutCallback);
            fragments.push({ kind: "box", metrics });
            return;
        }

        if (node.textContent && node.style.display === Display.Inline) {
            fragments.push({
                kind: "text",
                node,
                style: node.style,
                text: node.textContent,
                preserveLeading: !!node.customData?.preserveLeadingSpace,
                preserveTrailing: !!node.customData?.preserveTrailingSpace,
            });
            return;
        }

        for (const child of node.children) {
            if (!isInlineDisplay(child.style.display)) {
                continue;
            }
            recurse(child);
        }
    };

    for (const node of nodes) {
        recurse(node);
    }

    return fragments;
}

export function tokenizeFragments(
    fragments: InlineFragment[],
    fontEmbedder: FontEmbedder | null,
): LayoutItem[] {
    const items: LayoutItem[] = [];
    for (const fragment of fragments) {
        if (fragment.kind === "box") {
            items.push({
                kind: "box",
                width: fragment.metrics.outerWidth,
                height: fragment.metrics.outerHeight,
                lineHeight: fragment.metrics.outerHeight,
                metrics: fragment.metrics,
            });
            continue;
        }

        const style = fragment.style;
        const raw = fragment.text ?? "";
        if (!raw) {
            continue;
        }
        const effectiveText = applyTextTransform(raw, style.textTransform);
        const lineHeight = resolvedLineHeight(style);
        const segments = segmentTextWithWhitespace(effectiveText, style.whiteSpace);
        for (const segment of segments) {
            if (segment.kind === "newline") {
                items.push({
                    kind: "newline",
                    width: 0,
                    height: lineHeight,
                    lineHeight,
                });
                continue;
            }
            const width = measureSegment(segment.text, style, fontEmbedder);
            items.push({
                kind: segment.kind,
                width,
                height: lineHeight,
                lineHeight,
                node: fragment.node,
                style,
                text: segment.text,
                spaceCount: segment.kind === "space" ? countSpaces(segment.text) : 0,
            });
        }
    }
    return items;
}

export function segmentTextWithWhitespace(
    text: string,
    mode: WhiteSpace,
): { kind: "word" | "space" | "newline"; text: string }[] {
    const segments: { kind: "word" | "space" | "newline"; text: string }[] = [];
    const regex = /(\n)|(\s+)|([^\s]+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
            if (mode === WhiteSpace.Pre || mode === WhiteSpace.PreWrap || mode === WhiteSpace.PreLine) {
                segments.push({ kind: "newline", text: "\n" });
            } else {
                segments.push({ kind: "space", text: " " });
            }
        } else if (match[2]) {
            segments.push({ kind: "space", text: match[2] });
        } else if (match[3]) {
            segments.push({ kind: "word", text: match[3] });
        }
    }
    return segments;
}

export function splitWordItemToken(item: LayoutItem, availableWidth: number): [LayoutItem | null, LayoutItem | null] {
    if (item.kind !== "word" || !item.text || !item.style) {
        return [item, null];
    }

    let buffer = "";
    let bufferWidth = 0;
    for (const char of Array.from(item.text)) {
        const candidate = buffer + char;
        const candidateWidth = estimateLineWidth(candidate, item.style);
        if (buffer && candidateWidth > availableWidth) {
            break;
        }
        buffer = candidate;
        bufferWidth = candidateWidth;
    }

    if (!buffer) {
        return [item, null];
    }

    const head: LayoutItem = {
        ...item,
        text: buffer,
        width: bufferWidth,
    };
    const tailText = item.text.slice(buffer.length);
    if (!tailText) {
        return [head, null];
    }
    const tail: LayoutItem = {
        ...item,
        text: tailText,
        width: estimateLineWidth(tailText, item.style),
    };
    return [head, tail];
}

function isInlineDisplay(display: Display): boolean {
    switch (display) {
        case Display.Inline:
        case Display.InlineBlock:
        case Display.InlineFlex:
        case Display.InlineGrid:
        case Display.InlineTable:
            return true;
        default:
            return false;
    }
}

function isAtomicInline(display: Display): boolean {
    switch (display) {
        case Display.InlineBlock:
        case Display.InlineFlex:
        case Display.InlineGrid:
        case Display.InlineTable:
            return true;
        default:
            return false;
    }
}
