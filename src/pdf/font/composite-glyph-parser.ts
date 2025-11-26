import type { GlyphOutlineCmd } from "../../types/fonts.js";
import type { DataViewReader } from "./ttf-table-provider.js";
import { TransformationMatrix } from "./transformation-matrix.js";

/**
 * Provider interface for retrieving glyph outlines.
 * Used to resolve component glyph references in composite glyphs.
 */
export interface GlyphOutlineProvider {
    /**
     * Gets the outline for a glyph.
     * @param glyphId - The glyph ID
     * @param depth - Current recursion depth (for preventing infinite recursion)
     * @returns Glyph outline commands, or null if not available
     */
    getOutline(glyphId: number, depth?: number): GlyphOutlineCmd[] | null;
}

/**
 * Component transformation and reference data.
 */
interface ComponentData {
    glyphIndex: number;
    flags: number;
    transform: TransformationMatrix;
    hasMoreComponents: boolean;
}

/**
 * Parses composite (component-based) TrueType glyphs.
 * 
 * Composite glyphs are built from one or more simple glyphs (components),
 * each with its own transformation (translation, scale, rotation).
 */
export class CompositeGlyphParser {
    private readonly recursionLimit = 8;
    private readonly visited: Set<number> = new Set();

    // Component flags
    private static readonly ARG_1_AND_2_ARE_WORDS = 0x0001;
    private static readonly WE_HAVE_A_SCALE = 0x0008;
    private static readonly MORE_COMPONENTS = 0x0020;
    private static readonly WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
    private static readonly WE_HAVE_A_TWO_BY_TWO = 0x0080;

    constructor(private readonly reader: DataViewReader) { }

    /**
     * Parses a composite glyph.
     * @param view - DataView containing the composite glyph data
     * @param provider - Provider for resolving component glyph references
     * @param depth - Current recursion depth
     * @returns Array of glyph outline commands, or null if parsing fails
     */
    parse(
        view: DataView,
        provider: GlyphOutlineProvider,
        depth: number = 0
    ): GlyphOutlineCmd[] | null {
        if (depth > this.recursionLimit) return null;

        // Composite glyph component records start at offset 10 (after header)
        const cmds = this.parseComponentRecords(view, 10, provider, depth);

        // Clear visited set for next parse
        this.visited.clear();

        return cmds;
    }

    /**
     * Parses component records from a composite glyph.
     * @param view - DataView containing the glyph data
     * @param startOffset - Starting offset for component records
     * @param provider - Provider for resolving component references
     * @param depth - Current recursion depth
     * @returns Combined outline commands from all components, or null if parsing fails
     */
    private parseComponentRecords(
        view: DataView,
        startOffset: number,
        provider: GlyphOutlineProvider,
        depth: number
    ): GlyphOutlineCmd[] | null {
        if (depth > this.recursionLimit) return null;

        let offset = startOffset;
        const allCmds: GlyphOutlineCmd[] = [];

        while (true) {
            const component = this.readComponentData(view, offset);
            if (!component) return null;

            offset = this.calculateNextOffset(view, offset, component.flags);

            // Prevent infinite recursion cycles
            if (this.visited.has(component.glyphIndex)) {
                // Skip this component to avoid cycle
            } else {
                this.visited.add(component.glyphIndex);

                // Get component's outline
                const componentCmds = provider.getOutline(component.glyphIndex, depth + 1);
                if (componentCmds && componentCmds.length > 0) {
                    // Transform the component's outline
                    const transformedCmds = component.transform.applyToCommands(componentCmds);

                    // Ensure proper moveTo at start if needed
                    if (transformedCmds.length > 0 && transformedCmds[0].type !== "moveTo") {
                        const firstCoord = this.findFirstCoordinate(transformedCmds);
                        if (firstCoord) {
                            allCmds.push({ type: "moveTo", x: firstCoord.x, y: firstCoord.y });
                        }
                    }

                    allCmds.push(...transformedCmds);
                }
            }

            // Check if there are more components
            if (!component.hasMoreComponents) break;
        }

        return allCmds.length > 0 ? allCmds : null;
    }

