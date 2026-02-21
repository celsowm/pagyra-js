import type { CssRuleEntry } from "../../html/css/parse-css.js";
import type { SvgElement } from "../../types/core.js";
import { log } from "../../logging/debug.js";
import { parseInlineStyle } from "../inline-style-parser.js";
import {
  CustomPropertiesMap,
  extractCustomProperties,
  resolveDeclarationsWithVariables,
} from "../custom-properties.js";

export interface ResolvedDeclarationsResult {
  resolvedDeclarations: Record<string, string>;
  customProperties: CustomPropertiesMap;
}

function normalizeRuleDeclarations(declarations: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [property, value] of Object.entries(declarations)) {
    if (property.startsWith("--")) {
      normalized[property] = value;
    } else {
      normalized[property.toLowerCase()] = value;
    }
  }
  return normalized;
}

function collectAggregatedDeclarations(element: SvgElement, cssRules: CssRuleEntry[]): Record<string, string> {
  const aggregated: Record<string, string> = {};

  for (const rule of cssRules) {
    if (!rule.match(element)) {
      continue;
    }
    log("style", "debug", "CSS rule matched", { selector: rule.selector, declarations: rule.declarations });
    if (rule.declarations.display) {
      log("style", "debug", "Display declaration found", { selector: rule.selector, display: rule.declarations.display });
    }
    Object.assign(aggregated, normalizeRuleDeclarations(rule.declarations));
  }

  const inlineStyle = parseInlineStyle(element.getAttribute("style") ?? "");
  if (Object.keys(inlineStyle).length > 0) {
    log("style", "debug", "inline style applied", { declarations: inlineStyle });
  }
  Object.assign(aggregated, inlineStyle);

  return aggregated;
}

export function resolveDeclarationsForElement(
  element: SvgElement,
  cssRules: CssRuleEntry[],
  parentCustomProperties?: CustomPropertiesMap,
): ResolvedDeclarationsResult {
  const aggregated = collectAggregatedDeclarations(element, cssRules);

  let customProperties = parentCustomProperties
    ? parentCustomProperties.clone()
    : new CustomPropertiesMap();

  const elementCustomProps = extractCustomProperties(aggregated);
  customProperties = elementCustomProps.inherit(customProperties);

  log("style", "debug", "custom properties", {
    count: customProperties.size,
    keys: customProperties.keys(),
  });

  return {
    resolvedDeclarations: resolveDeclarationsWithVariables(aggregated, customProperties),
    customProperties,
  };
}
