// src/html/dom-converter.ts

import { type DomEl, type CssPseudoElement, type CssRuleEntry } from "./css/parse-css.js";
import { LayoutNode, type LayoutNodeOptions } from "../dom/node.js";
import { ComputedStyle } from "../css/style.js";
import { cloneLineHeight } from "../css/line-height.js";
import { computeStyleForElement, computeStyleForPseudoElement } from "../css/compute-style.js";
import { convertImageElement, resolveImageSource, canLoadHttpResource, type ConversionContext } from "./image-converter.js";
import { Display, WhiteSpace } from "../css/enums.js";
import { parseSvg } from "../svg/parser.js";
import type { SvgRootNode } from "../svg/types.js";
import { ImageService } from "../image/image-service.js";
import type { ImageInfo } from "../image/types.js";
import { log } from "../logging/debug.js";
import { decodeBase64ToUint8Array } from "../utils/base64.js";
import { defaultFormRegistry, extractFormControlData } from "../dom/form-registry.js";
import type { ExtendedDomNode, SvgElement } from "../types/core.js";
import { applyCounterIncrements, applyCounterResets } from "../layout/counter.js";
import { evaluateContent } from "../css/parsers/content-parser.js";

function findMeaningfulSibling(start: Node | null, direction: "previous" | "next"): Node | null {
  let current = start;
  const getNext = direction === "previous"
    ? (node: Node) => node.previousSibling
    : (node: Node) => node.nextSibling;
  while (current) {
    if (current.nodeType === current.TEXT_NODE) {
      const content = current.textContent ?? "";
      if (content.replace(/\s+/g, "").length > 0) {
        return current;
      }
    } else if (current.nodeType === current.ELEMENT_NODE) {
      const tagName = (current as Element).tagName.toLowerCase();
      if (!["script", "style", "meta", "link"].includes(tagName)) {
        return current;
      }
    }
    current = getNext(current);
  }
  return null;
}

function hasMeaningfulPreviousSibling(node: Node): boolean {
  return findMeaningfulSibling(node.previousSibling, "previous") !== null;
}

function hasMeaningfulNextSibling(node: Node): boolean {
  return findMeaningfulSibling(node.nextSibling, "next") !== null;
}

function isInlineDisplay(display: Display): boolean {
  return (
    display === Display.Inline ||
    display === Display.InlineBlock ||
    display === Display.InlineFlex ||
    display === Display.InlineGrid ||
    display === Display.InlineTable
  );
}

function isGridOrFlexContainer(display: Display): boolean {
  return (
    display === Display.Grid ||
    display === Display.InlineGrid ||
    display === Display.Flex ||
    display === Display.InlineFlex
  );
}

function shouldPreserveCollapsedWhitespace(children: LayoutNode[], style: ComputedStyle): boolean {
  if (isGridOrFlexContainer(style.display)) {
    return false;
  }
  if (style.whiteSpace === WhiteSpace.Pre || style.whiteSpace === WhiteSpace.PreWrap) {
    return true;
  }
  const lastChild = children.length > 0 ? children[children.length - 1] : null;
  return !!lastChild && isInlineDisplay(lastChild.style.display);
}

function extractCssUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("url(") && trimmed.endsWith(")")) {
    let inner = trimmed.slice(4, -1).trim();
    if (
      (inner.startsWith("'") && inner.endsWith("'")) ||
      (inner.startsWith("\"") && inner.endsWith("\""))
    ) {
      inner = inner.slice(1, -1);
    }
    return inner;
  }
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith("\"") && trimmed.endsWith("\""))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isDataUri(value: string): boolean {
  return /^data:/i.test(value);
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseSpan(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

async function loadBackgroundImage(
  cssUrl: string,
  context: ConversionContext,
): Promise<{ info: ImageInfo; resolvedSrc: string } | null> {
  const imageService = ImageService.getInstance(context.environment);
  const resolvedSrc = resolveImageSource(cssUrl, context);

  if (isHttpUrl(resolvedSrc) && !canLoadHttpResource(resolvedSrc, context)) {
    log('dom-converter', 'warn', `Skipping remote background image (${resolvedSrc}); remote assets are not supported.`);
    return null;
  }

  try {
    let imageInfo: ImageInfo;
    if (isDataUri(resolvedSrc)) {
      const comma = resolvedSrc.indexOf(",");
      if (comma < 0) {
        log('dom-converter', 'warn', `Unsupported data URI format for background image: ${cssUrl}`);
        return null;
      }
      const meta = resolvedSrc.substring(5, comma);
      const isBase64 = meta.endsWith(";base64");
      const payload = resolvedSrc.substring(comma + 1);
      const bytes = isBase64
        ? decodeBase64ToUint8Array(payload)
        : new TextEncoder().encode(decodeURIComponent(payload));
      const copy = bytes.slice();
      imageInfo = await imageService.decodeImage(copy.buffer);
    } else {
      imageInfo = await imageService.loadImage(resolvedSrc);
    }
    return { info: imageInfo, resolvedSrc };
  } catch (error) {
    log('dom-converter', 'warn', `Failed to load background image ${cssUrl}:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function hydrateBackgroundImages(style: ComputedStyle, context: ConversionContext): Promise<void> {
  if (!style.backgroundLayers || style.backgroundLayers.length === 0) {
    return;
  }

  for (const layer of style.backgroundLayers) {
    if (layer.kind !== "image") {
      continue;
    }
    if (layer.imageInfo) {
      continue;
    }
    const cssUrl = extractCssUrl(layer.url);
    if (!cssUrl) {
      continue;
    }

    const loaded = await loadBackgroundImage(cssUrl, context);
    if (!loaded) {
      continue;
    }
    layer.originalUrl = cssUrl;
    layer.resolvedUrl = loaded.resolvedSrc;
    layer.imageInfo = loaded.info;
  }
}

function createGeneratedTextNode(text: string, parentStyle: ComputedStyle): LayoutNode | null {
  if (text.length === 0) {
    return null;
  }

  const textStyle = new ComputedStyle({
    display: Display.Inline,
    color: parentStyle.color,
    fontSize: parentStyle.fontSize,
    lineHeight: cloneLineHeight(parentStyle.lineHeight),
    fontFamily: parentStyle.fontFamily,
    fontWeight: parentStyle.fontWeight,
    fontStyle: parentStyle.fontStyle,
    letterSpacing: parentStyle.letterSpacing,
    wordSpacing: parentStyle.wordSpacing,
    overflowWrap: parentStyle.overflowWrap,
    whiteSpace: parentStyle.whiteSpace,
    textDecorationLine: parentStyle.textDecorationLine,
    textDecorationColor: parentStyle.textDecorationColor,
    textDecorationStyle: parentStyle.textDecorationStyle,
    textTransform: parentStyle.textTransform,
    transform: parentStyle.transform,
    textShadows: parentStyle.textShadows,
  });

  return new LayoutNode(textStyle, [], {
    textContent: text,
    customData: {
      preserveLeadingSpace: true,
      preserveTrailingSpace: true,
    },
  });
}

function registerCounterScopeForNode(
  style: ComputedStyle,
  context: ConversionContext,
  parentScopeId: string | null,
): string | undefined {
  if (!context.counterContext) {
    return undefined;
  }
  const scopeId = context.counterContext.registerScope(parentScopeId);
  if (style.counterReset && style.counterReset.length > 0) {
    applyCounterResets(context.counterContext, style.counterReset, scopeId);
  }
  if (style.counterIncrement && style.counterIncrement.length > 0) {
    applyCounterIncrements(context.counterContext, style.counterIncrement, scopeId);
  }
  return scopeId;
}

async function synthesizePseudoElement(
  element: DomEl,
  pseudoType: CssPseudoElement,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  context: ConversionContext,
  parentCounterScopeId: string | null,
): Promise<LayoutNode | null> {
  const pseudoStyle = computeStyleForPseudoElement(
    element,
    cssRules,
    pseudoType,
    parentStyle,
    context.units,
    context.rootFontSize,
  );

  if (!pseudoStyle.content) {
    return null;
  }

  await hydrateBackgroundImages(pseudoStyle, context);

  const pseudoScopeId = registerCounterScopeForNode(pseudoStyle, context, parentCounterScopeId);
  const effectiveScopeId = pseudoScopeId ?? parentCounterScopeId;
  const generatedText = evaluateContent(pseudoStyle.content, {
    getCounter: (name) => context.counterContext?.getCounter(name, effectiveScopeId) ?? 0,
    getAttribute: (name) => element.getAttribute(name),
    quoteDepth: 0,
  });

  const children: LayoutNode[] = [];
  const textNode = createGeneratedTextNode(generatedText, pseudoStyle);
  if (textNode) {
    children.push(textNode);
  }

  const pseudoNode = new LayoutNode(pseudoStyle, children, {
    tagName: pseudoType,
    customData: {
      pseudoType: pseudoType === "::before" ? "before" : "after",
    },
  });
  if (pseudoScopeId) {
    pseudoNode.counterScopeId = pseudoScopeId;
  }

  return pseudoNode;
}

export async function convertDomNode(
  node: Node,
  cssRules: CssRuleEntry[],
  parentStyle: ComputedStyle,
  context: ConversionContext,
  parentCounterScopeId: string | null = context.rootCounterScopeId ?? null,
): Promise<LayoutNode | null> {
  const extendedNode = node as unknown as ExtendedDomNode;
  log('dom-converter', 'debug', `convertDomNode - entering function for node type: ${node.nodeType}, tagName: ${extendedNode.tagName || 'text node'}`);
  if (node.nodeType === node.TEXT_NODE) {
    const raw = node.textContent ?? "";
    const collapsed = raw.replace(/\s+/g, " ").normalize("NFC");
    const trimmed = collapsed.trim();

    const hasPrev = hasMeaningfulPreviousSibling(node);
    const hasNext = hasMeaningfulNextSibling(node);

    if (trimmed.length === 0) {
      if (isGridOrFlexContainer(parentStyle.display)) {
        return null;
      }
      const keepSpace = hasPrev && hasNext;
      if (!keepSpace) {
        return null;
      }
      log('dom-converter', 'debug', "convertDomNode - processing text node: (single space)");
      const textStyle = new ComputedStyle({
        display: Display.Inline,
        color: parentStyle.color,
        fontSize: parentStyle.fontSize,
        lineHeight: cloneLineHeight(parentStyle.lineHeight),
        fontFamily: parentStyle.fontFamily,
        fontWeight: parentStyle.fontWeight,
        fontStyle: parentStyle.fontStyle,
        letterSpacing: parentStyle.letterSpacing,
        wordSpacing: parentStyle.wordSpacing,
        textDecorationLine: parentStyle.textDecorationLine,
        textDecorationColor: parentStyle.textDecorationColor,
        textDecorationStyle: parentStyle.textDecorationStyle,
        textTransform: parentStyle.textTransform,
        transform: parentStyle.transform,
        textShadows: parentStyle.textShadows,
      });
      return new LayoutNode(textStyle, [], {
        textContent: " ",
        customData: {
          preserveLeadingSpace: true,
          preserveTrailingSpace: true,
        },
      });
    }

    let text = trimmed;
    const preserveLeading = collapsed.startsWith(" ") && hasPrev;
    const preserveTrailing = collapsed.endsWith(" ") && hasNext;

    if (preserveLeading) {
      text = " " + text;
    }
    if (preserveTrailing) {
      text = text + " ";
    }

    log('dom-converter', 'debug', "convertDomNode - processing text node:", text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    const textStyle = new ComputedStyle({
      display: Display.Inline,
      color: parentStyle.color,
      fontSize: parentStyle.fontSize,
      lineHeight: cloneLineHeight(parentStyle.lineHeight),
      fontFamily: parentStyle.fontFamily,
      fontWeight: parentStyle.fontWeight,
      fontStyle: parentStyle.fontStyle,
      letterSpacing: parentStyle.letterSpacing,
      wordSpacing: parentStyle.wordSpacing,
      textDecorationLine: parentStyle.textDecorationLine,
      textDecorationColor: parentStyle.textDecorationColor,
      textDecorationStyle: parentStyle.textDecorationStyle,
      textTransform: parentStyle.textTransform,
      transform: parentStyle.transform,
      textShadows: parentStyle.textShadows,
    });
    return new LayoutNode(textStyle, [], {
      textContent: text,
      customData: {
        preserveLeadingSpace: preserveLeading,
        preserveTrailingSpace: preserveTrailing,
      },
    });
  }

  if (node.nodeType !== node.ELEMENT_NODE) return null;

  const element = node as unknown as DomEl;
  const tagName = element.tagName.toLowerCase();
  log('dom-converter', 'debug', `convertDomNode - processing element: ${tagName}, with style attr: ${element.getAttribute("style")}`);
  if (tagName === "script" || tagName === "style") return null;

  // Handle image elements
  if (tagName === "img") {
    return await convertImageElement(element, cssRules, parentStyle, context);
  }

  if (tagName === "svg") {
    const ownStyle = computeStyleForElement(element, cssRules, parentStyle, context.units, context.rootFontSize);
    log('dom-converter', 'debug', "convertDomNode - computed style backgroundLayers:", ownStyle.backgroundLayers);
    const svgRoot = parseSvg(element as SvgElement, { warn: (message) => log('svg-parser', 'warn', message) });
    if (!svgRoot) {
      return new LayoutNode(ownStyle, [], { tagName });
    }
    const intrinsic = resolveSvgIntrinsicSize(svgRoot, element as SvgElement);
    return new LayoutNode(ownStyle, [], {
      tagName,
      intrinsicInlineSize: intrinsic.width,
      intrinsicBlockSize: intrinsic.height,
      customData: {
        svg: {
          root: svgRoot,
          intrinsicWidth: intrinsic.width,
          intrinsicHeight: intrinsic.height,
          resourceBaseDir: context?.resourceBaseDir,
          assetRootDir: context?.assetRootDir,
        },
      },
    });
  }

  if (tagName === "br") {
    const textStyle = new ComputedStyle({
      display: Display.Inline,
      color: parentStyle.color,
      fontSize: parentStyle.fontSize,
      lineHeight: cloneLineHeight(parentStyle.lineHeight),
      fontFamily: parentStyle.fontFamily,
      fontWeight: parentStyle.fontWeight,
      fontStyle: parentStyle.fontStyle,
      textTransform: parentStyle.textTransform,
    });
    return new LayoutNode(textStyle, [], { textContent: "\n" });
  }

  if (defaultFormRegistry.isFormElement(tagName)) {
    const formControlData = extractFormControlData(element as SvgElement, tagName);
    if (formControlData) {
      const ownStyle = computeStyleForElement(element, cssRules, parentStyle, context.units, context.rootFontSize);
      await hydrateBackgroundImages(ownStyle, context);
      
      const options: LayoutNodeOptions = { tagName };
      const id = element.getAttribute("id");
      if (id) {
        options.customData = { id, formControl: formControlData };
      } else {
        options.customData = { formControl: formControlData };
      }
      
      return new LayoutNode(ownStyle, [], options);
    }
  }

  // ✅ Coalescing de #text
  const ownStyle = computeStyleForElement(element, cssRules, parentStyle, context.units, context.rootFontSize);
  await hydrateBackgroundImages(ownStyle, context);
  log('dom-converter', 'debug', "convertDomNode - computed style backgroundLayers:", ownStyle.backgroundLayers);
  
  // Log if this is the div element that should have the gradient
  if (element.tagName.toLowerCase() === 'div' && element.getAttribute("style")?.includes('linear-gradient')) {
    log('dom-converter', 'debug', "Found div with gradient style!");
  }
  const elementCounterScopeId = registerCounterScopeForNode(ownStyle, context, parentCounterScopeId) ?? undefined;
  const currentScopeId = elementCounterScopeId ?? parentCounterScopeId;

  const layoutChildren: LayoutNode[] = [];
  const beforePseudo = await synthesizePseudoElement(
    element,
    "::before",
    cssRules,
    ownStyle,
    context,
    currentScopeId,
  );
  if (beforePseudo) {
    layoutChildren.push(beforePseudo);
  }
  let textBuf = "";

  const childNodes = element.childNodes;
  if (!childNodes) {
    return new LayoutNode(ownStyle, [], { tagName });
  }

  for (const child of Array.from(childNodes) as Node[]) {
    if (child.nodeType === child.TEXT_NODE) {
      textBuf += child.textContent ?? "";
      continue;
    }
    if (textBuf) {
      let normalized = textBuf.replace(/\s+/g, " ").normalize("NFC");
      if (normalized.trim().length === 0) {
        normalized = shouldPreserveCollapsedWhitespace(layoutChildren, ownStyle) ? " " : "";
      }
      if (normalized) {
        const preserveLeading = normalized.startsWith(" ");
        const preserveTrailing = normalized.endsWith(" ");
        layoutChildren.push(new LayoutNode(new ComputedStyle({
          display: Display.Inline,
          color: ownStyle.color,
          fontSize: ownStyle.fontSize,
          lineHeight: cloneLineHeight(ownStyle.lineHeight),
          fontFamily: ownStyle.fontFamily,
          fontWeight: ownStyle.fontWeight,
          fontStyle: ownStyle.fontStyle,
          letterSpacing: ownStyle.letterSpacing,
          wordSpacing: ownStyle.wordSpacing,
          overflowWrap: ownStyle.overflowWrap,
          whiteSpace: ownStyle.whiteSpace,
          textDecorationLine: ownStyle.textDecorationLine,
          textDecorationColor: ownStyle.textDecorationColor,
          textDecorationStyle: ownStyle.textDecorationStyle,
          textTransform: ownStyle.textTransform,
          transform: ownStyle.transform,
          textShadows: ownStyle.textShadows,
        }), [], {
          textContent: normalized,
          customData: {
            preserveLeadingSpace: preserveLeading,
            preserveTrailingSpace: preserveTrailing,
          },
        }));
      }
      textBuf = "";
    }
    const sub = await convertDomNode(child, cssRules, ownStyle, context, currentScopeId);
    if (sub) layoutChildren.push(sub);
  }
  if (textBuf) {
    let normalized = textBuf.replace(/\s+/g, " ").normalize("NFC");
    if (normalized.trim().length === 0) {
      normalized = shouldPreserveCollapsedWhitespace(layoutChildren, ownStyle) ? " " : "";
    }
    if (normalized) {
      const preserveLeading = normalized.startsWith(" ");
      const preserveTrailing = normalized.endsWith(" ");
      layoutChildren.push(new LayoutNode(new ComputedStyle({
        display: Display.Inline,
        color: ownStyle.color,
        fontSize: ownStyle.fontSize,
        lineHeight: cloneLineHeight(ownStyle.lineHeight),
        fontFamily: ownStyle.fontFamily,
        fontWeight: ownStyle.fontWeight,
        fontStyle: ownStyle.fontStyle,
        letterSpacing: ownStyle.letterSpacing,
        wordSpacing: ownStyle.wordSpacing,
        overflowWrap: ownStyle.overflowWrap,
        whiteSpace: ownStyle.whiteSpace,
        textDecorationLine: ownStyle.textDecorationLine,
        textDecorationColor: ownStyle.textDecorationColor,
        textDecorationStyle: ownStyle.textDecorationStyle,
        textTransform: ownStyle.textTransform,
        transform: ownStyle.transform,
        textShadows: ownStyle.textShadows,
      }), [], {
        textContent: normalized,
        customData: {
          preserveLeadingSpace: preserveLeading,
          preserveTrailingSpace: preserveTrailing,
        },
      }));
    }
  }

  const afterPseudo = await synthesizePseudoElement(
    element,
    "::after",
    cssRules,
    ownStyle,
    context,
    currentScopeId,
  );
  if (afterPseudo) {
    layoutChildren.push(afterPseudo);
  }

  // Preserve the original HTML ID
  const id = element.getAttribute("id");
  const options: LayoutNodeOptions = { tagName };
  if (tagName === "td" || tagName === "th") {
    options.tableColSpan = parseSpan(element.getAttribute("colspan")) ?? 1;
    options.tableRowSpan = parseSpan(element.getAttribute("rowspan")) ?? 1;
  }
  if (id) {
    options.customData = { ...options.customData, id };
  }
  const layoutNode = new LayoutNode(ownStyle, layoutChildren, options);
  if (elementCounterScopeId) {
    layoutNode.counterScopeId = elementCounterScopeId;
  }
  return layoutNode;
}

function resolveSvgIntrinsicSize(svg: SvgRootNode, element: SvgElement): { width: number; height: number } {
  let width = svg.width;
  let height = svg.height;
  if (svg.viewBox) {
    if (!width || width <= 0) {
      width = svg.viewBox.width;
    }
    if (!height || height <= 0) {
      height = svg.viewBox.height;
    }
  }
  if (!width || width <= 0) {
    width = attributeToNumber(element.getAttribute("width")) ?? 100;
  }
  if (!height || height <= 0) {
    height = attributeToNumber(element.getAttribute("height")) ?? width;
  }
  return {
    width: Number.isFinite(width) && width > 0 ? width : 100,
    height: Number.isFinite(height) && height > 0 ? height : 100,
  };
}

function attributeToNumber(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}
