# Changelog

## Unreleased

### Added
- Full `overflow-wrap` / `word-wrap` parsing, inheritance, and layout support so long tokens wrap deterministically in PDF output.
- Support for resolving `em`/`rem` units (font-size, spacing, borders, shadows, grids) using inherited/root font sizes to keep layout deterministic.
- `text-transform` parsing plus layout/PDF rendering so uppercase/lowercase/capitalize behave deterministically across the pipeline.
- Support for SVG `stroke-dasharray` and `stroke-dashoffset` attributes for dashed line rendering.

### Fixed
- Apply justified spacing consistently across all inline fragments by marking the last line during inline layout and reusing it in PDF text-run generation.
