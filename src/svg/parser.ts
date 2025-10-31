import {
  type SvgCommon,
  type SvgCircleNode,
  type SvgContainerNode,
  type SvgEllipseNode,
  type SvgGroupNode,
  type SvgLineNode,
  type SvgNode,
  type SvgNodeType,
  type SvgPathNode,
  type SvgPoint,
  type SvgPolygonNode,
  type SvgPolylineNode,
  type SvgRectNode,
  type SvgRootNode,
  type SvgTextNode,
  type SvgViewBox,
} from "./types.js";

export interface ParseSvgOptions {
  warn?: (message: string) => void;
}

interface SvgParseContext {
  warn: (message: string) => void;
}

export function parseSvg(element: Element, options: ParseSvgOptions = {}): SvgRootNode | null {
  const warn = options.warn ?? (() => {});
  if (element.tagName.toLowerCase() !== "svg") {
    warn("Expected <svg> root element.");
    return null;
  }
  const context: SvgParseContext = { warn };
  const parsed = parseElement(element, context);
  if (!parsed || parsed.type !== "svg") {
    warn("Unable to parse <svg> element.");
    return null;
  }
  return parsed;
}

export function parseElement(element: Element, context: SvgParseContext): SvgNode | null {
  const tag = element.tagName.toLowerCase() as SvgNodeType;
  switch (tag) {
    case "svg":
      return parseSvgRoot(element, context);
    case "g":
      return parseGroup(element, context);
    case "rect":
      return parseRect(element);
    case "circle":
      return parseCircle(element);
    case "ellipse":
      return parseEllipse(element);
    case "line":
      return parseLine(element);
    case "path":
      return parsePath(element);
    case "polyline":
      return parsePolyline(element);
    case "polygon":
      return parsePolygon(element);
    case "text":
      return parseText(element);
    default:
      context.warn(`Unsupported <${tag}> element ignored.`);
      return null;
  }
}

function parseSvgRoot(element: Element, context: SvgParseContext): SvgRootNode | null {
  const base = createContainerBase(element, "svg", context);
  if (!base) {
    return null;
  }

  const viewBox = parseViewBox(element.getAttribute("viewBox"));
  const width = parseLength(element.getAttribute("width"));
  const height = parseLength(element.getAttribute("height"));

  return {
    ...base,
    type: "svg",
    width,
    height,
    viewBox,
  };
}

function parseGroup(element: Element, context: SvgParseContext): SvgGroupNode | null {
  const base = createContainerBase(element, "g", context);
  if (!base) {
    return null;
  }
  return {
    ...base,
    type: "g",
  };
}

function parseRect(element: Element): SvgRectNode {
  const common = collectCommon(element, "rect");
  return {
    ...common,
    type: "rect",
    x: parseLength(element.getAttribute("x")),
    y: parseLength(element.getAttribute("y")),
    width: parseLength(element.getAttribute("width")),
    height: parseLength(element.getAttribute("height")),
    rx: parseLength(element.getAttribute("rx")),
    ry: parseLength(element.getAttribute("ry")),
  };
}

function parseCircle(element: Element): SvgCircleNode {
  const common = collectCommon(element, "circle");
  return {
    ...common,
    type: "circle",
    cx: parseLength(element.getAttribute("cx")),
    cy: parseLength(element.getAttribute("cy")),
    r: parseLength(element.getAttribute("r")),
  };
}

function parseEllipse(element: Element): SvgEllipseNode {
  const common = collectCommon(element, "ellipse");
  return {
    ...common,
    type: "ellipse",
    cx: parseLength(element.getAttribute("cx")),
    cy: parseLength(element.getAttribute("cy")),
    rx: parseLength(element.getAttribute("rx")),
    ry: parseLength(element.getAttribute("ry")),
  };
}

function parseLine(element: Element): SvgLineNode {
  const common = collectCommon(element, "line");
  return {
    ...common,
    type: "line",
    x1: parseLength(element.getAttribute("x1")),
    y1: parseLength(element.getAttribute("y1")),
    x2: parseLength(element.getAttribute("x2")),
    y2: parseLength(element.getAttribute("y2")),
  };
}

