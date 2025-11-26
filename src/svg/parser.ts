import {
  type SvgCircleNode,
  type SvgClipPathNode,
  type SvgCommon,
  type SvgContainerNode,
  type SvgEllipseNode,
  type SvgGradientStop,
  type SvgGroupNode,
  type SvgDefsNode,
  type SvgImageNode,
  type SvgLineNode,
  type SvgLinearGradientNode,
  type SvgNode,
  type SvgNodeType,
  type SvgPathNode,
  type SvgPoint,
  type SvgPolygonNode,
  type SvgPolylineNode,
  type SvgRadialGradientNode,
  type SvgRectNode,
  type SvgRootNode,
  type SvgTextNode,
  type SvgUseNode,
  type SvgViewBox,
} from "./types.js";
import { parseTransform } from "../transform/css-parser.js";
import { ParserRegistry, type SvgParseContext as ImportedSvgParseContext } from "./parser-registry.js";

export interface ParseSvgOptions {
  warn?: (message: string) => void;
  /** Optional custom parser registry. If not provided, uses the default registry. */
  registry?: ParserRegistry;
}

/** @deprecated Use SvgParseContext from parser-registry.ts */
interface SvgParseContext extends ImportedSvgParseContext { }
export type { SvgParseContext as SvgParseContext };

export function parseSvg(element: Element, options: ParseSvgOptions = {}): SvgRootNode | null {
  const warn = options.warn ?? (() => { });
  if (element.tagName.toLowerCase() !== "svg") {
    warn("Expected <svg> root element.");
    return null;
  }
  const context: SvgParseContext = { warn };
  const registry = options.registry ?? defaultParserRegistry;
  const parsed = registry.parse(element, context);
  if (!parsed || parsed.type !== "svg") {
    warn("Unable to parse <svg> element.");
    return null;
  }
  return parsed;
}

/**
 * Parses a generic SVG element into a typed node structure.
 * 
 * @param element - The DOM element to parse
 * @param context - Parsing context
 * @param registry - Optional parser registry (uses default if not provided)
 * @returns Parsed SVG node or null if unsupported
 */
