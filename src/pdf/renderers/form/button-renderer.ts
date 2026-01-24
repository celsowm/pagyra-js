import type { RenderBox, RGBA } from "../../types.js";
import type { IFormRenderer, RenderContext, RenderCommands } from "./irenderer.js";
import type { FormControlData, ButtonControlData } from "./types.js";
import { formatNumber } from "../text-renderer-utils.js";
import { encodeFormText, resolveFormFont, resolveFormTextPosition } from "./text-utils.js";

// const DEFAULT_BUTTON_PADDING_H = 20;
const DEFAULT_BORDER_WIDTH = 1;

export class ButtonRenderer implements IFormRenderer {
  readonly elementType = 'button';

  canRender(node: RenderBox): boolean {
    const data = this.getFormControlDataInternal(node);
    return data !== null && data.kind === 'button';
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
    // const paddingH = DEFAULT_BUTTON_PADDING_H;
    const borderWidth = DEFAULT_BORDER_WIDTH;
    const { font, fontSize } = resolveFormFont(node, context.fontProvider);

    const xPt = ct.convertPxToPt(rect.x);
    const yPt = ct.pageHeightPt - ct.convertPxToPt(rect.y + rect.height);
    const widthPt = ct.convertPxToPt(rect.width);
    const heightPt = ct.convertPxToPt(rect.height);
    // const paddingHPt = ct.convertPxToPt(paddingH);
    const borderPt = ct.convertPxToPt(borderWidth);

    commands.push("q");
    
    const bgColor = this.getButtonBackgroundColor(data.buttonType, data.isDisabled);
    commands.push(`${bgColor.r.toFixed(3)} ${bgColor.g.toFixed(3)} ${bgColor.b.toFixed(3)} rg`);
    commands.push(`${formatNumber(xPt)} ${formatNumber(yPt)} ${formatNumber(widthPt)} ${formatNumber(heightPt)} re`);
    commands.push("f");

    const borderColor = data.isDisabled 
      ? { r: 0.8, g: 0.8, b: 0.8, a: 1 }
      : { r: 0.4, g: 0.4, b: 0.4, a: 1 };
    commands.push(`${borderColor.r.toFixed(3)} ${borderColor.g.toFixed(3)} ${borderColor.b.toFixed(3)} RG`);
    commands.push(`${formatNumber(borderPt)} w`);
    commands.push(`${formatNumber(xPt)} ${formatNumber(yPt)} ${formatNumber(widthPt)} ${formatNumber(heightPt)} re`);
    commands.push("S");

    const textX = xPt + widthPt / 2;
    const { yPt: textY } = resolveFormTextPosition(node, fontSize, ct, "center");

    const textColor: RGBA = data.isDisabled 
      ? { r: 0.6, g: 0.6, b: 0.6, a: 1 }
      : { r: 1, g: 1, b: 1, a: 1 };

    commands.push("BT");
    commands.push(`/${font.resourceName} ${formatNumber(ct.convertPxToPt(fontSize))} Tf`);
    commands.push(`${textColor.r.toFixed(3)} ${textColor.g.toFixed(3)} ${textColor.b.toFixed(3)} rg`);
    
    const buttonText = this.getButtonText(data);
    const encodedText = encodeFormText(buttonText, font);
    commands.push(`1 0 0 0 ${formatNumber(textX)} ${formatNumber(textY)} Tm`);
    commands.push(`(${encodedText}) Tj`);
    commands.push("ET");

    commands.push("Q");

    return { commands, shadings };
  }

  getFormControlData(node: RenderBox): FormControlData | null {
    return this.getFormControlDataInternal(node);
  }

  private getFormControlDataInternal(node: RenderBox): ButtonControlData | null {
    if (node.customData && 'formControl' in node.customData) {
      const formControl = (node.customData as { formControl: unknown }).formControl;
      if (formControl && typeof formControl === 'object' && 'kind' in formControl && formControl.kind === 'button') {
        return formControl as ButtonControlData;
      }
    }
    return null;
  }

  private getButtonBackgroundColor(buttonType: string, isDisabled?: boolean): RGBA {
    if (isDisabled) {
      return { r: 0.9, g: 0.9, b: 0.9, a: 1 };
    }
    
    switch (buttonType) {
      case 'submit':
        return { r: 0.2, g: 0.5, b: 0.2, a: 1 };
      case 'reset':
        return { r: 0.8, g: 0.3, b: 0.2, a: 1 };
      default:
        return { r: 0.4, g: 0.4, b: 0.5, a: 1 };
    }
  }

  private getButtonText(data: ButtonControlData): string {
    if (data.value && data.value.length > 0) {
      return data.value;
    }
    
    switch (data.buttonType) {
      case 'submit':
        return 'Submit';
      case 'reset':
        return 'Reset';
      default:
        return 'Button';
    }
  }

  // Note: text encoding handled by encodeFormText.
}
