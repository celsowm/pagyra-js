import { computeStyleForElement } from "../../../css/compute-style.js";
import { ComputedStyle } from "../../../css/style.js";
import { LayoutNode } from "../../../dom/node.js";
import { log } from "../../../logging/debug.js";
import { parseSvg } from "../../../svg/parser.js";
import type { SvgElement } from "../../../types/core.js";
import { resolveSvgIntrinsicSize } from "../helpers.js";
import type { SpecialElementHandler } from "./types.js";

function createSvgNode(
  element: Parameters<SpecialElementHandler>[0]["element"],
  tagName: string,
  cssRules: Parameters<SpecialElementHandler>[0]["cssRules"],
  parentStyle: ComputedStyle,
  context: Parameters<SpecialElementHandler>[0]["context"],
): LayoutNode {
  const ownStyle = computeStyleForElement(element, cssRules, parentStyle, context.units, context.rootFontSize);
  log("dom-converter", "debug", "convertDomNode - computed style backgroundLayers:", ownStyle.backgroundLayers);

  const svgRoot = parseSvg(element as SvgElement, { warn: (message) => log("svg-parser", "warn", message) });
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

export const svgHandler: SpecialElementHandler = ({ element, tagName, cssRules, parentStyle, context }) => {
  return createSvgNode(element, tagName, cssRules, parentStyle, context);
};
