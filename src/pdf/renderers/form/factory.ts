import type { RenderBox } from "../../types.js";
import type { IFormRenderer, RenderContext, RenderCommands } from "./irenderer.js";
import type { FormControlData } from "./types.js";
import { InputTextRenderer } from "./input-text-renderer.js";
import { CheckboxRenderer } from "./checkbox-renderer.js";
import { RadioRenderer } from "./radio-renderer.js";
import { SelectRenderer } from "./select-renderer.js";
import { TextareaRenderer } from "./textarea-renderer.js";
import { ButtonRenderer } from "./button-renderer.js";

export class FormRendererFactory {
  private readonly renderers: IFormRenderer[];

  constructor(renderers?: IFormRenderer[]) {
    if (renderers && renderers.length > 0) {
      this.renderers = renderers;
    } else {
      this.renderers = [
        new InputTextRenderer(),
        new CheckboxRenderer(),
        new RadioRenderer(),
        new SelectRenderer(),
        new TextareaRenderer(),
        new ButtonRenderer(),
      ];
    }
  }

  getRenderer(node: RenderBox): IFormRenderer {
    const renderer = this.renderers.find(r => r.canRender(node));
    if (!renderer) {
      throw new Error(`No form renderer found for node kind: ${node.kind}, tagName: ${node.tagName}`);
    }
    return renderer;
  }

  canRender(node: RenderBox): boolean {
    return this.renderers.some(r => r.canRender(node));
  }

  render(node: RenderBox, context: RenderContext): RenderCommands {
    const renderer = this.getRenderer(node);
    return renderer.render(node, context);
  }

  getFormControlData(node: RenderBox): FormControlData | null {
    const renderer = this.renderers.find(r => r.canRender(node));
    if (!renderer) return null;
    return renderer.getFormControlData(node);
  }
}

export const defaultFormRendererFactory = new FormRendererFactory();
