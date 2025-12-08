# Pagyra-js

A TypeScript-based HTML to PDF converter library with comprehensive CSS support and advanced layout capabilities.

## Features

### Core Capabilities
- **HTML to PDF Conversion**: Convert HTML content to PDF with precise layout control
- **Comprehensive CSS Support**: Full CSS parsing, inheritance, and layout support
- **Advanced Text Handling**: Complete text layout with overflow wrapping, justification, and text transformation
- **Font Management**: Built-in font support with custom font embedding via `@font-face`
- **Cross-Platform**: Works in both Node.js and browser environments

### Recent Additions (from CHANGELOG)
- **Overflow Wrapping**: Full `overflow-wrap` / `word-wrap` parsing and layout support
- **Relative Units**: Support for `em`/`rem` units using inherited/root font sizes
- **Text Transformation**: `text-transform` parsing and rendering (uppercase/lowercase/capitalize)
- **SVG Stroke Support**: `stroke-dasharray` and `stroke-dashoffset` for dashed line rendering
- **CSS Variables**: Custom properties with inheritance and `var()` function resolution
- **Justified Text**: Consistent justified spacing across all inline fragments

## Installation

```bash
npm install pagyra-js
```

## Usage

### Minimal Example (HTML only)

```typescript
import { renderHtmlToPdf } from 'pagyra-js';

// Minimal usage - only HTML is required
// Other parameters will use sensible defaults (A4 size, standard margins)
const pdfBytes = await renderHtmlToPdf({
  html: '<h1>Hello World</h1><p>This is a PDF generated from HTML!</p>'
});
```

### Basic Example with Full Control

```typescript
import { renderHtmlToPdf } from 'pagyra-js';

const pdfBytes = await renderHtmlToPdf({
  html: '<h1>Hello World</h1><p>This is a PDF generated from HTML!</p>',
  css: 'body { font-family: Arial; } h1 { color: blue; }',
  viewportWidth: 800,
  viewportHeight: 600,
  pageWidth: 800,
  pageHeight: 1100,
  margins: { top: 20, right: 20, bottom: 20, left: 20 }
});

// Save or use the PDF bytes
fs.writeFileSync('output.pdf', Buffer.from(pdfBytes));
```

### Advanced Example with Custom Fonts

```typescript
import { renderHtmlToPdf } from 'pagyra-js';

const pdfBytes = await renderHtmlToPdf({
  html: `
    <div class="container">
      <h1>Advanced PDF Example</h1>
      <p class="justified">This text will be justified and use custom fonts.</p>
      <div class="box">Styled box with border-radius</div>
    </div>
  `,
  css: `
    @font-face {
      font-family: 'CustomFont';
      src: url('/path/to/font.woff2') format('woff2');
      font-weight: normal;
    }
    body {
      font-family: 'CustomFont', Arial;
      font-size: 14px;
    }
    .justified {
      text-align: justify;
      overflow-wrap: break-word;
    }
    .box {
      width: 200px;
      height: 100px;
      background-color: #f0f0f0;
      border-radius: 8px;
      border: 1px solid #ccc;
    }
  `,
  viewportWidth: 1000,
  viewportHeight: 800,
  pageWidth: 1000,
  pageHeight: 1400,
  margins: { top: 30, right: 30, bottom: 30, left: 30 },
  fontConfig: {
    fontFaceDefs: [
      {
        name: 'CustomFont',
        family: 'CustomFont',
        src: '/path/to/font.woff2',
        weight: 400,
        style: 'normal'
      }
    ]
  }
});
```

## API Reference

### Main Functions

#### `renderHtmlToPdf(options: RenderHtmlOptions): Promise<Uint8Array>`

Converts HTML to PDF and returns the PDF as a Uint8Array.

**Parameters:**

**Mandatory Parameters:**
- `html`: HTML content string (the only truly required parameter)

