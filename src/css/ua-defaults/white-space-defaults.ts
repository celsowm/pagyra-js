import { WhiteSpace } from "../enums.js";

const ELEMENT_WHITE_SPACE_DEFAULTS: Readonly<Record<string, WhiteSpace>> = {
  pre: WhiteSpace.Pre,
  textarea: WhiteSpace.PreWrap,
};

export function getElementWhiteSpaceDefault(tagName: string): WhiteSpace | undefined {
  return ELEMENT_WHITE_SPACE_DEFAULTS[tagName.toLowerCase()];
}
