import type { LayoutNode } from "../../dom/node.js";
import type { RenderBox, Rect, RGBA, Run, Decorations } from "../types.js";
import type { Matrix } from "../../geometry/matrix.js";
import { createTextRuns } from "./text-utils.js";
import { createListMarkerRun } from "./list-utils.js";
import { svgMatrixToPdf } from "../transform-adapter.js";
import { multiplyMatrices } from "../../geometry/matrix.js";

export interface NodeTextRunContext {
  node: LayoutNode;
  children: RenderBox[];
  borderBox: Rect;
  contentBox: Rect;
  textColor?: RGBA;
  decorations?: Decorations;
  transform?: Matrix;
  fallbackColor: RGBA;
}

export function buildNodeTextRuns(context: NodeTextRunContext): Run[] {
  const { node, children, borderBox, contentBox, textColor, decorations, transform, fallbackColor } = context;
  const textRuns = createTextRuns(node, textColor, decorations);

  if (node.tagName === "li") {
    const markerRun = createListMarkerRun(node, contentBox, children, textColor ?? fallbackColor);
    if (markerRun) {
      textRuns.unshift(markerRun);
    }
  }

  if (transform && textRuns.length > 0) {
    applyTransformToTextRuns(textRuns, transform, borderBox);
  }

  return textRuns;
}

function applyTransformToTextRuns(runs: Run[], cssMatrix: Matrix, originBox: Rect): void {
  if (runs.length === 0) {
    return;
  }
  const pdfMatrix = svgMatrixToPdf(cssMatrix);
  if (!pdfMatrix) {
    return;
  }
  const baseOriginX = Number.isFinite(originBox.x) ? originBox.x : 0;
  const baseOriginY = Number.isFinite(originBox.y) ? originBox.y : 0;
  const originWidth = Number.isFinite(originBox.width) ? originBox.width : 0;
  const originHeight = Number.isFinite(originBox.height) ? originBox.height : 0;
  const originX = baseOriginX + originWidth / 2;
  const originY = baseOriginY + originHeight / 2;
  const toOrigin = translationMatrix(-originX, -originY);
  const fromOrigin = translationMatrix(originX, originY);
  for (const run of runs) {
    const baseMatrix = run.lineMatrix ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const localMatrix = multiplyMatrices(toOrigin, baseMatrix);
    const transformedLocal = multiplyMatrices(pdfMatrix, localMatrix);
    run.lineMatrix = multiplyMatrices(fromOrigin, transformedLocal);
  }
}

function translationMatrix(tx: number, ty: number): Matrix {
  return { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
}
