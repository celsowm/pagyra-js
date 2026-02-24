import { AlignItems, BoxSizing, Display } from "../../css/enums.js";
import type { TrackDefinition, TrackSize } from "../../css/style.js";
import { isAutoLength, resolveLength } from "../../css/length.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import {
  adjustForBoxSizing,
  containingBlock,
  horizontalMargin,
  horizontalNonContent,
  resolveWidthBlock,
  verticalNonContent,
} from "../utils/node-math.js";
import type { LayoutNode } from "../../dom/node.js";
import { calculateTrackOffsets, calculateTotalGap } from "../utils/gap-calculator.js";

interface GridRowItem {
  child: LayoutNode;
  columnWidth: number;
  columnX: number;
}

interface GridRow {
  items: GridRowItem[];
  height: number;
}

type RepeatTrack = Extract<TrackDefinition, { kind: "repeat" }>;
type AutoRepeatTrack = Extract<TrackDefinition, { kind: "repeat-auto" }>;

function isRepeatTrack(def: TrackDefinition): def is RepeatTrack {
  return typeof def === "object" && def !== null && "kind" in def && def.kind === "repeat";
}

function isAutoRepeatTrack(def: TrackDefinition): def is AutoRepeatTrack {
  return typeof def === "object" && def !== null && "kind" in def && def.kind === "repeat-auto";
}

function trackMinSize(track: TrackSize): number {
  switch (track.kind) {
    case "fixed":
      return Math.max(0, track.size);
    case "clamp":
      return Math.max(0, track.min);
    case "flex":
      return Math.max(0, track.min ?? 0);
    case "auto":
      return Math.max(0, track.min ?? 0);
    default:
      return 0;
  }
}

function trackFlex(track: TrackSize): number {
  return track.kind === "flex" ? Math.max(0, track.flex) : 0;
}

function cloneTrackSize(track: TrackSize): TrackSize {
  if (track.kind === "fixed") {
    return { kind: "fixed", size: track.size };
  }
  if (track.kind === "clamp") {
    return {
      kind: "clamp",
      min: track.min,
      preferred: track.preferred,
      max: track.max,
    };
  }
  if (track.kind === "flex") {
    return {
      kind: "flex",
      flex: track.flex,
      min: track.min,
      max: track.max,
    };
  }
  return {
    kind: "auto",
    min: track.min,
    max: track.max,
  };
}

function flattenTrackDefinitions(
  definitions: TrackDefinition[],
  childCount: number,
  availableWidth: number,
  columnGap: number,
): TrackSize[] {
  if (definitions.length === 0) {
    return [];
  }

  const tracks: TrackSize[] = [];
  for (const def of definitions) {
    if (isRepeatTrack(def)) {
      for (let i = 0; i < def.count; i++) {
        tracks.push(cloneTrackSize(def.track));
      }
      continue;
    }
    if (isAutoRepeatTrack(def)) {
      const minSize = trackMinSize(def.track);
      let count = childCount || 1;
      if (minSize > 0) {
        const unit = minSize + columnGap;
        if (unit > 0) {
          count = Math.max(1, Math.floor((availableWidth + columnGap) / unit));
        }
      }
      if (def.mode === "auto-fit" && childCount > 0) {
        count = Math.min(count, childCount);
      }
      for (let i = 0; i < count; i++) {
        tracks.push(cloneTrackSize(def.track));
      }
      continue;
    }
    tracks.push(cloneTrackSize(def as TrackSize));
  }
  return tracks;
}

