// src/pdf/utils/filter-utils.ts

import type { FilterFunction } from "../../css/properties/visual.js";
import type { RGBA, ShadowLayer } from "../types.js";
import { parseColor, cloneColor } from "./color-utils.js";
import { log } from "../../logging/debug.js";

/**
 * Extrai o multiplicador de opacity de uma lista de filter functions.
 * Múltiplos `opacity()` são multiplicados entre si (composição sequencial).
 * Retorna 1.0 se não houver `opacity()` na lista.
 */
export function extractOpacityMultiplier(filters: FilterFunction[]): number {
  let multiplier = 1;
  for (const fn of filters) {
    if (fn.kind === "opacity") {
      multiplier *= fn.value;
    }
  }
  return Math.max(0, Math.min(1, multiplier));
}

/**
 * Converte `drop-shadow()` do filter em ShadowLayer[] compatível
 * com o pipeline de box-shadow existente.
 *
 * Diferenças em relação a box-shadow real:
 * - Sem `inset` (sempre false).
 * - Sem `spread-radius` (sempre 0).
 * - Na prática do CSS, drop-shadow segue a forma alpha do conteúdo,
 *   mas no MVP aproximamos como sombra retangular (box-shadow).
 */
export function extractDropShadowLayers(
  filters: FilterFunction[],
  fallbackColor: RGBA,
): ShadowLayer[] {
  const result: ShadowLayer[] = [];
  for (const fn of filters) {
    if (fn.kind !== "drop-shadow") continue;

    const offsetX = typeof fn.offsetX === "number" ? fn.offsetX : 0;
    const offsetY = typeof fn.offsetY === "number" ? fn.offsetY : 0;
    const blur = typeof fn.blurRadius === "number" ? Math.max(0, fn.blurRadius) : 0;

    let color: RGBA;
    if (fn.color) {
      const parsed = parseColor(fn.color);
      color = parsed ? cloneColor(parsed) : cloneColor(fallbackColor);
    } else {
      color = cloneColor(fallbackColor);
    }

    result.push({
      inset: false,
      offsetX,
      offsetY,
      blur,
      spread: 0,
      color,
    });
  }
  return result;
}

/**
 * Lista nomes de funções de filtro que não são renderizáveis no MVP.
 * Usado para emitir warnings durante a fase de pintura.
 */
export function listUnsupportedFilters(filters: FilterFunction[] | undefined): string[] {
  if (!filters || filters.length === 0) return [];

  const unsupported: string[] = [];
  for (const fn of filters) {
    // opacity e drop-shadow são suportados no MVP
    if (fn.kind === "opacity" || fn.kind === "drop-shadow") continue;
    unsupported.push(fn.kind);
  }
  return unsupported;
}

/**
 * Emite warnings para filtros não suportados.
 * Chamado uma vez por box durante a fase de pintura.
 */
export function warnUnsupportedFilters(
  filters: FilterFunction[] | undefined,
  label: "filter" | "backdrop-filter",
  boxId: string,
): void {
  const names = label === "backdrop-filter"
    ? (filters ?? []).map((fn) => fn.kind)
    : listUnsupportedFilters(filters);

  if (names.length === 0) return;

  log("paint", "warn", `Unsupported ${label} function(s) ignored: ${names.join(", ")}`, {
    boxId,
    functions: names,
  });
}
