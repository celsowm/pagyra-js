import { Display } from "../../css/enums.js";
import { containingBlock } from "../utils/node-math.js";
export class TableLayoutStrategy {
    supportedDisplays = new Set([Display.Table, Display.InlineTable]);
    canLayout(node) {
        return this.supportedDisplays.has(node.style.display);
    }
    layout(node, context) {
        const cb = containingBlock(node, context.env.viewport);
        const tableGrid = [];

        function findRows(currentNode) {
            if (currentNode.tagName === 'tr') {
                const row = [];
                for (const cell of currentNode.children) {
                    if (cell.tagName === 'td' || cell.tagName === 'th') {
                        const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
                        const rowspan = parseInt(cell.getAttribute('rowspan') || '1', 10);
                        row.push({ cell, colspan, rowspan });
                    }
                }
                tableGrid.push(row);
            } else {
                for (const child of currentNode.children) {
                    findRows(child);
                }
            }
        }

        findRows(node);

        const numRows = tableGrid.length;
        const numCols = tableGrid.reduce((max, row) => Math.max(max, row.reduce((sum, cell) => sum + cell.colspan, 0)), 0);

        const V = Array.from({ length: numRows + 1 }, () => Array(numCols + 1).fill(false));
        const gridWithPositions = [];

        for (let r = 0; r < numRows; ++r) {
            const gridRow = [];
            let c = 0;
            for (const { cell, colspan, rowspan } of tableGrid[r]) {
                while (V[r][c]) {
                    c++;
                }

                gridRow.push({ cell, r, c, colspan, rowspan });

                for (let i = 0; i < rowspan; ++i) {
                    for (let j = 0; j < colspan; ++j) {
                        if (r + i < numRows && c + j < numCols) {
                            V[r + i][c + j] = true;
                        }
                    }
                }
            }
            gridWithPositions.push(gridRow);
        }

        const columnWidth = cb.width / numCols;
        const columnWidths = Array(numCols).fill(columnWidth);

        const cellHeights = new Map();
        for (const row of gridWithPositions) {
            for (const cellData of row) {
                const { cell, colspan } = cellData;
                const cellWidth = colspan * columnWidth;
                cell.style.width = cellWidth;
                context.layoutChild(cell);
                cellHeights.set(cell, cell.box.borderBoxHeight);
            }
        }

        const rowHeights = Array(numRows).fill(0);
        for (let r = 0; r < numRows; ++r) {
            for (const cellData of gridWithPositions[r] || []) {
                const { cell, rowspan } = cellData;
                if (rowspan === 1) {
                    rowHeights[r] = Math.max(rowHeights[r], cellHeights.get(cell) || 0);
                }
            }
        }

        for (const row of gridWithPositions) {
            for (const cellData of row) {
                const { cell, r, rowspan } = cellData;
                if (rowspan > 1) {
                    const cellHeight = cellHeights.get(cell) || 0;
                    const currentRowsHeight = rowHeights.slice(r, r + rowspan).reduce((a, b) => a + b, 0);
                    if (cellHeight > currentRowsHeight) {
                        const diff = cellHeight - currentRowsHeight;
                        const heightToAdd = diff / rowspan;
                        for (let i = 0; i < rowspan; ++i) {
                            rowHeights[r + i] += heightToAdd;
                        }
                    }
                }
            }
        }

        let currentY = node.box.y;
        for (let r = 0; r < numRows; ++r) {
            for (const cellData of gridWithPositions[r] || []) {
                const { cell, c, colspan } = cellData;
                let currentX = node.box.x;
                for (let i = 0; i < c; ++i) {
                    currentX += columnWidths[i];
                }

                cell.box.x = currentX;
                cell.box.y = currentY;

                let cellWidth = 0;
                for (let i = 0; i < colspan; ++i) {
                    cellWidth += columnWidths[c + i];
                }
                cell.box.width = cellWidth;
            }
            currentY += rowHeights[r];
        }

        node.box.contentWidth = cb.width;
        node.box.contentHeight = rowHeights.reduce((a, b) => a + b, 0);
        node.box.borderBoxWidth = node.box.contentWidth;
        node.box.borderBoxHeight = node.box.contentHeight;
        node.box.scrollWidth = node.box.contentWidth;
        node.box.scrollHeight = node.box.contentHeight;
    }
}
