# Quick Reference: Background-Repeat Property

## Property Support
The `background-repeat` CSS property is fully supported for controlling how background images and gradients tile.

## Syntax
```css
background-repeat: value;
```

## Supported Values
| Value | Description | Support Status |
|-------|-------------|----------------|
| `repeat` | Tiles the image in both directions (default for images) | ✅ Full |
| `repeat-x` | Tiles the image horizontally only | ✅ Full |
| `repeat-y` | Tiles the image vertically only | ✅ Full |
| `no-repeat` | Displays the image once (default for gradients) | ✅ Full |
| `space` | Tiles with spacing to fit container | ⚠️ Renders as `repeat` (with warning) |
| `round` | Tiles and scales to fit container | ⚠️ Renders as `repeat` (with warning) |

## Usage Scenarios

### 1. As an Inline Property
```html
<div style="background-image: url(pattern.png); background-repeat: repeat-x;">
  Horizontal pattern
</div>
```

### 2. Within Background Shorthand
```html
<div style="background: url(tile.png) no-repeat center;">
  Centered image, no tiling
</div>
```

### 3. In External/Internal CSS
```html
<style>
  .tiled-background {
    background-image: url(tile.png);
    background-repeat: repeat;
    background-size: 100px 100px;
  }
</style>
<div class="tiled-background">Content</div>
```

### 4. With Gradients
```html
<div style="background-image: linear-gradient(to right, red, blue); background-repeat: no-repeat;">
  Single gradient
</div>
```

### 5. Property Override
```html
<!-- The background-repeat property will override the shorthand -->
<div style="background: url(img.png) repeat; background-repeat: no-repeat;">
  Override example
</div>
```

## Advanced Examples

### Tiled Pattern with Size Control
```css
.pattern {
  background-image: url(small-tile.png);
  background-repeat: repeat;
  background-size: 50px 50px;
}
```

### Horizontal Banner
```css
.banner {
  background-image: url(banner-pattern.png);
  background-repeat: repeat-x;
  background-position: top center;
}
```

### Vertical Sidebar
```css
.sidebar {
  background-image: url(vertical-pattern.png);
  background-repeat: repeat-y;
  background-position: left center;
}
```

### Single Positioned Image
```css
.logo-watermark {
  background-image: url(logo.png);
  background-repeat: no-repeat;
  background-position: bottom right;
  background-size: 100px auto;
}
```

## Default Behavior
- **Images**: Default to `repeat` if not specified
- **Gradients**: Default to `no-repeat` if not specified

## Property Cascade
The `background-repeat` property follows standard CSS cascade rules:
1. Inline styles have highest specificity
2. Later declarations override earlier ones
3. Properties override shorthand when declared after

## Combining with Other Properties
```css
.complex-background {
  background-image: url(texture.png);
  background-repeat: repeat;
  background-size: 80px 80px;
  background-position: center;
  background-origin: padding-box;
}
```

## Notes
- The `space` and `round` values are accepted but currently render as `repeat` with a console warning
- Full implementation of `space` and `round` spacing algorithms may be added in future versions
- Background repeat works seamlessly with other background properties
