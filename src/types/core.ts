/**
 * Core type definitions for pagyra-js
 * Centralizes common types to eliminate `any` usage across the codebase
 */

import type { SvgNode, SvgLinearGradientNode, SvgRadialGradientNode } from "../svg/types.js";
import type { LengthLike } from "../css/length.js";
import type { LineHeightValue } from "../css/line-height.js";
import type { StyleProperties } from "../css/style.js";

// ─────────────────────────────────────────────────────────────────────────────
// DOM-like interfaces (for working with parsed HTML elements)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal DOM Element interface for CSS selector matching and style computation.
 * Compatible with browser DOM, linkedom, jsdom, etc.
 */
export interface DomElement {
  readonly nodeType: number;
  readonly tagName: string;
  readonly id?: string;
  readonly classList?: DOMTokenList;
  readonly parentElement: DomElement | null;
  readonly firstElementChild: DomElement | null;
  readonly lastElementChild: DomElement | null;
  readonly nextElementSibling: DomElement | null;
  readonly previousElementSibling: DomElement | null;
  readonly ownerDocument?: { documentElement?: DomElement };
  getAttribute(name: string): string | null;
  hasAttribute?(name: string): boolean;
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
