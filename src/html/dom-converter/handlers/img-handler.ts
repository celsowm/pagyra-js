import { convertImageElement } from "../../image-converter.js";
import type { SpecialElementHandler } from "./types.js";

export const imgHandler: SpecialElementHandler = async ({ element, cssRules, parentStyle, context }) => {
  return await convertImageElement(element, cssRules, parentStyle, context);
};
