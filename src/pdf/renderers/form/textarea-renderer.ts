import type { RenderBox } from "../../types.js";
import type { IFormRenderer, RenderContext, RenderCommands } from "./irenderer.js";
import type { FormControlData, TextareaControlData } from "./types.js";
import { formatNumber } from "../text-renderer-utils.js";
import { formatPdfRgb } from "./color-utils.js";
import { encodeFormText, resolveFormFont, resolveFormTextPosition } from "./text-utils.js";

const DEFAULT_BORDER_WIDTH = 1;
// const DEFAULT_TEXTAREA_ROWS = 3;
const LINE_HEIGHT = 20;

export class TextareaRenderer implements IFormRenderer {
  readonly elementType = 'textarea';

  canRender(node: RenderBox): boolean {
    const data = this.getFormControlDataInternal(node);
    return data !== null && data.kind === 'textarea';
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
    const borderWidth = DEFAULT_BORDER_WIDTH;
    const { font, fontSize } = resolveFormFont(node, context.fontProvider);

    const xPt = ct.convertPxToPt(rect.x);
    const yPt = ct.pageHeightPt - ct.convertPxToPt(rect.y + rect.height);
    const widthPt = ct.convertPxToPt(rect.width);
    const heightPt = ct.convertPxToPt(rect.height);
    const borderPt = ct.convertPxToPt(borderWidth);

    commands.push("q");
    
    const bgColor = node.background?.color ?? { r: 1, g: 1, b: 1, a: 1 };
    commands.push(`${formatPdfRgb(bgColor)} rg`);
    commands.push(`${formatNumber(xPt)} ${formatNumber(yPt)} ${formatNumber(widthPt)} ${formatNumber(heightPt)} re`);
    commands.push("f");

    const borderColor = node.borderColor ?? { r: 0.7, g: 0.7, b: 0.7, a: 1 };
    commands.push(`${formatPdfRgb(borderColor)} RG`);
    commands.push(`${formatNumber(borderPt)} w`);
    commands.push(`${formatNumber(xPt)} ${formatNumber(yPt)} ${formatNumber(widthPt)} ${formatNumber(heightPt)} re`);
    commands.push("S");

    const lineHeightPt = ct.convertPxToPt(LINE_HEIGHT);
    const { xPt: textX, yPt: textY } = resolveFormTextPosition(node, fontSize, ct, "top");

    commands.push("BT");
    commands.push(`/${font.resourceName} ${formatNumber(ct.convertPxToPt(fontSize))} Tf`);
    commands.push(`${lineHeightPt} TL`);

    if (data.value && data.value.length > 0) {
      const textColor = node.color ?? { r: 0, g: 0, b: 0, a: 1 };
      commands.push(`${formatPdfRgb(textColor)} rg`);
      commands.push(`${formatNumber(textX)} ${formatNumber(textY)} Td`);
      
      const lines = data.value.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          commands.push(`0 ${formatNumber(-lineHeightPt)} Td`);
        }
        const encodedLine = encodeFormText(lines[i], font);
        commands.push(`(${encodedLine}) Tj`);
      }
    } else if (data.placeholder && data.placeholder.length > 0) {
      const placeholderColor = { r: 0.6, g: 0.6, b: 0.6, a: 1 };
      commands.push(`${formatPdfRgb(placeholderColor)} rg`);
      commands.push(`${formatNumber(textX)} ${formatNumber(textY)} Td`);
      
      const encodedPlaceholder = encodeFormText(data.placeholder, font);
      commands.push(`(${encodedPlaceholder}) Tj`);
    }

    commands.push("ET");

    commands.push("Q");

    return { commands, shadings };
  }

  getFormControlData(node: RenderBox): FormControlData | null {
    return this.getFormControlDataInternal(node);
  }

  private getFormControlDataInternal(node: RenderBox): TextareaControlData | null {
    if (node.customData && 'formControl' in node.customData) {
      const formControl = (node.customData as { formControl: unknown }).formControl;
      if (formControl && typeof formControl === 'object' && 'kind' in formControl && formControl.kind === 'textarea') {
        return formControl as TextareaControlData;
      }
    }
    return null;
  }

  // Note: text encoding handled by encodeFormText.
}
