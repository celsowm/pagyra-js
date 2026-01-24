/**
 * Core type definitions for pagyra-js
 * Centralizes common types to eliminate `any` usage across the codebase
 */

import type { SvgNode, SvgLinearGradientNode, SvgRadialGradientNode } from "../svg/types.js";
import type { LengthLike } from "../css/length.js";
import type { LineHeightValue } from "../css/line-height.js";
import type { StyleProperties } from "../css/style.js";
import type { BackgroundLayer } from "../css/background-types.js";
import type { DomLikeElement } from "../css/selectors/matcher.js";

// ─────────────────────────────────────────────────────────────────────────────
// DOM-like interfaces (for working with parsed HTML elements)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal DOM Element interface for CSS selector matching and style computation.
 * Compatible with browser DOM, linkedom, jsdom, etc.
 * Extends DomLikeElement to ensure compatibility with selector matcher.
 */
export interface DomElement extends DomLikeElement {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly childNodes?: ArrayLike<DomNode>;
  readonly textContent?: string | null;
  hasAttribute(name: string): boolean;
  querySelectorAll(selectors: string): DomElement[];
}

/**
 * Union type for SVG parsing - accepts both native Element and DomElement
 */
export type SvgElement = Element | DomElement | DomLikeElement;

/**
 * Type guard to check if a value is a DomElement
 */
export function isDomElement(value: unknown): value is DomElement {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const el = value as Partial<DomElement>;
  return (
    typeof el.nodeType === 'number' &&
    typeof el.tagName === 'string' &&
    typeof el.getAttribute === 'function'
  );
}

/**
 * Minimal DOM Node interface for traversal
 */
