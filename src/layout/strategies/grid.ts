import { Display } from "../../css/enums.js";
import type { TrackDefinition, TrackSize } from "../../css/style.js";
import { resolveLength } from "../../css/length.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import {
  containingBlock,
  horizontalMargin,
  horizontalNonContent,
  resolveWidthBlock,
  verticalNonContent,
} from "../utils/node-math.js";
import type { LayoutNode } from "../../dom/node.js";

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

  const gapTotal = columnGap * Math.max(0, columnCount - 1);
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
    const baseContentWidth = resolveWidthBlock(node, cb.width);
    node.box.contentWidth = baseContentWidth;
    const horizontalExtras = horizontalNonContent(node, baseContentWidth);
    node.box.borderBoxWidth = baseContentWidth + horizontalExtras;
    node.box.marginBoxWidth = node.box.borderBoxWidth + horizontalMargin(node, baseContentWidth);

    const paddingLeft = resolveLength(node.style.paddingLeft, baseContentWidth, { auto: "zero" });
    const paddingTop = resolveLength(node.style.paddingTop, baseContentWidth, { auto: "zero" });
    const borderLeft = resolveLength(node.style.borderLeft, baseContentWidth, { auto: "zero" });
    const borderTop = resolveLength(node.style.borderTop, baseContentWidth, { auto: "zero" });

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
      columnWidths.reduce((sum, width) => sum + width, 0) + columnGap * Math.max(0, columnWidths.length - 1);
    const resolvedContentWidth = columnWidths.length > 0 ? Math.max(baseContentWidth, totalColumnWidth) : baseContentWidth;
    node.box.contentWidth = resolvedContentWidth;
    node.box.borderBoxWidth = resolvedContentWidth + horizontalExtras;
    node.box.marginBoxWidth = node.box.borderBoxWidth + horizontalMargin(node, resolvedContentWidth);

    const columnOffsets: number[] = [];
    let offset = 0;
    for (const width of columnWidths) {
      columnOffsets.push(offset);
      offset += width + columnGap;
    }

    let contentHeight = 0;
    let currentRowTop = contentOriginY;
    let currentRowHeight = 0;
    let columnIndex = 0;
    let rowCount = 0;

    for (const child of node.children) {
      if (child.style.display === Display.None) {
        continue;
      }

      const columnWidth = columnWidths[columnIndex] ?? columnWidths[columnWidths.length - 1] ?? baseContentWidth;
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

      columnIndex += 1;
      if (columnIndex >= columnWidths.length) {
        rowCount += 1;
        contentHeight += currentRowHeight;
        currentRowTop += currentRowHeight + rowGap;
        currentRowHeight = 0;
        columnIndex = 0;
      }
    }

    if (columnIndex !== 0) {
      rowCount += 1;
      contentHeight += currentRowHeight;
    }

    const totalRowGap = rowGap * Math.max(0, rowCount - 1);
    const verticalExtras = verticalNonContent(node, node.box.contentWidth);
    node.box.contentHeight = Math.max(0, contentHeight + totalRowGap);
    node.box.borderBoxHeight = node.box.contentHeight + verticalExtras;
    node.box.marginBoxHeight =
      node.box.borderBoxHeight +
      resolveLength(node.style.marginTop, node.box.contentWidth, { auto: "zero" }) +
      resolveLength(node.style.marginBottom, node.box.contentWidth, { auto: "zero" });

    node.box.scrollWidth = Math.max(node.box.contentWidth, totalColumnWidth);
    node.box.scrollHeight = node.box.contentHeight;

    if (columnWidths.length === 0) {
      node.box.contentWidth = baseContentWidth;
      node.box.borderBoxWidth = node.box.contentWidth + horizontalExtras;
      node.box.marginBoxWidth = node.box.borderBoxWidth + horizontalMargin(node, node.box.contentWidth);
    }
  }
}
