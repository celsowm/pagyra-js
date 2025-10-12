export interface FloatRect {
  readonly top: number;
  readonly bottom: number;
  readonly inlineStart: number;
  readonly inlineEnd: number;
}

interface RegisteredFloat {
  readonly side: "left" | "right";
  readonly rect: FloatRect;
}

export class FloatContext {
  private readonly floats: RegisteredFloat[] = [];

  register(side: "left" | "right", rect: FloatRect): void {
    this.floats.push({ side, rect });
  }

  bottom(side: "left" | "right"): number {
    let result = 0;
    for (const entry of this.floats) {
      if (entry.side === side) {
        result = Math.max(result, entry.rect.bottom);
      }
    }
    return result;
  }

  inlineOffsets(top: number, bottom: number, containingBlockWidth: number): { start: number; end: number } {
    let leftOffset = 0;
    let rightOffset = 0;
    for (const { side, rect } of this.floats) {
      if (!rangesOverlap(rect.top, rect.bottom, top, bottom)) {
        continue;
      }
      if (side === "left") {
        leftOffset = Math.max(leftOffset, rect.inlineEnd);
      } else {
        rightOffset = Math.max(rightOffset, containingBlockWidth - rect.inlineStart);
      }
    }
    return {
      start: leftOffset,
      end: containingBlockWidth - rightOffset,
    };
  }

  nextUnblockedY(top: number, bottom: number): number | null {
    let candidate: number | null = null;
    for (const { rect } of this.floats) {
      if (rangesOverlap(rect.top, rect.bottom, top, bottom)) {
        candidate = candidate === null ? rect.bottom : Math.min(candidate, rect.bottom);
      }
    }
    return candidate;
  }
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}
