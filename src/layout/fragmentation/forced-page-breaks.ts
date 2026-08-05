import { Display, FloatMode, Position } from "../../css/enums.js";
import { LayoutNode } from "../../dom/node.js";
import type { PageFlowMetrics } from "./page-flow.js";

const EPSILON = 0.01;

/**
 * Applies CSS pagination constraints in continuous layout coordinates. The later
 * page-margin mapping turns each variable printable-height interval into a page.
 */
export function applyForcedPageBreaks(root: LayoutNode, pageFlow: PageFlowMetrics): void {
  let accumulatedOffset = 0;

  const visit = (node: LayoutNode, isRoot: boolean): void => {
    if (accumulatedOffset !== 0) {
      shiftNodeGeometry(node, accumulatedOffset);
    }

    if (!isRoot && participatesInPageFlow(node)) {
      const beforeOffset = forcedBreakOffset(
        node.style.breakBefore,
        node.box.y,
        pageFlow,
      );
      if (beforeOffset > EPSILON) {
        shiftNodeGeometry(node, beforeOffset);
        accumulatedOffset += beforeOffset;
      }
    }

    for (const child of node.children) {
      visit(child, false);
    }

    if (!isRoot && participatesInPageFlow(node)) {
      const lineConstraintOffset = widowOrphanOffset(node, pageFlow);
      if (lineConstraintOffset > EPSILON) {
        node.shift(0, lineConstraintOffset);
        accumulatedOffset += lineConstraintOffset;
      }

      const bottom = subtreeBottom(node);
      const afterOffset = forcedBreakOffset(
        node.style.breakAfter,
        bottom,
        pageFlow,
      );
      if (afterOffset > EPSILON) {
        accumulatedOffset += afterOffset;
      }
    }
  };

  visit(root, true);
}

function participatesInPageFlow(node: LayoutNode): boolean {
  if (node.style.display === Display.None || isInlineDisplay(node.style.display)) {
    return false;
  }
  if (node.style.position === Position.Absolute || node.style.position === Position.Fixed) {
    return false;
  }
  return node.style.float === FloatMode.None;
}

function isInlineDisplay(display: Display): boolean {
  return display === Display.Inline
    || display === Display.InlineBlock
    || display === Display.InlineFlex
    || display === Display.InlineGrid
    || display === Display.InlineTable;
}

function forcedBreakOffset(
  value: string | undefined,
  coordinate: number,
  pageFlow: PageFlowMetrics,
): number {
  const normalized = value?.trim().toLowerCase();
  if (normalized !== "page" && normalized !== "left" && normalized !== "right") {
    return 0;
  }

  const currentPageIndex = pageFlow.pageIndexAtContentY(coordinate);
  const currentPageStart = pageFlow.contentStartForPage(currentPageIndex);
  let targetPageIndex = Math.abs(coordinate - currentPageStart) <= EPSILON
    ? currentPageIndex
    : currentPageIndex + 1;

  if (normalized === "left") {
    if (targetPageIndex % 2 === 0) {
      targetPageIndex++;
    }
  } else if (normalized === "right") {
    if (targetPageIndex % 2 !== 0) {
      targetPageIndex++;
    }
  }

  return Math.max(0, pageFlow.contentStartForPage(targetPageIndex) - coordinate);
}

function widowOrphanOffset(node: LayoutNode, pageFlow: PageFlowMetrics): number {
  if (!node.establishesIFC) {
    return 0;
  }

  const baselines = collectFormattingContextBaselines(node);
  if (baselines.length < 2) {
    return 0;
  }

  const pageOf = (baseline: number): number => pageFlow.pageIndexAtContentY(baseline - EPSILON);
  const firstPage = pageOf(baselines[0]);
  const lastPage = pageOf(baselines[baselines.length - 1]);
  if (firstPage === lastPage) {
    return 0;
  }

  const firstPageLines = baselines.filter((baseline) => pageOf(baseline) === firstPage).length;
  const lastPageLines = baselines.filter((baseline) => pageOf(baseline) === lastPage).length;
  const orphans = Math.max(1, Math.trunc(node.style.orphans || 2));
  const widows = Math.max(1, Math.trunc(node.style.widows || 2));

  if (firstPageLines >= orphans && lastPageLines >= widows) {
    return 0;
  }

  const height = subtreeBottom(node) - node.box.y;
  if (height > pageFlow.maximumUsableHeight() + EPSILON) {
    return 0;
  }

  const currentPage = pageFlow.pageIndexAtContentY(node.box.y);
  const nextPageTop = pageFlow.contentStartForPage(currentPage + 1);
  return Math.max(0, nextPageTop - node.box.y);
}

function collectFormattingContextBaselines(node: LayoutNode): number[] {
  const values = new Set<number>();

  const visit = (current: LayoutNode, isRoot: boolean): void => {
    if (!isRoot && current.establishesIFC) {
      return;
    }
    for (const run of current.inlineRuns ?? []) {
      values.add(Math.round(run.baseline * 1000) / 1000);
    }
    for (const child of current.children) {
      visit(child, false);
    }
  };

  visit(node, true);
  return [...values].sort((left, right) => left - right);
}

function shiftNodeGeometry(node: LayoutNode, dy: number): void {
  node.box.y += dy;
  node.box.baseline += dy;
  if (node.inlineRuns) {
    for (const run of node.inlineRuns) {
      run.baseline += dy;
    }
  }
}

function subtreeBottom(node: LayoutNode): number {
  let bottom = node.box.y + Math.max(
    node.box.marginBoxHeight,
    node.box.borderBoxHeight,
    node.box.contentHeight,
  );
  for (const child of node.children) {
    bottom = Math.max(bottom, subtreeBottom(child));
  }
  return bottom;
}
