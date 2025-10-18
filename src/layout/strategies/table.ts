import { BorderModel, Display } from "../../css/enums.js";
import { LayoutNode } from "../../dom/node.js";
import { log } from "../../debug/log.js";
import { resolveLength } from "../../css/length.js";
import { containingBlock, horizontalNonContent, resolveWidthBlock, verticalNonContent } from "../utils/node-math.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import { layoutTableCell, auditTableCell, debugTableCell } from "../table/cell_layout.js";

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
          if (!cell) continue;
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
      // Resolve vertical shared borders between adjacent rows
      for (let r = 0; r < numRows - 1; r++) {
        for (let c = 0; c < numCols; c++) {
          const upper = grid[r][c];
          const lower = grid[r + 1][c];
          if (!upper || !lower) continue;
          const upperBottom = upper.style.borderBottom ?? 0;
          const lowerTop = lower.style.borderTop ?? 0;
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
          const leftRight = left.style.borderRight ?? 0;
          const rightLeft = right.style.borderLeft ?? 0;
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
    log("LAYOUT", "DEBUG", "Table column widths calculated", { colWidths });

    const rowHeights = new Array(numRows).fill(0);
    for (let r = 0; r < numRows; r++) {
      let maxRowHeight = 0;
      for (let c = 0; c < numCols; c++) {
        const cell = grid[r][c];
        if (!cell) continue;

  // Calculate border and padding for cell, resolving to numbers
  const borderLeft = resolveLength(cell.style.borderLeft, colWidths[c], { auto: "zero" });
  const borderRight = resolveLength(cell.style.borderRight, colWidths[c], { auto: "zero" });
  const borderTop = resolveLength(cell.style.borderTop, colWidths[c], { auto: "zero" });
  const borderBottom = resolveLength(cell.style.borderBottom, colWidths[c], { auto: "zero" });
  const paddingLeft = resolveLength(cell.style.paddingLeft, colWidths[c], { auto: "zero" });
  const paddingRight = resolveLength(cell.style.paddingRight, colWidths[c], { auto: "zero" });
  const paddingTop = resolveLength(cell.style.paddingTop, colWidths[c], { auto: "zero" });
  const paddingBottom = resolveLength(cell.style.paddingBottom, colWidths[c], { auto: "zero" });

  // Available content width for cell
  const cellAvailableWidth = colWidths[c] - borderLeft - borderRight - paddingLeft - paddingRight;
        cell.box.x = 0;
        cell.box.y = 0;
        cell.box.contentWidth = cellAvailableWidth;

        // Layout child using inline layout for text
        debugTableCell(cell); // Debug specific cell
        layoutTableCell(cell);
        if (cell.textContent?.includes('Row 3, Cell 3')) auditTableCell(cell); // Audit after layout

          // Offset children by padding so text is not glued to border
          for (const child of cell.children) {
            child.box.x = (child.box.x ?? 0) + paddingLeft;
            child.box.y = (child.box.y ?? 0) + paddingTop;
          }

        // Apply textAlign and verticalAlign to children if present
        if (cell.style.textAlign || cell.style.verticalAlign) {
          for (const child of cell.children) {
            if (cell.style.textAlign) child.style.textAlign = cell.style.textAlign;
            if (cell.style.verticalAlign) child.style.verticalAlign = cell.style.verticalAlign;
          }
        }

        // Ensure cell node itself has correct contentHeight
        cell.box.contentHeight = cell.box.contentHeight || 0;
        // If cell has children, use the max of their contentHeight
        if (cell.children && cell.children.length > 0) {
          let maxChildHeight = 0;
          for (const child of cell.children) {
            maxChildHeight = Math.max(maxChildHeight, child.box.contentHeight || 0);
          }
          cell.box.contentHeight = Math.max(cell.box.contentHeight, maxChildHeight);
        }

        // Total cell height including borders and padding
        const cellTotalHeight = cell.box.contentHeight + borderTop + borderBottom + paddingTop + paddingBottom;
        maxRowHeight = Math.max(maxRowHeight, cellTotalHeight);
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
          // Calculate border and padding for cell, resolving to numbers
          const borderLeft = resolveLength(cell.style.borderLeft, colWidths[c], { auto: "zero" });
          const borderTop = resolveLength(cell.style.borderTop, colWidths[c], { auto: "zero" });
          const paddingLeft = resolveLength(cell.style.paddingLeft, colWidths[c], { auto: "zero" });
          const paddingTop = resolveLength(cell.style.paddingTop, colWidths[c], { auto: "zero" });

          // Set the cell's final position (including border and padding)
          const newX = node.box.x + cursorX + borderLeft + paddingLeft;
          const newY = node.box.y + cursorY + borderTop + paddingTop;

          // Calculate the offset from the cell's position during layout (which was 0,0)
          const deltaX = newX - cell.box.x;
          const deltaY = newY - cell.box.y;

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

          // Set border box dimensions
          cell.box.borderBoxWidth = colWidths[c];
          cell.box.borderBoxHeight = rowHeights[r];

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
