# Changelog

## Unreleased

### Added
- Full `overflow-wrap` / `word-wrap` parsing, inheritance, and layout support so long tokens wrap deterministically in PDF output.
- Support for resolving `em`/`rem` units (font-size, spacing, borders, shadows, grids) using inherited/root font sizes to keep layout deterministic.
