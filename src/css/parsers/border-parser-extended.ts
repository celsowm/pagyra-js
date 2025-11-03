// src/css/parsers/border-parser-extended.ts

import { BorderModel } from "../enums.js";
import {
  parseBorderCornerRadius,
  parseBorderRadiusShorthand,
  parseBorderWidth as parseBorderWidthValue,
} from "./border-parser.js";
import { parseBoxShadowList } from "./box-shadow-parser.js";
import {
  applyBorderColorShorthand,
  applyBorderStyleShorthand,
  applyBorderShorthand,
  isNoneBorderStyle,
} from "../shorthands/border-shorthand.js";
import { applyBoxShorthand } from "../shorthands/box-shorthand.js";
import type { StyleAccumulator } from "../style.js";
import type { UnitParsers } from "../../units/units.js";

export function parseBorderColor(value: string, target: StyleAccumulator): void {
  applyBorderColorShorthand(value, (color) => {
    target.borderColor = color;
  });
}

export function parseBoxShadow(value: string, target: StyleAccumulator): void {
  const parsed = parseBoxShadowList(value);
  if (parsed !== undefined) {
    target.boxShadows = parsed;
  }
}

export function parseBorder(value: string, target: StyleAccumulator): void {
  applyBorderShorthand(value, (width) => {
    target.borderTop = width;
    target.borderRight = width;
    target.borderBottom = width;
    target.borderLeft = width;
  }, (color) => {
    target.borderColor = color ?? target.borderColor;
  });
}

export function parseBorderTop(value: string, target: StyleAccumulator): void {
  applyBorderShorthand(value, (width) => {
    target.borderTop = width;
  }, (color) => {
    target.borderColor = color ?? target.borderColor;
  });
}

export function parseBorderRight(value: string, target: StyleAccumulator): void {
  applyBorderShorthand(value, (width) => {
    target.borderRight = width;
  }, (color) => {
    target.borderColor = color ?? target.borderColor;
  });
}

export function parseBorderBottom(value: string, target: StyleAccumulator): void {
  applyBorderShorthand(value, (width) => {
    target.borderBottom = width;
  }, (color) => {
    target.borderColor = color ?? target.borderColor;
  });
}

export function parseBorderLeft(value: string, target: StyleAccumulator): void {
  applyBorderShorthand(value, (width) => {
    target.borderLeft = width;
  }, (color) => {
    target.borderColor = color ?? target.borderColor;
  });
}

export function parseBorderRadius(value: string, target: StyleAccumulator): void {
  const parsed = parseBorderRadiusShorthand(value);
  if (parsed) {
    target.borderTopLeftRadiusX = parsed.topLeft.x;
    target.borderTopLeftRadiusY = parsed.topLeft.y;
    target.borderTopRightRadiusX = parsed.topRight.x;
    target.borderTopRightRadiusY = parsed.topRight.y;
    target.borderBottomRightRadiusX = parsed.bottomRight.x;
    target.borderBottomRightRadiusY = parsed.bottomRight.y;
    target.borderBottomLeftRadiusX = parsed.bottomLeft.x;
    target.borderBottomLeftRadiusY = parsed.bottomLeft.y;
  }
}

export function parseBorderTopLeftRadius(value: string, target: StyleAccumulator): void {
  const parsed = parseBorderCornerRadius(value);
  if (parsed) {
    target.borderTopLeftRadiusX = parsed.x;
    target.borderTopLeftRadiusY = parsed.y;
  }
}

export function parseBorderTopRightRadius(value: string, target: StyleAccumulator): void {
  const parsed = parseBorderCornerRadius(value);
  if (parsed) {
    target.borderTopRightRadiusX = parsed.x;
    target.borderTopRightRadiusY = parsed.y;
  }
}

export function parseBorderBottomRightRadius(value: string, target: StyleAccumulator): void {
  const parsed = parseBorderCornerRadius(value);
  if (parsed) {
    target.borderBottomRightRadiusX = parsed.x;
    target.borderBottomRightRadiusY = parsed.y;
  }
}

export function parseBorderBottomLeftRadius(value: string, target: StyleAccumulator): void {
  const parsed = parseBorderCornerRadius(value);
  if (parsed) {
    target.borderBottomLeftRadiusX = parsed.x;
    target.borderBottomLeftRadiusY = parsed.y;
  }
}

export function parseBorderWidth(value: string, target: StyleAccumulator): void {
  applyBoxShorthand(value, (top: number | undefined, right: number | undefined, bottom: number | undefined, left: number | undefined) => {
    target.borderTop = top;
    target.borderRight = right;
    target.borderBottom = bottom;
    target.borderLeft = left;
  }, parseBorderWidthValue);
}

export function parseBorderTopWidth(value: string, target: StyleAccumulator): void {
  target.borderTop = parseBorderWidthValue(value) ?? target.borderTop;
}

export function parseBorderRightWidth(value: string, target: StyleAccumulator): void {
  target.borderRight = parseBorderWidthValue(value) ?? target.borderRight;
}

export function parseBorderBottomWidth(value: string, target: StyleAccumulator): void {
  target.borderBottom = parseBorderWidthValue(value) ?? target.borderBottom;
}

export function parseBorderLeftWidth(value: string, target: StyleAccumulator): void {
  target.borderLeft = parseBorderWidthValue(value) ?? target.borderLeft;
}

export function parseBorderTopColor(value: string, target: StyleAccumulator): void {
  if (value.trim()) {
    target.borderColor = value.trim();
  }
}

export function parseBorderRightColor(value: string, target: StyleAccumulator): void {
  if (value.trim()) {
    target.borderColor = value.trim();
  }
}

export function parseBorderBottomColor(value: string, target: StyleAccumulator): void {
  if (value.trim()) {
    target.borderColor = value.trim();
  }
}

export function parseBorderLeftColor(value: string, target: StyleAccumulator): void {
  if (value.trim()) {
    target.borderColor = value.trim();
  }
}

export function parseBorderStyle(value: string, target: StyleAccumulator): void {
  applyBorderStyleShorthand(value, (style) => {
    if (style === "none" || style === "hidden") {
      target.borderTop = 0;
      target.borderRight = 0;
      target.borderBottom = 0;
      target.borderLeft = 0;
    }
  });
}

export function parseBorderTopStyle(value: string, target: StyleAccumulator): void {
  if (isNoneBorderStyle(value)) {
    target.borderTop = 0;
  }
}

export function parseBorderRightStyle(value: string, target: StyleAccumulator): void {
  if (isNoneBorderStyle(value)) {
    target.borderRight = 0;
  }
}

export function parseBorderBottomStyle(value: string, target: StyleAccumulator): void {
  if (isNoneBorderStyle(value)) {
    target.borderBottom = 0;
  }
}

export function parseBorderLeftStyle(value: string, target: StyleAccumulator): void {
  if (isNoneBorderStyle(value)) {
    target.borderLeft = 0;
  }
}

export function parseBorderCollapse(value: string, target: StyleAccumulator): void {
  const keyword = value.trim().toLowerCase();
  target.borderModel = keyword === "collapse" ? BorderModel.Collapse : BorderModel.Separate;
}