function resolveColumnWidths(tracks: TrackSize[], contentWidth: number, columnGap: number): number[] {
  const columnCount = tracks.length;
  if (columnCount === 0) {
    return [];
  }

  const gapTotal = calculateTotalGap(columnGap, columnCount);
  const available = Math.max(0, contentWidth - gapTotal);
  const minSizes = tracks.map((track) => trackMinSize(track));
  const flexFactors = tracks.map((track) => trackFlex(track));
  const totalMin = minSizes.reduce((sum, size) => sum + size, 0);
  const totalFlex = flexFactors.reduce((sum, flex) => sum + flex, 0);
  const leftover = Math.max(0, available - totalMin);

  return tracks.map((track, index) => {
    switch (track.kind) {
      case "fixed":
        return Math.max(0, track.size);
      case "clamp": {
        const min = Math.max(0, track.min);
        const max = Math.max(min, track.max);
        const preferred = track.preferred;
        return Math.max(min, Math.min(preferred, max));
      }
      case "flex": {
        let size = minSizes[index];
        if (totalFlex > 0 && flexFactors[index] > 0) {
          size += (flexFactors[index] / totalFlex) * leftover;
        }
        if (track.max !== undefined) {
          size = Math.min(size, track.max);
        }
        return Math.max(0, size);
      }
      case "auto": {
        let size = minSizes[index];
        if (track.max !== undefined && size > track.max) {
          size = track.max;
        }
        return Math.max(0, size);
      }
      default:
        return available / columnCount;
    }
  });
}

export class GridLayoutStrategy implements LayoutStrategy {
  private readonly supportedDisplays = new Set<Display>([Display.Grid, Display.InlineGrid]);

