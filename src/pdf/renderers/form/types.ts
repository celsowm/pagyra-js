export type InputType = 
  | 'text' 
  | 'password' 
  | 'email' 
  | 'number' 
  | 'tel' 
  | 'url' 
  | 'search'
  | 'date'
  | 'time'
  | 'color'
  | 'range'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'hidden';

export type ButtonType = 'submit' | 'reset' | 'button';

export type FormElementKind = 
  | 'input' 
  | 'select' 
  | 'textarea' 
  | 'button';

export interface BaseFormControlData {
  readonly isDisabled?: boolean;
  readonly isRequired?: boolean;
  readonly name?: string;
  readonly id?: string;
}

export interface InputControlData extends BaseFormControlData {
  readonly kind: 'input';
  readonly inputType: InputType;
  readonly value?: string;
  readonly placeholder?: string;
  readonly isChecked?: boolean;
  readonly min?: string | number;
  readonly max?: string | number;
  readonly step?: string | number;
  readonly accept?: string;
  readonly multiple?: boolean;
  readonly readonly?: boolean;
}

export interface SelectOption {
  readonly value: string;
  readonly text: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
}

export interface SelectControlData extends BaseFormControlData {
  readonly kind: 'select';
  readonly options: ReadonlyArray<SelectOption>;
  readonly isMultiple?: boolean;
}

export interface TextareaControlData extends BaseFormControlData {
  readonly kind: 'textarea';
  readonly value?: string;
  readonly placeholder?: string;
  readonly rows?: number;
  readonly cols?: number;
  readonly readonly?: boolean;
  readonly maxlength?: number;
  readonly minlength?: number;
  readonly wrap?: 'soft' | 'hard';
}

export interface ButtonControlData extends BaseFormControlData {
  readonly kind: 'button';
  readonly buttonType: ButtonType;
  readonly value?: string;
}

export type FormControlData = 
  | InputControlData 
  | SelectControlData 
  | TextareaControlData 
  | ButtonControlData;

export function isInputControlData(data: FormControlData): data is InputControlData {
  return data.kind === 'input';
}

export function isSelectControlData(data: FormControlData): data is SelectControlData {
  return data.kind === 'select';
}

export function isTextareaControlData(data: FormControlData): data is TextareaControlData {
  return data.kind === 'textarea';
}

export function isButtonControlData(data: FormControlData): data is ButtonControlData {
  return data.kind === 'button';
}

export function isCheckboxControl(data: FormControlData): boolean {
  return isInputControlData(data) && data.inputType === 'checkbox';
}

export function isRadioControl(data: FormControlData): boolean {
  return isInputControlData(data) && data.inputType === 'radio';
}

export function isTextInputControl(data: FormControlData): boolean {
  if (!isInputControlData(data)) return false;
  return ['text', 'password', 'email', 'number', 'tel', 'url', 'search'].includes(data.inputType);
}
