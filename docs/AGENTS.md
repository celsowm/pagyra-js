# AGENTS.md — Project Rules for Coding Agents

> This document defines how autonomous coding agents should work in this repository:
> goals, constraints, folder structure, coding style, tests, error handling, and
> what you *must* do before opening a PR.

---

## 1) Mission & Scope

- **Mission:** Convert **HTML + CSS** into **deterministic PDF** bytes via a clean pipeline:
  `HTML → DOM → CSSOM → Cascade → StyledTree → Layout (+pagination) → DisplayList → PDF`.
- **Out of scope:** Executing JavaScript from HTML, fetching the open internet beyond allowed inputs,
  adding heavy dependencies without explicit instructions, or breaking determinism.

---

## 2) Repository Layout (authoritative)

Use and keep these boundaries stable:

```
/src/core.ts          # Core exports and main types
/src/html-to-pdf.ts   # Main HTML to PDF conversion pipeline
/src/index.ts         # Public API entry point
/src/html/            # HTML parsing and DOM conversion (using linkedom)
/src/css/             # CSS parsing, cascade, shorthands, specificity
/src/layout/          # Layout computation (block/inline layout, positioning)
/src/dom/             # DOM node representation and manipulation
/src/pdf/             # PDF generation, rendering, and primitives
/src/fonts/           # Font handling, embedding, subsetting, metrics
/src/image/           # Image decoding (PNG, JPEG, WebP), processing
/src/svg/             # SVG parsing and rendering support
/src/assets/          # Built-in assets (fonts, images)
/src/compression/     # Data compression utilities (deflate, brotli)
/src/config/          # Configuration interfaces
/src/debug/           # Debugging and audit utilities
/src/geometry/        # Geometric calculations (boxes, matrices)
/src/logging/         # Logging utilities
/src/orchestrator/    # Pipeline coordination
/src/paint-order/     # Paint order management
/src/render/          # Render tree operations and transformations
/src/style/           # Style computation and inheritance
/src/text/            # Text processing and line breaking
/src/transform/       # Transformation utilities
/src/types/           # Type definitions
/src/units/           # Unit conversion and page utilities
/tests/helpers/       # Test utilities and helpers
/tests/layout/        # Layout-specific tests
/tests/pdf/           # PDF-specific tests
/scripts/             # Development scripts and utilities
/playground/          # Interactive development server
/playground/public/examples/ # HTML examples for testing
/examples/            # Example files (if any)
```

Do **not** restructure without updating this file and the README.

---

## 3) Pipeline Contracts (inputs/outputs)

### 3.1 Input Loader
- **In:** `RenderHtmlOptions` with HTML string, CSS string, viewport/page dimensions, margins, font config
- **Out:** `PreparedRender` with layout root, render tree, and page size in points
- **Errors:** `E_HTML_EMPTY`, `E_FETCH_FAILED`

### 3.2 HTML → DOM
- **Library:** Uses linkedom for HTML parsing (no JS execution)
- **Rules:** Preserve whitespace where CSS `white-space` requires; normalize HTML fragments to full documents
- **Error:** `E_HTML_SYNTAX` (recover if possible; warn + continue).

### 3.3 CSS Resolution
- Sources: `<style>`, `style=""` attributes, linked styles, UA styles.
- **Ordering:** UA < author < inline, specificity, `!important`.
- **Minimum selectors:** type/class/id, **descendant `A B`**, **child `A > B`**.
- **Shorthands:** border, margin, padding, background, font, etc.
- **@font-face:** Support for font loading and embedding from CSS

### 3.4 Style Computation (Cascade)
- **Out:** DOM nodes with computed styles attached
- **Normalize:** units (px internally), shorthands → longhands, inheritance, font face definitions

### 3.5 Layout & Pagination
- Flow layout, line boxes, absolute/fixed positioning, page fragments.
- **Stacking contexts & z-index:** negative < 0 < positive; follow paint order rules.
- **Recoverable overflow:** report `E_LAYOUT_OVERFLOW` (warn) and continue.

### 3.6 Render Tree Construction
- **Order:** backgrounds → borders → text → decorations → images/shadows.
- Generate **deterministic** render tree per page with proper offsets and margins applied.

