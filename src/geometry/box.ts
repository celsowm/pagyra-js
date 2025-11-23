export class Box {
  x = 0;
  y = 0;
  contentWidth = 0;
  contentHeight = 0;
  scrollWidth = 0;
  scrollHeight = 0;
  borderBoxWidth = 0;
  borderBoxHeight = 0;
  marginBoxWidth = 0;
  marginBoxHeight = 0;
  baseline = 0;
  usedMarginLeft?: number;
  usedMarginRight?: number;

  clone(): Box {
    const box = new Box();
    box.x = this.x;
    box.y = this.y;
    box.contentWidth = this.contentWidth;
    box.contentHeight = this.contentHeight;
    box.scrollWidth = this.scrollWidth;
    box.scrollHeight = this.scrollHeight;
    box.borderBoxWidth = this.borderBoxWidth;
    box.borderBoxHeight = this.borderBoxHeight;
    box.marginBoxWidth = this.marginBoxWidth;
    box.marginBoxHeight = this.marginBoxHeight;
    box.baseline = this.baseline;
    box.usedMarginLeft = this.usedMarginLeft;
    box.usedMarginRight = this.usedMarginRight;
    return box;
  }
}

import type { FontEmbedder } from "../pdf/font/embedder.js";

export interface Viewport {
  readonly width: number;
  readonly height: number;
  readonly fontEmbedder?: FontEmbedder | null;
}

export interface ContainingBlock {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
