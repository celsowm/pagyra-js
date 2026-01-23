import type { RenderBox, RGBA } from "../../types.js";
import type { IFormRenderer, RenderContext, RenderCommands } from "./irenderer.js";
import type { FormControlData, InputControlData } from "./types.js";
// import { formatNumber } from "../text-renderer-utils.js";
import { drawRadio } from "./shape-utils.js";

const DEFAULT_RADIO_SIZE = 16;

export class RadioRenderer implements IFormRenderer {
  readonly elementType = 'radio';

  canRender(node: RenderBox): boolean {
    const data = this.getFormControlDataInternal(node);
    return data !== null && data.inputType === 'radio';
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
    const size = Math.min(rect.width, rect.height, DEFAULT_RADIO_SIZE);
    const x = rect.x + (rect.width - size) / 2;
    const y = rect.y + (rect.height - size) / 2;

    const xPt = ct.convertPxToPt(x);
    const yPt = ct.pageHeightPt - ct.convertPxToPt(y + size);
    const sizePt = ct.convertPxToPt(size);

    // const bgColor = node.background?.color ?? { r: 1, g: 1, b: 1, a: 1 };
    const borderColor = node.borderColor ?? { r: 0.6, g: 0.6, b: 0.6, a: 1 };
    const fillColor: RGBA = { r: 0.2, g: 0.4, b: 0.8, a: 1 };

    commands.push("q");

    const fillCommands = drawRadio(xPt, yPt, sizePt, data.isChecked ?? false, fillColor, borderColor);
    commands.push(...fillCommands);

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
}
