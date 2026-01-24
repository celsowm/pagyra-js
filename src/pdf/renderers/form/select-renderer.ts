import type { RenderBox } from "../../types.js";
import type { IFormRenderer, RenderContext, RenderCommands } from "./irenderer.js";
import type { FormControlData, SelectControlData } from "./types.js";
import { formatNumber } from "../text-renderer-utils.js";
import { drawDropdownArrow } from "./shape-utils.js";
import { formatPdfRgb } from "./color-utils.js";
import { encodeFormText, resolveFormFont, resolveFormTextPosition } from "./text-utils.js";

// const DEFAULT_SELECT_HEIGHT = 34;
const DROPDOWN_ARROW_SIZE = 12;

export class SelectRenderer implements IFormRenderer {
  readonly elementType = 'select';

  canRender(node: RenderBox): boolean {
    const data = this.getFormControlDataInternal(node);
    return data !== null && data.kind === 'select';
  }

  render(node: RenderBox, context: RenderContext): RenderCommands {
    const commands: string[] = [];
    const shadings = new Map<string, string>();
    const data = this.getFormControlDataInternal(node);
    
    if (!data) {
      return { commands, shadings };
    }

    const { coordinateTransformer } = context;
    const ct = coordinateTransformer;
    
    const rect = node.borderBox;
    const { font, fontSize } = resolveFormFont(node, context.fontProvider);
    const padding = 10;
    const arrowSize = DROPDOWN_ARROW_SIZE;
    // const arrowWidth = arrowSize * 1.2;

    const xPt = ct.convertPxToPt(rect.x);
    const yPt = ct.pageHeightPt - ct.convertPxToPt(rect.y + rect.height);
    const widthPt = ct.convertPxToPt(rect.width);
    const heightPt = ct.convertPxToPt(rect.height);
    // const arrowWidthPt = ct.convertPxToPt(arrowWidth);
    // const arrowHeightPt = ct.convertPxToPt(arrowSize);
    const arrowX = rect.x + rect.width - padding - arrowSize;
    const arrowY = rect.y + rect.height / 2 - arrowSize / 2;
    // const arrowXPt = ct.convertPxToPt(arrowX);
    // const arrowYPt = ct.pageHeightPt - ct.convertPxToPt(arrowY + arrowSize / 2);

    commands.push("q");
    
    const bgColor = node.background?.color ?? { r: 1, g: 1, b: 1, a: 1 };
    commands.push(`${formatPdfRgb(bgColor)} rg`);
    commands.push(`${formatNumber(xPt)} ${formatNumber(yPt)} ${formatNumber(widthPt)} ${formatNumber(heightPt)} re`);
    commands.push("f");

    const borderColor = node.borderColor ?? { r: 0.7, g: 0.7, b: 0.7, a: 1 };
    commands.push(`${formatPdfRgb(borderColor)} RG`);
    commands.push("1 w");
    commands.push(`${formatNumber(xPt)} ${formatNumber(yPt)} ${formatNumber(widthPt)} ${formatNumber(heightPt)} re`);
    commands.push("S");

    const arrowCommands = drawDropdownArrow(arrowX, arrowY, arrowSize, { r: 0.4, g: 0.4, b: 0.4, a: 1 });
    commands.push(...arrowCommands);

    const selectedOption = data.options.find(o => o.selected) ?? data.options[0];
    if (selectedOption) {
      const textColor = node.color ?? { r: 0, g: 0, b: 0, a: 1 };
      const { xPt: textX, yPt: textY } = resolveFormTextPosition(node, fontSize, ct, "center");
      
      commands.push("BT");
      commands.push(`/${font.resourceName} ${formatNumber(ct.convertPxToPt(fontSize))} Tf`);
      commands.push(`${formatPdfRgb(textColor)} rg`);
      commands.push(`${formatNumber(textX)} ${formatNumber(textY)} Td`);
      
      const encodedText = encodeFormText(selectedOption.text, font);
      commands.push(`(${encodedText}) Tj`);
      commands.push("ET");
    }

    commands.push("Q");

    return { commands, shadings };
  }

  getFormControlData(node: RenderBox): FormControlData | null {
    return this.getFormControlDataInternal(node);
  }

  private getFormControlDataInternal(node: RenderBox): SelectControlData | null {
    if (node.customData && 'formControl' in node.customData) {
      const formControl = (node.customData as { formControl: unknown }).formControl;
      if (formControl && typeof formControl === 'object' && 'kind' in formControl && formControl.kind === 'select') {
        return formControl as SelectControlData;
      }
    }
    return null;
  }

  // Note: text encoding handled by encodeFormText.
}