  canLayout(node: LayoutNode): boolean {
    return this.supportedDisplays.has(node.style.display);
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    const containerRefs = { containerWidth: cb.width, containerHeight: cb.height };
    const baseContentWidth = resolveWidthBlock(node, cb.width, cb.height);
    node.box.contentWidth = baseContentWidth;
    const horizontalExtras = horizontalNonContent(node, baseContentWidth, cb.height);
    node.box.borderBoxWidth = baseContentWidth + horizontalExtras;
    node.box.marginBoxWidth = node.box.borderBoxWidth + horizontalMargin(node, baseContentWidth, cb.height);

    const paddingLeft = resolveLength(node.style.paddingLeft, baseContentWidth, { auto: "zero", ...containerRefs });
    const paddingTop = resolveLength(node.style.paddingTop, cb.height, { auto: "zero", ...containerRefs });
    const borderLeft = resolveLength(node.style.borderLeft, baseContentWidth, { auto: "zero", ...containerRefs });
    const borderTop = resolveLength(node.style.borderTop, cb.height, { auto: "zero", ...containerRefs });

    const contentOriginX = node.box.x + borderLeft + paddingLeft;
    const contentOriginY = node.box.y + borderTop + paddingTop;

    const columnGap = node.style.columnGap ?? 0;
    const rowGap = node.style.rowGap ?? 0;

    const flattenedTracks = flattenTrackDefinitions(
      node.style.trackListColumns,
      node.children.length,
      baseContentWidth,
      columnGap,
    );
    const tracks: TrackSize[] =
      flattenedTracks.length > 0 ? flattenedTracks : [{ kind: "flex", flex: 1 } as TrackSize];
    const columnWidths = resolveColumnWidths(tracks, baseContentWidth, columnGap);
    const totalColumnWidth =
      columnWidths.reduce((sum, width) => sum + width, 0) + calculateTotalGap(columnGap, columnWidths.length);
    const resolvedContentWidth = columnWidths.length > 0 ? Math.max(baseContentWidth, totalColumnWidth) : baseContentWidth;
    node.box.contentWidth = resolvedContentWidth;
    node.box.borderBoxWidth = resolvedContentWidth + horizontalExtras;
    node.box.marginBoxWidth = node.box.borderBoxWidth + horizontalMargin(node, resolvedContentWidth, cb.height);

    const columnOffsets = calculateTrackOffsets(columnWidths, columnGap);

    const rows: GridRow[] = [];
    let currentRowTop = contentOriginY;
    let currentRowHeight = 0;
    let columnIndex = 0;
    let currentRowItems: GridRowItem[] = [];

    for (const child of node.children) {
      if (child.style.display === Display.None) {
        continue;
      }

      const span = Math.min(child.style.gridColumnSpan ?? 1, columnWidths.length);

      // Wrap to next row if the span doesn't fit
      if (columnIndex + span > columnWidths.length) {
        if (currentRowItems.length > 0) {
          rows.push({ items: currentRowItems, height: currentRowHeight });
          currentRowTop += currentRowHeight + rowGap;
          currentRowHeight = 0;
          currentRowItems = [];
        }
        columnIndex = 0;
      }

      // Calculate the total width of spanned columns
      let columnWidth = 0;
      for (let s = 0; s < span; s++) {
        columnWidth += columnWidths[columnIndex + s] ?? 0;
      }
      // Add gap between spanned columns
      if (span > 1) {
        columnWidth += columnGap * (span - 1);
      }

      const columnX = contentOriginX + (columnOffsets[columnIndex] ?? 0);

      child.box.x = columnX;
      child.box.y = currentRowTop;

      const originalContentWidth = node.box.contentWidth;
      node.box.contentWidth = columnWidth;
      context.layoutChild(child);
      node.box.contentWidth = originalContentWidth;

      child.box.x = columnX;
      child.box.y = currentRowTop;

      currentRowHeight = Math.max(currentRowHeight, child.box.borderBoxHeight);
      currentRowItems.push({
        child,
        columnWidth,
        columnX,
      });

      columnIndex += span;
      if (columnIndex >= columnWidths.length) {
        rows.push({ items: currentRowItems, height: currentRowHeight });
        currentRowTop += currentRowHeight + rowGap;
        currentRowHeight = 0;
        columnIndex = 0;
        currentRowItems = [];
      }
    }

    if (currentRowItems.length > 0) {
      rows.push({ items: currentRowItems, height: currentRowHeight });
    }

    const rowCount = rows.length;
    const contentHeight = rows.reduce((sum, row) => sum + row.height, 0);
    const totalRowGap = calculateTotalGap(rowGap, rowCount);
    const verticalExtras = verticalNonContent(node, cb.height, cb.width);
    let resolvedContentHeight = Math.max(0, contentHeight + totalRowGap);
    if (node.style.height !== "auto" && node.style.height !== undefined) {
      resolvedContentHeight = adjustForBoxSizing(
        resolveLength(node.style.height, cb.height, { auto: "zero", ...containerRefs }),
        node.style.boxSizing,
        verticalExtras,
      );
    }
    node.box.contentHeight = Math.max(0, resolvedContentHeight);
    node.box.borderBoxHeight = node.box.contentHeight + verticalExtras;
    node.box.marginBoxHeight =
      node.box.borderBoxHeight +
      resolveLength(node.style.marginTop, cb.height, { auto: "zero", ...containerRefs }) +
      resolveLength(node.style.marginBottom, cb.height, { auto: "zero", ...containerRefs });

    const stretchedRowHeights = resolveGridAlignContentRows(
      rows,
      rowGap,
      node.box.contentHeight,
      node.style.alignContent,
    );
    const containerAlignItems = node.style.alignItems ?? AlignItems.Stretch;

    let finalRowTop = contentOriginY;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const rowHeight = stretchedRowHeights[rowIndex] ?? row.height;

      for (const rowItem of row.items) {
        const child = rowItem.child;
        const finalX = rowItem.columnX;
        const finalY = finalRowTop;

        const prePlaceDx = finalX - child.box.x;
        const prePlaceDy = finalY - child.box.y;
        child.box.x = finalX;
        child.box.y = finalY;
        offsetLayoutSubtree(child, prePlaceDx, prePlaceDy);

        const alignSelf = resolveGridItemAlignment(child, containerAlignItems);
        const autoHeight = child.style.height === undefined || child.style.height === "auto" || isAutoLength(child.style.height);
        if (alignSelf === AlignItems.Stretch && autoHeight) {
          const childContainerRefs = { containerWidth: rowItem.columnWidth, containerHeight: rowHeight };
          const marginTop = resolveLength(child.style.marginTop, rowHeight, { auto: "zero", ...childContainerRefs });
          const marginBottom = resolveLength(child.style.marginBottom, rowHeight, { auto: "zero", ...childContainerRefs });
          const targetBorderBoxHeight = Math.max(0, rowHeight - marginTop - marginBottom);
          const childVerticalExtras = verticalNonContent(child, rowHeight, rowItem.columnWidth);
          const stretchedSpecifiedHeight = child.style.boxSizing === BoxSizing.BorderBox
            ? targetBorderBoxHeight
            : Math.max(0, targetBorderBoxHeight - childVerticalExtras);

          const currentBorderHeight = child.box.borderBoxHeight;
          if (Math.abs(currentBorderHeight - targetBorderBoxHeight) > 0.01) {
            const originalHeight = child.style.height;
            const originalContentWidth = node.box.contentWidth;
            try {
              child.style.height = stretchedSpecifiedHeight;
              child.box.x = finalX;
              child.box.y = finalY;
              node.box.contentWidth = rowItem.columnWidth;
              context.layoutChild(child);
            } finally {
              node.box.contentWidth = originalContentWidth;
              child.style.height = originalHeight;
            }

            const relayoutDx = finalX - child.box.x;
            const relayoutDy = finalY - child.box.y;
            child.box.x = finalX;
            child.box.y = finalY;
            offsetLayoutSubtree(child, relayoutDx, relayoutDy);
          }
        }
      }

      finalRowTop += rowHeight;
      if (rowIndex < rows.length - 1) {
        finalRowTop += rowGap;
      }
    }

