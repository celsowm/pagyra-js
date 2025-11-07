import type { TextTransform } from "../css/style.js";

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const DEFAULT_LOCALE = "en-US";

function capitalizeText(text: string): string {
  let result = "";
  let capitalizeNext = true;

  for (const char of text) {
    if (LETTER_OR_NUMBER.test(char)) {
      if (capitalizeNext) {
        result += char.toLocaleUpperCase(DEFAULT_LOCALE);
        capitalizeNext = false;
      } else {
        result += char.toLocaleLowerCase(DEFAULT_LOCALE);
      }
      continue;
    }

    capitalizeNext = true;
    result += char;
  }

  return result;
}

export function applyTextTransform(text: string, transform?: TextTransform): string {
  if (!text || !transform || transform === "none") {
    return text;
  }

  switch (transform) {
    case "uppercase":
      return text.toLocaleUpperCase(DEFAULT_LOCALE);
    case "lowercase":
      return text.toLocaleLowerCase(DEFAULT_LOCALE);
    case "capitalize":
      return capitalizeText(text);
    default:
      return text;
  }
}
