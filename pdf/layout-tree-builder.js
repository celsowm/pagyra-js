import { FloatMode, OverflowMode, Position } from "../css/enums.js";
import { resolveLength } from "../css/length.js";
import { NodeKind, Overflow, LayerMode, } from "./types.js";
export function buildRenderTree(root, options = {}) {
    const dpiAssumption = options.dpiAssumption ?? 96;
    const stylesheets = {
        fontFaces: options.stylesheets?.fontFaces ?? [],
    };
    const headerFooter = {
        headerHtml: options.headerFooter?.headerHtml,
        footerHtml: options.headerFooter?.footerHtml,
        headerFirstHtml: options.headerFooter?.headerFirstHtml,
        footerFirstHtml: options.headerFooter?.footerFirstHtml,
        headerEvenHtml: options.headerFooter?.headerEvenHtml,
        footerEvenHtml: options.headerFooter?.footerEvenHtml,
        headerOddHtml: options.headerFooter?.headerOddHtml,
        footerOddHtml: options.headerFooter?.footerOddHtml,
        placeholders: options.headerFooter?.placeholders ?? {},
        layerMode: options.headerFooter?.layerMode ?? LayerMode.Under,
        maxHeaderHeightPx: options.headerFooter?.maxHeaderHeightPx ?? 0,
        maxFooterHeightPx: options.headerFooter?.maxFooterHeightPx ?? 0,
        clipOverflow: options.headerFooter?.clipOverflow ?? false,
        fontFamily: options.headerFooter?.fontFamily,
    };
    const state = { counter: 0 };
    const renderRoot = convertNode(root, state);
    return {
        root: renderRoot,
        dpiAssumption,
        css: stylesheets,
        hf: headerFooter,
    };
}
const DEFAULT_TEXT_COLOR = { r: 0, g: 0, b: 0, a: 1 };
function convertNode(node, state) {
    const id = `node-${state.counter++}`;
    const widthRef = Math.max(node.box.contentWidth, 0);
    const contentHeightRef = Math.max(node.box.contentHeight, 0);
    const padding = {
        top: resolveLength(node.style.paddingTop, widthRef, { auto: "zero" }),
        right: resolveLength(node.style.paddingRight, widthRef, { auto: "zero" }),
        bottom: resolveLength(node.style.paddingBottom, widthRef, { auto: "zero" }),
        left: resolveLength(node.style.paddingLeft, widthRef, { auto: "zero" }),
    };
    const border = {
        top: resolveLength(node.style.borderTop, widthRef, { auto: "zero" }),
        right: resolveLength(node.style.borderRight, widthRef, { auto: "zero" }),
        bottom: resolveLength(node.style.borderBottom, widthRef, { auto: "zero" }),
        left: resolveLength(node.style.borderLeft, widthRef, { auto: "zero" }),
    };
    const borderBox = {
        x: node.box.x,
        y: node.box.y,
        width: fallbackDimension(node.box.borderBoxWidth, node.box.contentWidth + padding.left + padding.right + border.left + border.right),
        height: fallbackDimension(node.box.borderBoxHeight, contentHeightRef + padding.top + padding.bottom + border.top + border.bottom),
    };
    const paddingBox = {
        x: borderBox.x + border.left,
        y: borderBox.y + border.top,
        width: node.box.contentWidth + padding.left + padding.right,
        height: node.box.contentHeight + padding.top + padding.bottom,
    };
    const contentBox = {
        x: paddingBox.x + padding.left,
        y: paddingBox.y + padding.top,
        width: node.box.contentWidth,
        height: node.box.contentHeight,
    };
    const visualOverflow = cloneRect(borderBox);
    const borderRadius = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
    const children = node.children.map((child) => convertNode(child, state));
    const textColor = parseColor(node.style.color);
    const textRuns = node.textContent ? createTextRuns(node, textColor) : [];
    return {
        id,
        tagName: node.tagName,
        textContent: node.textContent,
        kind: mapNodeKind(node),
        contentBox,
        paddingBox,
        borderBox,
        visualOverflow,
        padding,
        border,
        borderRadius,
        opacity: 1,
        overflow: mapOverflow(node.style.overflowX ?? OverflowMode.Visible),
        textRuns,
        decorations: {},
        textShadows: [],
        boxShadows: [],
        establishesStackingContext: false,
        zIndexComputed: 0,
        positioning: mapPosition(node.style),
        children,
        links: [],
        borderColor: parseColor(node.style.borderColor),
        color: textColor,
        background: { color: parseColor(node.style.backgroundColor) },
    };
}
function cloneRect(rect) {
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}
function mapNodeKind(node) {
    if (node.textContent && node.textContent.length > 0) {
        return NodeKind.TextRuns;
    }
    return NodeKind.Container;
}
function mapPosition(style) {
    if (style.float !== FloatMode.None) {
        return { type: "float" };
    }
    switch (style.position) {
        case Position.Absolute:
            return { type: "absolute" };
        case Position.Fixed:
            return { type: "fixed" };
        case Position.Sticky:
            return { type: "sticky" };
        default:
            return { type: "normal" };
    }
}
function mapOverflow(mode) {
    switch (mode) {
        case OverflowMode.Hidden:
            return Overflow.Hidden;
        case OverflowMode.Scroll:
            return Overflow.Scroll;
        case OverflowMode.Auto:
            return Overflow.Auto;
        case OverflowMode.Clip:
            return Overflow.Clip;
        default:
            return Overflow.Visible;
    }
}
function fallbackDimension(value, computed) {
    return value > 0 ? value : computed;
}
function createTextRuns(node, color) {
    if (!node.textContent) {
        return [];
    }
    const baseline = node.box.baseline > 0 ? node.box.baseline : node.box.y + node.box.contentHeight;
    return [
        {
            text: node.textContent,
            fontFamily: node.style.fontFamily ?? "sans-serif",
            fontSize: node.style.fontSize,
            fill: color ?? DEFAULT_TEXT_COLOR,
            lineMatrix: { a: 1, b: 0, c: 0, d: 1, e: node.box.x, f: baseline },
        },
    ];
}
function parseColor(value) {
    if (!value) {
        return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "transparent") {
        return undefined;
    }
    const hexMatch = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
        const digits = hexMatch[1];
        if (digits.length === 3) {
            const r = parseHex(digits[0] + digits[0]);
            const g = parseHex(digits[1] + digits[1]);
            const b = parseHex(digits[2] + digits[2]);
            return { r, g, b, a: 1 };
        }
        const r = parseHex(digits.slice(0, 2));
        const g = parseHex(digits.slice(2, 4));
        const b = parseHex(digits.slice(4, 6));
        return { r, g, b, a: 1 };
    }
    const rgbMatch = normalized.match(/^rgba?\((.+)\)$/);
    if (rgbMatch) {
        const parts = rgbMatch[1].split(",").map((part) => part.trim());
        const r = clampColor(Number.parseFloat(parts[0]));
        const g = clampColor(Number.parseFloat(parts[1]));
        const b = clampColor(Number.parseFloat(parts[2]));
        const a = parts[3] !== undefined ? clampAlpha(Number.parseFloat(parts[3])) : 1;
        return { r, g, b, a };
    }
    return undefined;
}
function parseHex(value) {
    return Number.parseInt(value, 16);
}
function clampColor(value) {
    if (Number.isNaN(value)) {
        return 0;
    }
    if (value > 255) {
        return 255;
    }
    if (value < 0) {
        return 0;
    }
    return value;
}
function clampAlpha(value) {
    if (Number.isNaN(value)) {
        return 1;
    }
    if (value > 1) {
        return 1;
    }
    if (value < 0) {
        return 0;
    }
    return value;
}