    node.box.scrollWidth = Math.max(node.box.contentWidth, totalColumnWidth);
    node.box.scrollHeight = node.box.contentHeight;

    if (columnWidths.length === 0) {
      node.box.contentWidth = baseContentWidth;
      node.box.borderBoxWidth = node.box.contentWidth + horizontalExtras;
      node.box.marginBoxWidth = node.box.borderBoxWidth + horizontalMargin(node, node.box.contentWidth, cb.height);
    }
  }
}

function offsetLayoutSubtree(node: LayoutNode, deltaX: number, deltaY: number): void {
  if (deltaX === 0 && deltaY === 0) {
    return;
  }
  node.walk((desc) => {
    if (desc !== node) {
      desc.box.x += deltaX;
      desc.box.y += deltaY;
    }
    desc.box.baseline += deltaY;

    if (desc.inlineRuns && desc.inlineRuns.length > 0) {
      for (const run of desc.inlineRuns) {
        run.startX += deltaX;
        run.baseline += deltaY;
      }
    }
  });
}

function resolveGridItemAlignment(child: LayoutNode, containerAlign: AlignItems): AlignItems {
  const alignSelf = child.style.alignSelf;
  if (alignSelf && alignSelf !== "auto") {
    return alignSelf;
  }
  return containerAlign;
}

function resolveGridAlignContentRows(
  rows: GridRow[],
  rowGap: number,
  containerContentHeight: number,
  alignContent: string,
): number[] {
  const rowHeights = rows.map((row) => row.height);
  if (alignContent !== "stretch") {
    return rowHeights;
  }
  const naturalHeight = rowHeights.reduce((sum, height) => sum + height, 0) + calculateTotalGap(rowGap, rowHeights.length);
  const freeSpace = Math.max(0, containerContentHeight - naturalHeight);
  if (freeSpace > 0 && rowHeights.length > 0) {
    const extraPerRow = freeSpace / rowHeights.length;
    for (let i = 0; i < rowHeights.length; i++) {
      rowHeights[i] += extraPerRow;
    }
  }
  return rowHeights;
}
