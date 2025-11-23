# CSS Properties Support for Pagyra-JS PDF Output

This document lists the CSS properties supported by Pagyra-JS for static PDF generation.

## 1. LAYOUT & BOX MODEL

| Property | Description | Is possible on PDF? | Is implemented? |
|----------|-------------|----------------------|----------------|
aspect-ratio | Sets preferred width/height ratio. | ✅ Yes | ❌ No
block-size | Logical height (block axis). | ✅ Yes | ❌ No
box-sizing | Calculates size (content-box vs border-box). | ✅ Yes | ❌ No
display | Defines rendering box type (block, inline, flex, etc.). | ✅ Yes | ✅ Yes
float | Moves element to left/right of flow. | ✅ Yes | ✅ Yes
clear | Specifies side where floating elements are not allowed. | ✅ Yes | ❌ No
height | Sets height of the element. | ✅ Yes | ✅ Yes
inline-size | Logical width (inline axis). | ✅ Yes | ❌ No
margin | Shorthand for outer spacing. | ✅ Yes | ✅ Yes
margin-block | Shorthand for logical vertical margins. | ✅ Yes | ❌ No
margin-inline | Shorthand for logical horizontal margins. | ✅ Yes | ❌ No
margin-top / right / bottom / left | Individual outer spacing. | ✅ Yes | ✅ Yes
max-height | Sets maximum height. | ✅ Yes | ✅ Yes
max-width | Sets maximum width. | ✅ Yes | ✅ Yes
min-height | Sets minimum height. | ✅ Yes | ✅ Yes
min-width | Sets minimum width. | ✅ Yes | ✅ Yes
padding | Shorthand for inner spacing. | ✅ Yes | ✅ Yes
padding-block | Shorthand for logical vertical padding. | ✅ Yes | ❌ No
padding-inline | Shorthand for logical horizontal padding. | ✅ Yes | ❌ No
padding-top / right / bottom / left | Individual inner spacing. | ✅ Yes | ✅ Yes
vertical-align | Vertical alignment of inline/table-cell boxes. | ✅ Yes | ❌ No
visibility | Hides element but reserves space. | ✅ Yes | ❌ No
width | Sets width of the element. | ✅ Yes | ✅ Yes

## 2. FLEXBOX & GRID

| Property | Description | Is possible on PDF? | Is implemented? |
|----------|-------------|----------------------|----------------|
align-content | Aligns rows/grid tracks (cross-axis). | ✅ Yes | ✅ Yes
align-items | Aligns items inside container (cross-axis). | ✅ Yes | ✅ Yes
align-self | Aligns individual item (overrides align-items). | ✅ Yes | ✅ Yes
column-gap | Space between columns. | ✅ Yes | ✅ Yes
flex | Shorthand for grow, shrink, and basis. | ✅ Yes | ❌ No
flex-basis | Initial size of flex item. | ✅ Yes | ❌ No
flex-direction | Direction of flex items (row/column). | ✅ Yes | ✅ Yes
flex-flow | Shorthand for flex-direction and flex-wrap. | ✅ Yes | ❌ No
flex-grow | Factor for item to grow. | ✅ Yes | ❌ No
flex-shrink | Factor for item to shrink. | ✅ Yes | ❌ No
flex-wrap | Whether items wrap to next line. | ✅ Yes | ✅ Yes
gap | Shorthand for row and column gaps. | ✅ Yes | ✅ Yes
grid | Shorthand for all explicit/implicit grid properties. | ✅ Yes | ❌ No
grid-area | Assigns item to named area or start/end lines. | ✅ Yes | ❌ No
grid-auto-columns | Default size of implicit columns. | ✅ Yes | ❌ No
grid-auto-flow | Algorithm for auto-placing items. | ✅ Yes | ✅ Yes
grid-auto-rows | Default size of implicit rows. | ✅ Yes | ❌ No
grid-column | Shorthand for column start/end. | ✅ Yes | ❌ No
grid-row | Shorthand for row start/end. | ✅ Yes | ❌ No
grid-template | Shorthand for rows, columns, and areas. | ✅ Yes | ❌ No
grid-template-areas | Defines named grid areas. | ✅ Yes | ❌ No
grid-template-columns | Defines explicit column sizes. | ✅ Yes | ✅ Yes
grid-template-rows | Defines explicit row sizes. | ✅ Yes | ✅ Yes
justify-content | Aligns items along main axis. | ✅ Yes | ✅ Yes
justify-items | Aligns items inside their grid cells (inline axis). | ✅ Yes | ❌ No
justify-self | Aligns individual item inside its cell. | ✅ Yes | ❌ No
order | Controls visual order of items. | ✅ Yes | ❌ No
place-content | Shorthand for align-content and justify-content. | ✅ Yes | ❌ No
place-items | Shorthand for align-items and justify-items. | ✅ Yes | ❌ No
place-self | Shorthand for align-self and justify-self. | ✅ Yes | ❌ No
row-gap | Space between rows. | ✅ Yes | ✅ Yes