**Optional Parameters (with sensible defaults available):**
- `css`: CSS styles string (defaults to empty string)
- `viewportWidth`: Viewport width in pixels (can be calculated from page size)
- `viewportHeight`: Viewport height in pixels (can be calculated from page size)
- `pageWidth`: Page width in pixels (defaults to A4 width: ~595pt/8.27in)
- `pageHeight`: Page height in pixels (defaults to A4 height: ~841pt/11.69in)
- `margins`: Page margins in pixels (defaults to standard A4 margins: ~36pt/0.5in all sides)
- `debug`: Enable debug logging (optional, defaults to false)
- `debugLevel`: Debug log level (optional)
- `debugCats`: Debug categories (optional)
- `fontConfig`: Font configuration (optional, loads built-in fonts by default)
- `resourceBaseDir`: Base directory for resource resolution (optional)
- `assetRootDir`: Asset root directory (optional)
- `headerFooter`: Header/footer configuration (optional)
- `environment`: Environment abstraction (Node/browser, optional - defaults to Node environment)

**Note:** While the TypeScript interface requires all parameters, in practice only `html` is truly mandatory. The playground server demonstrates how to compute reasonable defaults for other parameters using helper functions like `sanitizeDimension()` and `resolvePageMarginsPx()`.

#### `prepareHtmlRender(options: RenderHtmlOptions): Promise<PreparedRender>`

Prepares HTML for rendering without generating the final PDF. Useful for debugging layout.

**Returns:**
- `layoutRoot`: Root layout node
- `renderTree`: Render tree structure
- `pageSize`: Page dimensions in points
- `margins`: Applied margins

### CSS Support

Pagyra-js supports a comprehensive set of CSS properties:

- **Layout**: `display`, `position`, `float`, `clear`, `z-index`
- **Box Model**: `width`, `height`, `margin`, `padding`, `border`, `box-sizing`
- **Flexbox**: `flex-direction`, `flex-wrap`, `justify-content`, `align-items`, etc.
- **Grid**: `grid-template`, `grid-gap`, `grid-auto-flow`
- **Text**: `font-family`, `font-size`, `font-weight`, `line-height`, `text-align`, `text-transform`, `overflow-wrap`
- **Colors**: `color`, `background-color`, `opacity`
- **Spacing**: `gap`, `margin-block`, `margin-inline`
- **Units**: `px`, `em`, `rem`, `pt`, `mm`, `cm`, `in`, `%`
- **Custom Properties**: CSS variables with `var()`

### Font Configuration

```typescript
interface FontConfig {
  fontFaceDefs: Array<{
    name: string;
    family: string;
    src: string;
    data?: ArrayBuffer; // Font data (required for browser environment)
    weight: number;
    style: 'normal' | 'italic';
  }>;
}
```

## Development

### Project Structure

```
src/
├── core.ts                  # Core exports and types
├── html-to-pdf.ts           # Main HTML to PDF conversion logic
├── index.ts                 # Main entry point
├── browser-entry.ts         # Browser-specific entry point
├── css/                     # CSS parsing and styling
├── dom/                     # DOM node handling
├── html/                    # HTML parsing and conversion
├── layout/                  # Layout calculation engine
├── pdf/                     # PDF generation and rendering
├── svg/                     # SVG support
├── units/                   # Unit conversion utilities
└── ... (other modules)
```

### Build Process

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run linter
npm run lint

# Run playground (Node environment)
npm run playground

# Run browser playground
npm run playground:browser
```

### Development Scripts

- `npm run build`: Compile TypeScript to JavaScript
- `npm run clean`: Remove build artifacts
- `npm run test`: Run test suite
- `npm run lint`: Run ESLint
- `npm run playground`: Interactive development environment
- `npm run playground:browser`: Browser-based playground
- `npm run build:browser`: Build browser bundle

## Browser Support

Pagyra-js can run in browser environments with some configuration:

```typescript
import { renderHtmlToPdfBrowser } from 'pagyra-js/browser-entry';

// Use the browser-specific entry point
const pdfBytes = await renderHtmlToPdfBrowser({
  html: '<p>Browser PDF generation</p>',
  css: 'body { font-family: Arial; }',
  // ... other options
  environment: new BrowserEnvironment() // Provide browser environment
});
```

## Examples

Check the `playground/public/examples/` directory for various usage examples:
- Basic HTML to PDF conversion
- CSS layout demonstrations
- SVG rendering examples
- Advanced text formatting
- Custom font usage

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests for new functionality
5. Run `npm run lint` and `npm test`
6. Submit a pull request

## License

MIT License
