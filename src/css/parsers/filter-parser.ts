// src/css/parsers/filter-parser.ts

import type { FilterFunction, NumericFilterFunction, BlurFilterFunction,
  HueRotateFilterFunction, DropShadowFilterFunction } from "../properties/visual.js";
import type { StyleAccumulator } from "../style.js";
import { splitCssList } from "../utils.js";
import { parseLength } from "./length-parser.js";
import type { NumericLength } from "../length.js";

// ── Funções expostas ao registro ────────────────────────────────────

export function parseFilter(value: string, target: StyleAccumulator): void {
  const result = parseFilterList(value);
  if (result !== undefined) {
    target.filter = result;
  }
}

export function parseBackdropFilter(value: string, target: StyleAccumulator): void {
  const result = parseFilterList(value);
  if (result !== undefined) {
    target.backdropFilter = result;
  }
}

// ── Lógica de parsing ───────────────────────────────────────────────

/**
 * Parseia a string completa do valor de filter/backdrop-filter.
 * Retorna `undefined` para keywords de herança (inherit/revert),
 * `[]` para `none`/`initial`, ou a lista de funções parseadas.
 *
 * A separação de funções NÃO usa splitCssCommaList — no CSS filter,
 * as funções são separadas por espaço, e os parênteses delimitam
 * cada função. Usamos regex para extrair cada `name(...)`.
 */
export function parseFilterList(value: string): FilterFunction[] | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const keyword = trimmed.toLowerCase();
  if (keyword === "none" || keyword === "initial") return [];
  if (keyword === "inherit" || keyword === "revert" || keyword === "revert-layer") return undefined;

  // Regex para extrair funções: captura "name(" e conteúdo até ")"
  // Respeita parênteses aninhados (ex: drop-shadow com rgb(...))
  const functions = extractFilterFunctions(trimmed);
  if (functions.length === 0) return undefined;

  const result: FilterFunction[] = [];
  for (const { name, args } of functions) {
    const parsed = parseSingleFilterFunction(name, args);
    if (parsed) {
      result.push(parsed);
    }
    // Funções desconhecidas são silenciosamente ignoradas (spec-compliant)
  }

  return result.length > 0 ? result : undefined;
}

// ── Extração de funções ─────────────────────────────────────────────

interface RawFunction {
  name: string;
  args: string;
}

/**
 * Extrai funções CSS da string. Trata parênteses aninhados
 * (necessário para `drop-shadow(2px 2px rgba(0,0,0,0.5))`).
 */
function extractFilterFunctions(input: string): RawFunction[] {
  const results: RawFunction[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    // Pula espaços
    while (i < len && /\s/.test(input[i])) i++;
    if (i >= len) break;

    // Lê nome da função
    const nameStart = i;
    while (i < len && input[i] !== "(" && !/\s/.test(input[i])) i++;
    if (i >= len || input[i] !== "(") break;

    const name = input.slice(nameStart, i).toLowerCase();
    i++; // pula "("

    // Lê argumentos respeitando parênteses aninhados
    let depth = 1;
    const argsStart = i;
    while (i < len && depth > 0) {
      if (input[i] === "(") depth++;
      else if (input[i] === ")") depth--;
      if (depth > 0) i++;
    }

    const args = input.slice(argsStart, i).trim();
    if (depth === 0) i++; // pula ")" final

    results.push({ name, args });
  }

  return results;
}

// ── Parsing de cada função individual ───────────────────────────────

const NUMERIC_FILTER_NAMES = new Set([
  "brightness", "contrast", "grayscale", "sepia", "saturate", "invert", "opacity",
]);

// Funções com clamp em [0, 1]
const CLAMPED_FILTER_NAMES = new Set([
  "grayscale", "sepia", "invert", "opacity",
]);

function parseSingleFilterFunction(name: string, args: string): FilterFunction | null {
  if (NUMERIC_FILTER_NAMES.has(name)) {
    return parseNumericFilter(name as NumericFilterFunction["kind"], args);
  }
  switch (name) {
    case "blur":
      return parseBlurFilter(args);
    case "hue-rotate":
      return parseHueRotateFilter(args);
    case "drop-shadow":
      return parseDropShadowFilter(args);
    default:
      return null; // função desconhecida
  }
}

/**
 * Parseia funções numéricas: `brightness(1.5)`, `opacity(50%)`, etc.
 * - Sem argumento → usa default da spec (1.0 para a maioria).
 * - `%` → dividido por 100.
 * - Clamp para funções com domínio [0,1].
 * - Clamp ≥ 0 para brightness/contrast/saturate.
 */
