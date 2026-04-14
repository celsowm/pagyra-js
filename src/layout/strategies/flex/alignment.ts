import { AlignItems, JustifyContent } from "../../../css/enums.js";
import type { AlignSelfValue } from "../../../css/style.js";
import { calculateLinesCrossSize } from "./line-builder.js";
import type { AlignContentResolution, FlexLine } from "./types.js";

export function resolveAlignContentLayout(
  lines: FlexLine[],
  alignContent: string,
  containerCrossSize: number,
  crossAxisGap: number,
): AlignContentResolution {
  const lineCrossSizes = lines.map((line) => line.crossSize);
  if (lines.length === 0) {
    return { lineCrossSizes, initialOffset: 0, additionalGap: 0 };
  }

  const naturalCross = calculateLinesCrossSize(lines, crossAxisGap);
  const freeSpace = Math.max(0, containerCrossSize - naturalCross);

  switch (alignContent) {
    case "stretch":
      if (freeSpace > 0) {
        const extraPerLine = freeSpace / lines.length;
        for (let i = 0; i < lineCrossSizes.length; i++) {
          lineCrossSizes[i] += extraPerLine;
        }
      }
      return { lineCrossSizes, initialOffset: 0, additionalGap: 0 };
    case "flex-end":
      return { lineCrossSizes, initialOffset: freeSpace, additionalGap: 0 };
    case "center":
      return { lineCrossSizes, initialOffset: freeSpace / 2, additionalGap: 0 };
    case "space-between":
      if (lines.length <= 1) {
        return { lineCrossSizes, initialOffset: 0, additionalGap: 0 };
      }
      return { lineCrossSizes, initialOffset: 0, additionalGap: freeSpace / (lines.length - 1) };
    case "space-around": {
      const gap = freeSpace / lines.length;
      return { lineCrossSizes, initialOffset: gap / 2, additionalGap: gap };
    }
    case "space-evenly": {
      const gap = freeSpace / (lines.length + 1);
      return { lineCrossSizes, initialOffset: gap, additionalGap: gap };
    }
    case "flex-start":
    default:
      return { lineCrossSizes, initialOffset: 0, additionalGap: 0 };
  }
}

export function resolveItemAlignment(alignSelf: AlignSelfValue | undefined, containerAlign: AlignItems): AlignItems {
  if (alignSelf && alignSelf !== "auto") {
    return alignSelf;
  }
  return containerAlign;
}

export function computeCrossOffset(
  alignment: AlignItems,
  containerSize: number,
  itemSize: number,
  marginStart: number,
  marginEnd: number,
): number {
  const total = itemSize + marginStart + marginEnd;
  const reference = Number.isFinite(containerSize) ? containerSize : total;
  const freeSpace = reference - total;
  if (freeSpace <= 0) {
    return 0;
  }
  switch (alignment) {
    case AlignItems.Center:
      return freeSpace / 2;
    case AlignItems.FlexEnd:
      return freeSpace;
    default:
      return 0;
  }
}

export function resolveJustifySpacing(
  justify: JustifyContent,
  freeSpace: number,
  itemCount: number,
): { offset: number; gap: number } {
  if (itemCount <= 0) {
    return { offset: 0, gap: 0 };
  }
  const clamped = Number.isFinite(freeSpace) ? Math.max(freeSpace, 0) : 0;
  switch (justify) {
    case JustifyContent.Center:
      return { offset: clamped / 2, gap: 0 };
    case JustifyContent.FlexEnd:
    case JustifyContent.End:
    case JustifyContent.Right:
      return { offset: clamped, gap: 0 };
    case JustifyContent.SpaceBetween:
      if (itemCount === 1) {
        return { offset: 0, gap: 0 };
      }
      return { offset: 0, gap: clamped / (itemCount - 1) };
    case JustifyContent.SpaceAround: {
      const gap = clamped / itemCount;
      return { offset: gap / 2, gap };
    }
    case JustifyContent.SpaceEvenly: {
      const gap = clamped / (itemCount + 1);
      return { offset: gap, gap };
    }
    default:
      return { offset: 0, gap: 0 };
  }
}
