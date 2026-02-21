import { Display } from "../enums.js";
import { log } from "../../logging/debug.js";

const INLINE_TAGS = new Set([
  "span",
  "a",
  "strong",
  "em",
  "b",
  "s",
  "strike",
  "del",
  "label",
  "code",
  "small",
  "time",
  "i",
  "u",
  "sub",
  "sup",
  "mark",
  "abbr",
  "cite",
  "dfn",
  "kbd",
  "q",
  "tt",
]);

const FORCED_DISPLAY_BY_TAG: Partial<Record<string, Display>> = {
  table: Display.Table,
  thead: Display.TableRowGroup,
  tbody: Display.TableRowGroup,
  tfoot: Display.TableRowGroup,
  tr: Display.TableRow,
  td: Display.TableCell,
  th: Display.TableCell,
};

export function defaultDisplayForTag(tag: string): Display {
  let display: Display;
  if (INLINE_TAGS.has(tag)) {
    display = Display.Inline;
  } else {
    switch (tag) {
      case "table":
        display = Display.Table;
        break;
      case "tbody":
      case "thead":
      case "tfoot":
        display = Display.TableRowGroup;
        break;
      case "tr":
        display = Display.TableRow;
        break;
      case "td":
      case "th":
        display = Display.TableCell;
        break;
      case "caption":
        display = Display.TableCaption;
        break;
      default:
        display = Display.Block;
        break;
    }
  }

  log("style", "trace", "defaultDisplayForTag", { tag, display });
  return display;
}

export function resolveDisplayForElement(
  tagName: string,
  styleDisplay: Display | undefined,
  mergedDefaultDisplay: Display | undefined,
): Display {
  const defaultDisplay = mergedDefaultDisplay ?? defaultDisplayForTag(tagName);
  const computedDisplay = styleDisplay ?? defaultDisplay;

  log("style", "debug", "computeStyleForElement display", {
    tagName,
    styleInitDisplay: styleDisplay,
    defaultDisplay,
    finalDisplay: computedDisplay,
  });

  const forcedDisplay = FORCED_DISPLAY_BY_TAG[tagName];
  if (forcedDisplay !== undefined && computedDisplay !== forcedDisplay) {
    log("style", "debug", "Forcing table display", { tagName, originalDisplay: computedDisplay });
    return forcedDisplay;
  }
  return computedDisplay;
}
