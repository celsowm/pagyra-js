# Plano Revisado: `filter` e `backdrop-filter` (CSS + PDF)

## 1) Avaliação do plano original

### Pontos fortes
- Acertou em separar parser, tipos e integração no registro de propriedades.
- Identificou corretamente que `backdrop-filter` é o ponto mais difícil no PDF.
- Propôs implementação incremental (MVP primeiro).

### Lacunas técnicas (importantes)
- Faltam pontos obrigatórios do pipeline de estilo: `src/css/ua-defaults/base-defaults.ts` e `src/css/compute-style/overrides.ts`.
- O tipo `opacity-filter` está desalinhado com a função CSS real (`opacity()`).
- O plano presume captura/leitura de pixels no PDF (`captureContent`), mas o `PagePainter` atual é immediate-mode e não tem infraestrutura para isso.
- Não define estratégia de compatibilidade para funções não suportadas no PDF (deve ignorar com warning, sem quebrar render).
- Não cobre impacto em stacking/contexto visual e critérios de aceite objetivos.
- Não define testes mínimos por fase.

---

## 2) Objetivo realista

- Entregar suporte sólido de parsing para `filter` e `backdrop-filter`.
- Entregar suporte PDF **MVP** sem rearquitetura:
  - `filter: opacity(...)` com composição no `opacity` existente.
  - `filter: drop-shadow(...)` como aproximação usando infraestrutura de shadow já existente.
- `blur()/brightness()/contrast()/grayscale()/sepia()/saturate()/hue-rotate()/invert()` e `backdrop-filter`: parsear e transportar no estilo, mas **não renderizar no PDF** por enquanto (com warning).

---

## 3) Referência CSS — Especificação das funções `<filter-function>`

