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
/src/html/            # HTML tokenizer/parser, sanitize (no JS execution)
/src/css/             # CSS tokenizer & parser, shorthands, specificity, cascade
/src/layout/          # formatting contexts, block/inline layout, pagination
/src/paint/           # display list builder (backgrounds, borders, text, images, shadows)
/src/pdf/             # PDF objects, fonts, images, xref, writer (ISO 32000-2 alignment)
/src/assets/          # UA styles, built-in fonts/base14/fallbacks
/src/viewport.ts      # viewport helpers
/tests/unit/          # small, focused specs
/tests/e2e/           # end-to-end (HTML → PDF) contract tests
/tools/               # CLIs and dev scripts
```

Do **not** restructure without updating this file and the README.

---

## 3) Pipeline Contracts (inputs/outputs)

### 3.1 Input Loader
- **In:** `string | URL | ReadableStream` (HTML), optional `baseUrl`
- **Out:** `RawHtml { html: string; baseUrl?: string }`
- **Errors:** `E_HTML_EMPTY`, `E_FETCH_FAILED`

### 3.2 HTML → DOM
- **Rules:** No JS execution. Preserve whitespace where CSS `white-space` requires.
- **Error:** `E_HTML_SYNTAX` (recover if possible; warn + continue).

### 3.3 CSS Resolution
- Sources: `<style>`, `style=""` attributes, linked styles, UA styles.
- **Ordering:** UA < author < inline, specificity, `!important`.
- **Minimum selectors:** type/class/id, **descendant `A B`**, **child `A > B`**.
- **Shorthands:** border, margin, padding, background, font, etc.

### 3.4 Style Computation (Cascade)
- **Out:** `StyledTree` (node → `ComputedStyle`).
- **Normalize:** units (px internally), shorthands → longhands, inheritance.

### 3.5 Layout & Pagination
- Flow layout, line boxes, absolute/fixed positioning, page fragments.
- **Stacking contexts & z-index:** negative < 0 < positive; follow paint order rules.
- **Recoverable overflow:** report `E_LAYOUT_OVERFLOW` (warn) and continue.

### 3.6 Painter → Display List
- **Order:** backgrounds → borders → text → decorations → images/shadows.
- Generate **deterministic** `DisplayList[]` per page.

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

- Always subset embedded fonts; keep cmap/metrics consistent.
- Provide sane fallbacks for missing glyphs.
- Respect normalized font-weight steps (100..900); snap non-integer weights to nearest step.

---

## 6) Colors, Backgrounds & Shadows

- Work in **sRGB** internally; writer maps to DeviceRGB/ICC.
- Background shorthand may include **colors**, **images (url(...))**, and **linear-gradients**.
- `box-shadow` layers supported; `none` disables.

---

## 7) CSS Conventions & Notable Rules

- `z-index`: accepts **integer** values or `auto`. Non-integers (e.g., `"2.0"`) are ignored.
- Shorthands must expand correctly (border, margin/padding, background, font).
- Table displays for `table`, `tbody/thead/tfoot`, `tr`, `td/th` are **forced** to canonical display types when overridden improperly.
- Defaults approximate UA styles (headings, paragraphs, lists, inline elements, tables, etc.).

---

## 8) Error Policy

- Prefer **warn and continue** (collect `warnings: string[]`) when safe.
- Fatal errors have stable codes `E_*` and never produce partial PDFs.
- All thrown errors must include: `code`, brief `message`, and optional `details`.

---

## 9) Tooling & Scripts

**Do not** reinvent commands; use these NPM scripts:

```jsonc
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "lint": "eslint . --max-warnings=0",
    "type-check": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:e2e": "vitest run tests/e2e",
    "validate": "npm run lint && npm run type-check && npm run test",
    "pdf:from-html": "node tools/render-html-to-pdf.cjs"
  }
}
```

---

## 10) Coding Style

- Language: **TypeScript** (ES modules).
- Lint/format: **ESLint + Prettier**; zero warnings on CI.
- Logging: use the provided logger; avoid raw `console.log` in src.
- Keep modules **SRP** (Single Responsibility Principle). Split big functions.

---

## 11) Tests: What You Must Cover

- **Unit:** CSS parsing (shorthands/longhands), specificity, cascade, layout pieces, painter pieces, PDF primitives.
- **E2E:** 
  - z-index negative vs zero/positive (3+ overlapping elements).
  - Page breaks: `page-break-*` / `break-inside: avoid`.
  - Fonts: accents/symbols, embedding + subset, widths/metrics accuracy.
  - Images: PNG/JPEG with/without alpha; scaling & `object-fit`.
  - Selectors: `A B` and `A > B` with specificity ties.
  - Determinism: snapshot binary with `seed=42`.

A PR **must** add/adjust tests that reproduce any bug or validate a new feature.

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

- **Inputs:** HTML string/URL/stream + optional baseUrl + render options (page size, margins, fonts, seed).
- **Artifacts:** PDF bytes (`Uint8Array`) + metrics (timings, page count) + warnings.
- Never write files in library code; CLIs/tools may write to disk.

---

## 15) Agent Checklists (must pass)

- [ ] `npm run validate` (lint + types + unit + e2e) succeeded.
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

---

## 17) Document Maintenance

- Version: `1.0.0`
- Last updated: 2025-11-05
- Editors: maintainers of this repo. Update alongside code changes that alter behavior.
