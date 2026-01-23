import type { RenderBox, RGBA } from "../../types.js";
import type { IFormRenderer, RenderContext, RenderCommands } from "./irenderer.js";
import type { FormControlData, InputControlData } from "./types.js";
import { formatNumber } from "../text-renderer-utils.js";

// const DEFAULT_INPUT_HEIGHT = 34;
const DEFAULT_INPUT_PADDING = 10;
const DEFAULT_BORDER_WIDTH = 1;

export class InputTextRenderer implements IFormRenderer {
  readonly elementType = 'input-text';

  canRender(node: RenderBox): boolean {
    const data = this.getFormControlDataInternal(node);
    return data !== null && ['text', 'password', 'email', 'number', 'tel', 'url', 'search'].includes(data.inputType);
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
    
    const borderWidth = DEFAULT_BORDER_WIDTH;
    const padding = DEFAULT_INPUT_PADDING;
    const rect = node.borderBox;
    // const innerWidth = Math.max(0, rect.width - padding * 2 - borderWidth * 2);
    // const innerHeight = Math.max(0, rect.height - padding * 2 - borderWidth * 2);

    const xPt = ct.convertPxToPt(rect.x);
    const yPt = ct.pageHeightPt - ct.convertPxToPt(rect.y + rect.height);
    const widthPt = ct.convertPxToPt(rect.width);
    const heightPt = ct.convertPxToPt(rect.height);
    const paddingPt = ct.convertPxToPt(padding);
    const borderPt = ct.convertPxToPt(borderWidth);
    // const innerWidthPt = ct.convertPxToPt(innerWidth);
    // const innerHeightPt = ct.convertPxToPt(innerHeight);

    commands.push("q");
    
    const bgColor = this.parseColor(node.background?.color) ?? { r: 1, g: 1, b: 1, a: 1 };
    commands.push(`${bgColor.r.toFixed(3)} ${bgColor.g.toFixed(3)} ${bgColor.b.toFixed(3)} rg`);
    commands.push(`${formatNumber(xPt)} ${formatNumber(yPt)} ${formatNumber(widthPt)} ${formatNumber(heightPt)} re`);
    commands.push("f");

    const borderColor = this.parseColor(node.borderColor) ?? { r: 0.7, g: 0.7, b: 0.7, a: 1 };
    commands.push(`${borderColor.r.toFixed(3)} ${borderColor.g.toFixed(3)} ${borderColor.b.toFixed(3)} RG`);
    commands.push(`${formatNumber(borderPt)} w`);
    commands.push(`${formatNumber(xPt)} ${formatNumber(yPt)} ${formatNumber(widthPt)} ${formatNumber(heightPt)} re`);
    commands.push("S");

    if (data.isDisabled) {
      commands.push(`${formatNumber(xPt)} ${formatNumber(yPt)} ${formatNumber(widthPt)} ${formatNumber(heightPt)} re`);
      commands.push(`${bgColor.r.toFixed(3)} ${bgColor.g.toFixed(3)} ${bgColor.b.toFixed(3)} rg`);
      commands.push("f");
    }

    if (data.value && data.value.length > 0) {
      const textColor = node.color ?? { r: 0, g: 0, b: 0, a: 1 };
      const textX = xPt + paddingPt + borderPt;
      const fontSize = node.textRuns[0]?.fontSize ?? 14;
      const textY = yPt + paddingPt + borderPt + ct.convertPxToPt(fontSize) * 0.35;
      
      commands.push("BT");
      commands.push(`/F1 ${formatNumber(ct.convertPxToPt(fontSize))} Tf`);
      commands.push(`${textColor.r.toFixed(3)} ${textColor.g.toFixed(3)} ${textColor.b.toFixed(3)} rg`);
      commands.push(`${formatNumber(textX)} ${formatNumber(textY)} Td`);
      
      const escapedValue = this.escapePdfString(data.value);
      commands.push(`(${escapedValue}) Tj`);
      commands.push("ET");
    } else if (data.placeholder && data.placeholder.length > 0) {
      const placeholderColor = this.parseRgbaString("153, 153, 153") ?? { r: 0.6, g: 0.6, b: 0.6, a: 1 };
      const textX = xPt + paddingPt + borderPt;
      const fontSize = node.textRuns[0]?.fontSize ?? 14;
      const textY = yPt + paddingPt + borderPt + ct.convertPxToPt(fontSize) * 0.35;
      
      commands.push("BT");
      commands.push(`/F1 ${formatNumber(ct.convertPxToPt(fontSize))} Tf`);
      commands.push(`${placeholderColor.r.toFixed(3)} ${placeholderColor.g.toFixed(3)} ${placeholderColor.b.toFixed(3)} rg`);
      commands.push(`${formatNumber(textX)} ${formatNumber(textY)} Td`);
      
      const escapedPlaceholder = this.escapePdfString(data.placeholder);
      commands.push(`(${escapedPlaceholder}) Tj`);
      commands.push("ET");
    }

    commands.push("Q");

    return { commands, shadings };
  }

  getFormControlData(node: RenderBox): FormControlData | null {
    return this.getFormControlDataInternal(node);
  }

  private getFormControlDataInternal(node: RenderBox): InputControlData | null {
    if (node.customData && 'formControl' in node.customData) {
      const formControl = (node.customData as { formControl: unknown }).formControl;
      if (formControl && typeof formControl === 'object' && 'kind' in formControl && formControl.kind === 'input') {
        return formControl as InputControlData;
      }
    }
    return null;
  }

  private parseColor(color: RGBA | string | undefined): RGBA | null {
    if (!color) return null;
    if (typeof color === 'object' && 'r' in color) {
      return color as RGBA;
    }
    if (typeof color === 'string') {
      return this.parseRgbaString(color);
    }
    return null;
  }

  private parseRgbaString(colorStr: string): RGBA | null {
    const match = colorStr.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) {
      const hexMatch = colorStr.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      if (hexMatch) {
        return {
          r: parseInt(hexMatch[1], 16) / 255,
          g: parseInt(hexMatch[2], 16) / 255,
          b: parseInt(hexMatch[3], 16) / 255,
          a: 1
        };
      }
      return null;
    }
    return {
      r: parseInt(match[1]) / 255,
      g: parseInt(match[2]) / 255,
      b: parseInt(match[3]) / 255,
      a: 1
    };
  }

  private escapePdfString(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F]/g, "");
  }
}
