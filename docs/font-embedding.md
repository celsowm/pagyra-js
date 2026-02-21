# Embedding Fonts in Pagyra with Vite

Pagyra supports custom fonts in projects through two main methods: standard CSS `@font-face` rules (recommended) and programmatic configuration.

## Method 1: Using CSS (Recommended)

This is the easiest way to add fonts. Pagyra automatically processes `@font-face` rules in the CSS you provide.

1.  **Place your font files** in your project (e.g., `public/fonts/`).
2.  **Define `@font-face`** in your CSS.

```css
/* style.css */
@font-face {
  font-family: 'MyCustomFont';
  src: url('/fonts/MyCustomFont.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
}

.custom-text {
  font-family: 'MyCustomFont', sans-serif;
}
```

3.  **Pass the CSS** to Pagyra.

```typescript
import { renderHtmlToPdf } from 'pagyra-js';
// If using Vite's raw import for CSS
import cssContent from './style.css?raw'; 

const pdf = await renderHtmlToPdf({
  html: '<div class="custom-text">Hello World</div>',
  css: cssContent,
  // Ensure assetRootDir allows loading from public/
  assetRootDir: window.location.origin, 
});
```

Pagyra will fetch the font file from the URL specified in `src` using the current environment's resource loader.

### Selawik (TTF local, opt-in)

Selawik can be used as a drop-in open alternative in your own CSS stack without changing Pagyra's global font aliases.

```css
@font-face {
  font-family: 'Selawik';
  src: url('ttf/selawik/selawkl.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
}

@font-face {
  font-family: 'Selawik';
  src: url('ttf/selawik/selawksl.ttf') format('truetype');
  font-weight: 300; /* OS/2 usWeightClass is 300 */
  font-style: normal;
}

@font-face {
  font-family: 'Selawik';
  src: url('ttf/selawik/selawk.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Selawik';
  src: url('ttf/selawik/selawksb.ttf') format('truetype');
  font-weight: 600;
  font-style: normal;
}

@font-face {
  font-family: 'Selawik';
  src: url('ttf/selawik/selawkb.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
}

body {
  font-family: 'Selawik', 'DejaVu Sans', 'Arimo', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
```

Important:
- A `.zip` file is not loaded directly by Pagyra. Extract it first and reference the `.ttf` files in `@font-face`.
- Keep symbol-capable fallbacks in the stack (`DejaVu Sans`, `Arimo`) for glyphs like `->`-style arrows, bullets, and other symbols.

## Method 2: Programmatic Configuration (`fontConfig`)

For more control, or if you have the font data in memory (e.g., as an `ArrayBuffer` from a file input or preloaded asset), you can use the `fontConfig` option.

```typescript
import { renderHtmlToPdf, type FontConfig } from 'pagyra-js';

// Example: Loading a font manually
const fontUrl = new URL('/fonts/MyCustomFont.woff2', import.meta.url).href;
const fontBuffer = await fetch(fontUrl).then(res => res.arrayBuffer());

const fontConfig: FontConfig = {
  fontFaceDefs: [
    {
      name: 'MyCustomFont',
      family: 'MyCustomFont',
      weight: 400,
      style: 'normal',
      src: fontUrl,
      data: fontBuffer, // Pass the buffer directly
    }
  ],
  defaultStack: ['MyCustomFont', 'sans-serif']
};

const pdf = await renderHtmlToPdf({
  html: '<div style="font-family: MyCustomFont">Hello World</div>',
  fontConfig: fontConfig
});
```

## TypeScript Support

We have exported `FontConfig` and `FontFaceDef` types from the main package to help with type safety when using the programmatic approach.
