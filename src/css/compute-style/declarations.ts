import type { CssRuleEntry } from "../../html/css/parse-css.js";
import type { CssPseudoElement } from "../../html/css/parse-css.js";
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

function collectAggregatedDeclarations(
  element: SvgElement,
  cssRules: CssRuleEntry[],
  options?: { pseudoElement?: CssPseudoElement; includeInlineStyle?: boolean },
): Record<string, string> {
  const aggregated: Record<string, string> = {};
  const targetPseudo = options?.pseudoElement;
  const includeInlineStyle = options?.includeInlineStyle ?? true;

  for (const rule of cssRules) {
    if (targetPseudo) {
      if (rule.pseudoElement !== targetPseudo) {
        continue;
      }
    } else if (rule.pseudoElement) {
      continue;
    }

    if (!rule.match(element)) {
      continue;
    }
    log("style", "debug", "CSS rule matched", { selector: rule.selector, declarations: rule.declarations });
    if (rule.declarations.display) {
      log("style", "debug", "Display declaration found", { selector: rule.selector, display: rule.declarations.display });
    }
    Object.assign(aggregated, normalizeRuleDeclarations(rule.declarations));
  }

  if (includeInlineStyle) {
    const inlineStyle = parseInlineStyle(element.getAttribute("style") ?? "");
    if (Object.keys(inlineStyle).length > 0) {
      log("style", "debug", "inline style applied", { declarations: inlineStyle });
    }
    Object.assign(aggregated, inlineStyle);
  }

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

export function resolveDeclarationsForPseudoElement(
  element: SvgElement,
  cssRules: CssRuleEntry[],
  pseudoType: CssPseudoElement,
  parentCustomProperties?: CustomPropertiesMap,
): ResolvedDeclarationsResult {
  const aggregated = collectAggregatedDeclarations(element, cssRules, {
    pseudoElement: pseudoType,
    includeInlineStyle: false,
  });

  let customProperties = parentCustomProperties
    ? parentCustomProperties.clone()
    : new CustomPropertiesMap();

  const pseudoCustomProps = extractCustomProperties(aggregated);
  customProperties = pseudoCustomProps.inherit(customProperties);

  return {
    resolvedDeclarations: resolveDeclarationsWithVariables(aggregated, customProperties),
    customProperties,
  };
}
