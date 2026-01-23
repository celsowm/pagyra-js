import type { FormControlData, InputType, ButtonType, SelectOption } from "../pdf/renderers/form/types.js";

export interface FormElementConfig {
  readonly tagName: string;
  readonly isFormControl: boolean;
  readonly attributeExtractors: readonly string[];
}

export class FormRegistry {
  private readonly elements = new Map<string, FormElementConfig>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.elements.set('input', {
      tagName: 'input',
      isFormControl: true,
      attributeExtractors: ['type', 'value', 'checked', 'disabled', 'placeholder', 'name', 'id', 'min', 'max', 'step', 'accept', 'multiple', 'readonly', 'required']
    });

    this.elements.set('select', {
      tagName: 'select',
      isFormControl: true,
      attributeExtractors: ['multiple', 'disabled', 'name', 'id', 'required']
    });

    this.elements.set('textarea', {
      tagName: 'textarea',
      isFormControl: true,
      attributeExtractors: ['rows', 'cols', 'disabled', 'placeholder', 'name', 'id', 'maxlength', 'minlength', 'readonly', 'required', 'wrap']
    });

    this.elements.set('button', {
      tagName: 'button',
      isFormControl: true,
      attributeExtractors: ['type', 'disabled', 'name', 'id', 'value']
    });
  }

  register(tagName: string, config: FormElementConfig): void {
    this.elements.set(tagName.toLowerCase(), config);
  }

  getConfig(tagName: string): FormElementConfig | undefined {
    return this.elements.get(tagName.toLowerCase());
  }

  isFormElement(tagName: string): boolean {
    const config = this.getConfig(tagName);
    return config?.isFormControl ?? false;
  }
}

export const defaultFormRegistry = new FormRegistry();

export function extractInputType(typeAttr: string | null): InputType {
  const normalized = (typeAttr || 'text').toLowerCase() as InputType;
  const validTypes: InputType[] = [
    'text', 'password', 'email', 'number', 'tel', 'url', 'search',
    'date', 'time', 'color', 'range', 'checkbox', 'radio', 'file', 'hidden'
  ];
  return validTypes.includes(normalized) ? normalized : 'text';
}

export function extractButtonType(typeAttr: string | null): ButtonType {
  const normalized = (typeAttr || 'button').toLowerCase() as ButtonType;
  const validTypes: ButtonType[] = ['submit', 'reset', 'button'];
  return validTypes.includes(normalized) ? normalized : 'button';
}

export function extractBooleanAttribute(element: Element, attrName: string): boolean {
  return element.hasAttribute(attrName) && element.getAttribute(attrName) !== 'false';
}

export function extractSelectOptions(element: Element): SelectOption[] {
  const options: SelectOption[] = [];
  const optionElements = element.querySelectorAll('option');
  
  for (const option of Array.from(optionElements)) {
    options.push({
      value: option.getAttribute('value') ?? option.textContent ?? '',
      text: option.textContent ?? '',
      selected: extractBooleanAttribute(option, 'selected'),
      disabled: extractBooleanAttribute(option, 'disabled')
    });
  }
  
  return options;
}

export function extractFormControlData(
  element: Element,
  tagName: string
): FormControlData | null {
  const config = defaultFormRegistry.getConfig(tagName);
  if (!config) return null;

  const isDisabled = extractBooleanAttribute(element, 'disabled');
  const name = element.getAttribute('name') ?? undefined;
  const id = element.getAttribute('id') ?? undefined;
  const isRequired = extractBooleanAttribute(element, 'required');

  switch (tagName.toLowerCase()) {
    case 'input': {
      const typeAttr = element.getAttribute('type');
      const inputType = extractInputType(typeAttr);
      const value = element.getAttribute('value') ?? undefined;
      const placeholder = element.getAttribute('placeholder') ?? undefined;
      const isChecked = inputType === 'checkbox' || inputType === 'radio'
        ? extractBooleanAttribute(element, 'checked')
        : undefined;
      const min = element.getAttribute('min') ?? undefined;
      const max = element.getAttribute('max') ?? undefined;
      const step = element.getAttribute('step') ?? undefined;
      const accept = inputType === 'file' ? element.getAttribute('accept') ?? undefined : undefined;
      const isMultiple = inputType === 'file' ? extractBooleanAttribute(element, 'multiple') : undefined;
      const readonly = extractBooleanAttribute(element, 'readonly');

      return {
        kind: 'input',
        inputType,
        value,
        placeholder,
        isChecked,
        isDisabled,
        isRequired,
        name,
        id,
        min,
        max,
        step,
        accept,
        multiple: isMultiple,
        readonly
      };
    }

    case 'select': {
      const isMultiple = extractBooleanAttribute(element, 'multiple');
      const options = extractSelectOptions(element);

      return {
        kind: 'select',
        options,
        isMultiple,
        isDisabled,
        isRequired,
        name,
        id
      };
    }

    case 'textarea': {
      const rows = parseInt(element.getAttribute('rows') || '3', 10);
      const cols = parseInt(element.getAttribute('cols') || '20', 10);
      const value = element.getAttribute('value') ?? element.textContent ?? '';
      const placeholder = element.getAttribute('placeholder') ?? undefined;
      const maxlength = parseInt(element.getAttribute('maxlength') || '0', 10) || undefined;
      const minlength = parseInt(element.getAttribute('minlength') || '0', 10) || undefined;
      const wrap = (element.getAttribute('wrap') || 'soft') as 'soft' | 'hard';
      const readonly = extractBooleanAttribute(element, 'readonly');

      return {
        kind: 'textarea',
        value,
        placeholder,
        rows,
        cols,
        maxlength,
        minlength,
        wrap,
        isDisabled,
        isRequired,
        name,
        id,
        readonly
      };
    }

    case 'button': {
      const buttonType = extractButtonType(element.getAttribute('type'));
      const value = element.getAttribute('value') ?? element.textContent ?? '';

      return {
        kind: 'button',
        buttonType,
        value,
        isDisabled,
        name,
        id
      };
    }

    default:
      return null;
  }
}