    /**
     * Reads a single component's data from the view.
     * @param view - DataView containing the glyph data
     * @param offset - Starting offset for this component
     * @returns Component data or null if reading fails
     */
    private readComponentData(view: DataView, offset: number): ComponentData | null {
        if (offset + 4 > view.byteLength) return null;

        const flags = this.reader.getUint16(view, offset);
        const glyphIndex = this.reader.getUint16(view, offset + 2);
        let p = offset + 4;

        // Read arguments (translation or matching points)
        let arg1 = 0;
        let arg2 = 0;

        if (flags & CompositeGlyphParser.ARG_1_AND_2_ARE_WORDS) {
            // 16-bit signed arguments
            if (p + 4 > view.byteLength) return null;
            arg1 = this.reader.getInt16(view, p);
            arg2 = this.reader.getInt16(view, p + 2);
            p += 4;
        } else {
            // 8-bit signed arguments
            if (p + 2 > view.byteLength) return null;
            arg1 = this.reader.getInt8(view, p);
            arg2 = this.reader.getInt8(view, p + 1);
            p += 2;
        }

        // Read transformation matrix
        let mxx = 1, mxy = 0, myx = 0, myy = 1;

        if (flags & CompositeGlyphParser.WE_HAVE_A_SCALE) {
            // Uniform scale
            if (p + 2 > view.byteLength) return null;
            const scale = this.reader.getInt16(view, p) / (1 << 14);
            mxx = scale;
            myy = scale;
        } else if (flags & CompositeGlyphParser.WE_HAVE_AN_X_AND_Y_SCALE) {
            // Non-uniform scale
            if (p + 4 > view.byteLength) return null;
            const sx = this.reader.getInt16(view, p) / (1 << 14);
            const sy = this.reader.getInt16(view, p + 2) / (1 << 14);
            mxx = sx;
            myy = sy;
        } else if (flags & CompositeGlyphParser.WE_HAVE_A_TWO_BY_TWO) {
            // Full 2x2 matrix
            if (p + 8 > view.byteLength) return null;
            mxx = this.reader.getInt16(view, p) / (1 << 14);
            mxy = this.reader.getInt16(view, p + 2) / (1 << 14);
            myx = this.reader.getInt16(view, p + 4) / (1 << 14);
            myy = this.reader.getInt16(view, p + 6) / (1 << 14);
        }

        // Treat args as translation (simplified - spec allows matching points too)
        const transform = TransformationMatrix.fromComponents(arg1, arg2, mxx, mxy, myx, myy);

        return {
            glyphIndex,
            flags,
            transform,
            hasMoreComponents: !!(flags & CompositeGlyphParser.MORE_COMPONENTS)
        };
    }

    /**
     * Calculates the next offset after reading a component record.
     * @param view - DataView containing the glyph data
     * @param offset - Current offset
     * @param flags - Component flags
     * @returns Next offset
     */
    private calculateNextOffset(view: DataView, offset: number, flags: number): number {
        let p = offset + 4; // flags + glyphIndex

        // Skip arguments
        if (flags & CompositeGlyphParser.ARG_1_AND_2_ARE_WORDS) {
            p += 4;
        } else {
            p += 2;
        }

        // Skip transformation data
        if (flags & CompositeGlyphParser.WE_HAVE_A_SCALE) {
            p += 2;
        } else if (flags & CompositeGlyphParser.WE_HAVE_AN_X_AND_Y_SCALE) {
            p += 4;
        } else if (flags & CompositeGlyphParser.WE_HAVE_A_TWO_BY_TWO) {
            p += 8;
        }

        return p;
    }

    /**
     * Finds the first coordinate in a list of commands.
     * @param cmds - Array of glyph outline commands
     * @returns First coordinate found, or null
     */
    private findFirstCoordinate(cmds: GlyphOutlineCmd[]): { x: number; y: number } | null {
        for (const c of cmds) {
            if (c.type === "moveTo" || c.type === "lineTo") {
                return { x: c.x, y: c.y };
            }
            if (c.type === "quadTo") {
                return { x: c.x, y: c.y };
            }
            if (c.type === "cubicTo") {
                return { x: c.x, y: c.y };
            }
        }
        return null;
    }
}