function parseNumericFilter(kind: NumericFilterFunction["kind"], args: string): NumericFilterFunction | null {
  const trimmed = args.trim();
  let value: number;

  if (trimmed === "") {
    // Spec: sem argumento usa o default (equivale a amount máximo para efeito completo)
    // brightness/contrast/saturate default = 1; grayscale/sepia/invert/opacity default = 1
    value = 1;
  } else if (trimmed.endsWith("%")) {
    const percentStr = trimmed.slice(0, -1);
    const percent = parseFloat(percentStr);
    if (isNaN(percent)) return null;
    value = percent / 100;
  } else {
    value = parseFloat(trimmed);
    if (isNaN(value)) return null;
  }

  // Clamp conforme domínio
  if (CLAMPED_FILTER_NAMES.has(kind)) {
    value = Math.max(0, Math.min(1, value));
  } else {
    // brightness, contrast, saturate: ≥ 0, sem limite superior
    value = Math.max(0, value);
  }

  return { kind, value };
}

/**
 * Parseia `blur(<length>)`.
 * - Sem argumento → `blur(0px)`.
 * - Valor negativo → inválido (descartado).
 */
function parseBlurFilter(args: string): BlurFilterFunction | null {
  const trimmed = args.trim();
  if (trimmed === "") {
    return { kind: "blur", value: 0 };
  }

  const length = parseLength(trimmed);
  if (length === undefined) return null;

  // Blur não aceita valor negativo
  if (typeof length === "number" && length < 0) return null;

  return { kind: "blur", value: length };
}

/**
 * Parseia `hue-rotate(<angle>)`.
 * - Sem argumento → `0deg`.
 * - Suporta `deg`, `rad`, `grad`, `turn`.
 * - Valores negativos são permitidos (rotação anti-horária).
 */
function parseHueRotateFilter(args: string): HueRotateFilterFunction | null {
  const trimmed = args.trim();
  if (trimmed === "") {
    return { kind: "hue-rotate", valueDeg: 0 };
  }

  const deg = parseAngleToDeg(trimmed);
  if (deg === null) return null;

  return { kind: "hue-rotate", valueDeg: deg };
}

function parseAngleToDeg(input: string): number | null {
  const lower = input.toLowerCase();
  if (lower.endsWith("deg")) {
    const v = parseFloat(lower.slice(0, -3));
    return isNaN(v) ? null : v;
  }
  if (lower.endsWith("rad")) {
    const v = parseFloat(lower.slice(0, -3));
    return isNaN(v) ? null : v * (180 / Math.PI);
  }
  if (lower.endsWith("grad")) {
    const v = parseFloat(lower.slice(0, -4));
    return isNaN(v) ? null : v * 0.9;
  }
  if (lower.endsWith("turn")) {
    const v = parseFloat(lower.slice(0, -4));
    return isNaN(v) ? null : v * 360;
  }
  // Número sem unidade: a spec trata "0" como 0deg, outros são inválidos
  const v = parseFloat(lower);
  if (isNaN(v)) return null;
  if (v === 0) return 0;
  return null; // spec exige unidade para valores != 0
}

/**
 * Parseia `drop-shadow(<offset-x> <offset-y> [<blur-radius>]? [<color>]?)`.
 * Mesma lógica do `parseSingleBoxShadow`, mas SEM `inset` e SEM `spread-radius`.
 * Reutiliza `splitCssList` e `parseLength` do projeto.
 */
function parseDropShadowFilter(args: string): DropShadowFilterFunction | null {
  const tokens = splitCssList(args);
  if (tokens.length < 2) return null;

  const lengths: NumericLength[] = [];
  let color: string | undefined;

  for (const token of tokens) {
    const length = parseLength(token);
    if (length !== undefined) {
      lengths.push(length);
      continue;
    }
    if (color === undefined && isColorLike(token)) {
      color = token;
      continue;
    }
    // Token desconhecido ignorado
  }

  if (lengths.length < 2) return null;

  return {
    kind: "drop-shadow",
    offsetX: lengths[0],
    offsetY: lengths[1],
    blurRadius: lengths[2] ?? 0,
    color,
  };
}

function isColorLike(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower.startsWith("#") || lower.startsWith("rgb(") || lower.startsWith("rgba(") ||
      lower.startsWith("hsl(") || lower.startsWith("hsla(")) {
    return true;
  }
  const colorNames = [
    "transparent", "black", "white", "red", "green", "blue",
    "yellow", "gray", "grey", "currentcolor",
  ];
  return colorNames.includes(lower);
}
