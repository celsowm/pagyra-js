# Source Modules Table

This table lists all modules in the src folder with a brief summary of each module's purpose.

| Module Path | Summary |
|-------------|---------|
| core.ts | Core functionality and main entry point for the library, exports key types and classes for layout, styling, geometry, and PDF rendering |
| html-to-pdf.ts | Module for converting HTML content to PDF format, including parsing HTML/CSS, handling resources, and generating PDF output |
| index.ts | Main entry point/export file for the library, exports core functionality and provides a demo layout function |
| assets/fonts/ | Directory containing font assets |
| assets/images/ | Directory containing image assets |
| compression/adler32.ts | Calculates Adler-32 checksum as required by zlib format, used in WOFF 1.0 for data integrity verification |
| compression/deflate.ts | DEFLATE compression/decompression module for WOFF 1.0, implementing zlib format with header and Adler-32 checksum |
| compression/index.ts | Entry point for compression module exports |
| compression/types.ts | Type definitions for compression functionality |
| compression/utils.ts | Utility functions for compression operations |
| css/apply-declarations.ts | Applies CSS declarations to style accumulator, handles property parsing and shorthand expansion |
| css/background-types.ts | Type definitions for CSS background properties |
| css/browser-defaults.ts | Browser-like User Agent (UA) defaults for PDF conversion, acts as a façade re-exporting focused UA defaults modules |
| css/compute-style.ts | Computes styles for DOM elements by applying CSS rules, inline styles, and inheritance logic |
| css/css-unit-resolver.ts | Resolves CSS units to absolute values using font size context |
| css/enums.ts | Enumerations for CSS properties like display, position, float, overflow, white-space, align-items, etc. |
| css/font-face-parser.ts | Parser for CSS @font-face rules |
| css/font-weight.ts | Font weight handling and utilities |
| css/inline-style-parser.ts | Parser for inline CSS styles |
| css/layout-property-resolver.ts | Resolves CSS layout properties like grid tracks to absolute values |
| css/length.ts | CSS length unit handling and conversion utilities |
| css/line-height.ts | Line height calculation and handling utilities |
| css/named-colors.ts | Definitions for named CSS colors |
| css/style-inheritance.ts | CSS style inheritance logic |
| css/style.ts | Complete CSS style properties and ComputedStyle class implementation |
| css/unit-conversion.ts | Unit conversion utilities for CSS |
| css/utils.ts | General CSS utility functions |
| css/viewport.ts | Viewport-related CSS functionality |
| css/cascade/ | Directory for CSS cascade implementation |
| css/declarations/ | Directory for CSS declaration handling |
| css/parsers/background-parser-extended.ts | Extended parser for CSS background properties |
| css/parsers/background-parser.ts | Parser for CSS background properties |
| css/parsers/border-block-parser.ts | Parser for CSS border-block properties |
| css/parsers/border-inline-parser.ts | Parser for CSS border-inline properties |
| css/parsers/border-parser-extended.ts | Extended parser for CSS border properties |
| css/parsers/border-parser.ts | Parser for CSS border properties |
| css/parsers/box-shadow-parser.ts | Parser for CSS box-shadow properties |
| css/parsers/color-parser.ts | Parser for CSS color values |
| css/parsers/dimension-parser.ts | Parser for CSS dimension values |
| css/parsers/display-flex-parser.ts | Parser for CSS flex display properties |
| css/parsers/flex-parser.ts | Parser for CSS flex properties |
| css/parsers/font-parser.ts | Parser for CSS font properties |
| css/parsers/gradient-parser.ts | Parser for CSS gradient values |
| css/parsers/grid-parser-extended.ts | Extended parser for CSS grid properties |
| css/parsers/grid-parser.ts | Parser for CSS grid properties |
| css/parsers/length-parser.ts | Parser for CSS length values |
| css/parsers/list-style-parser.ts | Parser for CSS list-style properties |
| css/parsers/margin-block-parser.ts | Parser for CSS margin-block properties |
| css/parsers/margin-inline-parser.ts | Parser for CSS margin-inline properties |
| css/parsers/margin-parser.ts | Parser for CSS margin properties |
| css/parsers/opacity-parser.ts | Parser for CSS opacity values |
| css/parsers/overflow-wrap-parser.ts | Parser for CSS overflow-wrap properties |
| css/parsers/padding-block-parser.ts | Parser for CSS padding-block properties |
| css/parsers/padding-inline-parser.ts | Parser for CSS padding-inline properties |
| css/parsers/padding-parser.ts | Parser for CSS padding properties |
| css/parsers/position-parser.ts | Parser for CSS position properties |
| css/parsers/register-parsers.ts | Module for registering CSS parsers |
| css/parsers/registry.ts | Registry for CSS property parsers |
| css/parsers/text-parser-extended.ts | Extended parser for CSS text properties |
| css/parsers/text-parser.ts | Parser for CSS text properties |
| css/parsers/text-shadow-parser.ts | Parser for CSS text-shadow properties |
| css/properties/box-model.ts | CSS box model property handling |
| css/properties/flexbox.ts | CSS flexbox property handling |
| css/properties/grid.ts | CSS grid property handling |
| css/properties/layout.ts | CSS layout property handling |
| css/properties/misc.ts | Miscellaneous CSS property handling |
| css/properties/typography.ts | CSS typography property handling |
| css/properties/visual.ts | CSS visual property handling |
| css/selectors/matcher.ts | CSS selector matching functionality |
| css/selectors/parser.ts | CSS selector parser |
| css/selectors/simple-key.ts | Simple key implementation for selectors |
| css/selectors/specificity.ts | CSS selector specificity calculation |
| css/selectors/types.ts | Type definitions for CSS selectors |
| css/shorthands/border-shorthand.ts | CSS border shorthand property handling |
| css/shorthands/box-shorthand.ts | CSS box shorthand property handling |
| css/ua-defaults/base-defaults.ts | Base user agent default styles |
| css/ua-defaults/browser-defaults.ts | Browser-specific default styles |
| css/ua-defaults/element-defaults.ts | Element-specific default styles |
| css/ua-defaults/types.ts | Type definitions for user agent defaults |
| debug/audit.ts | Audit functionality for line runs, including text reconstruction and font face switching analysis |
| debug/ids.ts | ID management for debugging purposes |
| debug/log.js | JavaScript logging functionality for debugging |
| debug/log.ts | TypeScript logging functionality for debugging (deprecated, forwards to src/logging/debug.ts) |
| debug/tree.ts | Tree structure debugging utilities |
| dom/node.ts | LayoutNode class representing DOM nodes with computed styles, box model, and tree structure |
| fonts/detector.ts | Font format detection utility that identifies font formats from binary data |
| fonts/font-registry-resolver.ts | Adapter implementing FontResolver using FontRegistry, allowing layout system to resolve fonts during render tree building |
| fonts/index.ts | Entry point for font module exports |
| fonts/orchestrator.ts | Font handling orchestration |
| fonts/types.ts | Type definitions for font functionality including font metrics, programs, and loading |
| fonts/embedders/ | Directory for font embedding functionality |
| fonts/engines/ttf-engine.ts | TTF font engine implementation |
| fonts/engines/woff-engine.ts | WOFF font engine implementation |
| fonts/engines/woff2-engine.ts | WOFF2 font engine implementation |
| fonts/extractors/metrics-extractor.ts | Font metrics extraction utilities |
| fonts/parsers/ | Directory for font parsing functionality |
| fonts/utils/ | Directory for font utility functions |
| geometry/box.ts | Box class for geometric representations and viewport/containing block interfaces |
| geometry/matrix.ts | Matrix operations for geometric transformations |
| html/dom-converter.ts | Converts HTML DOM nodes to layout nodes, applying computed styles and handling different element types |
| html/image-converter.ts | Converts HTML image elements to layout nodes with proper sizing and resource handling |
| html/css/ | Directory for HTML-CSS integration |
| html/parse/ | Directory for HTML parsing functionality |
| image/base-decoder.ts | Base class for image decoders with common functionality |
| image/image-service.ts | Image service following SOLID principles, handles loading and decoding of various image formats |
| image/jpeg-decoder.ts | JPEG decoder that extracts metadata and intrinsic dimensions from SOF0 marker |
| image/png-decoder.ts | PNG image decoder implementation |
| image/types.ts | Type definitions for image processing |
| image/webp-decoder.ts | WebP image decoding implementation |
| image/webp-huffman.ts | WebP Huffman decoding utilities |
| image/webp-riff-parser.ts | WebP RIFF format parser |
| image/webp-vp8l-decoder.ts | WebP VP8L decoding implementation |
| layout/text-run.ts | GlyphRun interface representing sequences of glyphs for rendering with precise font information |
| layout/context/ | Directory for layout context management |
| layout/inline/ | Directory for inline layout implementation |
| layout/pipeline/engine.ts | Layout engine that orchestrates the layout process using different strategies for different node types |
| layout/pipeline/ | Directory for layout pipeline processing |
| layout/strategies/ | Directory for layout strategy implementations |
| layout/table/ | Directory for table layout implementation |
| layout/tree/ | Directory for layout tree management |
| layout/utils/ | Directory for layout utility functions |
| logging/debug.ts | Debug logging functionality |
| orchestrator/ | Directory for processing orchestration |
| pdf/header-footer-layout.ts | PDF header and footer layout |
| pdf/header-footer-painter.ts | PDF header and footer painting |
| pdf/header-footer-tokens.ts | PDF header and footer token handling |
| pdf/header-footer.ts | PDF header and footer functionality |
| pdf/layout-tree-builder.ts | PDF layout tree construction |
| pdf/page-painter.ts | PDF page painting implementation |
| pdf/pagination.ts | PDF pagination functionality |
| pdf/render.ts | Main PDF rendering implementation that creates PDF documents from layout trees |
| pdf/transform-adapter.ts | PDF transformation adapter |
| pdf/types.ts | Type definitions for PDF functionality including render boxes, text runs, and graphics |
| pdf/font/ | Directory for PDF font handling |
| pdf/font-subset/ | Directory for PDF font subsetting |
| pdf/graphics/ | Directory for PDF graphics operations |
| pdf/primitives/ | Directory for PDF primitive operations |
| pdf/renderer/ | Directory for PDF rendering implementation |
| pdf/renderers/ | Directory for PDF renderer implementations |
| pdf/shading/ | Directory for PDF shading operations |
| pdf/stacking/ | Directory for PDF stacking context |
| pdf/svg/ | Directory for PDF-SVG integration |
| pdf/utils/ | Directory for PDF utility functions |
| render/offset.ts | Functions for offsetting render tree elements and applying page vertical margins |
| render/pdf/ | Directory for PDF rendering implementation |
| render/pipeline/ | Directory for render pipeline processing |
| render/tree/ | Directory for render tree management |
| style/inheritance/ | Directory for style inheritance implementation |
| style/shorthands/ | Directory for CSS shorthand handling |
| style/ua/ | Directory for user agent style handling |
| svg/index.ts | SVG module entry point, exports parser and type definitions |
| svg/parser-registry.ts | Registry for SVG element parsers |
| svg/parser.ts | SVG parsing implementation |
| svg/path-data.ts | SVG path data handling |
| svg/types.ts | Type definitions for SVG functionality |
| svg/path/ | Directory for SVG path operations |
| svg/transform/ | Directory for SVG transformation |
| text/line-breaker.ts | Text line breaking algorithm using Knuth-Plass algorithm for optimal line breaks |
| text/text-transform.ts | Text transformation functionality for applying CSS text-transform |
| text/text.ts | Core text processing functionality |
| transform/css-parser.ts | CSS transformation parser |
| types/fonts.js | Font type definitions in JavaScript |
| types/fonts.ts | Font type definitions in TypeScript |
| types/public.ts | Public API type definitions |
| units/page-utils.ts | Page unit utilities |
| units/units.ts | Unit conversion and handling utilities for CSS units |