## 3. TYPOGRAPHY & TEXT

| Property | Description | Is possible on PDF? | Is implemented? |
|----------|-------------|----------------------|----------------|
color | Foreground text color. | ✅ Yes | ✅ Yes
direction | Writing direction (LTR / RTL). | ✅ Yes | ❌ No
font | Shorthand for font style, weight, size, family. | ✅ Yes | ❌ No
font-family | Specifies typeface (Arial, Times, etc.). | ✅ Yes | ✅ Yes
font-feature-settings | Advanced OpenType features control. | ✅ Yes | ❌ No
font-kerning | Controls kerning information usage. | ✅ Yes | ❌ No
font-optical-sizing | Toggles optical sizing for variable fonts. | ✅ Yes | ❌ No
font-size | Size of the font (px, rem, pt). | ✅ Yes | ✅ Yes
font-size-adjust | Preserves aspect ratio (x-height) of font. | ✅ Yes | ❌ No
font-stretch | Selects normal, condensed, or expanded face. | ✅ Yes | ❌ No
font-style | Font style (normal, italic, oblique). | ✅ Yes | ✅ Yes
font-synthesis | Controls synthesis of missing font weights/styles. | ✅ Yes | ❌ No
font-variant | Controls small-caps and other variants. | ✅ Yes | ✅ Yes
font-weight | Thickness of characters (bold, 100-900). | ✅ Yes | ✅ Yes
hyphens | Controls hyphenation of words at line breaks. | ✅ Yes | ❌ No
letter-spacing | Spacing between characters (tracking). | ✅ Yes | ✅ Yes
line-break | Strictness of line-breaking rules. | ✅ Yes | ❌ No
line-height | Height of a line box (leading). | ✅ Yes | ✅ Yes
overflow-wrap | Specifies if browser can break lines within words. | ✅ Yes | ✅ Yes
quotes | Defines quotation marks for generated content. | ✅ Yes | ❌ No
tab-size | Width of tab character. | ✅ Yes | ❌ No
text-align | Horizontal alignment (left, center, justify). | ✅ Yes | ✅ Yes
text-align-last | Alignment of the last line of a block. | ✅ Yes | ❌ No
text-decoration | Shorthand for underline, overline, line-through. | ✅ Yes | ✅ Yes
text-decoration-color | Color of text decoration. | ✅ Yes | ✅ Yes
text-decoration-line | Type of decoration (underline, etc.). | ✅ Yes | ✅ Yes
text-decoration-style | Style of decoration (solid, wavy, dotted). | ✅ Yes | ✅ Yes
text-indent | Indentation of the first line of text. | ✅ Yes | ✅ Yes
text-justify | Justification method for text. | ✅ Yes | ❌ No
text-orientation | Orientation of text characters in a line. | ✅ Yes | ❌ No
text-overflow | How to signal clipped content (ellipsis). | ✅ Yes | ❌ No
text-shadow | Adds shadow to text. | ✅ Yes | ✅ Yes
text-transform | Controls capitalization (uppercase, lowercase). | ✅ Yes | ✅ Yes
white-space | Handling of white space and line breaks. | ✅ Yes | ❌ No
word-break | Rules for breaking lines within words. | ✅ Yes | ❌ No
word-spacing | Spacing between words. | ✅ Yes | ❌ No
writing-mode | Horizontal or vertical layout of text. | ✅ Yes | ❌ No

## 4. BACKGROUNDS & BORDERS

