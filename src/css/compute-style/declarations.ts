import type { CssRuleEntry } from "../../html/css/parse-css.js";
import type { CssPseudoElement } from "../../html/css/parse-css.js";
import type { SvgElement } from "../../types/core.js";
import { log } from "../../logging/debug.js";
import { parseInlineStyle } from "../inline-style-parser.js";
import { computeSpecificity, type Specificity } from "../selectors/specificity.js";
import {
  CustomPropertiesMap,
  extractCustomProperties,
  resolveDeclarationsWithVariables,
} from "../custom-properties.js";

export interface ResolvedDeclarationsResult {
  resolvedDeclarations: Record<string, string>;
  customProperties: CustomPropertiesMap;
}

type DeclarationOrigin = "author" | "inline";

interface CascadeCandidate {
  property: string;
  value: string;
  important: boolean;
  origin: DeclarationOrigin;
  specificity: Specificity;
  sourceOrder: number;
}

function normalizeProperty(property: string): string {
  return property.startsWith("--") ? property : property.toLowerCase();
}

function splitImportant(value: string): { value: string; important: boolean } {
  const match = /!\s*important\s*$/i.exec(value);
  if (!match || match.index === undefined) {
    return { value: value.trim(), important: false };
  }
  return {
    value: value.slice(0, match.index).trim(),
    important: true,
  };
}

function compareSpecificity(left: Specificity, right: Specificity): number {
  for (let index = 0; index < left.length; index++) {
    const difference = left[index] - right[index];
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function originPriority(origin: DeclarationOrigin): number {
  return origin === "inline" ? 1 : 0;
}

function shouldReplaceWinner(current: CascadeCandidate | undefined, next: CascadeCandidate): boolean {
  if (!current) {
    return true;
  }
  if (current.important !== next.important) {
    return next.important;
  }

  const originDifference = originPriority(next.origin) - originPriority(current.origin);
  if (originDifference !== 0) {
    return originDifference > 0;
  }

  const specificityDifference = compareSpecificity(next.specificity, current.specificity);
  if (specificityDifference !== 0) {
    return specificityDifference > 0;
  }

  return next.sourceOrder >= current.sourceOrder;
}

function selectorSpecificity(selector: string): Specificity {
  const withoutPseudoElement = selector.replace(/::?(?:before|after)\s*$/i, "").trim() || "*";
  return computeSpecificity(withoutPseudoElement);
}

function applyCandidate(
  winners: Map<string, CascadeCandidate>,
  candidate: CascadeCandidate,
): void {
  if (shouldReplaceWinner(winners.get(candidate.property), candidate)) {
    winners.set(candidate.property, candidate);
  }
}

function collectAggregatedDeclarations(
  element: SvgElement,
  cssRules: CssRuleEntry[],
  options?: { pseudoElement?: CssPseudoElement; includeInlineStyle?: boolean },
): Record<string, string> {
  const winners = new Map<string, CascadeCandidate>();
  const targetPseudo = options?.pseudoElement;
  const includeInlineStyle = options?.includeInlineStyle ?? true;

  for (let ruleIndex = 0; ruleIndex < cssRules.length; ruleIndex++) {
    const rule = cssRules[ruleIndex];
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

    const specificity = selectorSpecificity(rule.selector);
    const entries = Object.entries(rule.declarations);
    for (let declarationIndex = 0; declarationIndex < entries.length; declarationIndex++) {
      const [rawProperty, rawValue] = entries[declarationIndex];
      const property = normalizeProperty(rawProperty);
      const parsed = splitImportant(rawValue);
      applyCandidate(winners, {
        property,
        value: parsed.value,
        important: parsed.important,
        origin: "author",
        specificity,
        sourceOrder: ruleIndex * 1_000_000 + declarationIndex,
      });
    }
  }

  if (includeInlineStyle) {
    const inlineStyle = parseInlineStyle(element.getAttribute("style") ?? "");
    if (Object.keys(inlineStyle).length > 0) {
      log("style", "debug", "inline style applied", { declarations: inlineStyle });
    }

    const entries = Object.entries(inlineStyle);
    for (let declarationIndex = 0; declarationIndex < entries.length; declarationIndex++) {
      const [rawProperty, rawValue] = entries[declarationIndex];
      const property = normalizeProperty(rawProperty);
      const parsed = splitImportant(rawValue);
      applyCandidate(winners, {
        property,
        value: parsed.value,
        important: parsed.important,
        origin: "inline",
        specificity: [0, 0, 0],
        sourceOrder: cssRules.length * 1_000_000 + declarationIndex,
      });
    }
  }

  const aggregated: Record<string, string> = {};
  for (const [property, candidate] of winners) {
    aggregated[property] = candidate.value;
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
