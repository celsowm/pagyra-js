# Unsupported CSS Features in `very-complex-css.html`

Based on an analysis of the `very-complex-css.html` example, the following CSS features are likely not fully supported by the HTML-to-PDF conversion library.

## Advanced Layout

*   **`backdrop-filter`**: This feature is computationally expensive and not widely supported by PDF renderers. It's used in the `.kpi .card` style for a frosted glass effect.
*   **`clip-path` with complex paths**: The complex path used in the `.fx .blob` style is unlikely to be rendered correctly.
*   **CSS Masking (`mask` and `-webkit-mask`)**: The `.badge-img` style uses masking, which is an advanced feature with limited support in PDF converters.

## Advanced Typography

*   **`-webkit-background-clip: text`**: This is a non-standard feature used for gradient text in `.hero h1` and `.cliptext`. It's a common point of failure in HTML-to-PDF conversion.

## SVG and Filters

*   **SVG `filter` effects (e.g., `feDropShadow`)**: The drop shadow on the SVG rectangle is unlikely to be rendered.

## Dynamic and Print-Specific CSS

*   **`clamp()` and `calc()` with mixed units**: While simple calculations might work, `clamp()` and complex `calc()` expressions are often not supported.
*   **Transitions and Hover Effects (`:hover`, `transition`)**: The hover effect on the `.box` style is an interactive feature that will not be present in the static PDF output.
*   **`@media print`**: While some basic print styles might be applied, complex rules are often ignored. The `thead { display: table-header-group }` and `tfoot { display: table-footer-group }` might not work as expected.

## Less Common but Potentially Problematic

*   **`font-variant-numeric: tabular-nums`**: The `.counter-demo div::before` style uses this for monospaced numbers, which may not render correctly.