> Ref: [CSS Filter Effects Module Level 1](https://drafts.csswg.org/filter-effects/#FilterFunction)

Cada função tem assinatura, domínio e valor default bem definidos:

| Função | Sintaxe | Domínio | Default | Unidade |
|--------|---------|---------|---------|---------|
| `blur()` | `blur(<length>)` | `≥ 0` | `0px` | `px`, `em`, `rem` |
| `brightness()` | `brightness(<number> \| <percentage>)` | `≥ 0` | `1` / `100%` | adimensional / `%` |
| `contrast()` | `contrast(<number> \| <percentage>)` | `≥ 0` | `1` / `100%` | adimensional / `%` |
| `grayscale()` | `grayscale(<number> \| <percentage>)` | `0..1` | `1` / `100%` | adimensional / `%` |
| `sepia()` | `sepia(<number> \| <percentage>)` | `0..1` | `1` / `100%` | adimensional / `%` |
| `saturate()` | `saturate(<number> \| <percentage>)` | `≥ 0` | `1` / `100%` | adimensional / `%` |
| `hue-rotate()` | `hue-rotate(<angle>)` | ilimitado | `0deg` | `deg`, `rad`, `grad`, `turn` |
| `invert()` | `invert(<number> \| <percentage>)` | `0..1` | `1` / `100%` | adimensional / `%` |
| `opacity()` | `opacity(<number> \| <percentage>)` | `0..1` | `1` / `100%` | adimensional / `%` |
| `drop-shadow()` | `drop-shadow(<offset-x> <offset-y> <blur>? <color>?)` | `blur ≥ 0` | — | mesmas de `box-shadow` |

### Regras de parsing importantes
- `filter: none` reseta para sem filtros.
- Múltiplas funções são separadas por espaço (NÃO por vírgula): `filter: blur(2px) opacity(0.5)`.
- A ordem importa: os filtros são aplicados sequencialmente da esquerda para direita.
- `inherit`, `initial`, `revert`, `revert-layer` devem ser tratados como keywords globais.
- `drop-shadow()` **não** aceita `inset` nem `spread-radius` (diferente de `box-shadow`).
- `<percentage>` é convertido para `<number>` dividindo por 100 (ex: `50%` → `0.5`).
- `<angle>` deve ser normalizado para graus: `1turn = 360deg`, `1rad ≈ 57.2958deg`, `1grad = 0.9deg`.

---

## 4) Plano detalhado por fase

---

### Fase 0 — Contrato e escopo

**Objetivo:** Definir o que será suportado agora e o que fica para roadmap.

#### Matriz de suporte

| Capacidade | CSS Parsing | PDF Render (MVP) |
|------------|-------------|------------------|
| `filter: none` | ✅ | ✅ (no-op) |
| `filter: opacity(...)` | ✅ | ✅ (compõe com `opacity` existente) |
| `filter: drop-shadow(...)` | ✅ | ✅ (aproximação via `ShadowLayer[]`) |
| `filter: blur(...)` | ✅ | ❌ (warning + ignorado) |
| `filter: brightness(...)` | ✅ | ❌ (warning + ignorado) |
| `filter: contrast(...)` | ✅ | ❌ (warning + ignorado) |
| `filter: grayscale(...)` | ✅ | ❌ (warning + ignorado) |
| `filter: sepia(...)` | ✅ | ❌ (warning + ignorado) |
| `filter: saturate(...)` | ✅ | ❌ (warning + ignorado) |
| `filter: hue-rotate(...)` | ✅ | ❌ (warning + ignorado) |
| `filter: invert(...)` | ✅ | ❌ (warning + ignorado) |
| `backdrop-filter` (todas) | ✅ | ❌ (warning + ignorado) |

#### Comportamento para não suportados
- Emitir `log("paint", "warn", "Unsupported filter function ignored: <name>", { function: "<name>" })`.
- Não interromper render. Propriedade fica armazenada no `RenderBox` para uso futuro.
- Seguir padrão do projeto: `warn and continue` (seção 8 do `AGENTS.md`).

---

### Fase 1 — CSS parsing e modelo tipado

#### 1.1 Tipos — `src/css/properties/visual.ts`

Adicionar as definições de tipo abaixo **após** `TextShadowInput`:

```typescript
// ── Filter function types ──────────────────────────────────────────

/** Funções de filtro com argumento numérico (number ou percentage → number) */
export interface NumericFilterFunction {
  kind: "brightness" | "contrast" | "grayscale" | "sepia" | "saturate" | "invert" | "opacity";
  /** Valor normalizado: percentage já convertido para number (50% → 0.5) */
  value: number;
}

/** blur() usa <length>, não número puro */
export interface BlurFilterFunction {
  kind: "blur";
  /** Raio em px (já resolvido de em/rem via NumericLength) */
  value: NumericLength;
}

/** hue-rotate() usa <angle> */
export interface HueRotateFilterFunction {
  kind: "hue-rotate";
  /** Ângulo normalizado em graus */
  valueDeg: number;
}

/**
 * drop-shadow() — subconjunto de box-shadow:
 * NÃO suporta `inset` nem `spread-radius`.
 * Reutiliza NumericLength para offset/blur para resolução posterior em overrides.ts.
 */
export interface DropShadowFilterFunction {
  kind: "drop-shadow";
  offsetX: NumericLength;
  offsetY: NumericLength;
  blurRadius: NumericLength;
  color?: string;
}

/** União de todas as funções de filtro suportadas */
export type FilterFunction =
  | NumericFilterFunction
  | BlurFilterFunction
  | HueRotateFilterFunction
  | DropShadowFilterFunction;
```

O campo `NumericLength` (importado de `../length.ts`) já é `number | RelativeLength`, permitindo valores como `2em` no `blur()`.

Adicionar ao `VisualProperties`:

```typescript
export interface VisualProperties {
  // ... campos existentes ...

  /** CSS filter — lista ordenada de funções (aplicadas da esquerda para direita) */
  filter?: FilterFunction[];

  /** CSS backdrop-filter — mesma estrutura, render diferente */
  backdropFilter?: FilterFunction[];
}
```

#### 1.2 StyleAccumulator — `src/css/style.ts`

Adicionar campos ao `StyleAccumulator` (linha ~179, após `opacity`):

```typescript
export interface StyleAccumulator {
  // ... campos existentes ...
  opacity?: number;

  /** Parsed filter functions (pre-resolution — blur pode ter RelativeLength) */
  filter?: FilterFunction[];

  /** Parsed backdrop-filter functions */
  backdropFilter?: FilterFunction[];
}
```

Importar `FilterFunction` de `./properties/visual.js`.

#### 1.3 ComputedStyle — `src/css/style.ts`

Na classe `ComputedStyle` (linha ~300, após `opacity`):

```typescript
export class ComputedStyle implements StyleProperties {
  // ... campos existentes ...
  opacity: number;
  filter?: FilterFunction[];
  backdropFilter?: FilterFunction[];

  constructor(init?: Partial<StyleProperties>) {
    // ... no constructor, após this.opacity = data.opacity; ...
    this.filter = data.filter ? [...data.filter] : undefined;
    this.backdropFilter = data.backdropFilter ? [...data.backdropFilter] : undefined;
  }
}
```

#### 1.4 Parser — `src/css/parsers/filter-parser.ts` (arquivo novo)

**Responsabilidade:** Parsear a string CSS de `filter`/`backdrop-filter` em `FilterFunction[]`.

**Convenções a seguir** (baseadas no padrão de `text-shadow-parser.ts` e `box-shadow-parser.ts`):
- Importar `splitCssList` de `../utils.js` para tokenização.
- Importar `parseLength` de `./length-parser.js` para valores de comprimento.
- Exportar funções wrapper que recebem `(value: string, target: StyleAccumulator): void`.
- Tratar keywords globais: `none`, `initial` → `[]`; `inherit`, `revert`, `revert-layer` → `undefined` (herda).

```typescript
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
```

**Decisão de design — por que não usar `splitCssCommaList` para separar funções:**

No CSS, `filter` separa funções por **espaço**, não por vírgula. `splitCssList` quebraria dentro de parênteses (como `blur(2px)` → `["blur(2px)"]`), mas NÃO funciona quando temos `blur(2px) opacity(0.5)` porque trataria cada token como item separado. Precisamos de um extractor dedicado `extractFilterFunctions()` que entende a estrutura `name(args)`.

#### 1.5 Registro — `src/css/parsers/register-parsers.ts`

Adicionar no final, após o registro de `opacity`:

```typescript
// Filter
import { parseFilter, parseBackdropFilter } from "./filter-parser.js";

// ... dentro de registerAllPropertyParsers(), após registerPropertyParser("opacity", parseOpacity):
registerPropertyParser("filter", parseFilter);
registerPropertyParser("backdrop-filter", parseBackdropFilter);
registerPropertyParser("-webkit-backdrop-filter", parseBackdropFilter); // vendor prefix comum
```

#### 1.6 Defaults — `src/css/ua-defaults/base-defaults.ts`

No `createBaseDefaultsObject()`, após `opacity: 1`:

```typescript
// Filter (no filter applied by default)
filter: undefined,
backdropFilter: undefined,
```

> **Nota:** Como `undefined` significa "sem filtro", não é necessário atualizar `StyleDefaults` em `types.ts` — o tipo `Partial<...>` já aceita `undefined`.

#### 1.7 Overrides — `src/css/compute-style/overrides.ts`

Dentro de `applyStyleInitOverrides()`, após o bloco de `opacity` (linha ~230):

```typescript
if (styleInit.filter !== undefined) {
  // Resolver unidades relativas em blur() e drop-shadow()
  styleOptions.filter = styleInit.filter.map((fn) => resolveFilterUnits(fn, unitResolver));
}
if (styleInit.backdropFilter !== undefined) {
  styleOptions.backdropFilter = styleInit.backdropFilter.map((fn) => resolveFilterUnits(fn, unitResolver));
}
```

Função helper (no mesmo arquivo ou em um util separado):

```typescript
import type { FilterFunction } from "../properties/visual.js";

function resolveFilterUnits(fn: FilterFunction, unitResolver: CssUnitResolver): FilterFunction {
  switch (fn.kind) {
    case "blur":
      return {
        kind: "blur",
        value: typeof fn.value === "number" ? fn.value : unitResolver.resolveShadowLength(fn.value),
      };
    case "drop-shadow":
      return {
        kind: "drop-shadow",
        offsetX: unitResolver.resolveShadowLength(fn.offsetX),
        offsetY: unitResolver.resolveShadowLength(fn.offsetY),
        blurRadius: unitResolver.resolveShadowLength(fn.blurRadius, true),
        color: fn.color,
      };
    default:
      // Funções numéricas e hue-rotate não têm unidades relativas
      return fn;
  }
}
```

> **Nota:** `unitResolver.resolveShadowLength()` já é usado para `boxShadows` e `textShadows` no mesmo arquivo (linhas 87-103), mantendo consistência.

---

### Fase 2 — Propagação para árvore de render PDF

#### 2.1 RenderBox — `src/pdf/types.ts`

Adicionar campos em `RenderBox` (após `transform?`):

```typescript
export interface RenderBox {
  // ... campos existentes ...
  transform?: TextMatrix;

  /** Parsed CSS filter functions carried from ComputedStyle */
  filter?: FilterFunction[];

  /** Parsed CSS backdrop-filter functions carried from ComputedStyle */
  backdropFilter?: FilterFunction[];
}
```

Importar `FilterFunction` de `../css/properties/visual.js`.

#### 2.2 Layout tree builder — `src/pdf/layout-tree-builder.ts`

Na função `convertNode()`, no objeto de retorno (linha ~214), após `transform`:

```typescript
return {
  // ... campos existentes ...
  transform,
  filter: node.style.filter ? [...node.style.filter] : undefined,
  backdropFilter: node.style.backdropFilter ? [...node.style.backdropFilter] : undefined,
};
```

#### 2.3 Utilitário — `src/pdf/utils/filter-utils.ts` (arquivo novo)

```typescript
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
```

---

### Fase 3 — Render PDF MVP (sem off-screen)

#### 3.1 Alterações em `src/pdf/renderer/box-painter.ts`

Na função `paintBoxAtomic()`, o fluxo atual é:

```
1. beginTransformScope (se transform)
2. beginOpacityScope (se opacity < 1)
3. paintBoxShadows (outer)
4. clipPath
5. paintBackground
6. paintBorder
7. paintBoxShadows (inset)
8. imagem/SVG/form
9. paintText
10. endClipPath
11. endOpacityScope
12. endTransformScope
```

Com filter, o fluxo passa a ser:

```
1. beginTransformScope (se transform)
2. ★ calcular effectiveOpacity = box.opacity * extractOpacityMultiplier(box.filter)
3. ★ beginOpacityScope(effectiveOpacity) — se < 1
4. ★ warn unsupported filters/backdrop-filter
5. ★ paintFilterDropShadows (ANTES dos box-shadows normais)
6. paintBoxShadows (outer)
7. clipPath
8. paintBackground
9. paintBorder
10. paintBoxShadows (inset)
11. imagem/SVG/form
12. paintText
13. endClipPath
14. endOpacityScope
15. endTransformScope
```

Mudanças concretas na função:

```typescript
import {
  extractOpacityMultiplier,
  extractDropShadowLayers,
  warnUnsupportedFilters,
} from "../utils/filter-utils.js";

export async function paintBoxAtomic(painter: PagePainter, box: RenderBox): Promise<void> {
  const hasTransform = box.transform && (box.transform.b !== 0 || box.transform.c !== 0);

  // ★ Compor opacity do filter com opacity do box
  const filterOpacityMultiplier = box.filter ? extractOpacityMultiplier(box.filter) : 1;
  const effectiveOpacity = box.opacity * filterOpacityMultiplier;
  const hasOpacity = effectiveOpacity < 1;

  if (hasTransform) {
    painter.beginTransformScope(box.transform!, box.borderBox);
  }

  if (hasOpacity) {
    painter.beginOpacityScope(effectiveOpacity);
  }

  // ★ Warnings para filtros não renderizáveis
  warnUnsupportedFilters(box.filter, "filter", box.id);
  warnUnsupportedFilters(box.backdropFilter, "backdrop-filter", box.id);

  // ★ drop-shadow do filter (pintado como outer shadow antes dos box-shadows)
  if (box.filter) {
    const fallbackColor = box.color ?? { r: 0, g: 0, b: 0, a: 1 };
    const dropShadows = extractDropShadowLayers(box.filter, fallbackColor);
    if (dropShadows.length > 0) {
      paintDropShadows(painter, box, dropShadows);
    }
  }

  paintBoxShadows(painter, [box], false);

  // ... resto igual ao original ...
}
```

A função `paintDropShadows` reutiliza a infraestrutura existente de `paint-box-shadows.ts`, criando um `RenderBox` virtual com as `ShadowLayer[]` do filter:

```typescript
function paintDropShadows(painter: PagePainter, box: RenderBox, shadows: ShadowLayer[]): void {
  // Usa o borderBox como base da sombra (aproximação para drop-shadow)
  const virtualBox: Partial<RenderBox> = {
    borderBox: box.borderBox,
    borderRadius: box.borderRadius,
    boxShadows: shadows,
  };
  paintBoxShadows(painter, [virtualBox as RenderBox], false);
}
```

#### 3.2 Impacto em stacking context

Segundo a spec CSS, `filter` com qualquer valor diferente de `none` **cria um novo stacking context**. Ajustar em `src/pdf/layout-tree-builder.ts`:

```typescript
const establishesStackingContext =
  (typeof node.style.zIndex === "number" && node.style.position !== Position.Static) ||
  (node.style.filter !== undefined && node.style.filter.length > 0) ||
  (node.style.backdropFilter !== undefined && node.style.backdropFilter.length > 0);
```

---

### Fase 4 — Testes e documentação

#### 4.1 Testes de parsing CSS — `tests/css/filter-parser.spec.ts` (novo)

Casos obrigatórios:

```typescript
import { describe, it, expect } from "vitest";
import { parseFilterList } from "../../src/css/parsers/filter-parser.js";

describe("parseFilterList", () => {
  // Keywords globais
  it("returns [] for 'none'", () => {
    expect(parseFilterList("none")).toEqual([]);
  });
  it("returns [] for 'initial'", () => {
    expect(parseFilterList("initial")).toEqual([]);
  });
  it("returns undefined for 'inherit'", () => {
    expect(parseFilterList("inherit")).toBeUndefined();
  });
  it("returns undefined for 'revert'", () => {
    expect(parseFilterList("revert")).toBeUndefined();
  });
  it("returns undefined for empty string", () => {
    expect(parseFilterList("")).toBeUndefined();
  });

  // Funções individuais
  it("parses blur(5px)", () => {
    const result = parseFilterList("blur(5px)");
    expect(result).toEqual([{ kind: "blur", value: 5 }]);
  });
  it("parses blur() with no args as blur(0px)", () => {
    const result = parseFilterList("blur()");
    expect(result).toEqual([{ kind: "blur", value: 0 }]);
  });
  it("parses brightness(1.5)", () => {
    const result = parseFilterList("brightness(1.5)");
    expect(result).toEqual([{ kind: "brightness", value: 1.5 }]);
  });
  it("parses brightness(150%)", () => {
    const result = parseFilterList("brightness(150%)");
    expect(result).toEqual([{ kind: "brightness", value: 1.5 }]);
  });
  it("parses opacity(50%)", () => {
    const result = parseFilterList("opacity(50%)");
    expect(result).toEqual([{ kind: "opacity", value: 0.5 }]);
  });
  it("clamps opacity to [0, 1]", () => {
    const result = parseFilterList("opacity(200%)");
    expect(result).toEqual([{ kind: "opacity", value: 1 }]);
  });
  it("clamps grayscale to [0, 1]", () => {
    const result = parseFilterList("grayscale(150%)");
    expect(result).toEqual([{ kind: "grayscale", value: 1 }]);
  });
  it("does not clamp brightness above 1", () => {
    const result = parseFilterList("brightness(3)");
    expect(result).toEqual([{ kind: "brightness", value: 3 }]);
  });

  // Ângulos
  it("parses hue-rotate(90deg)", () => {
    const result = parseFilterList("hue-rotate(90deg)");
    expect(result).toEqual([{ kind: "hue-rotate", valueDeg: 90 }]);
  });
  it("parses hue-rotate(0.5turn)", () => {
    const result = parseFilterList("hue-rotate(0.5turn)");
    expect(result).toEqual([{ kind: "hue-rotate", valueDeg: 180 }]);
  });
  it("parses hue-rotate(3.14159rad)", () => {
    const result = parseFilterList("hue-rotate(3.14159rad)");
    expect(result![0].kind).toBe("hue-rotate");
    expect((result![0] as any).valueDeg).toBeCloseTo(180, 1);
  });
  it("parses hue-rotate with negative angle", () => {
    const result = parseFilterList("hue-rotate(-45deg)");
    expect(result).toEqual([{ kind: "hue-rotate", valueDeg: -45 }]);
  });

  // drop-shadow
  it("parses drop-shadow(2px 4px 6px black)", () => {
    const result = parseFilterList("drop-shadow(2px 4px 6px black)");
    expect(result).toEqual([{
      kind: "drop-shadow",
      offsetX: 2,
      offsetY: 4,
      blurRadius: 6,
      color: "black",
    }]);
  });
  it("parses drop-shadow with only offsets", () => {
    const result = parseFilterList("drop-shadow(2px 4px)");
    expect(result).toEqual([{
      kind: "drop-shadow",
      offsetX: 2,
      offsetY: 4,
      blurRadius: 0,
      color: undefined,
    }]);
  });
  it("parses drop-shadow with rgb() color", () => {
    const result = parseFilterList("drop-shadow(1px 1px 3px rgb(255, 0, 0))");
    expect(result![0].kind).toBe("drop-shadow");
    expect((result![0] as any).color).toBe("rgb(255, 0, 0)");
  });

  // Múltiplas funções
  it("parses multiple functions separated by space", () => {
    const result = parseFilterList("blur(2px) opacity(0.5) brightness(1.2)");
    expect(result).toHaveLength(3);
    expect(result![0]).toEqual({ kind: "blur", value: 2 });
    expect(result![1]).toEqual({ kind: "opacity", value: 0.5 });
    expect(result![2]).toEqual({ kind: "brightness", value: 1.2 });
  });

  // Valores inválidos
  it("returns null for unknown function", () => {
    const result = parseFilterList("foo(42)");
    expect(result).toBeUndefined();
  });
  it("drops invalid values but keeps valid ones", () => {
    const result = parseFilterList("blur(5px) unknown(42) opacity(0.8)");
    expect(result).toHaveLength(2);
    expect(result![0].kind).toBe("blur");
    expect(result![1].kind).toBe("opacity");
  });
});
```

#### 4.2 Testes PDF — `tests/pdf/filter-opacity.spec.ts` (novo)

Valida que `filter: opacity(...)` gera o graphics state correto:

```typescript
import { describe, it, expect } from "vitest";
import { extractOpacityMultiplier } from "../../src/pdf/utils/filter-utils.js";
import type { FilterFunction } from "../../src/css/properties/visual.js";

describe("extractOpacityMultiplier", () => {
  it("returns 1 for empty filter list", () => {
    expect(extractOpacityMultiplier([])).toBe(1);
  });
  it("returns value for single opacity()", () => {
    const filters: FilterFunction[] = [{ kind: "opacity", value: 0.5 }];
    expect(extractOpacityMultiplier(filters)).toBe(0.5);
  });
  it("multiplies multiple opacity() filters", () => {
    const filters: FilterFunction[] = [
      { kind: "opacity", value: 0.5 },
      { kind: "opacity", value: 0.5 },
    ];
    expect(extractOpacityMultiplier(filters)).toBe(0.25);
  });
  it("ignores non-opacity filters", () => {
    const filters: FilterFunction[] = [
      { kind: "blur", value: 5 },
      { kind: "opacity", value: 0.7 },
      { kind: "brightness", value: 1.5 },
    ];
    expect(extractOpacityMultiplier(filters)).toBeCloseTo(0.7);
  });
  it("clamps result to [0, 1]", () => {
    const filters: FilterFunction[] = [{ kind: "opacity", value: 0 }];
    expect(extractOpacityMultiplier(filters)).toBe(0);
  });
});
```

#### 4.3 Testes PDF — `tests/pdf/filter-drop-shadow.spec.ts` (novo)

Valida conversão de `drop-shadow()` para `ShadowLayer[]`.

#### 4.4 Testes PDF — `tests/pdf/backdrop-filter-noop.spec.ts` (novo)

Valida que `backdrop-filter` presente não causa erro no render:

```typescript
describe("backdrop-filter no-op", () => {
  it("renders without error when backdrop-filter is present", async () => {
    // Usa renderHtmlToPdf com HTML contendo backdrop-filter
    // Verifica que não lança exceção e produz PDF válido
  });
});
```

#### 4.5 Documentação — `docs/css-properties-support.md`

Adicionar seção:

```markdown
## Filter Effects

| Property | Parsing | PDF Render | Notes |
|----------|---------|------------|-------|
| `filter` | ✅ Full | ⚠️ Partial | `opacity()` and `drop-shadow()` rendered; others stored but ignored with warning |
| `backdrop-filter` | ✅ Full | ❌ Not rendered | Parsed and stored; requires off-screen compositing for PDF support |

### Supported `filter` functions

| Function | PDF Support | Approximation |
|----------|-------------|---------------|
| `opacity()` | ✅ | Composes with `opacity` property via `gs` graphics state |
| `drop-shadow()` | ✅ | Rendered as rectangular box-shadow (not alpha-contour) |
| `blur()` | ❌ | Requires raster pass / Form XObject |
| `brightness()` | ❌ | Requires color matrix transform |
| `contrast()` | ❌ | Requires color matrix transform |
| `grayscale()` | ❌ | Requires color matrix transform |
| `sepia()` | ❌ | Requires color matrix transform |
| `saturate()` | ❌ | Requires color matrix transform |
| `hue-rotate()` | ❌ | Requires color matrix transform |
| `invert()` | ❌ | Requires color matrix transform |
```

---

## 5) Arquivos impactados (MVP)

| Arquivo | Tipo | Ação |
|---------|------|------|
| `src/css/properties/visual.ts` | Existente | Adicionar tipos `FilterFunction` e campos em `VisualProperties` |
| `src/css/style.ts` | Existente | Adicionar `filter`/`backdropFilter` em `StyleAccumulator` e `ComputedStyle` |
| `src/css/ua-defaults/base-defaults.ts` | Existente | Adicionar defaults `filter: undefined, backdropFilter: undefined` |
| `src/css/compute-style/overrides.ts` | Existente | Adicionar resolução de unidades relativas para `blur()` e `drop-shadow()` |
| `src/css/parsers/filter-parser.ts` | **Novo** | Parser completo com `parseFilter`, `parseBackdropFilter`, `parseFilterList` |
| `src/css/parsers/register-parsers.ts` | Existente | Registrar `filter`, `backdrop-filter`, `-webkit-backdrop-filter` |
| `src/pdf/types.ts` | Existente | Adicionar `filter?` e `backdropFilter?` em `RenderBox` |
| `src/pdf/layout-tree-builder.ts` | Existente | Propagar `filter`/`backdropFilter` de `node.style` para `RenderBox` |
| `src/pdf/utils/filter-utils.ts` | **Novo** | `extractOpacityMultiplier`, `extractDropShadowLayers`, `warnUnsupportedFilters` |
| `src/pdf/renderer/box-painter.ts` | Existente | Integrar opacity composition e drop-shadow no fluxo de pintura |
| `tests/css/filter-parser.spec.ts` | **Novo** | Testes completos do parser |
| `tests/pdf/filter-opacity.spec.ts` | **Novo** | Testes do multiplicador de opacity |
| `tests/pdf/filter-drop-shadow.spec.ts` | **Novo** | Testes da conversão drop-shadow → ShadowLayer |
| `tests/pdf/backdrop-filter-noop.spec.ts` | **Novo** | Teste de não-regressão |
| `docs/css-properties-support.md` | Existente | Documentar suporte parcial |

---

## 6) Critérios de aceite

### Parsing
- [ ] `filter: none` → `[]` (sem funções).
- [ ] `filter: blur(5px) opacity(50%) drop-shadow(2px 2px 4px black)` → 3 funções com tipos corretos.
- [ ] `filter: brightness(150%)` → `{ kind: "brightness", value: 1.5 }`.
- [ ] `filter: hue-rotate(0.5turn)` → `{ kind: "hue-rotate", valueDeg: 180 }`.
- [ ] `backdrop-filter: blur(10px)` → parseado e armazenado corretamente.
- [ ] Keywords `inherit`/`revert` retornam `undefined` (não resetam para `[]`).
- [ ] Funções desconhecidas são silenciosamente ignoradas sem quebrar outras.
- [ ] `npm run validate` passa sem regressão em propriedades existentes.

### PDF Render
- [ ] `filter: opacity(0.5)` em um box com `opacity: 0.8` → effective opacity `0.4`, refletido no graphics state `gs`.
- [ ] `filter: drop-shadow(3px 3px 5px red)` → produz sombra visual no PDF (aproximação retangular).
- [ ] `filter: blur(10px)` → não quebra render, emite warning no log.
- [ ] `backdrop-filter: blur(10px) brightness(1.2)` → não quebra render, emite warning no log.
- [ ] PDF gerado com `filter`/`backdrop-filter` abre sem erros em viewers (Adobe, Chrome, etc.).
- [ ] `filter` com qualquer valor ≠ `none` cria stacking context (mesmo que não renderize o efeito).

### Testes
- [ ] `tests/css/filter-parser.spec.ts` — ≥ 15 casos cobrindo todas as funções, edge cases e valores inválidos.
- [ ] `tests/pdf/filter-opacity.spec.ts` — composição de múltiplos opacity, interação com box opacity.
- [ ] `tests/pdf/filter-drop-shadow.spec.ts` — geração de ShadowLayer correto.
- [ ] `tests/pdf/backdrop-filter-noop.spec.ts` — render sem erro.

---

## 7) Roadmap pós-MVP (quando houver necessidade real)

### Nível 1 — Color matrix filters (`brightness`, `contrast`, `grayscale`, `sepia`, `saturate`, `invert`)

**Abordagem:** PDF suporta `/TR` (Transfer Function) e `/TR2` para tone curves, e Form XObjects com Soft Masks com `/BM` (Blend Mode). Uma aproximação possível:

1. Renderizar o conteúdo do box em um Form XObject (off-screen buffer).
2. Aplicar uma Transfer Function que mapeia R, G, B via lookup tables calculadas a partir das matrizes de cor CSS.
3. Referenciá-lo no content stream com `Do`.

**Complexidade:** Média-alta. Requer infraestrutura de Form XObject e cálculo de transfer functions.

### Nível 2 — `blur()` real

**Abordagem:**

1. Rasterizar conteúdo do box como imagem bitmap (usando canvas virtual ou similar).
2. Aplicar gaussian blur na imagem.
3. Inserir a imagem resultante como XObject no PDF.

**Alternativa PDF-nativa:** Usar Soft Mask com `/SMask` e um Form XObject com uma shading function que simula blur. Limitado e impreciso.

**Complexidade:** Alta. Requer rasterização off-screen e processamento de imagem.

### Nível 3 — `backdrop-filter` verdadeiro

**Abordagem:**

1. No momento de pintar um box com `backdrop-filter`, capturar todo o conteúdo já pintado **abaixo** deste box.
2. Aplicar os filtros sobre essa captura.
3. Pintar a captura filtrada como background do box.

**Bloqueador:** O `PagePainter` é immediate-mode — os comandos PDF são emitidos sequencialmente e não há como "voltar" para capturar o que já foi escrito. Seria necessário:
- Mudar para um modelo de double-buffering (pintar tudo em Form XObjects intermediários), ou
- Fazer uma passada de análise prévia para identificar boxes com `backdrop-filter` e rearranjar a ordem de pintura.

**Complexidade:** Muito alta. Requer mudança arquitetural significativa. Deve ser tratado como épico separado.