function parsePath(element: Element): SvgPathNode {
  const common = collectCommon(element, "path");
  return {
    ...common,
    type: "path",
    d: element.getAttribute("d") ?? undefined,
  };
}

function parsePolyline(element: Element): SvgPolylineNode {
  const common = collectCommon(element, "polyline");
  return {
    ...common,
    type: "polyline",
    points: parsePointList(element.getAttribute("points")),
  };
}

function parsePolygon(element: Element): SvgPolygonNode {
  const common = collectCommon(element, "polygon");
  return {
    ...common,
    type: "polygon",
    points: parsePointList(element.getAttribute("points")),
  };
}

function parseText(element: Element): SvgTextNode | null {
  const common = collectCommon(element, "text");
  const raw = element.textContent ?? "";
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }
  return {
    ...common,
    type: "text",
    text,
    x: parseLength(element.getAttribute("x")),
    y: parseLength(element.getAttribute("y")),
    fontSize: parseLength(element.getAttribute("font-size")),
    fontFamily: element.getAttribute("font-family") ?? undefined,
    textAnchor: normalizeTextAnchor(element.getAttribute("text-anchor")),
  };
}

function normalizeTextAnchor(anchor: string | null): "start" | "middle" | "end" | undefined {
  if (!anchor) {
    return undefined;
  }
  const lower = anchor.trim().toLowerCase();
  if (lower === "start" || lower === "middle" || lower === "end") {
    return lower;
  }
  return undefined;
}

function createContainerBase(element: Element, type: SvgContainerNode["type"], context: SvgParseContext): SvgContainerNode | null {
  const common = collectCommon(element, type);
  const children: SvgNode[] = [];
  for (const child of Array.from(element.children)) {
    const parsed = parseElement(child, context);
    if (parsed) {
      children.push(parsed);
    }
  }
  return {
    ...common,
    type,
    children,
  };
}

function collectCommon(element: Element, type: SvgNodeType): SvgCommon {
  const attributes: Record<string, string> = {};
  if (typeof element.getAttributeNames === "function") {
    for (const name of element.getAttributeNames()) {
      const value = element.getAttribute(name);
      if (value !== null) {
        attributes[name] = value;
      }
    }
  } else {
    const rawAttrs = element.attributes ?? [];
    for (const attr of Array.from(rawAttrs)) {
      const value = attr.value;
      if (value !== null) {
        attributes[attr.name] = value;
      }
    }
  }

  const classAttr = element.getAttribute("class");
  const classes = classAttr ? classAttr.split(/\s+/).filter(Boolean) : [];

  const transform = element.getAttribute("transform") ?? undefined;

  return {
    type,
    id: element.getAttribute("id") ?? undefined,
    classes,
    attributes,
    transform,
  };
}

function parseLength(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const match = trimmed.match(/^(-?\d+(\.\d+)?)([a-z%]*)$/i);
  if (!match) {
    return undefined;
  }
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) {
    return undefined;
  }
  const unit = match[3] ?? "";
  if (unit && unit !== "px") {
    return undefined;
  }
  return value;
}

function parseViewBox(raw: string | null): SvgViewBox | undefined {
  if (!raw) {
    return undefined;
  }
  const tokens = raw
    .trim()
    .split(/[\s,]+/)
    .map((chunk) => Number.parseFloat(chunk));
  if (tokens.length !== 4 || tokens.some((value) => !Number.isFinite(value))) {
    return undefined;
  }
  return {
    minX: tokens[0],
    minY: tokens[1],
    width: tokens[2],
    height: tokens[3],
  };
}

function parsePointList(raw: string | null): readonly SvgPoint[] | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const numbers: number[] = [];
  for (const token of trimmed.split(/[\s,]+/)) {
    if (!token) {
      continue;
    }
    const value = Number.parseFloat(token);
    if (!Number.isFinite(value)) {
      return undefined;
    }
    numbers.push(value);
  }
  if (numbers.length % 2 !== 0) {
    return undefined;
  }
  const points: SvgPoint[] = [];
  for (let i = 0; i < numbers.length; i += 2) {
    points.push({ x: numbers[i], y: numbers[i + 1] });
  }
  return points;
}
