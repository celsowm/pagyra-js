import { encodeAndEscapePdfText } from "./utils/encoding.js";
export class PagePainter {
    pageHeightPt;
    pxToPt;
    fontRegistry;
    pageOffsetPx;
    commands = [];
    fonts = new Map();
    ptToPxFactor;
    constructor(pageHeightPt, pxToPt, fontRegistry, pageOffsetPx = 0) {
        this.pageHeightPt = pageHeightPt;
        this.pxToPt = pxToPt;
        this.fontRegistry = fontRegistry;
        this.pageOffsetPx = pageOffsetPx;
    }
    get pageHeightPx() {
        return this.ptToPx(this.pageHeightPt);
    }
    drawBoxOutline(box, color = { r: 0.85, g: 0.85, b: 0.85, a: 1 }) {
        this.strokeRect(box.borderBox, color);
    }
    drawFilledBox(box, color) {
        this.fillRect(box.borderBox, color);
    }
    async drawText(text, xPx, yPx, options = { fontSizePt: 10 }) {
        if (!text) {
            return;
        }
        const font = await this.ensureFont({ fontFamily: options.fontFamily });
        const usePageOffset = !(options.absolute ?? false);
        const offsetY = usePageOffset ? this.pageOffsetPx : 0;
        const xPt = this.pxToPt(xPx);
        const yPt = this.pageHeightPt - this.pxToPt(yPx - offsetY);
        const color = options.color ?? { r: 0, g: 0, b: 0, a: 1 };
        const escaped = encodeAndEscapePdfText(text);
        const baselineAdjust = options.fontSizePt;
        this.commands.push(fillColorCommand(color), "BT", `/${font.resourceName} ${formatNumber(options.fontSizePt)} Tf`, `${formatNumber(xPt)} ${formatNumber(yPt - baselineAdjust)} Td`, `(${escaped}) Tj`, "ET");
    }
    async drawTextRun(run) {
        const font = await this.ensureFont({ fontFamily: run.fontFamily });
        const color = run.fill ?? { r: 0, g: 0, b: 0, a: 1 };
        const escaped = encodeAndEscapePdfText(run.text);
        const Tm = run.lineMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
        const fontSizePt = this.pxToPt(run.fontSize);
        const localBaseline = Tm.f - this.pageOffsetPx;
        const y = this.pageHeightPt - this.pxToPt(localBaseline);
        const x = this.pxToPt(Tm.e);
        this.commands.push(fillColorCommand(color), "BT", `/${font.resourceName} ${formatNumber(fontSizePt)} Tf`, `${formatNumber(Tm.a)} ${formatNumber(Tm.b)} ${formatNumber(Tm.c)} ${formatNumber(Tm.d)} ${formatNumber(x)} ${formatNumber(y)} Tm`, `(${escaped}) Tj`, "ET");
    }
    result() {
        return {
            content: this.commands.join("\n"),
            fonts: this.fonts,
        };
    }
    fillRect(rect, color) {
        const pdfRect = this.rectToPdf(rect);
        if (!pdfRect) {
            return;
        }
        this.commands.push(fillColorCommand(color), `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`, "f");
    }
    strokeRect(rect, color) {
        const pdfRect = this.rectToPdf(rect);
        if (!pdfRect) {
            return;
        }
        this.commands.push(strokeColorCommand(color), `${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`, "S");
    }
    async ensureFont(options) {
        const family = options.fontFamily;
        const resource = await this.fontRegistry.ensureFontResource(family);
        if (!this.fonts.has(resource.resourceName)) {
            this.fonts.set(resource.resourceName, resource.ref);
        }
        return resource;
    }
    rectToPdf(rect) {
        if (!rect) {
            return null;
        }
        const widthPx = Math.max(rect.width, 0);
        const heightPx = Math.max(rect.height, 0);
        if (widthPx === 0 || heightPx === 0) {
            return null;
        }
        const localY = rect.y - this.pageOffsetPx;
        const x = this.pxToPt(rect.x);
        const y = this.pageHeightPt - this.pxToPt(localY + heightPx);
        const width = this.pxToPt(widthPx);
        const height = this.pxToPt(heightPx);
        return {
            x: formatNumber(x),
            y: formatNumber(y),
            width: formatNumber(width),
            height: formatNumber(height),
        };
    }
    ptToPx(value) {
        if (!this.ptToPxFactor) {
            const factor = this.pxToPt(1);
            this.ptToPxFactor = factor === 0 ? 0 : 1 / factor;
        }
        return value * (this.ptToPxFactor ?? 0);
    }
}
function fillColorCommand(color) {
    const r = formatNumber(normalizeChannel(color.r));
    const g = formatNumber(normalizeChannel(color.g));
    const b = formatNumber(normalizeChannel(color.b));
    if (color.a !== undefined && color.a < 1) {
        // Transparency is not directly supported; ignore alpha for now.
    }
    return `${r} ${g} ${b} rg`;
}
function strokeColorCommand(color) {
    const r = formatNumber(normalizeChannel(color.r));
    const g = formatNumber(normalizeChannel(color.g));
    const b = formatNumber(normalizeChannel(color.b));
    return `${r} ${g} ${b} RG`;
}
function normalizeChannel(value) {
    if (value > 1) {
        return value / 255;
    }
    return value;
}
function formatNumber(value) {
    if (!Number.isFinite(value)) {
        return "0";
    }
    return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