| Property | Description | Is possible on PDF? | Is implemented? |
|----------|-------------|----------------------|----------------|
background | Shorthand for all background properties. | ✅ Yes | ✅ Yes
background-attachment | Whether background scrolls or is fixed. | ✅ Yes (Fixed works as static) | ❌ No
background-blend-mode | Blending mode of background layers. | ✅ Yes | ❌ No
background-clip | Painting area of the background. | ✅ Yes | ❌ No
background-color | Background color of element. | ✅ Yes | ✅ Yes
background-image | Background image(s). | ✅ Yes | ✅ Yes
background-origin | Positioning area of background images. | ✅ Yes | ✅ Yes
background-position | Initial position of background image. | ✅ Yes | ✅ Yes
background-repeat | How background image is repeated. | ✅ Yes | ✅ Yes (repeat / repeat-x / repeat-y; space/round treated as repeat)
background-size | Size of background image. | ✅ Yes | ✅ Yes
border | Shorthand for width, style, and color. | ✅ Yes | ✅ Yes
border-collapse | Whether table borders are separated or collapsed. | ✅ Yes | ✅ Yes
border-color | Color of the border. | ✅ Yes | ✅ Yes
border-image | Shorthand for using image as border. | ✅ Yes | ❌ No
border-radius | Rounds the corners of an element's outer border edge. | ✅ Yes | ✅ Yes
border-spacing | Distance between borders of adjacent cells. | ✅ Yes | ❌ No
border-style | Style of border (solid, dashed, dotted). | ✅ Yes | ✅ Yes
border-width | Width of border. | ✅ Yes | ✅ Yes
box-shadow | Adds shadow effects around an element's frame. | ✅ Yes | ✅ Yes
object-fit | How content (img/video) fits its container. | ✅ Yes | ✅ Yes
object-position | Alignment of content within container. | ✅ Yes | ❌ No
opacity | Transparency level (0.0 to 1.0). | ✅ Yes | ✅ Yes

## 5. PRINT & FRAGMENTATION

| Property | Description | Is possible on PDF? | Is implemented? |
|----------|-------------|----------------------|----------------|
box-decoration-break | How box decorations render at breaks. | 📄 Print-Specific | ❌ No
break-after | Force/forbid break after element. | 📄 Print-Specific | ❌ No
break-before | Force/forbid break before element. | 📄 Print-Specific | ❌ No
break-inside | Force/forbid break inside element. | 📄 Print-Specific | ❌ No
column-count | Splits text into specific number of columns. | ✅ Yes | ❌ No
column-fill | How content fills columns (balance/auto). | ✅ Yes | ❌ No
column-span | Element spans across all columns. | ✅ Yes | ❌ No
column-rule | Line drawn between columns. | ✅ Yes | ❌ No
column-width | Ideal width of columns. | ✅ Yes | ❌ No
orphans | Min lines left at bottom of page. | 📄 Print-Specific | ❌ No
page | Named page type for @page rules. | 📄 Print-Specific | ❌ No
page-break-after | Legacy (use break-after). | 📄 Print-Specific | ❌ No
page-break-before | Legacy (use break-before). | 📄 Print-Specific | ❌ No
page-break-inside | Legacy (use break-inside). | 📄 Print-Specific | ❌ No
widows | Min lines at top of new page. | 📄 Print-Specific | ❌ No

## 6. POSITIONING & TRANSFORMS

| Property | Description | Is possible on PDF? | Is implemented? |
|----------|-------------|----------------------|----------------|
bottom | Distance from bottom edge. | ✅ Yes | ✅ Yes
inset | Shorthand for top/right/bottom/left. | ✅ Yes | ❌ No
left | Distance from left edge. | ✅ Yes | ✅ Yes
position | Positioning method (static, relative, absolute, fixed). | ✅ Yes | ✅ Yes
right | Distance from right edge. | ✅ Yes | ✅ Yes
top | Distance from top edge. | ✅ Yes | ✅ Yes
z-index | Stack order of positioned elements. | ✅ Yes | ✅ Yes
backface-visibility | Whether back face is visible when turned. | ✅ Yes (Snapshot) | ❌ No
perspective | Distance from viewer to z=0 plane. | ✅ Yes | ❌ No
perspective-origin | Position of the viewer. | ✅ Yes | ❌ No
rotate | Individual rotation transform. | ✅ Yes | ❌ No
scale | Individual scale transform. | ✅ Yes | ❌ No
transform | 2D/3D transformations (matrix, skew, etc.). | ✅ Yes | ✅ Yes
transform-box | Layout box that transform relates to. | ✅ Yes | ❌ No
transform-origin | Origin point for transformations. | ✅ Yes | ❌ No
transform-style | Whether children preserve 3D position. | ✅ Yes | ❌ No
translate | Individual translation transform. | ✅ Yes | ❌ No

## 7. ANIMATION & TRANSITION

