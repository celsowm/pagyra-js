import { ComputedStyle } from "../css/style.js";
import { computeStyleForElement } from "../css/compute-style.js";
import { Display } from "../css/enums.js";
import { LayoutNode } from "../dom/node.js";
import { convertDomNode } from "../html/dom-converter.js";
import type { CssRuleEntry } from "../html/css/parse-css.js";
import type { ConversionContext } from "../html/image-converter.js";
import { createCounterContext } from "../layout/counter.js";
import { log } from "../logging/debug.js";
import type { SvgElement } from "../types/core.js";
import type { UnitParsers } from "../units/units.js";
import type { Environment } from "../environment/environment.js";
import { selectContentRoot, shouldSkipContentNode } from "./html-parser.js";
import type { InterBlockWhitespaceMode, PagedBodyMarginMode } from "./types.js";

interface BuildRootLayoutContextOptions {
  document: Document;
  cssRules: CssRuleEntry[];
  units: UnitParsers;
  pagedBodyMargin?: PagedBodyMarginMode;
}

export function buildRootLayoutContext(options: BuildRootLayoutContextOptions) {
  const processChildrenOf = selectContentRoot(options.document);
  const baseParentStyle = new ComputedStyle();
  const htmlElement = options.document.documentElement;
  const documentElementStyle = htmlElement
    ? computeStyleForElement(htmlElement as SvgElement, options.cssRules, baseParentStyle, options.units, baseParentStyle.fontSize)
    : baseParentStyle;
  const rootFontSize = documentElementStyle.fontSize;

  let rootStyle: ComputedStyle;
  if (!processChildrenOf || processChildrenOf === htmlElement) {
    rootStyle = documentElementStyle;
  } else {
    rootStyle = computeStyleForElement(processChildrenOf as SvgElement, options.cssRules, documentElementStyle, options.units, rootFontSize);
  }
  if (isInlineDisplay(rootStyle.display)) {
    rootStyle.display = Display.Block;
  }
  if (options.pagedBodyMargin === "zero" && processChildrenOf?.tagName?.toLowerCase() === "body") {
    rootStyle.marginTop = 0;
    rootStyle.marginRight = 0;
    rootStyle.marginBottom = 0;
    rootStyle.marginLeft = 0;
  }

  const rootLayout = new LayoutNode(rootStyle, [], { tagName: processChildrenOf?.tagName?.toLowerCase() });
  return { processChildrenOf, rootStyle, rootLayout, rootFontSize };
}

interface CreateDomConversionContextOptions {
  resourceBaseDir: string;
  assetRootDir: string;
  units: UnitParsers;
  rootFontSize: number;
  environment: Environment;
  interBlockWhitespace?: InterBlockWhitespaceMode;
}

export function createDomConversionContext(options: CreateDomConversionContextOptions): ConversionContext {
  const counterContext = createCounterContext();
  const rootCounterScopeId = counterContext.registerScope(null);
  return {
    resourceBaseDir: options.resourceBaseDir,
    assetRootDir: options.assetRootDir,
    units: options.units,
    rootFontSize: options.rootFontSize,
    environment: options.environment,
    interBlockWhitespace: options.interBlockWhitespace ?? "collapse",
    counterContext,
    rootCounterScopeId,
  };
}

interface AppendConvertedChildrenOptions {
  processChildrenOf: Element | null;
  rootLayout: LayoutNode;
  cssRules: CssRuleEntry[];
  rootStyle: ComputedStyle;
  conversionContext: ConversionContext;
}

export async function appendConvertedChildren(options: AppendConvertedChildrenOptions): Promise<void> {
  const { processChildrenOf, rootLayout, cssRules, rootStyle, conversionContext } = options;
  if (!processChildrenOf) {
    return;
  }

  log("html-to-pdf", "debug", `prepareHtmlRender - processing children of: ${processChildrenOf.tagName}, count: ${processChildrenOf.childNodes.length}`);
  for (const child of Array.from(processChildrenOf.childNodes)) {
    const childTagName = child.nodeType === child.ELEMENT_NODE ? (child as Element).tagName : "text node";
    log("html-to-pdf", "debug", `prepareHtmlRender - processing child: ${childTagName}, type: ${child.nodeType}`);
    if (shouldSkipContentNode(child)) {
      continue;
    }
    const layoutChild = await convertDomNode(child, cssRules, rootStyle, conversionContext);
    if (layoutChild) rootLayout.appendChild(layoutChild);
  }
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