export function parseElement(
  element: Element,
  context: SvgParseContext,
  registry?: ParserRegistry
): SvgNode | null {
  const reg = registry ?? defaultParserRegistry;
  return reg.parse(element, context);
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

function parseDefs(element: Element, context: SvgParseContext): SvgDefsNode | null {
  const base = createContainerBase(element, "defs", context);
  if (!base) {
    return null;
  }
  return {
    ...base,
    type: "defs",
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
  const transformMatrix = transform ? parseTransform(transform) || undefined : undefined;

  return {
    type,
    id: element.getAttribute("id") ?? undefined,
    classes,
    attributes,
    transform,
    transformMatrix,
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

function parseImage(element: Element): SvgImageNode {
  const common = collectCommon(element, "image");
  return {
    ...common,
    type: "image",
    x: parseLength(element.getAttribute("x")),
    y: parseLength(element.getAttribute("y")),
    width: parseLength(element.getAttribute("width")),
    height: parseLength(element.getAttribute("height")),
    href: element.getAttribute("href") || element.getAttribute("xlink:href") || undefined,
    preserveAspectRatio: element.getAttribute("preserveAspectRatio") || undefined,
  };
}

function parseUse(element: Element): SvgUseNode {
  const common = collectCommon(element, "use");
  return {
    ...common,
    type: "use",
    x: parseLength(element.getAttribute("x")),
    y: parseLength(element.getAttribute("y")),
    width: parseLength(element.getAttribute("width")),
    height: parseLength(element.getAttribute("height")),
    href: element.getAttribute("href") || element.getAttribute("xlink:href") || undefined,
  };
}

function parseClipPath(element: Element, context: SvgParseContext): SvgClipPathNode | null {
  const base = createContainerBase(element, "clippath", context);
  if (!base) {
    return null;
  }
  const clipPathUnits = element.getAttribute("clipPathUnits");
  return {
    ...base,
    type: "clippath",
    clipPathUnits: clipPathUnits === "objectBoundingBox" ? "objectBoundingBox" : "userSpaceOnUse",
  };
}

function parseLinearGradient(element: Element, context: SvgParseContext): SvgLinearGradientNode | null {
  const common = collectCommon(element, "lineargradient");
  const stops = parseGradientStops(element, context);
  return {
    ...common,
    type: "lineargradient",
    x1: parseLength(element.getAttribute("x1")) ?? 0,
    y1: parseLength(element.getAttribute("y1")) ?? 0,
    x2: parseLength(element.getAttribute("x2")) ?? 1,
    y2: parseLength(element.getAttribute("y2")) ?? 0,
    gradientUnits: element.getAttribute("gradientUnits") === "userSpaceOnUse" ? "userSpaceOnUse" : "objectBoundingBox",
    spreadMethod: normalizeSpreadMethod(element.getAttribute("spreadMethod")),
    stops,
  };
}

function parseRadialGradient(element: Element, context: SvgParseContext): SvgRadialGradientNode | null {
  const common = collectCommon(element, "radialgradient");
  const stops = parseGradientStops(element, context);
  return {
    ...common,
    type: "radialgradient",
    cx: parseLength(element.getAttribute("cx")) ?? 0.5,
    cy: parseLength(element.getAttribute("cy")) ?? 0.5,
    r: parseLength(element.getAttribute("r")) ?? 0.5,
    fx: parseLength(element.getAttribute("fx")),
    fy: parseLength(element.getAttribute("fy")),
    gradientUnits: element.getAttribute("gradientUnits") === "userSpaceOnUse" ? "userSpaceOnUse" : "objectBoundingBox",
    spreadMethod: normalizeSpreadMethod(element.getAttribute("spreadMethod")),
    stops,
  };
}

function parseGradientStops(element: Element, _context: SvgParseContext): SvgGradientStop[] {
  const stops: SvgGradientStop[] = [];
  for (const child of Array.from(element.children)) {
    if (child.tagName.toLowerCase() === "stop") {
      const offset = parseGradientOffset(child.getAttribute("offset"));
      const color = child.getAttribute("stop-color") || "#000000";
      const opacity = parseOpacity(child.getAttribute("stop-opacity"));
      if (offset !== undefined) {
        stops.push({ offset, color, opacity });
      }
    }
  }
  return stops;
}

function parseGradientOffset(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.endsWith("%")) {
    const value = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(value) ? value / 100 : undefined;
  }
  const value = Number.parseFloat(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

function parseOpacity(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number.parseFloat(raw.trim());
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
}

function normalizeSpreadMethod(method: string | null): "pad" | "reflect" | "repeat" | undefined {
  if (!method) {
    return undefined;
  }
  const lower = method.trim().toLowerCase();
  if (lower === "pad" || lower === "reflect" || lower === "repeat") {
    return lower;
  }
  return undefined;
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

/**
 * Default registry with all standard SVG element parsers pre-registered.
 * 
 * Users can create their own custom registry or extend this one
 * to add support for non-standard elements.
 */
export const defaultParserRegistry = new ParserRegistry();

// Register all standard SVG element parsers
defaultParserRegistry.register("svg", parseSvgRoot);
defaultParserRegistry.register("g", parseGroup);
defaultParserRegistry.register("defs", parseDefs);
defaultParserRegistry.register("rect", parseRect);
defaultParserRegistry.register("circle", parseCircle);
defaultParserRegistry.register("ellipse", parseEllipse);
defaultParserRegistry.register("line", parseLine);
defaultParserRegistry.register("path", parsePath);
defaultParserRegistry.register("polyline", parsePolyline);
defaultParserRegistry.register("polygon", parsePolygon);
defaultParserRegistry.register("text", parseText);
defaultParserRegistry.register("image", parseImage);
defaultParserRegistry.register("use", parseUse);
defaultParserRegistry.register("clippath", parseClipPath);
defaultParserRegistry.register("lineargradient", parseLinearGradient);
defaultParserRegistry.register("radialgradient", parseRadialGradient);

