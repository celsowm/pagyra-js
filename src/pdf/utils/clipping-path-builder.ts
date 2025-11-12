import type { Rect, Radius } from "../types.js";
import { CoordinateTransformer } from "./coordinate-transformer.js";

export class ClippingPathBuilder {
  constructor(private readonly coordinateTransformer: CoordinateTransformer) {}

  buildClipCommands(rect: Rect, radius: Radius): string[] | null {
    if (!rect) {
      return null;
    }
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return null;
    }
    if (this.isZeroRadius(radius)) {
      const pdfRect = this.rectToPdf(rect);
      if (!pdfRect) {
        return null;
      }
      return [`${pdfRect.x} ${pdfRect.y} ${pdfRect.width} ${pdfRect.height} re`];
    }
    return this.buildRoundedClipCommands(rect, radius);
  }

  private buildRoundedClipCommands(rect: Rect, radius: Radius): string[] | null {
    const width = Math.max(rect.width, 0);
    const height = Math.max(rect.height, 0);
    if (width === 0 || height === 0) {
      return null;
    }
    const tl = radius.topLeft;
    const tr = radius.topRight;
    const br = radius.bottomRight;
    const bl = radius.bottomLeft;
    const k = 0.5522847498307936;
    const commands: string[] = [];

    const move = this.pointToPdf(rect.x + tl.x, rect.y);
    const lineTop = this.pointToPdf(rect.x + width - tr.x, rect.y);
    if (!move || !lineTop) {
      return null;
    }
    commands.push(`${move.x} ${move.y} m`);
    commands.push(`${lineTop.x} ${lineTop.y} l`);

    if (tr.x > 0 || tr.y > 0) {
      const cp1 = this.pointToPdf(rect.x + width - tr.x + k * tr.x, rect.y);
      const cp2 = this.pointToPdf(rect.x + width, rect.y + tr.y - k * tr.y);
      const end = this.pointToPdf(rect.x + width, rect.y + tr.y);
      if (!cp1 || !cp2 || !end) {
        return null;
      }
      commands.push(`${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y} c`);
    } else {
      const corner = this.pointToPdf(rect.x + width, rect.y);
      if (!corner) {
        return null;
      }
      commands.push(`${corner.x} ${corner.y} l`);
    }

    const rightLine = this.pointToPdf(rect.x + width, rect.y + height - br.y);
    if (!rightLine) {
      return null;
    }
    commands.push(`${rightLine.x} ${rightLine.y} l`);

    if (br.x > 0 || br.y > 0) {
      const cp1 = this.pointToPdf(rect.x + width, rect.y + height - br.y + k * br.y);
      const cp2 = this.pointToPdf(rect.x + width - br.x + k * br.x, rect.y + height);
      const end = this.pointToPdf(rect.x + width - br.x, rect.y + height);
      if (!cp1 || !cp2 || !end) {
        return null;
      }
      commands.push(`${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y} c`);
    } else {
      const corner = this.pointToPdf(rect.x + width, rect.y + height);
      if (!corner) {
        return null;
      }
      commands.push(`${corner.x} ${corner.y} l`);
    }

    const bottomLine = this.pointToPdf(rect.x + bl.x, rect.y + height);
    if (!bottomLine) {
      return null;
    }
    commands.push(`${bottomLine.x} ${bottomLine.y} l`);

    if (bl.x > 0 || bl.y > 0) {
      const cp1 = this.pointToPdf(rect.x + bl.x - k * bl.x, rect.y + height);
      const cp2 = this.pointToPdf(rect.x, rect.y + height - bl.y + k * bl.y);
      const end = this.pointToPdf(rect.x, rect.y + height - bl.y);
      if (!cp1 || !cp2 || !end) {
        return null;
      }
      commands.push(`${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y} c`);
    } else {
      const corner = this.pointToPdf(rect.x, rect.y + height);
      if (!corner) {
        return null;
      }
      commands.push(`${corner.x} ${corner.y} l`);
    }

    const leftLine = this.pointToPdf(rect.x, rect.y + tl.y);
    if (!leftLine) {
      return null;
    }
    commands.push(`${leftLine.x} ${leftLine.y} l`);

    if (tl.x > 0 || tl.y > 0) {
      const cp1 = this.pointToPdf(rect.x, rect.y + tl.y - k * tl.y);
      const cp2 = this.pointToPdf(rect.x + tl.x - k * tl.x, rect.y);
      const end = this.pointToPdf(rect.x + tl.x, rect.y);
      if (!cp1 || !cp2 || !end) {
        return null;
      }
      commands.push(`${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${end.x} ${end.y} c`);
    } else {
      const corner = this.pointToPdf(rect.x, rect.y);
      if (!corner) {
        return null;
      }
      commands.push(`${corner.x} ${corner.y} l`);
    }

    commands.push("h");
    return commands;
  }

  private rectToPdf(rect: Rect): { x: string; y: string; width: string; height: string } | null {
    if (!rect) {
      return null;
    }
    const widthPt = this.coordinateTransformer.convertPxToPt(Math.max(rect.width, 0));
    const heightPt = this.coordinateTransformer.convertPxToPt(Math.max(rect.height, 0));
    if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt) || widthPt === 0 || heightPt === 0) {
      return null;
    }
    const origin = this.pointToPdf(rect.x, rect.y + rect.height);
    if (!origin) {
      return null;
    }
    return {
      x: origin.x,
      y: origin.y,
      width: formatNumber(widthPt),
      height: formatNumber(heightPt),
    };
  }

  private pointToPdf(xPx: number, yPx: number): { x: string; y: string } | null {
    if (!Number.isFinite(xPx) || !Number.isFinite(yPx)) {
      return null;
    }
    const xPt = this.coordinateTransformer.convertPxToPt(xPx);
    const localY = yPx - this.coordinateTransformer.pageOffsetPx;
    const yPt = this.coordinateTransformer.pageHeightPt - this.coordinateTransformer.convertPxToPt(localY);
    if (!Number.isFinite(xPt) || !Number.isFinite(yPt)) {
      return null;
    }
    return {
      x: formatNumber(xPt),
      y: formatNumber(yPt),
    };
  }

  private isZeroRadius(radius: Radius): boolean {
    const epsilon = 1e-6;
    return (
      Math.abs(radius.topLeft.x) <= epsilon &&
      Math.abs(radius.topLeft.y) <= epsilon &&
      Math.abs(radius.topRight.x) <= epsilon &&
      Math.abs(radius.topRight.y) <= epsilon &&
      Math.abs(radius.bottomRight.x) <= epsilon &&
      Math.abs(radius.bottomRight.y) <= epsilon &&
      Math.abs(radius.bottomLeft.x) <= epsilon &&
      Math.abs(radius.bottomLeft.y) <= epsilon
    );
  }
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}
