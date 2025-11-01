# SVG TODO

Tracking outstanding work to round out SVG support. Delete when complete.

## Current Status (short)
- Implemented: `svg`, `g`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `text`, `path`; basic fill/stroke; `viewBox` mapping; text anchor; transforms; preserveAspectRatio; fill-rule.
- Missing: more units, dashing, gradients/patterns/paint servers, clipping/masking/filters, images, advanced text, CSS styling inside SVG, defs/use/markers.

## Priorities (P1 first)

### P1 — Core completeness
- [x] Implement `<path>` rendering (currently parsed, not drawn)
  - Hook point: `src/pdf/svg/render-svg.ts:146` ("TODO: Implement path rendering").
  - Add a lightweight path-data parser for `d` (M/m, L/l, H/V, C/S, Q/T, A, Z), output normalized segments.
  - Extend ShapeRenderer with generic path helpers: fillPath/strokePath (emit `m`, `l`, `c`, `h`, `f`/`S`).
  - Implement `fill-rule` (`nonzero` vs `evenodd` → use `f` vs `f*`).

- [x] Apply `transform` on containers and drawables
  - Collected but unused: `transform?: string` in nodes (`src/svg/types.ts:18`).
  - Add transform parsing (matrix/translate/scale/rotate/skewX/skewY).
  - Maintain a transform stack in render pass; wrap drawing with `q`/`cm`/`Q`.

- [x] Implement `preserveAspectRatio`
  - Currently scaleX/scaleY are independent: `src/pdf/svg/render-svg.ts:66`.
  - Parse `preserveAspectRatio` on `<svg>`; compute meet/slice + alignment; adjust mapping and stroke-scale.

### P2 — Geometry, units, paint
- [ ] Length units beyond px: support `pt`, `pc`, `in`, `cm`, `mm` (and `%` where applicable)
  - Parser rejects non-`px`: `src/svg/parser.ts:257`, `src/svg/parser.ts:274`.
  - Decide `%` reference (viewport vs bbox) per attribute.

- [ ] Stroke dashing / miter limit
  - Add support for `stroke-dasharray`, `stroke-dashoffset`, `stroke-miterlimit`.
  - PDF ops: `d` (dash pattern), `M` (miter limit). Wire through ShapeRenderer.

- [ ] Expand color support
  - Add `hsl()/hsla()` and `currentColor` (fallback to inherited color).
  - File: `src/pdf/utils/color-utils.ts` and style resolution in `src/pdf/svg/render-svg.ts`.

- [ ] Fill/stroke opacity interplay at group level
  - Ensure group `opacity` multiplies children (base present in `deriveStyle`, verify nested accumulation).

### P3 — Paint servers, clipping, images
- [ ] Paint servers: `fill="url(#...)"` / `stroke="url(#...)"`
  - Implement `<defs>` and resource resolution; support `<linearGradient>` and `<radialGradient>` first.
  - Map to existing PDF shading via `GradientService` (see CSS gradients) with `gradientTransform`.

- [ ] Clipping and masking
  - `<clipPath>` and `clip-path` → build path, emit `W n` clip in PDF.
  - `<mask>` (alpha/luminance) — stretch goal.

- [ ] `<image>` inside SVG
  - Add `image` node type and render via PagePainter.drawImage with proper transforms and preserveAspectRatio.

### P4 — Text and styling
- [ ] Advanced text
  - `<tspan>` with x/y/dx/dy arrays; `textLength`/`lengthAdjust`; baseline alignment; kerning/letter/word spacing.
  - Optional: `textPath`.

- [ ] Parse `style="..."` on SVG elements
  - Currently only presentation attributes are read; parse inline CSS declarations and merge into `deriveStyle`.
  - Consider limited selector support for SVG-internal `<style>` as a later phase.

### P5 — Reuse and markers
- [ ] `<defs>` / `<use>` referencing
  - Build ID map during parse; clone/instantiate with transforms and style inheritance.

- [ ] Markers
  - `marker-start` / `marker-mid` / `marker-end` on paths/lines/polylines.

## Parser and data model tasks
- [ ] Introduce `SvgImageNode`, `SvgUseNode`, `SvgClipPathNode`, `SvgLinearGradient`, `SvgRadialGradient`, `SvgPathData` types.
- [ ] Add path-data parser utility (arc → cubic conversion or native curve commands).
- [ ] Store normalized transforms (matrix) per node after parsing.

## Renderer plumbing
- [ ] ShapeRenderer: add generic path APIs (fillPath/strokePath), dash/miter ops, even-odd fill.
- [ ] Svg renderer: transform stack handling; clip stack; paint server resolution.

## Testing and examples
- [ ] Unit tests for length units, transforms, preserveAspectRatio, dashing, fill-rule.
- [ ] Golden PDF tests for basic shapes + path + text.
- [ ] Playground examples under `playground/public/examples/` covering: transforms, aspect ratio, path, gradients, clip.

## Nice-to-haves
- [ ] Performance: cache parsed path segments; reuse shadings; avoid redundant `cm`.
- [ ] Error reporting: collect warnings with element context (id/class) and emit once.
- [ ] Feature flags to progressively enable new SVG capabilities.

## Pointers
- Entry: `src/html/dom-converter.ts:143` (detects <svg>, builds customData/root/viewBox).
- Types: `src/svg/types.ts` (node shapes; add new node kinds here).
- Parse: `src/svg/parser.ts` (extend for units, transforms, path data, defs/resources).
- Render: `src/pdf/svg/render-svg.ts` (main SVG renderer; add transforms/paths/paint servers/clip).
- PDF shapes: `src/pdf/renderers/shape-renderer.ts` (low-level path/paint ops; add dash/miter/even-odd).
