# Using the GlyphRun Pipeline (TTF-only)

## Quick Start

The GlyphRun pipeline provides glyph-level control for PDF text rendering using TTF fonts.

### 1. Basic Usage

```typescript
import { GlyphRun } from "./layout/text-run.js";
import { PdfFontRegistry } from "./pdf/font-subset/font-registry.js";
import { drawGlyphRun } from "./pdf/utils/glyph-run-renderer.js";

// Create a GlyphRun (typically done by layout system)
const glyphRun: GlyphRun = {
  font: unifiedFont,        // UnifiedFont with metrics and program
  glyphIds: [1, 2, 3],      // Glyph IDs from cmap
  positions: [              // Per-glyph positioning
    { x: 0, y: 0 },
    { x: 600, y: 0 },
    { x: 850, y: 0 }
  ],
  text: "Hi!",              // Original Unicode for ToUnicode
  fontSize: 12,
};

// Register glyphs for subsetting
const registry = new PdfFontRegistry();
registry.registerGlyphRun(glyphRun);

// Get font subset
const handle = registry.ensureSubsetFor(unifiedFont);

// Generate PDF commands
const commands = drawGlyphRun(
  glyphRun,
  handle.subset,
  100,  // x position (pt)
  200,  // y position (pt)
  12,   // font size (pt)
  { r: 0, g: 0, b: 0, a: 1 }  // color
);

// Result: ["0.000 0.000 0.000 rg", "BT", "/F1 12.00 Tf", "100.00 200.00 Td", "<000100020003> Tj", "ET"]
```

### 2. Integration with Layout

```typescript
import { FontRegistryResolver } from "./fonts/font-registry-resolver.js";
import { buildRenderTree } from "./pdf/layout-tree-builder.js";

// Create font resolver
const fontResolver = new FontRegistryResolver(fontRegistry);

// Build render tree with font resolution
const layoutTree = buildRenderTree(layoutNode, {
  fontResolver,
  dpiAssumption: 96,
});

// Text runs now have .glyphs populated with GlyphRun data
for (const box of layoutTree.root.textRuns) {
  if (box.glyphs) {
    // Use GlyphRun for precise rendering
    registry.registerGlyphRun(box.glyphs);
  }
}
```

### 3. Font Subset Properties

```typescript
const subset = handle.subset;

subset.name           // "/F1" - PDF font resource name
subset.firstChar      // 0 - First char code
subset.lastChar       // N - Last char code
subset.widths         // [500, 600, 250] - Widths in PDF units
subset.toUnicodeCMap  // CMap string for text extraction
subset.encodeGlyph(gid) // Map glyph ID -> char code
```

## Architecture

```
Text Input
    ↓
FontResolver.resolveSync()
    ↓
UnifiedFont (with cmap & metrics)
    ↓
Map Unicode → Glyph IDs
    ↓
Compute positions from metrics
    ↓
GlyphRun { font, glyphIds, positions, text }
    ↓
PdfFontRegistry.registerGlyphRun()
    ↓
PdfFontSubset (widths, ToUnicode, encoding)
    ↓
drawGlyphRun() → PDF commands
```

## Key Features

✅ **Glyph-level control** - Exact glyphs chosen during layout are rendered in PDF
✅ **Consistent metrics** - Same width calculations used for layout and PDF
✅ **Text extraction** - ToUnicode CMap enables copy/paste and search
✅ **Subsetting ready** - Architecture supports future font subsetting

## Current Limitations

⚠️ Font subsetting returns placeholder (empty data)
⚠️ Full PDF rendering integration pending
⚠️ TTF-only (WOFF/WOFF2 support removed temporarily)

## Testing

Run the test suite:
```bash
npx vitest run tests/pdf-font/ttf-glyph-run.spec.ts
npx vitest run tests/pdf-font/end-to-end-glyph-run.spec.ts
```

## Next Steps

1. Implement `extractFontFile()` in `font-subset.ts` for true subsetting
2. Update `TextRenderer` to use `drawGlyphRun()`
3. Re-enable WOFF/WOFF2 support after TTF path is proven
