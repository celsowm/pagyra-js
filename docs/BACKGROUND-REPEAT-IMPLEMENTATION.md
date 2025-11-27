# Background-Repeat Support Implementation Summary

## Overview
Successfully implemented complete support for the CSS `background-repeat` property in the pagyra-js HTML-to-PDF converter. The implementation covers both inline `background-repeat` declarations and the property within the `background` shorthand.

## Changes Made

### 1. **Added `applyBackgroundRepeat` Function** (`src/css/parsers/background-parser.ts`)
- Created a new parser function that applies the `background-repeat` longhand property to background layers
- Validates the repeat value against the allowed keywords: `repeat`, `repeat-x`, `repeat-y`, `no-repeat`, `space`, `round`
- Applies to both image and gradient background layers
- Follows the same pattern as existing background property parsers (`applyBackgroundSize`, `applyBackgroundOrigin`)

### 2. **Exported Parser Function** (`src/css/parsers/background-parser-extended.ts`)
- Imported `applyBackgroundRepeat` from the base parser
- Created wrapper function `applyBackgroundRepeatDecl` following naming conventions
- Made it available for registration

### 3. **Registered the Parser** (`src/css/parsers/register-parsers.ts`)
- Added `applyBackgroundRepeatDecl` to imports
- Registered `background-repeat` property parser in `registerAllPropertyParsers()`
- Placed it logically alongside other background properties

### 4. **Comprehensive Test Coverage** (`tests/pdf/background-repeat.spec.ts`)
- Created 11 test cases covering all functionality:
  - All repeat modes: `repeat`, `no-repeat`, `repeat-x`, `repeat-y`, `space`, `round`
  - Default behavior when not specified
  - Parsing from background shorthand
  - Application to gradients
  - Property override scenarios
  - Invalid value handling

## Existing Infrastructure
The implementation leverages existing, robust infrastructure:

### Type Definitions
- **`BackgroundRepeat`** type already defined in `src/css/background-types.ts`
- Supports all standard CSS values: `repeat`, `repeat-x`, `repeat-y`, `no-repeat`, `space`, `round`

### Background Layer Storage
- **`ImageBackgroundLayer`** and **`GradientBackgroundLayer`** interfaces already include `repeat?` field
- PDF types (`BackgroundImage`, `GradientBackground`) already have `repeat` property

### Rendering Logic
- **`computeBackgroundTileRects`** function (`src/pdf/utils/background-tiles.ts`) already handles all repeat modes
- Properly calculates tile positions for:
  - `no-repeat`: Single tile
  - `repeat`: Tiles in both directions
  - `repeat-x`: Horizontal tiling only
  - `repeat-y`: Vertical tiling only
  - `space` and `round`: Treated as `repeat` with a warning (per spec notes)

### Integration
- **`createBackgroundImage`** and **`createGradientBackground`** (`src/pdf/utils/background-layer-resolver.ts`)
  - Already read `layer.repeat` and default to appropriate values
  - Images default to `"repeat"`
  - Gradients default to `"no-repeat"`

## Testing Results
✅ All 11 new tests passing
✅ All existing tests still passing
✅ No regressions introduced

## Demonstration
The feature can be demonstrated using the existing example file:
`playground/public/examples/background-repeat-showcase.html`

This file showcases:
- `background-repeat: repeat` (default tiling behavior)
- `background-repeat: no-repeat` (single image, centered)
- `background-repeat: repeat-x` (horizontal tiling)
- `background-repeat: repeat-y` (vertical tiling)

## Compliance with AGENTS.md
✅ Single Responsibility Principle maintained
✅ TypeScript with proper type safety
✅ Tests added with ≥80% coverage
✅ No breaking changes
✅ Follows existing code patterns
✅ Build succeeds: `npm run build` ✓
✅ Tests pass: `npm test` ✓

## Usage Examples

### Inline Property
```html
<div style="background-image: url(image.png); background-repeat: no-repeat;">
  Content
</div>
```

### Background Shorthand
```html
<div style="background: url(image.png) repeat-x;">
  Content
</div>
```

### With Gradients
```html
<div style="background-image: linear-gradient(red, blue); background-repeat: no-repeat;">
  Content
</div>
```

### CSS Rules
```css
.pattern {
  background-image: url(tile.png);
  background-repeat: repeat;
  background-size: 50px 50px;
}
```

## Notes
- The `space` and `round` values are parsed and stored correctly, but render as `repeat` with a warning (as noted in existing code)
- This is consistent with the current implementation for gradients
- Full `space` and `round` rendering could be added in a future enhancement

## Files Modified
1. `src/css/parsers/background-parser.ts` - Added core parser function
2. `src/css/parsers/background-parser-extended.ts` - Exported wrapper function
3. `src/css/parsers/register-parsers.ts` - Registered the parser
4. `tests/pdf/background-repeat.spec.ts` - Added comprehensive tests (NEW)

## Conclusion
The `background-repeat` property is now fully supported for HTML to PDF conversion, enabling precise control over how background images and gradients tile within elements. The implementation is complete, well-tested, and ready for use.