### 3.7 PDF Writer
- Embed/subset fonts; compress streams; valid xref; metadata/XMP if present.
- **Out:** `Uint8Array` (PDF).
- **No partial PDF** on fatal errors.

---

## 4) Determinism & Seeds

- Internal units = **px**. Convert `px → pt` only in PDF writer (default `1px = 0.75pt`).
- When `seed` is provided, **same input ⇒ same output bytes**.
- Do not include timestamps/volatile IDs unless explicitly normalized.

---

## 5) Fonts & Text

- Font handling via FontEmbedder with support for TTF, WOFF, and WOFF2 formats
- Always subset embedded fonts; keep cmap/metrics consistent.
- Support for @font-face rules with font loading from URLs or local files
- Provide sane fallbacks for missing glyphs.
- Respect normalized font-weight steps (100..900); snap non-integer weights to nearest step.
- Font loading supports data URIs, HTTP URLs, and local file paths

---

## 6) Colors, Backgrounds & Shadows

- Work in **sRGB** internally; writer maps to DeviceRGB/ICC.
- Background shorthand may include **colors**, **images (url(...))**, and **linear-gradients**.
- `box-shadow` layers supported; `none` disables.

---

## 7) CSS Conventions & Notable Rules

- `z-index`: accepts **integer** values or `auto`. Non-integers (e.g., `"2.0"`) are ignored.
- Shorthands must expand correctly (border, margin/padding, background, font).
- **Selectors supported:** tag names, `#id`, `.class`, `[attr]`, `:first-child`, `:last-child`, `:nth-child`, `:not()`, `:root`, descendant (`A B`), child (`A > B`), adjacent sibling (`A + B`), and general sibling (`A ~ B`) combinators
- **Display values:** `block`, `inline`, `inline-block`, `flex`, `inline-flex`, `grid`, `inline-grid`, `table`, `inline-table`, `table-row-group`, `table-header-group`, `table-footer-group`, `table-row`, `table-cell`, `table-caption`, `list-item`, `none`, `flow-root`
- **Position values:** `static`, `relative`, `absolute`, `fixed`, `sticky`
- **Float values:** `none`, `left`, `right`, `inline-start`, `inline-end`
- **Table displays for `table`, `tbody/thead/tfoot`, `tr`, `td/th` are forced to canonical display types when overridden improperly.
- Defaults approximate UA styles (headings, paragraphs, lists, inline elements, tables, etc.).

---

## 8) Error Policy

- Prefer **warn and continue** (collect `warnings: string[]`) when safe.
- Fatal errors have stable codes `E_*` and never produce partial PDFs.
- All thrown errors must include: `code`, brief `message`, and optional `details`.

## 8.5) Logging & Debugging

- **Log levels:** `trace`, `debug`, `info`, `warn`, `error` (in increasing order of severity)
- **Log categories:** `parse`, `style`, `layout`, `paint`, `font`, `encoding`, `pdf` (case-insensitive)
- **Debug configuration:** Use `configureDebug({ level: LogLevel, cats: string[] })` to set runtime logging
- **Playground debugging:** Use `--debug-level` and `--debug-cats` flags with `npm run playground:render`
- **Log output:** Colored console output with level and category prefixes for easy identification

---

## 9) Tooling & Scripts

**Do not** reinvent commands; use these NPM scripts:

```jsonc
{
  "scripts": {
    "build": "tsc",
    "start": "node ./dist/index.js",
    "clean": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\"",
    "lint": "eslint src tests --ext .ts,.js",
    "test": "vitest run",
    "playground": "tsx playground/server.ts",
    "playground:render": "tsx scripts/render-playground-example.ts",
    "validate": "npm run lint && npm test"
  }
}
```

**Note:** Run `npm run build` before testing to ensure TypeScript compilation succeeds.

---

## 10) Coding Style

- Language: **TypeScript** (ES modules).
- Lint/format: **ESLint + Prettier**; zero warnings on CI.
- Logging: use the provided logger; avoid raw `console.log` in src.
- Keep modules **SRP** (Single Responsibility Principle). Split big functions.

