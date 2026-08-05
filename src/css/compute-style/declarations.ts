import type {
  CssDeclarationEntry,
  CssPseudoElement,
  CssRuleEntry,
} from "../../html/css/parse-css.js";
import type { SvgElement } from "../../types/core.js";
import { log } from "../../logging/debug.js";
import { parseInlineDeclarations } from "../inline-style-parser.js";
import { computeSpecificity, type Specificity } from "../selectors/specificity.js";
import {
  CustomPropertiesMap,
  extractCustomProperties,
  resolveVariableReferences,
} from "../custom-properties.js";

export interface ResolvedStyleDeclaration {
  property: string;
  value: string;
}

export interface ResolvedDeclarationsResult {
  resolvedDeclarations: Record<string, string>;
  orderedDeclarations: ResolvedStyleDeclaration[];
  customProperties: CustomPropertiesMap;
}

type DeclarationOrigin = "author" | "inline";

interface CascadeCandidate {
  property: string;
  value: string;
  important: boolean;
  origin: DeclarationOrigin;
  specificity: Specificity;
  ruleOrder: number;
  declarationOrder: number;
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

function compareCascadePriority(left: CascadeCandidate, right: CascadeCandidate): number {
  if (left.important !== right.important) {
    return Number(left.important) - Number(right.important);
  }

  const originDifference = originPriority(left.origin) - originPriority(right.origin);
  if (originDifference !== 0) {
    return originDifference;
  }

  const specificityDifference = compareSpecificity(left.specificity, right.specificity);
  if (specificityDifference !== 0) {
    return specificityDifference;
  }

  const ruleOrderDifference = left.ruleOrder - right.ruleOrder;
  if (ruleOrderDifference !== 0) {
    return ruleOrderDifference;
  }
  return left.declarationOrder - right.declarationOrder;
}

function selectorSpecificity(selector: string): Specificity {
  const withoutPseudoElement = selector.replace(/::?(?:before|after)\s*$/i, "").trim() || "*";
  return computeSpecificity(withoutPseudoElement);
}

function fallbackOrderedDeclarations(rule: CssRuleEntry): CssDeclarationEntry[] {
  return Object.entries(rule.declarations).map(([rawProperty, rawValue], sourceOrder) => {
    const parsed = splitImportant(rawValue);
    return {
      property: normalizeProperty(rawProperty),
      value: parsed.value,
      important: parsed.important,
      sourceOrder,
    };
  });
}

function collectCascadeCandidates(
  element: SvgElement,
  cssRules: CssRuleEntry[],
  options?: { pseudoElement?: CssPseudoElement; includeInlineStyle?: boolean },
): CascadeCandidate[] {
  const candidates: CascadeCandidate[] = [];
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

    const specificity = rule.specificity ?? selectorSpecificity(rule.selector);
    const ruleOrder = rule.sourceOrder ?? ruleIndex;
    const declarations = rule.orderedDeclarations ?? fallbackOrderedDeclarations(rule);
    for (const declaration of declarations) {
      candidates.push({
        property: normalizeProperty(declaration.property),
        value: declaration.value,
        important: declaration.important,
        origin: "author",
        specificity,
        ruleOrder,
        declarationOrder: declaration.sourceOrder,
      });
    }
  }

  if (includeInlineStyle) {
    const inlineDeclarations = parseInlineDeclarations(element.getAttribute("style") ?? "");
    if (inlineDeclarations.length > 0) {
      log("style", "debug", "inline style applied", {
        declarations: Object.fromEntries(
          inlineDeclarations.map((declaration) => [declaration.property, declaration.value]),
        ),
      });
    }

    const inlineRuleOrder = cssRules.reduce(
      (highest, rule, index) => Math.max(highest, rule.sourceOrder ?? index),
      -1,
    ) + 1;
    for (const declaration of inlineDeclarations) {
      candidates.push({
        property: normalizeProperty(declaration.property),
        value: declaration.value,
        important: declaration.important,
        origin: "inline",
        specificity: [0, 0, 0],
        ruleOrder: inlineRuleOrder,
        declarationOrder: declaration.sourceOrder,
      });
    }
  }

  return candidates.sort(compareCascadePriority);
}

function resolveCascadedDeclarations(
  candidates: readonly CascadeCandidate[],
  parentCustomProperties?: CustomPropertiesMap,
): ResolvedDeclarationsResult {
  const cascadedValues: Record<string, string> = {};
  for (const candidate of candidates) {
    cascadedValues[candidate.property] = candidate.value;
  }

  let customProperties = parentCustomProperties
    ? parentCustomProperties.clone()
    : new CustomPropertiesMap();
  const elementCustomProps = extractCustomProperties(cascadedValues);
  customProperties = elementCustomProps.inherit(customProperties);

  const orderedDeclarations: ResolvedStyleDeclaration[] = [];
  const resolvedDeclarations: Record<string, string> = {};
  for (const [property, value] of Object.entries(cascadedValues)) {
    if (property.startsWith("--")) {
      resolvedDeclarations[property] = value;
    }
  }

  for (const candidate of candidates) {
    if (candidate.property.startsWith("--")) {
      continue;
    }
    const resolvedValue = resolveVariableReferences(candidate.value, customProperties);
    orderedDeclarations.push({
      property: candidate.property,
      value: resolvedValue,
    });
    resolvedDeclarations[candidate.property] = resolvedValue;
  }

  log("style", "debug", "custom properties", {
    count: customProperties.size,
    keys: customProperties.keys(),
  });

  return {
    resolvedDeclarations,
    orderedDeclarations,
    customProperties,
  };
}

export function resolveDeclarationsForElement(
  element: SvgElement,
  cssRules: CssRuleEntry[],
  parentCustomProperties?: CustomPropertiesMap,
): ResolvedDeclarationsResult {
  return resolveCascadedDeclarations(
    collectCascadeCandidates(element, cssRules),
    parentCustomProperties,
  );
}

export function resolveDeclarationsForPseudoElement(
  element: SvgElement,
  cssRules: CssRuleEntry[],
  pseudoType: CssPseudoElement,
  parentCustomProperties?: CustomPropertiesMap,
): ResolvedDeclarationsResult {
  return resolveCascadedDeclarations(
    collectCascadeCandidates(element, cssRules, {
      pseudoElement: pseudoType,
      includeInlineStyle: false,
    }),
    parentCustomProperties,
  );
}
