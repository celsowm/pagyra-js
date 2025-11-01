export type AspectAlign =
  | "none"
  | "xMinYMin"
  | "xMidYMin"
  | "xMaxYMin"
  | "xMinYMid"
  | "xMidYMid"
  | "xMaxYMid"
  | "xMinYMax"
  | "xMidYMax"
  | "xMaxYMax";

export interface PreserveAspectRatioConfig {
  align: AspectAlign;
  meetOrSlice: "meet" | "slice";
}

export function parsePreserveAspectRatio(raw: string | undefined): PreserveAspectRatioConfig {
  const defaultValue: PreserveAspectRatioConfig = { align: "xMidYMid", meetOrSlice: "meet" };
  if (!raw) {
    return defaultValue;
  }
  const tokens = raw.trim().split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) {
    return defaultValue;
  }

  const validAlignments: Record<string, AspectAlign> = {
    none: "none",
    xminymin: "xMinYMin",
    xmidymin: "xMidYMin",
    xmaxymin: "xMaxYMin",
    xminymid: "xMinYMid",
    xmidymid: "xMidYMid",
    xmaxymid: "xMaxYMid",
    xminymax: "xMinYMax",
    xmidymax: "xMidYMax",
    xmaxymax: "xMaxYMax",
  };

  let index = 0;
  let alignToken = tokens[index]?.toLowerCase() ?? "";
  if (alignToken === "defer") {
    index += 1;
    alignToken = tokens[index]?.toLowerCase() ?? "";
  }
  index += 1;

  let align = validAlignments[alignToken] ?? defaultValue.align;
  if (align === "none") {
    return { align: "none", meetOrSlice: "meet" };
  }

  let meetOrSlice: "meet" | "slice" = "meet";
  for (; index < tokens.length; index += 1) {
    const token = tokens[index]?.toLowerCase();
    if (token === "meet") {
      meetOrSlice = "meet";
      break;
    }
    if (token === "slice") {
      meetOrSlice = "slice";
      break;
    }
  }

  if (!validAlignments[alignToken]) {
    align = defaultValue.align;
  }

  return { align, meetOrSlice };
}

export function getAlignFactors(align: AspectAlign): { x: number; y: number } {
  if (align === "none") {
    return { x: 0, y: 0 };
  }
  const horizontal = align.includes("xMid") ? 0.5 : align.includes("xMax") ? 1 : 0;
  const vertical = align.includes("YMid") ? 0.5 : align.includes("YMax") ? 1 : 0;
  return { x: horizontal, y: vertical };
}