---

## 10.5) Development Workflow

- **Playground:** Use `npm run playground` to start interactive development server
  - Access at `http://localhost:3000` (or configured port) for visual testing
  - Hot reload for rapid iteration on HTML/CSS inputs
  - Render specific examples with `npm run playground:render`
  - Playground render supports command-line options:
    - `npm run playground:render [example-path]` - Render a specific example from playground/public/examples/
    - `npm run playground:render -- --debug-level debug` - Enable debug logging
    - `npm run playground:render -- --debug-cats layout,pdf` - Enable specific debug categories (comma-separated)
    - Output PDFs are saved to `playground/exports/` directory
  
- **Scripts:** Development utilities in `/scripts/` directory
  - TypeScript scripts run with `tsx` for direct execution without compilation
  - May write output files for debugging/validation purposes

- **Build & Test Cycle:**
  1. Make changes in `/src/`
  2. Run `npm run build` to compile TypeScript
  3. Run `npm test` for unit and e2e tests
  4. Use playground for visual/manual verification
  5. Run `npm run validate` before committing (lint + test)

---

## 11) Tests: What You Must Cover

- **Unit:** CSS parsing (shorthands/longhands), specificity, cascade, layout pieces, render tree construction, PDF primitives.
- **Layout tests:** Inline fragments, text alignment, positioning, flexbox/grid (if implemented)
- **PDF tests:** Alignments, header/footer rendering, page breaks, font embedding
- **E2E:** 
  - z-index negative vs zero/positive (3+ overlapping elements).
  - Page breaks: `page-break-*` / `break-inside: avoid`.
  - Fonts: accents/symbols, embedding + subset, widths/metrics accuracy.
  - Images: PNG/JPEG/WebP with/without alpha; scaling & `object-fit`.
  - Selectors: `A B` and `A > B` with specificity ties.
  - Determinism: snapshot binary with `seed=42`.

A PR **must** add/adjust tests that reproduce any bug or validate a new feature in the appropriate test directory (`/tests/helpers/`, `/tests/layout/`, or `/tests/pdf/`).

---

## 12) PR & Commits

- One focused change per PR.
- Conventional commits: `feat(...)`, `fix(...)`, `test(...)`, `refactor(...)`, etc.
- Update `CHANGELOG.md` and, if relevant, this `AGENTS.md`.
- CI requirement: `npm run validate` **must pass**.

---

## 13) Security & Supply Chain

- No runtime network fetches during tests except for controlled fixtures.
- No dynamic `eval`/Function constructors.
- Keep dependencies minimal; justify any new runtime dep in PR description.

---

## 14) Inputs & Artifacts

- **Inputs:** `RenderHtmlOptions` with HTML string, CSS string, viewport/page dimensions, margins, font config, resource base directory, header/footer HTML
- **Artifacts:** PDF bytes (`Uint8Array`) + metrics (timings, page count) + warnings.
- Never write files in library code; CLIs in `/scripts/` may write to disk.

---

## 15) Agent Checklists (must pass)

- [ ] `npm run validate` (lint + test) succeeded.
- [ ] Coverage ≥ 80% for changed modules.
- [ ] Deterministic snapshots unchanged (or re-baselined with reason).
- [ ] Added/updated e2e demonstrating the change.
- [ ] No stray logs; no partial PDF on fatal paths.
- [ ] Documentation (README/AGENTS) updated if behavior changed.

---

## 16) Glossary

- **StyledTree:** DOM nodes decorated with computed CSS.
- **DisplayList:** Ordered painting operations per page.
- **Deterministic:** Same inputs + same seed → identical PDF bytes.
- **RenderTree:** Tree structure representing the final layout with positioning and styling applied for PDF rendering
- **LayoutNode:** Internal representation of DOM elements with computed layout properties
- **FontEmbedder:** Component responsible for font loading, subsetting, and embedding in PDF output

---

## 17) Document Maintenance

- Version: `1.1.0`
- Last updated: 2025-11-26
- Editors: maintainers of this repo. Update alongside code changes that alter behavior.
- Keep synchronized with `package.json` scripts and actual repository structure.
