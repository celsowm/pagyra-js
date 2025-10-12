export class FloatContext {
    floats = [];
    register(side, rect) {
        this.floats.push({ side, rect });
    }
    bottom(side) {
        let result = 0;
        for (const entry of this.floats) {
            if (entry.side === side) {
                result = Math.max(result, entry.rect.bottom);
            }
        }
        return result;
    }
    inlineOffsets(top, bottom, containingBlockWidth) {
        let leftOffset = 0;
        let rightOffset = 0;
        for (const { side, rect } of this.floats) {
            if (!rangesOverlap(rect.top, rect.bottom, top, bottom)) {
                continue;
            }
            if (side === "left") {
                leftOffset = Math.max(leftOffset, rect.inlineEnd);
            }
            else {
                rightOffset = Math.max(rightOffset, containingBlockWidth - rect.inlineStart);
            }
        }
        return {
            start: leftOffset,
            end: containingBlockWidth - rightOffset,
        };
    }
    nextUnblockedY(top, bottom) {
        let candidate = null;
        for (const { rect } of this.floats) {
            if (rangesOverlap(rect.top, rect.bottom, top, bottom)) {
                candidate = candidate === null ? rect.bottom : Math.min(candidate, rect.bottom);
            }
        }
        return candidate;
    }
}
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}
