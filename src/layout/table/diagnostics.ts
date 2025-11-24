import { LayoutNode } from "../../dom/node.js";
import { log } from "../../logging/debug.js";

export function auditTableCell(td: LayoutNode): void {
  log("layout", "debug", "[AUDIT] td inline", {
    tdWidth: td.box.contentWidth,
    lines: (td.lineBoxes ?? []).length,
    joined: (td.lineBoxes ?? []).map((line) => line.text).join(" | "),
  });
}

export function debugTableCell(cell: LayoutNode): void {
  if (cell.tagName === "td" && cell.textContent?.includes("Row 3, Cell 3")) {
    log("layout", "debug", "[DEBUG] before inline layout for problematic td", {
      textContent: cell.textContent,
      contentWidth: cell.box.contentWidth,
    });
  }
}
