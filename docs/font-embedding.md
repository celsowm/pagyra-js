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