export interface DomNode {
  readonly nodeType: number;
  readonly textContent: string | null;
  readonly parentNode: DomNode | null;
  readonly childNodes: ArrayLike<DomNode>;
  readonly firstChild: DomNode | null;
  readonly lastChild: DomNode | null;
  readonly nextSibling: DomNode | null;
  readonly previousSibling: DomNode | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS Property Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolved length value (either a number in px or 'auto')
 */
export type ResolvedLength = number | "auto";

/**
 * CSS unit resolver callback type
 */
export type LengthSetter = (resolved: ResolvedLength) => void;
export type NumberSetter = (resolved: number) => void;

/**
 * Inherited CSS properties passed from parent to child
 */
export interface InheritedStyleProperties {
  color?: string;
  fontSize: number;
  lineHeight: LineHeightValue;
  fontFamily?: string;
  fontStyle?: string;
  fontVariant?: string;
  fontWeight?: number;
  letterSpacing?: number;
  textDecorationLine?: string;
  textDecorationColor?: string;
  textDecorationStyle?: string;
  overflowWrap?: string;
  textIndent: LengthLike;
  textTransform: string;
  listStyleType: string;
}

/**
 * Partial style defaults merged from UA and element-specific rules
 */
export type MergedStyleDefaults = Partial<StyleProperties>;

// ─────────────────────────────────────────────────────────────────────────────
// SVG Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SVG definitions map (id -> gradient, clipPath, or other defs element)
 */
export type SvgDefsMap = Map<string, SvgNode>;

/**
 * SVG gradient node (either linear or radial)
 */
export type SvgGradientNode = SvgLinearGradientNode | SvgRadialGradientNode;

/**
 * Type guard for linear gradient nodes
 */
export function isSvgLinearGradient(node: SvgNode): node is SvgLinearGradientNode {
  return node.type === "lineargradient";
}

/**
 * Type guard for radial gradient nodes
 */
export function isSvgRadialGradient(node: SvgNode): node is SvgRadialGradientNode {
  return node.type === "radialgradient";
}

/**
 * Type guard for gradient nodes (linear or radial)
 */
export function isSvgGradient(node: SvgNode): node is SvgGradientNode {
  return node.type === "lineargradient" || node.type === "radialgradient";
}

/**
 * Check if an SVG node has children (container node)
 */
export function isSvgContainerNode(node: SvgNode): node is SvgNode & { children: SvgNode[] } {
  return "children" in node && Array.isArray((node as { children?: unknown }).children);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF / Font Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PDF document interface for font registration
 */
export interface PdfDocumentLike {
  registerFont?(name: string, data: ArrayBuffer): void;
}

/**
 * Font configuration passed to font registry
 */
export interface FontConfigLike {
  fontFaceDefs?: ReadonlyArray<{ name: string; family: string; weight: number; style: string; src: string }>;
  defaultStack?: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Decoded PNG image data
 */
export interface DecodedPngData {
  width: number;
  height: number;
  data: Uint8Array;
  depth: number;
  colorType: number;
  palette?: Uint8Array;
  transparency?: Uint8Array;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Layout context for inline layout
 */
export interface InlineLayoutContext {
  availableWidth: number;
  lineHeight: number;
  textAlign?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global environment type for browser detection
 */
export interface GlobalEnv {
  window?: { document?: unknown };
  document?: unknown;
  process?: { versions?: { node?: string } };
  Deno?: unknown;
  Bun?: unknown;
}

/**
 * Get the global environment object
 */
export function getGlobalEnv(): GlobalEnv {
  if (typeof globalThis !== "undefined") return globalThis as GlobalEnv;
  if (typeof window !== "undefined") return window as unknown as GlobalEnv;
  if (typeof global !== "undefined") return global as unknown as GlobalEnv;
  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// GlobalThis Extensions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pagyra-specific global environment
 */
export interface PagyraGlobalEnvironment {
  __PAGYRA_ENV__?: unknown;
  __PAGYRA_FONT_BASE__?: string;
  __PAGYRA_FONT_SOURCE__?: string;
  __PAGYRA_USE_GOOGLE_FONTS__?: boolean;
}

/**
 * Extended globalThis with Pagyra properties
 */
export interface ExtendedGlobalThis extends GlobalEnv, PagyraGlobalEnvironment {
  DecompressionStream?: typeof DecompressionStream;
  CompressionStream?: typeof CompressionStream;
}

/**
 * Get the extended globalThis with Pagyra properties
 */
export function getExtendedGlobalThis(): ExtendedGlobalThis {
  return globalThis as ExtendedGlobalThis;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSS transform matrix (2D)
 */
export interface TransformMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

/**
 * CSS transform value (can be a matrix or transform string)
 */
export type TransformValue = TransformMatrix | string;

// ─────────────────────────────────────────────────────────────────────────────
// Context Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rendering context for HTML to PDF conversion
 */
export interface RenderContext {
  resourceBaseDir?: string;
  assetRootDir?: string;
  defs?: SvgDefsMap;
  [key: string]: unknown;
}

/**
 * Layout context for inline layout
 */
export interface LayoutContext {
  availableWidth: number;
  lineHeight: number;
  textAlign?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Font Data Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Font face with embedded data
 */
export interface FontFaceWithData {
  data?: Uint8Array | ArrayBuffer;
  baseFont?: string;
  resourceName?: string;
  [key: string]: unknown;
}

/**
 * Font metrics for glyph rendering
 */
export interface FontMetrics {
  ascent: number;
  descent: number;
  lineGap: number;
  capHeight?: number;
  xHeight?: number;
  unitsPerEm: number;
  getGlyphOutline?(glyphId: number): Path2D | null;
}

/**
 * Unified font with metrics and program
 */
export interface UnifiedFont {
  metrics?: FontMetrics;
  program?: {
    getGlyphOutline?(glyphId: number): Path2D | null;
  };
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Gradient Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Linear gradient definition
 */
export interface LinearGradient {
  type: "linear";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: Array<{ offset: number; color: string }>;
}

/**
 * Radial gradient definition
 */
export interface RadialGradient {
  type: "radial";
  cx: number;
  cy: number;
  r: number;
  fx?: number;
  fy?: number;
  stops: Array<{ offset: number; color: string }>;
}

/**
 * Gradient (linear or radial)
 */
export type Gradient = LinearGradient | RadialGradient;

/**
 * Type guard for linear gradients
 */
export function isLinearGradient(value: unknown): value is LinearGradient {
  const candidate = value as Partial<LinearGradient>;
  return candidate.type === "linear" && Array.isArray(candidate.stops);
}

/**
 * Type guard for radial gradients
 */
export function isRadialGradient(value: unknown): value is RadialGradient {
  const candidate = value as Partial<RadialGradient>;
  return candidate.type === "radial" && typeof candidate.r === "number";
}

/**
 * Type guard for gradients (linear or radial)
 */
export function isGradient(value: unknown): value is Gradient {
  return isLinearGradient(value) || isRadialGradient(value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Readable stream interface
 */
export interface ReadableStreamLike<T = unknown> {
  readonly locked: boolean;
  cancel(reason?: unknown): Promise<void>;
  getReader(): ReadableStreamDefaultReader<T>;
  pipeThrough<T2>(transform: { readable: ReadableStream<T2>; writable: WritableStream<T> }, options?: { signal?: AbortSignal }): ReadableStream<T2>;
  pipeTo(dest: WritableStream<T>, options?: { preventClose?: boolean; preventAbort?: boolean; preventCancel?: boolean; signal?: AbortSignal }): Promise<void>;
  tee(): [ReadableStream<T>, ReadableStream<T>];
}

/**
 * Writable stream interface
 */
export interface WritableStreamLike<T = unknown> {
  readonly locked: boolean;
  abort(reason?: unknown): Promise<void>;
  close(): Promise<void>;
  getWriter(): WritableStreamDefaultWriter<T>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Style Object Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended style properties with transform and shadows
 * Note: This is a separate interface that can be used alongside StyleProperties
 * when additional type information is needed (e.g., parsed transform matrices)
 */
export interface ExtendedStyleProperties {
  transform?: TransformValue;
  textShadows: Array<{
    offsetX: number;
    offsetY: number;
    blurRadius: number;
    color?: string;
  }>;
  backgroundLayers?: BackgroundLayer[];
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Image/Shadow Data Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Image data for rendering
 */
export interface ImageData {
  src: string;
  width: number;
  height: number;
  data?: Uint8Array;
  [key: string]: unknown;
}

/**
 * Glyph mask for text shadow rendering
 */
export interface GlyphMask {
  mask: Uint8Array;
  pos: { x: number; y: number };
  width: number;
  height: number;
}

/**
 * Shadow layer for text shadows
 */
export interface ShadowLayer {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM Node Extensions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended DOM element with additional properties
 */
export interface ExtendedDomElement extends DomElement {
  attributes?: NamedNodeMap;
  className?: string;
  clientHeight?: number;
  clientLeft?: number;
  clientTop?: number;
  clientWidth?: number;
  childNodes?: ArrayLike<DomNode>;
  [key: string]: unknown;
}

/**
 * Extended DOM node with tagName property
 */
export interface ExtendedDomNode extends DomNode {
  tagName?: string;
  [key: string]: unknown;
}
