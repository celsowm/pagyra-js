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

## 2) Objetivo realista

- Entregar suporte sólido de parsing para `filter` e `backdrop-filter`.
- Entregar suporte PDF **MVP** sem rearquitetura:
  - `filter: opacity(...)` com composição no `opacity` existente.
  - `filter: drop-shadow(...)` como aproximação usando infraestrutura de shadow já existente.
- `blur()/brightness()/contrast()/grayscale()/sepia()/saturate()/hue-rotate()/invert()` e `backdrop-filter`: parsear e transportar no estilo, mas **não renderizar no PDF** por enquanto (com warning).

## 3) Plano melhor (fases)

## Fase 0 - Contrato e escopo
- Definir matriz de suporte:
  - CSS parsing: suporte amplo.
  - PDF render: suporte parcial (MVP).
- Definir comportamento para não suportados: ignorar efeito e emitir `log("paint", "warn", ...)`.

## Fase 1 - CSS parsing e modelo tipado
- Criar `src/css/parsers/filter-parser.ts` com:
  - `parseFilter(value, target)` e `parseBackdropFilter(value, target)`.
  - Suporte a lista de funções com `splitCssList`.
  - `none`, `initial`, `inherit`, `revert`, `revert-layer`.
- Adicionar tipos em `src/css/properties/visual.ts`:
  - União tipada para funções (`blur`, `brightness`, `contrast`, `grayscale`, `sepia`, `saturate`, `hue-rotate`, `invert`, `opacity`, `drop-shadow`).
- Integrar em:
  - `src/css/style.ts` (`StyleAccumulator` + `ComputedStyle`).
  - `src/css/ua-defaults/base-defaults.ts` (defaults).
  - `src/css/compute-style/overrides.ts` (resolução de unidades relativas para números, como já é feito em shadows).
  - `src/css/parsers/register-parsers.ts` (registro das propriedades).

## Fase 2 - Propagação para árvore de render PDF
- Incluir campos em `src/pdf/types.ts` (`RenderBox.filter`, `RenderBox.backdropFilter`).
- Propagar em `src/pdf/layout-tree-builder.ts` a partir de `node.style`.
- Criar utilitário `src/pdf/utils/filter-utils.ts`:
  - `extractOpacityMultiplier(filter)`
  - `extractDropShadowLayers(filter, fallbackColor)`
  - `listUnsupportedFilters(filter/backdropFilter)`

## Fase 3 - Render PDF MVP (sem off-screen)
- Em `src/pdf/renderer/box-painter.ts`:
  - Calcular `effectiveOpacity = box.opacity * opacityMultiplier` e usar no scope de opacidade existente.
  - Pintar `drop-shadow()` via pipeline de shadow atual (aproximação baseada em box/radius).
  - Para filtros não suportados e `backdrop-filter`, não aplicar efeito e registrar warning.

## Fase 4 - Testes e documentação
- CSS:
  - `tests/css/filter-parser.spec.ts` cobrindo `none`, múltiplas funções, `%`, `deg`, `drop-shadow(...)`, valores inválidos.
- PDF:
  - `tests/pdf/filter-opacity.spec.ts` validando presença de graphics state.
  - `tests/pdf/filter-drop-shadow.spec.ts` validando geração de comandos/imagem de shadow.
  - `tests/pdf/backdrop-filter-noop.spec.ts` garantindo que não quebra render.
- Atualizar `docs/css-properties-support.md` com suporte parcial explícito.

## 4) Arquivos impactados (MVP)

- `src/css/properties/visual.ts`
- `src/css/style.ts`
- `src/css/ua-defaults/base-defaults.ts`
- `src/css/compute-style/overrides.ts`
- `src/css/parsers/filter-parser.ts` (novo)
- `src/css/parsers/register-parsers.ts`
- `src/pdf/types.ts`
- `src/pdf/layout-tree-builder.ts`
- `src/pdf/utils/filter-utils.ts` (novo)
- `src/pdf/renderer/box-painter.ts`
- `tests/css/filter-parser.spec.ts` (novo)
- `tests/pdf/filter-opacity.spec.ts` (novo)
- `tests/pdf/filter-drop-shadow.spec.ts` (novo)
- `tests/pdf/backdrop-filter-noop.spec.ts` (novo)
- `docs/css-properties-support.md`

## 5) Critérios de aceite

- `filter` e `backdrop-filter` parseiam sem regressão em propriedades existentes.
- PDF não quebra quando `filter/backdrop-filter` estiver presente.
- `filter: opacity(...)` altera transparência do box conforme esperado.
- `filter: drop-shadow(...)` produz resultado visual aceitável para caixas retangulares.
- Filtros não suportados e `backdrop-filter` ficam explícitos em warning.

## 6) Roadmap pós-MVP (quando houver necessidade real)

- Implementar infraestrutura de off-screen compositing (Form XObject/raster pass) para:
  - `blur()` real do conteúdo.
  - filtros de cor (`brightness`, `contrast`, etc.).
  - `backdrop-filter` verdadeiro.
- Esse passo é de alta complexidade e deve ser tratado como épico separado.
