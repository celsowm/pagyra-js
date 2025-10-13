import { Display } from "../../css/enums.js";
import { LayoutNode } from "../../dom/node.js";
import { log } from "../../debug/log.js";
import { resolveLength } from "../../css/length.js";
import { containingBlock, horizontalNonContent, resolveWidthBlock, verticalNonContent } from "../utils/node-math.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";

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

    const colWidths = this.calculateColumnWidths(grid, node.box.contentWidth);
    log("LAYOUT", "DEBUG", "Table column widths calculated", { colWidths });

    const rowHeights = new Array(numRows).fill(0);
    for (let r = 0; r < numRows; r++) {
      let maxRowHeight = 0;
      for (let c = 0; c < numCols; c++) {
        const cell = grid[r][c];
        if (!cell) continue;

        const cellAvailableWidth = colWidths[c] - horizontalNonContent(cell, colWidths[c]);
        cell.box.x = 0;
        cell.box.y = 0;
        cell.box.contentWidth = cellAvailableWidth;

        context.layoutChild(cell);

        const verticalExtras = verticalNonContent(cell, colWidths[c]);
        const cellBorderBoxHeight = cell.box.contentHeight + verticalExtras;
        maxRowHeight = Math.max(maxRowHeight, cellBorderBoxHeight);
      }
      rowHeights[r] = maxRowHeight;
    }
    log("LAYOUT", "DEBUG", "Table row heights calculated", { rowHeights });

    let cursorY = 0;
    for (let r = 0; r < numRows; r++) {
      let cursorX = 0;
      for (let c = 0; c < numCols; c++) {
        const cell = grid[r][c];

        if (cell) {
          const newX = node.box.x + cursorX;
          const newY = node.box.y + cursorY;

          // Calculate the offset from the cell's position during layout (which was 0,0)
          const deltaX = newX - cell.box.x;
          const deltaY = newY - cell.box.y;

          // Set the cell's final position
          cell.box.x = newX;
          cell.box.y = newY;

          // Apply the same offset to all of the cell's descendants
          cell.walk((descendant) => {
            descendant.box.x += deltaX;
            descendant.box.y += deltaY;
            if (descendant.box.baseline !== undefined) {
              descendant.box.baseline += deltaY;
            }
          }, false);

          cell.box.borderBoxWidth = colWidths[c];
          cell.box.borderBoxHeight = rowHeights[r];

          const hExtras = horizontalNonContent(cell, colWidths[c]);
          cell.box.contentWidth = colWidths[c] - hExtras;

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
        cursorX += colWidths[c];
      }
      cursorY += rowHeights[r];
    }

    node.box.contentHeight = cursorY;
    node.box.borderBoxWidth = node.box.contentWidth + horizontalNonContent(node, cb.width);
    node.box.borderBoxHeight = node.box.contentHeight + verticalNonContent(node, cb.width);
    node.box.scrollWidth = node.box.contentWidth;
    node.box.scrollHeight = node.box.contentHeight;
  }

  private buildTableGrid(tableNode: LayoutNode): (LayoutNode | null)[][] {
    const grid: (LayoutNode | null)[][] = [];
    let currentRowIndex = -1;

    const processRow = (rowNode: LayoutNode) => {
      grid.push([]);
      currentRowIndex++;
      let currentColIndex = 0;
      for (const cellNode of rowNode.children) {
        if (cellNode.style.display === Display.TableCell) {
          if (grid[currentRowIndex]) {
            grid[currentRowIndex][currentColIndex] = cellNode;
          }
          currentColIndex++;
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

    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < grid.length; r++) {
        const cell = grid[r][c];
        if (!cell) continue;

        let maxIntrinsicWidth = 0;
        if (cell.intrinsicInlineSize) {
          maxIntrinsicWidth = cell.intrinsicInlineSize;
        }
        cell.walk((node) => {
          if (node.intrinsicInlineSize !== undefined) {
            maxIntrinsicWidth = Math.max(maxIntrinsicWidth, node.intrinsicInlineSize);
          }
        });

        const horizontalExtras = horizontalNonContent(cell, 0);
        const cellMinWidth = maxIntrinsicWidth + horizontalExtras;
        minContentWidths[c] = Math.max(minContentWidths[c], cellMinWidth);
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
}
