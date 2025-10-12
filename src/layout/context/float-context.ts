export interface FloatRect {
  readonly top: number;
  readonly bottom: number;
  readonly inlineStart: number;
  readonly inlineEnd: number;
}

export class FloatContext {
  private readonly leftFloats: FloatRect[] = [];
  private readonly rightFloats: FloatRect[] = [];

  register(side: "left" | "right", rect: FloatRect): void {
    const collection = side === "left" ? this.leftFloats : this.rightFloats;
    collection.push(rect);
  }

  occupiedWidth(side: "left" | "right", top: number, bottom: number): number {
    const collection = side === "left" ? this.leftFloats : this.rightFloats;
    let result = 0;
    for (const rect of collection) {
      if (rangesOverlap(rect.top, rect.bottom, top, bottom)) {
        const width = rect.inlineEnd - rect.inlineStart;
        result = Math.max(result, width);
      }
    }
    return result;
  }

  bottom(side: "left" | "right"): number {
    const collection = side === "left" ? this.leftFloats : this.rightFloats;
    return collection.reduce((acc, rect) => Math.max(acc, rect.bottom), 0);
  }
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}