| Property | Description | Is possible on PDF? | Is implemented? |
|----------|-------------|----------------------|----------------|
animation | Shorthand for animation properties. | ❌ No (Static) | ❌ No
animation-delay | Time before animation starts. | ❌ No | ❌ No
animation-direction | Forward, backward, or alternate. | ❌ No | ❌ No
animation-duration | How long animation takes. | ❌ No | ❌ No
animation-fill-mode | Styles applied before/after execution. | ❌ No | ❌ No
animation-iteration-count | Number of times to play. | ❌ No | ❌ No
animation-name | Name of @keyframes. | ❌ No | ❌ No
animation-play-state | Running or paused. | ❌ No | ❌ No
animation-timing-function | Speed curve of animation. | ❌ No | ❌ No
offset | Motion path shorthand. | ❌ No (Static) | ❌ No
transition | Shorthand for transitions. | ❌ No | ❌ No
transition-delay | Delay before transition. | ❌ No | ❌ No
transition-duration | Time transition takes. | ❌ No | ❌ No
transition-property | Properties to transition. | ❌ No | ❌ No
transition-timing-function | Speed curve of transition. | ❌ No | ❌ No
will-change | Hints to browser for optimization. | ❌ No (Irrelevant) | ❌ No

## 8. SVG & MASKING

| Property | Description | Is possible on PDF? | Is implemented? |
|----------|-------------|----------------------|----------------|
clip-path | Clipping region (shape/SVG). | ✅ Yes | ❌ No
clip-rule | How to determine inside of shape. | ✅ Yes | ❌ No
fill | Color of SVG shape. | ✅ Yes | ❌ No
fill-opacity | Opacity of fill. | ✅ Yes | ❌ No
fill-rule | Algorithm for filling shapes. | ✅ Yes | ❌ No
filter | Graphical effects (blur, brightness). | ✅ Yes | ❌ No
mask | Shorthand for mask properties. | ✅ Yes | ❌ No
mask-clip | Area affected by mask. | ✅ Yes | ❌ No
mask-image | Image used as mask. | ✅ Yes | ❌ No
mask-mode | Alpha or luminance masking. | ✅ Yes | ❌ No
shape-outside | Shape for content to wrap around. | ✅ Yes | ❌ No
stop-color | Color of gradient stop. | ✅ Yes | ❌ No
stroke | Color of SVG stroke. | ✅ Yes | ❌ No
stroke-dasharray | Pattern of dashes/gaps. | ✅ Yes | ❌ No
stroke-linecap | Shape of endpoints of line. | ✅ Yes | ❌ No
stroke-width | Width of stroke. | ✅ Yes | ❌ No

## 9. UI, INTERACTION & SCROLL

| Property | Description | Is possible on PDF? | Is implemented? |
|----------|-------------|----------------------|----------------|
accent-color | Color for UI controls (checkboxes). | ✅ Yes (Visual) | ❌ No
appearance | Native OS UI styling. | ✅ Yes (Static) | ❌ No
caret-color | Color of text insertion cursor. | ❌ No | ❌ No
cursor | Mouse cursor icon. | ❌ No | ❌ No
outline | Drawn line outside border (doesn't take space). | ✅ Yes | ❌ No
outline-offset | Space between border and outline. | ✅ Yes | ❌ No
overflow | Handling of content spill (scroll/hidden). | ✅ Yes | ❌ No
overscroll-behavior | Scroll chaining behavior. | ❌ No | ❌ No
pointer-events | Reaction to pointer events. | ❌ No | ❌ No
resize | User resizability. | ❌ No | ❌ No
scroll-behavior | Smooth scrolling. | ❌ No | ❌ No
scroll-margin | Scroll snap margin. | ❌ No | ❌ No
scroll-padding | Scroll snap padding. | ❌ No | ❌ No
scroll-snap-align | Snap alignment. | ❌ No | ❌ No
scroll-snap-type | Snap physics. | ❌ No | ❌ No
scrollbar-color | Color of scrollbars. | ✅ Yes (If visible) | ❌ No
scrollbar-width | Width of scrollbars. | ✅ Yes (If visible) | ❌ No
touch-action | Touch gesture handling. | ❌ No | ❌ No
user-select | Text selection control. | ❌ No | ❌ No

## 10. LOGIC & GLOBAL

| Property | Description | Is possible on PDF? | Is implemented? |
|----------|-------------|----------------------|----------------|
all | Resets all properties. | ✅ Yes | ❌ No
contain | Performance isolation. | ✅ Yes | ❌ No
content | Generated content (::before/::after). | ✅ Yes | ❌ No
counter-increment | Increment CSS counter. | ✅ Yes | ❌ No
counter-reset | Reset CSS counter. | ✅ Yes | ❌ No
mix-blend-mode | How element blends with parent. | ✅ Yes | ❌ No
isolation | New stacking context for blending. | ✅ Yes | ❌ No
