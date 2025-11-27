# Text Overlap Fix - Summary

## Problem

Text from different flexbox items was rendering at overlapping Y-coordinates in the generated PDF, causing unreadable output.

### Example
```html
<div style="display: flex; gap: 32px;">
    <div><h2>First Title</h2></div>
    <div><h2>Second Title</h2></div>
</div>
  ```

Both "First Title" and "Second Title" were rendering at the same Y position (y: 763.89), even though they should be in separate horizontally-positioned containers.

## Root Cause

The flexbox layout strategy in `src/layout/strategies/flex.ts` was correctly positioning flex items using the `offsetLayoutSubtree` function (lines 255-262). However, this function only updated:
- `node.box.x`
- `node.box.y`
- `node.box.baseline`

It **did NOT** update the `inlineRuns` array, which contains text positioning data with its own `startX` and `baseline` properties.

When text runs were later converted to PDF operations in `src/pdf/utils/text-utils.ts` (lines 58-65), they used the **outdated inline run coordinates** that hadn't been adjusted for the flex item's final position.

## Solution

Updated the `offsetLayoutSubtree` function in `src/layout/strategies/flex.ts` to also adjust inline run positions:

```typescript
function offsetLayoutSubtree(node: LayoutNode, deltaX: number, deltaY: number): void {
  if (deltaX === 0 && deltaY === 0) {
    return;
  }
  node.walk((desc) => {
    if (desc === node) {
      return;
    }
    desc.box.x += deltaX;
    desc.box.y += deltaY;
    desc.box.baseline += deltaY;
    
    // Update inline runs if they exist
    if (desc.inlineRuns && desc.inlineRuns.length > 0) {
      for (const run of desc.inlineRuns) {
        run.startX += deltaX;
        run.baseline += deltaY;
      }
    }
  });
}
```

## Impact

This fix ensures that when flex items are repositioned:
1. The box positions are updated
2. **The inline text runs inside those boxes are also updated with the same offset**
3. The PDF renderer uses the correct final positions

## Files Modified

- `src/layout/strategies/flex.ts` - Added inline run position updates to `offsetLayoutSubtree` function

## Testing

To verify the fix:
1. Render any HTML with flexbox containers side-by-side containing text
2. Check that text in different flex items appears at different horizontal and vertical positions
3. Verify no overlapping text in the PDF output

Example test file: `playground/public/examples/debug-text-overlap.html`

## Related Code Paths

- **Inline layout**: `src/layout/inline/run-placer.ts` - Creates inline runs with initial positions
- **Text run creation**: `src/pdf/utils/text-utils.ts` - Converts inline runs to PDF Run objects
- **Flexbox positioning**: `src/layout/strategies/flex.ts` - Positions flex items and calls `offsetLayoutSubtree`
- **PDF rendering**: `src/pdf/renderers/text-renderer.ts` - Uses Run.lineMatrix for PDF coordinates

## Notes

This same issue could potentially affect other layout strategies that reposition nodes after inline layout (e.g., absolute positioning, grid layout). Consider applying similar fixes if needed.
