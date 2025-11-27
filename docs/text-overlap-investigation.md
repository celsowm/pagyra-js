# Text Overlap Investigation

## Issue Description
Text from multiple flex items is rendering at the same Y-coordinate in the PDF, causing overlapping text.

## Analysis
From debug logs:
- "Layered" renders at **x: 78.315, y: 763.89**
- "Inset" renders at **x: 119.5725, y: 763.89** (SAME Y!)

These should be in separate flex items horizontally positioned.

## Root Cause
The text runs' `lineMatrix` uses `inlineRun.startX` and `inlineRun.baseline` which are calculated relative to the containing block, but when the parent is a flex item that has been repositioned, the inline runs don't inherit the parent's offset.

## Files to Check
1. `src/layout/strategies/flex.ts` - Lines 255-262: Flex item positioning
2. `src/pdf/utils/text-utils.ts` - Lines 58-65: Text run lineMatrix creation
3. `src/layout/inline/run-placer.ts` - Lines 70-74: InlineRun creation with startX and baseline

## Hypothesis
When `offsetLayoutSubtree` is called in flex.ts line 262 to adjust child positions, it updates `node.box.x` and `node.box.y` but the `inlineRuns` that were created BEFORE this offset still have their old relative coordinates.

## Potential Fix
Ensure that when `offsetLayoutSubtree` adjusts child positions, it also adjusts any `inlineRuns` that have been created.

Check: Does `offsetLayoutSubtree` update baseline positions for inline runs?
