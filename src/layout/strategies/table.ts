import { BorderModel, Display } from "../../css/enums.js";
import { LayoutNode } from "../../dom/node.js";
import { log } from "../../debug/log.js";
import { resolveLength } from "../../css/length.js";
import { containingBlock, horizontalNonContent, resolveWidthBlock, verticalNonContent } from "../utils/node-math.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import { layoutTableCell } from "../table/cell_layout.js";
import { auditTableCell, debugTableCell } from "../table/diagnostics.js";
import type { LengthLike } from "../../css/length.js";

export class TableLayoutStrategy implements LayoutStrategy {
  private readonly supportedDisplays = new Set<Display>([Display.Table, Display.InlineTable]);

  canLayout(node: LayoutNode): boolean {
    return this.supportedDisplays.has(node.style.display);
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    log("LAYOUT", "DEBUG", "TableLayoutStrategy invoked", {
      tagName: node.tagName,
      display: node.style.display,
      children: node.children.length
    });

    const cb = containingBlock(node, context.env.viewport);
    node.box.contentWidth = resolveWidthBlock(node, cb.width);
    log("LAYOUT", "DEBUG", "Table layout start", {
      table: node.tagName,
      availableWidth: cb.width,
      resolvedWidth: node.box.contentWidth,
    });

    const grid = this.buildTableGrid(node);
    if (grid.length === 0 || grid[0].length === 0) {
      node.box.contentHeight = 0;
      return;
    }
    const numRows = grid.length;
    const numCols = grid[0].length;
    log("LAYOUT", "DEBUG", "Table grid created", { rows: numRows, cols: numCols });
    const collapsedBorders = node.style.borderModel === BorderModel.Collapse;

      // Mimic browser border behavior: resolve border styles for each cell
      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
          const cell = grid[r][c];
          if (!cell || !this.isOriginCell(cell, r, c)) continue;
          const row = cell.parent;
          // Set default border width and color for table cells if not set
          const isTableCell = cell.tagName === 'td' || cell.tagName === 'th';
          if (isTableCell) {
            if (cell.style.borderTop === undefined) cell.style.borderTop = collapsedBorders ? 0 : 1;
            if (cell.style.borderRight === undefined) cell.style.borderRight = collapsedBorders ? 0 : 1;
            if (cell.style.borderBottom === undefined) cell.style.borderBottom = collapsedBorders ? 0 : 1;
            if (cell.style.borderLeft === undefined) cell.style.borderLeft = collapsedBorders ? 0 : 1;
            if (cell.style.borderColor === undefined) cell.style.borderColor = '#000';
          }
          // Inherit from row/table if still not set
          if (cell.style.borderTop === undefined) {
            if (row && row.style.borderTop !== undefined && row.style.borderTop !== 0) {
              cell.style.borderTop = row.style.borderTop;
            } else if (node.style.borderTop !== undefined && node.style.borderTop !== 0) {
              cell.style.borderTop = node.style.borderTop;
            }
          }
          if (cell.style.borderRight === undefined) {
            if (row && row.style.borderRight !== undefined && row.style.borderRight !== 0) {
              cell.style.borderRight = row.style.borderRight;
            } else if (node.style.borderRight !== undefined && node.style.borderRight !== 0) {
              cell.style.borderRight = node.style.borderRight;
            }
          }
          if (cell.style.borderBottom === undefined) {
            if (row && row.style.borderBottom !== undefined && row.style.borderBottom !== 0) {
              cell.style.borderBottom = row.style.borderBottom;
            } else if (node.style.borderBottom !== undefined && node.style.borderBottom !== 0) {
              cell.style.borderBottom = node.style.borderBottom;
            }
          }
          if (cell.style.borderLeft === undefined) {
            if (row && row.style.borderLeft !== undefined && row.style.borderLeft !== 0) {
              cell.style.borderLeft = row.style.borderLeft;
            } else if (node.style.borderLeft !== undefined && node.style.borderLeft !== 0) {
              cell.style.borderLeft = node.style.borderLeft;
            }
          }
          if (cell.style.borderColor === undefined) {
            if (row && row.style.borderColor !== undefined) {
              cell.style.borderColor = row.style.borderColor;
            } else if (node.style.borderColor !== undefined) {
              cell.style.borderColor = node.style.borderColor;
            }
          }
          // Debug log border properties
          log("LAYOUT", "TRACE", "Cell border properties", {
            row: r,
            col: c,
            borderTop: cell.style.borderTop,
            borderRight: cell.style.borderRight,
            borderBottom: cell.style.borderBottom,
            borderLeft: cell.style.borderLeft,
            borderColor: cell.style.borderColor,
          });
        }
      }

    if (collapsedBorders) {
      const numericBorder = (value: LengthLike | undefined): number =>
        resolveLength(value, node.box.contentWidth, { auto: "zero" });

      // Resolve vertical shared borders between adjacent rows
      for (let r = 0; r < numRows - 1; r++) {
        for (let c = 0; c < numCols; c++) {
          const upper = grid[r][c];
          const lower = grid[r + 1][c];
          if (!upper || !lower) continue;
          if (upper === lower) continue;
          if (!this.isRowBoundary(upper, r)) continue;
          const upperBottom = numericBorder(upper.style.borderBottom);
          const lowerTop = numericBorder(lower.style.borderTop);
          const shared = Math.max(upperBottom, lowerTop);
          lower.style.borderTop = shared;
          upper.style.borderBottom = 0;
          if (lower.style.borderColor === undefined && upper.style.borderColor !== undefined) {
            lower.style.borderColor = upper.style.borderColor;
          }
        }
      }
      // Resolve horizontal shared borders between adjacent columns
      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols - 1; c++) {
          const left = grid[r][c];
          const right = grid[r][c + 1];
          if (!left || !right) continue;
          if (left === right) continue;
          if (!this.isColumnBoundary(left, c)) continue;
          const leftRight = numericBorder(left.style.borderRight);
          const rightLeft = numericBorder(right.style.borderLeft);
          const shared = Math.max(leftRight, rightLeft);
          right.style.borderLeft = shared;
          left.style.borderRight = 0;
          if (right.style.borderColor === undefined && left.style.borderColor !== undefined) {
            right.style.borderColor = left.style.borderColor;
          }
        }
      }
    }
    const colWidths = this.calculateColumnWidths(grid, node.box.contentWidth);
    const tableContentWidth = colWidths.reduce((sum, width) => sum + width, 0);
    node.box.contentWidth = tableContentWidth;
    log("LAYOUT", "DEBUG", "Table column widths calculated", { colWidths });

    const rowHeights = new Array(numRows).fill(0);
    const spanningHeightRequests: { startRow: number; span: number; height: number }[] = [];
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = grid[r][c];
        if (!cell || !this.isOriginCell(cell, r, c)) continue;

        const colSpan = Math.min(this.cellColSpan(cell), numCols - c);
        const rowSpan = Math.min(this.cellRowSpan(cell), numRows - r);
        const spannedWidth = this.sumColumns(colWidths, c, colSpan);

        const boxMetrics = this.resolveCellBoxMetrics(cell, spannedWidth);
        const cellAvailableWidth =
          spannedWidth - boxMetrics.borderLeft - boxMetrics.borderRight - boxMetrics.paddingLeft - boxMetrics.paddingRight;
        cell.box.x = 0;
        cell.box.y = 0;
        cell.box.contentWidth = cellAvailableWidth;

        debugTableCell(cell);
        layoutTableCell(cell);
        if (cell.textContent?.includes("Row 3, Cell 3")) auditTableCell(cell);

        for (const child of cell.children) {
          child.box.x = (child.box.x ?? 0) + boxMetrics.paddingLeft;
          child.box.y = (child.box.y ?? 0) + boxMetrics.paddingTop;
        }

        if (cell.style.textAlign || cell.style.verticalAlign) {
          for (const child of cell.children) {
            if (cell.style.textAlign) child.style.textAlign = cell.style.textAlign;
            if (cell.style.verticalAlign) child.style.verticalAlign = cell.style.verticalAlign;
          }
        }

        cell.box.contentHeight = cell.box.contentHeight || 0;
        if (cell.children && cell.children.length > 0) {
          let maxChildHeight = 0;
          for (const child of cell.children) {
            maxChildHeight = Math.max(maxChildHeight, child.box.contentHeight || 0);
          }
          cell.box.contentHeight = Math.max(cell.box.contentHeight, maxChildHeight);
        }

        const cellTotalHeight =
          cell.box.contentHeight + boxMetrics.borderTop + boxMetrics.borderBottom + boxMetrics.paddingTop + boxMetrics.paddingBottom;

        if (rowSpan === 1) {
          rowHeights[r] = Math.max(rowHeights[r], cellTotalHeight);
        } else {
          spanningHeightRequests.push({ startRow: r, span: rowSpan, height: cellTotalHeight });
        }
      }
    }

    for (const request of spanningHeightRequests) {
      const share = request.height / request.span;
      for (let offset = 0; offset < request.span; offset++) {
        const targetRow = request.startRow + offset;
        if (targetRow < rowHeights.length) {
          rowHeights[targetRow] = Math.max(rowHeights[targetRow], share);
        }
      }
    }
    log("LAYOUT", "DEBUG", "Table row heights calculated", { rowHeights });

    const colOffsets = this.prefixSums(colWidths);
    const rowOffsets = this.prefixSums(rowHeights);

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = grid[r][c];

        if (cell && this.isOriginCell(cell, r, c)) {
          const colSpan = Math.min(this.cellColSpan(cell), numCols - c);
          const rowSpan = Math.min(this.cellRowSpan(cell), numRows - r);
          const spanWidth = colOffsets[c + colSpan] - colOffsets[c];
          const spanHeight = rowOffsets[r + rowSpan] - rowOffsets[r];

          const boxMetrics = this.resolveCellBoxMetrics(cell, spanWidth);
          const availableContentHeight =
            spanHeight - boxMetrics.borderTop - boxMetrics.borderBottom - boxMetrics.paddingTop - boxMetrics.paddingBottom;
          const alignOffsetY = this.computeVerticalAlignOffset(
            cell.style.verticalAlign,
            availableContentHeight,
            cell.box.contentHeight,
          );

          const newX = node.box.x + colOffsets[c] + boxMetrics.borderLeft + boxMetrics.paddingLeft;
          const newY = node.box.y + rowOffsets[r] + boxMetrics.borderTop + boxMetrics.paddingTop;

          // Calculate the offset from the cell's position during layout (which was 0,0)
          const deltaX = newX - cell.box.x;
          const deltaY = newY - cell.box.y;

          cell.box.x = newX;
          cell.box.y = newY;

          // Apply the same offset to all of the cell's descendants, plus any vertical-align offset
          cell.walk((descendant) => {
            descendant.box.x += deltaX;
            descendant.box.y += deltaY + alignOffsetY;
            if (descendant.box.baseline !== undefined) {
              descendant.box.baseline += deltaY + alignOffsetY;
            }
          }, false);

          // Set border box dimensions
          cell.box.borderBoxWidth = spanWidth;
          cell.box.borderBoxHeight = spanHeight;

          // Debug log for cell position and size
          log("LAYOUT", "TRACE", "Positioning table cell", {
            row: r,
            col: c,
            x: cell.box.x,
            y: cell.box.y,
            width: cell.box.borderBoxWidth,
            height: cell.box.borderBoxHeight,
            contentWidth: cell.box.contentWidth,
            contentHeight: cell.box.contentHeight,
          });
        }
      }
    }

    node.box.contentHeight = rowOffsets[numRows];
    node.box.borderBoxWidth = node.box.contentWidth + horizontalNonContent(node, cb.width);
    node.box.borderBoxHeight = node.box.contentHeight + verticalNonContent(node, cb.width);
    node.box.scrollWidth = node.box.contentWidth;
    node.box.scrollHeight = node.box.contentHeight;
  }

  private buildTableGrid(tableNode: LayoutNode): (LayoutNode | null)[][] {
    const grid: (LayoutNode | null)[][] = [];
    const activeRowSpans: { colStart: number; colSpan: number; remainingRows: number; cell: LayoutNode }[] = [];
    let currentRowIndex = -1;

    const processRow = (rowNode: LayoutNode) => {
      currentRowIndex++;
      const row: (LayoutNode | null)[] = [];

      for (const span of activeRowSpans) {
        if (span.remainingRows <= 0) continue;
        while (row.length < span.colStart + span.colSpan) row.push(null);
        for (let i = 0; i < span.colSpan; i++) {
          row[span.colStart + i] = span.cell;
        }
        span.remainingRows--;
      }

      let currentColIndex = 0;
      for (const cellNode of rowNode.children) {
        if (cellNode.style.display === Display.TableCell) {
          while (row[currentColIndex]) currentColIndex++;

          const colSpan = Math.max(1, cellNode.tableColSpan ?? 1);
          const rowSpan = Math.max(1, cellNode.tableRowSpan ?? 1);
          cellNode.tableColSpan = colSpan;
          cellNode.tableRowSpan = rowSpan;
          cellNode.tableCellOrigin = { row: currentRowIndex, col: currentColIndex };

          while (row.length < currentColIndex + colSpan) row.push(null);
          for (let i = 0; i < colSpan; i++) {
            row[currentColIndex + i] = cellNode;
          }

          if (rowSpan > 1) {
            activeRowSpans.push({
              colStart: currentColIndex,
              colSpan,
              remainingRows: rowSpan - 1,
              cell: cellNode,
            });
          }

          currentColIndex += colSpan;
        }
      }

      grid.push(row);
      for (let i = activeRowSpans.length - 1; i >= 0; i--) {
        if (activeRowSpans[i].remainingRows <= 0) {
          activeRowSpans.splice(i, 1);
        }
      }
    };

    for (const child of tableNode.children) {
      if (child.style.display === Display.TableRow) {
        processRow(child);
      } else if (
        [Display.TableRowGroup, Display.TableHeaderGroup, Display.TableFooterGroup].includes(child.style.display)
      ) {
        for (const rowNode of child.children) {
          if (rowNode.style.display === Display.TableRow) {
            processRow(rowNode);
          }
        }
      }
    }

    const maxCols = grid.reduce((max, row) => Math.max(max, row.length), 0);
    grid.forEach((row) => {
      while (row.length < maxCols) row.push(null);
    });

    return grid;
  }

  private calculateColumnWidths(grid: (LayoutNode | null)[][], tableWidth: number): number[] {
    const numCols = grid[0]?.length || 0;
    if (numCols === 0) return [];

    const minContentWidths = new Array(numCols).fill(0);

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = grid[r][c];
        if (!cell || !this.isOriginCell(cell, r, c)) continue;

        let maxIntrinsicWidth = 0;
        if (cell.intrinsicInlineSize) {
          maxIntrinsicWidth = cell.intrinsicInlineSize;
        }
        cell.walk((node) => {
          if (node.intrinsicInlineSize !== undefined) {
            maxIntrinsicWidth = Math.max(maxIntrinsicWidth, node.intrinsicInlineSize);
          }
        });

        const horizontalExtras = horizontalNonContent(cell, tableWidth);
        const cellMinWidth = maxIntrinsicWidth + horizontalExtras;
        const colSpan = Math.min(this.cellColSpan(cell), numCols - c);

        if (colSpan === 1) {
          minContentWidths[c] = Math.max(minContentWidths[c], cellMinWidth);
        } else {
          const share = cellMinWidth / colSpan;
          for (let offset = 0; offset < colSpan; offset++) {
            minContentWidths[c + offset] = Math.max(minContentWidths[c + offset], share);
          }
        }
      }
    }

    const totalMinWidth = minContentWidths.reduce((a, b) => a + b, 0);

    if (totalMinWidth < tableWidth) {
      const remainingWidth = tableWidth - totalMinWidth;
      const weights = minContentWidths.map((w) => (w > 0 ? w : totalMinWidth > 0 ? 0 : 1));
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      if (totalWeight > 0) {
        return minContentWidths.map((minWidth, i) => {
          return minWidth + remainingWidth * (weights[i] / totalWeight);
        });
      } else {
        return new Array(numCols).fill(tableWidth / numCols);
      }
    } else if (totalMinWidth > 0) {
      return minContentWidths;
    } else {
      return new Array(numCols).fill(tableWidth / numCols);
    }
  }

  private isOriginCell(cell: LayoutNode, row: number, col: number): boolean {
    const origin = cell.tableCellOrigin;
    return !!origin && origin.row === row && origin.col === col;
  }

  private cellColSpan(cell: LayoutNode): number {
    return Math.max(1, cell.tableColSpan ?? 1);
  }

  private cellRowSpan(cell: LayoutNode): number {
    return Math.max(1, cell.tableRowSpan ?? 1);
  }

  private isColumnBoundary(cell: LayoutNode, column: number): boolean {
    const origin = cell.tableCellOrigin;
    if (!origin) return false;
    return origin.col + this.cellColSpan(cell) - 1 === column;
  }

  private isRowBoundary(cell: LayoutNode, row: number): boolean {
    const origin = cell.tableCellOrigin;
    if (!origin) return false;
    return origin.row + this.cellRowSpan(cell) - 1 === row;
  }

  private sumColumns(colWidths: number[], start: number, span: number): number {
    let total = 0;
    for (let i = 0; i < span; i++) {
      total += colWidths[start + i] ?? 0;
    }
    return total;
  }

  private prefixSums(values: number[]): number[] {
    const offsets = [0];
    for (const value of values) {
      offsets.push(offsets[offsets.length - 1] + value);
    }
    return offsets;
  }

  private resolveCellBoxMetrics(
    cell: LayoutNode,
    referenceWidth: number,
  ): {
    borderLeft: number;
    borderRight: number;
    borderTop: number;
    borderBottom: number;
    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
    paddingBottom: number;
  } {
    const resolve = (value: LengthLike | undefined) => resolveLength(value, referenceWidth, { auto: "zero" });
    return {
      borderLeft: resolve(cell.style.borderLeft),
      borderRight: resolve(cell.style.borderRight),
      borderTop: resolve(cell.style.borderTop),
      borderBottom: resolve(cell.style.borderBottom),
      paddingLeft: resolve(cell.style.paddingLeft),
      paddingRight: resolve(cell.style.paddingRight),
      paddingTop: resolve(cell.style.paddingTop),
      paddingBottom: resolve(cell.style.paddingBottom),
    };
  }

  private computeVerticalAlignOffset(verticalAlign: string | undefined, available: number, content: number): number {
    const usedContent = Math.max(0, content ?? 0);
    const free = available - usedContent;
    if (!Number.isFinite(free) || free <= 0) return 0;

    const keyword = (verticalAlign ?? "top").toLowerCase();
    if (keyword === "middle" || keyword === "center") {
      return free / 2;
    }
    if (keyword === "bottom" || keyword === "text-bottom") {
      return free;
    }
    return 0;
  }
}
