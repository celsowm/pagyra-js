import { LayoutNode } from "../../dom/node.js";
import type { LayoutContext, LayoutStrategy } from "../pipeline/strategy.js";
import { containingBlock } from "../utils/node-math.js";
import { resolveLength } from "../../css/length.js";
import { verticalNonContent, horizontalNonContent } from "../utils/node-math.js";
import { finalizeOverflow } from "../utils/overflow.js";

const DEFAULT_INPUT_WIDTH = 200;
const DEFAULT_INPUT_HEIGHT = 34;
const DEFAULT_TEXTAREA_WIDTH = 300;
const DEFAULT_BUTTON_MIN_WIDTH = 100;
const DEFAULT_BUTTON_HEIGHT = 40;
const DEFAULT_SELECT_HEIGHT = 34;
const DEFAULT_CHECKBOX_SIZE = 16;

export class FormLayoutStrategy implements LayoutStrategy {
  private readonly formTags = new Set(['input', 'select', 'textarea', 'button']);

  canLayout(node: LayoutNode): boolean {
    if (!node.tagName) return false;
    return this.formTags.has(node.tagName.toLowerCase());
  }

  layout(node: LayoutNode, context: LayoutContext): void {
    const cb = containingBlock(node, context.env.viewport);
    const tagName = node.tagName?.toLowerCase() ?? '';
    const formControl = node.customData?.formControl as { kind: string; inputType?: string } | undefined;

    let contentWidth: number;
    let contentHeight: number;

    switch (tagName) {
      case 'input': {
        const inputType = formControl?.inputType ?? 'text';
        if (inputType === 'checkbox' || inputType === 'radio') {
          contentWidth = DEFAULT_CHECKBOX_SIZE;
          contentHeight = DEFAULT_CHECKBOX_SIZE;
        } else if (inputType === 'hidden') {
          contentWidth = 0;
          contentHeight = 0;
        } else {
          contentWidth = resolveLength(node.style.width, cb.width, { auto: DEFAULT_INPUT_WIDTH });
          contentHeight = resolveLength(node.style.height, cb.height, { auto: DEFAULT_INPUT_HEIGHT });
        }
        break;
      }

      case 'select':
        contentWidth = resolveLength(node.style.width, cb.width, { auto: DEFAULT_INPUT_WIDTH });
        contentHeight = resolveLength(node.style.height, cb.height, { auto: DEFAULT_SELECT_HEIGHT });
        break;

      case 'textarea': {
        contentWidth = resolveLength(node.style.width, cb.width, { auto: DEFAULT_TEXTAREA_WIDTH });
        const rows = (formControl as { rows?: number } | undefined)?.rows ?? 3;
        contentHeight = resolveLength(node.style.height, cb.height, { auto: rows * 24 });
        break;
      }

      case 'button':
        contentWidth = resolveLength(node.style.width, cb.width, { auto: DEFAULT_BUTTON_MIN_WIDTH });
        contentHeight = resolveLength(node.style.height, cb.height, { auto: DEFAULT_BUTTON_HEIGHT });
        break;

      default:
        contentWidth = DEFAULT_INPUT_WIDTH;
        contentHeight = DEFAULT_INPUT_HEIGHT;
    }

    node.box.contentWidth = Math.max(0, contentWidth);
    node.box.contentHeight = Math.max(0, contentHeight);

    const horizontalExtras = horizontalNonContent(node, contentWidth);
    node.box.borderBoxWidth = node.box.contentWidth + horizontalExtras;

    const verticalExtras = verticalNonContent(node, contentWidth);
    node.box.borderBoxHeight = node.box.contentHeight + verticalExtras;

    node.box.x = cb.x;
    node.box.y = cb.y;

    const marginLeft = resolveLength(node.style.marginLeft, cb.width, { auto: "zero" });
    const marginRight = resolveLength(node.style.marginRight, cb.width, { auto: "zero" });

    node.box.usedMarginLeft = marginLeft;
    node.box.usedMarginRight = marginRight;

    node.box.marginBoxWidth = node.box.borderBoxWidth + marginLeft + marginRight;
    node.box.marginBoxHeight = node.box.borderBoxHeight + marginLeft + marginRight;

    finalizeOverflow(node);
  }
}
