// Analysis of unchecked "Parser and data model tasks" from SVG-TODO.md

/*
## Item 1: Introduce `SvgImageNode`, `SvgUseNode`, `SvgClipPathNode`, `SvgLinearGradient`, `SvgRadialGradient`, `SvgPathData` types.

### Deep Analysis:

#### Current State:
- SvgNodeType union: "svg" | "g" | "rect" | "circle" | "ellipse" | "line" | "path" | "polyline" | "polygon" | "text"
- SvgPathNode currently stores raw string in `d?: string`
- No support for <image>, <use>, <clipPath>, <linearGradient>, <radialGradient> elements

#### SVG Specification Requirements:

**SvgImageNode (<image>):**
- Attributes: x, y, width, height, href/xlink:href, preserveAspectRatio
- x, y, width, height are lengths (can be % for some cases)
- href is required, points to image resource
- preserveAspectRatio controls aspect ratio handling

**SvgUseNode (<use>):**
- Attributes: x, y, width, height, href/xlink:href
- References another element by ID
- Can override position/size of referenced element
- width/height are optional, default to referenced element's dimensions

**SvgClipPathNode (<clipPath>):**
- Container element for clipping paths
- Attributes: clipPathUnits ("userSpaceOnUse" | "objectBoundingBox")
- Children can be shapes or <use> elements
- Defines the clipping region

**SvgLinearGradient & SvgRadialGradient:**
- Paint server elements for gradients
- LinearGradient: x1, y1, x2, y2, gradientUnits, spreadMethod, stops
- RadialGradient: cx, cy, r, fx, fy, gradientUnits, spreadMethod, stops
- Stops defined by <stop> children with offset and stop-color

**SvgPathData:**
- Could be a type alias for NormalizedPathCommand[]
- Would replace the raw string in SvgPathNode.d
- Enables type safety and better tooling

#### Implementation Considerations:
- Need to decide if SvgPathData should replace string or be additional field
- Gradient stops need their own type definitions
- preserveAspectRatio parsing needs to be implemented
- xlink:href vs href attribute handling

#### Dev Plan:
1. Extend SvgNodeType union with new types
2. Define SvgImageNode with required attributes
3. Define SvgUseNode with reference attributes
4. Define SvgClipPathNode as container
5. Define gradient node types with stop definitions
6. Add SvgPathData type alias
7. Update SvgNode union and related types
8. Modify parser to handle new elements
9. Add preserveAspectRatio parsing utility

#### Test Plan:
- Parse <image> with all attribute combinations
- Parse <use> with href and overrides
- Parse <clipPath> with different units
- Parse gradients with multiple stops
- Test malformed/invalid attributes
- Test optional vs required attributes
- Integration with existing parsing pipeline

## Item 2: Add path-data parser utility (arc → cubic conversion or native curve commands).

### Deep Analysis:

#### Current Implementation Review:
Located in `src/svg/path-data.ts`:
- `parsePathData(data: string)` returns `NormalizedPathCommand[]`
- `NormalizedPathCommand` = M, L, C, Z (move, line, cubic curve, close)
- Full SVG path command support: M/m, L/l, H/h, V/v, C/c, S/s, Q/q, T/t, A/a, Z/z
- Arc-to-cubic conversion implemented in `arcToCubicCurves()`
- Quadratic-to-cubic conversion in `quadraticToCubic()`
- Smooth curve handling for S/s and T/t commands

#### Arc Conversion Implementation:
```typescript
function arcToCubicCurves(x0, y0, rx, ry, angle, largeArc, sweep, x, y)
```
- Handles elliptical arcs with rotation
- Converts to multiple cubic Bézier curves
- Implements SVG arc parameter handling (large-arc-flag, sweep-flag)
- Uses standard algorithm for arc approximation

#### Requirements Assessment:
✅ **Arc → cubic conversion**: IMPLEMENTED
- Converts A/a commands to series of C commands
- Handles all arc parameters correctly

✅ **Native curve commands**: IMPLEMENTED
- Preserves C/c (cubic) commands as-is
- Converts Q/q and T/t (quadratic) to C commands
- Handles smooth curves (S/s, T/t) correctly

✅ **Path data parser utility**: IMPLEMENTED
- Exported `parsePathData()` function
- Robust error handling for malformed input
- Supports relative and absolute coordinates

#### Potential Improvements:
- Could expose intermediate utilities if needed
- Arc approximation could be optimized for fewer segments
- Could add validation for degenerate cases

#### Conclusion:
**This item is ALREADY COMPLETED.** The path data parser exists and exceeds the requirements. It handles arc-to-cubic conversion, supports all curve commands, and normalizes to a consistent format.

#### Dev Plan:
1. Document that this functionality already exists
2. Consider if any edge case improvements are needed
3. Verify arc conversion accuracy against SVG specification
4. Potentially expose more granular utilities if needed by other parts of codebase

#### Test Plan:
- Verify arc conversion matches SVG specification examples
- Test edge cases: zero radius, 360° arcs, degenerate arcs
- Test all command types with various parameter combinations
- Test error handling for malformed path data
- Performance test with complex paths

## Item 3: Store normalized transforms (matrix) per node after parsing.

### Deep Analysis:

#### Current State:
- `SvgCommon.transform?: string` stores raw transform attribute string
- `parseTransform()` in `src/pdf/svg/matrix-utils.ts` can parse strings to `Matrix` objects
- During rendering (`src/pdf/svg/render-svg.ts`), transforms are parsed on-demand
- No pre-computed matrices stored per node
- Transform composition happens during rendering traversal

#### Transform Inheritance in SVG:
- Child elements inherit transforms from parent containers
- Effective transform = parent_matrix * child_matrix
- Order matters: transforms are applied in document order
- Nested groups can have complex transform hierarchies

#### Requirements Analysis:
**"Store normalized transforms (matrix) per node after parsing"**
- "Normalized" likely means parsed to Matrix format
- "Per node" means each SvgNode should have its computed transform matrix
- "After parsing" means compute during parse phase, not render phase

#### Implementation Approaches:

**Option A: Store Local Matrix Per Node**
- Each node stores its own transform matrix (from its transform attribute)
- During rendering, compose: effective_matrix = parent_effective * node_local_matrix
- Pros: Simple, matches SVG spec semantics
- Cons: Composition still happens during rendering

**Option B: Store Effective Matrix Per Node**
- Pre-compute the effective transform matrix during parsing
- Store the final composed matrix on each node
- Pros: Rendering is faster (no composition needed)
- Cons: More complex parsing, needs to handle parent context

**Option C: Hybrid Approach**
- Store local matrix per node
- Cache effective matrix if needed
- Best of both worlds

#### Performance Considerations:
- Parsing phase: Single pass through document
- Rendering phase: Multiple passes possible (different viewports, etc.)
- Pre-computing during parsing saves render-time computation
- But parsing becomes more complex with parent context tracking

#### Recommended Approach:
**Option A (Store Local Matrix Per Node)** - Simpler, more maintainable
- Add `transformMatrix?: Matrix` to `SvgCommon`
- Parse transform strings to matrices during `collectCommon()`
- Keep rendering logic for composition (already exists)
- Benefits: Clear separation of concerns, easier testing

#### Dev Plan:
1. Import `Matrix` and `parseTransform` in `src/svg/types.ts` and `parser.ts`
2. Add `transformMatrix?: Matrix` to `SvgCommon` interface
3. Modify `collectCommon()` to call `parseTransform()` and store result
4. Update rendering code to use pre-parsed matrices instead of re-parsing strings
5. Handle cases where parsing fails (invalid transform strings)
6. Consider backward compatibility with existing code

#### Test Plan:
- Test parsing of all transform types: matrix(), translate(), scale(), rotate(), skewX(), skewY()
- Test transform composition with nested groups
- Test invalid transform strings (should store undefined matrix)
- Test performance improvement in rendering
- Test edge cases: empty transforms, multiple transforms, complex nesting
- Integration tests with existing rendering pipeline
*/

export {};
