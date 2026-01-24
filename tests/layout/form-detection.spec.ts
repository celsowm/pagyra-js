import { renderTreeForHtml } from '../helpers/render-utils.js';
import { defaultFormRendererFactory } from '../../src/pdf/renderers/form/factory.js';
import type { RenderBox } from '../../src/pdf/types.js';
import {
  isButtonControlData,
  isInputControlData,
  isSelectControlData,
  isTextareaControlData,
} from '../../src/pdf/renderers/form/types.js';

describe('Form Rendering', () => {
  describe('Form Element Detection', () => {
    it('should detect input text element', async () => {
      const html = '<input type="text" value="test">';
      const tree = await renderTreeForHtml(html);
      const inputs = findFormElements(tree.root, 'input');
      expect(inputs.length).toBe(1);
      
      const formData = defaultFormRendererFactory.getFormControlData(inputs[0]);
      expect(formData).not.toBeNull();
      expect(formData?.kind).toBe('input');
    });

    it('should detect checkbox element', async () => {
      const html = '<input type="checkbox" checked>';
      const tree = await renderTreeForHtml(html);
      const inputs = findFormElements(tree.root, 'input');
      expect(inputs.length).toBe(1);
      
      const formData = defaultFormRendererFactory.getFormControlData(inputs[0]);
      expect(formData).not.toBeNull();
      expect(formData?.kind).toBe('input');
      if (!formData || !isInputControlData(formData)) {
        throw new Error("Expected input control data");
      }
      expect(formData.inputType).toBe('checkbox');
      expect(formData.isChecked).toBe(true);
    });

    it('should detect radio element', async () => {
      const html = '<input type="radio" name="choice" value="a">';
      const tree = await renderTreeForHtml(html);
      const inputs = findFormElements(tree.root, 'input');
      expect(inputs.length).toBe(1);
      
      const formData = defaultFormRendererFactory.getFormControlData(inputs[0]);
      expect(formData).not.toBeNull();
      expect(formData?.kind).toBe('input');
      if (!formData || !isInputControlData(formData)) {
        throw new Error("Expected input control data");
      }
      expect(formData.inputType).toBe('radio');
    });

    it('should detect select element', async () => {
      const html = '<select><option value="1">One</option><option value="2" selected>Two</option></select>';
      const tree = await renderTreeForHtml(html);
      const selects = findFormElements(tree.root, 'select');
      expect(selects.length).toBe(1);
      
      const formData = defaultFormRendererFactory.getFormControlData(selects[0]);
      expect(formData).not.toBeNull();
      expect(formData?.kind).toBe('select');
      if (!formData || !isSelectControlData(formData)) {
        throw new Error("Expected select control data");
      }
      expect(formData.options.length).toBe(2);
      expect(formData.options[1].selected).toBe(true);
    });

    it('should detect textarea element', async () => {
      const html = '<textarea rows="4" cols="30">Initial content</textarea>';
      const tree = await renderTreeForHtml(html);
      const textareas = findFormElements(tree.root, 'textarea');
      expect(textareas.length).toBe(1);
      
      const formData = defaultFormRendererFactory.getFormControlData(textareas[0]);
      expect(formData).not.toBeNull();
      expect(formData?.kind).toBe('textarea');
      if (!formData || !isTextareaControlData(formData)) {
        throw new Error("Expected textarea control data");
      }
      expect(formData.rows).toBe(4);
      expect(formData.value).toBe('Initial content');
    });

    it('should detect button element', async () => {
      const html = '<button type="submit">Click Me</button>';
      const tree = await renderTreeForHtml(html);
      const buttons = findFormElements(tree.root, 'button');
      expect(buttons.length).toBe(1);
      
      const formData = defaultFormRendererFactory.getFormControlData(buttons[0]);
      expect(formData).not.toBeNull();
      expect(formData?.kind).toBe('button');
      if (!formData || !isButtonControlData(formData)) {
        throw new Error("Expected button control data");
      }
      expect(formData.buttonType).toBe('submit');
      expect(formData.value).toBe('Click Me');
    });
  });

  describe('Form Renderer Factory', () => {
    it('should return true for canRender with form elements', async () => {
      const tests = [
        '<input type="text">',
        '<input type="checkbox">',
        '<input type="radio">',
        '<select><option>A</option></select>',
        '<textarea></textarea>',
        '<button>OK</button>',
      ];

      for (const html of tests) {
        const tree = await renderTreeForHtml(html);
        const formElement = findFirstFormElement(tree.root);
        if (formElement) {
          expect(defaultFormRendererFactory.canRender(formElement)).toBe(true);
        }
      }
    });

    it('should return false for canRender with non-form elements', async () => {
      const html = '<div>Content</div>';
      const tree = await renderTreeForHtml(html);
      
      expect(defaultFormRendererFactory.canRender(tree.root)).toBe(false);
    });
  });
});

function findFormElements(root: RenderBox, tagName: string): RenderBox[] {
  const results: RenderBox[] = [];
  if (root.tagName?.toLowerCase() === tagName) {
    results.push(root);
  }
  for (const child of (root.children ?? [])) {
    results.push(...findFormElements(child, tagName));
  }
  return results;
}

function findFirstFormElement(root: RenderBox): RenderBox | null {
  if (root.customData && "formControl" in root.customData) {
    return root;
  }
  for (const child of (root.children ?? [])) {
    const found = findFirstFormElement(child);
    if (found) return found;
  }
  return null;
}
