import type { GlyphOutlineCmd } from "../../types/fonts.js";
import type { DataViewReader } from "./ttf-table-provider.js";

/**
 * Represents a point in a glyph contour.
 */
interface Point {
    x: number;
    y: number;
    onCurve: boolean;
}

/**
 * Parses simple (non-composite) TrueType glyphs.
 * 
 * Simple glyphs consist of one or more contours made up of on-curve and off-curve points.
 * Off-curve points are quadratic Bezier control points.
 */
export class SimpleGlyphParser {
    constructor(private readonly reader: DataViewReader) { }

    /**
     * Parses a simple glyph from a DataView.
     * @param view - DataView containing the glyph data starting at the glyph header
     * @returns Array of glyph outline commands, or null if parsing fails
     */
    parse(view: DataView): GlyphOutlineCmd[] | null {
        const contours = this.parseContours(view);
        if (!contours) return null;

        return this.buildOutlineCommands(contours);
    }

    /**
     * Parses glyph contours from the DataView.
     * @param view - DataView containing the glyph data
     * @returns Array of contours (each contour is an array of points), or null if parsing fails
     */
    private parseContours(view: DataView): Point[][] | null {
        if (view.byteLength < 10) return null;

        // Read glyph header
        const numberOfContours = view.getInt16(0, false);
        if (numberOfContours < 0) return null; // Composite glyph, shouldn't happen here

        // Read endPtsOfContours array
        const endPtsOffset = 10;
        const endPts: number[] = [];
        for (let i = 0; i < numberOfContours; i++) {
            if (endPtsOffset + i * 2 + 2 > view.byteLength) return null;
            endPts.push(this.reader.getUint16(view, endPtsOffset + i * 2));
        }

        // Read instruction length and skip instructions
        const instrLenOffset = endPtsOffset + numberOfContours * 2;
        if (instrLenOffset + 2 > view.byteLength) return null;
        const instructionLength = this.reader.getUint16(view, instrLenOffset);
        const flagsOffset = instrLenOffset + 2 + instructionLength;
        if (flagsOffset > view.byteLength) return null;

        // Calculate number of points
        const nPoints = endPts.length === 0 ? 0 : endPts[endPts.length - 1] + 1;
        if (nPoints <= 0) return [];

        // Parse flags
        const flagsResult = this.parseFlags(view, nPoints, flagsOffset);
        if (!flagsResult) return null;
        const { flags, nextOffset: xCoordOffset } = flagsResult;

        // Parse coordinates
        const coordsResult = this.parseCoordinates(view, flags, xCoordOffset);
        if (!coordsResult) return null;
        const { points } = coordsResult;

        // Split points into contours
        const contours: Point[][] = [];
        let startIndex = 0;
        for (let c = 0; c < numberOfContours; c++) {
            const endIndex = endPts[c];
            if (endIndex < startIndex || endIndex >= points.length) return null;
            contours.push(points.slice(startIndex, endIndex + 1));
            startIndex = endIndex + 1;
        }

        return contours;
    }

    /**
     * Parses glyph flags with run-length encoding.
     * @param view - DataView containing the glyph data
     * @param nPoints - Number of points to read
     * @param offset - Starting offset for flags
     * @returns Flags array and next offset, or null if parsing fails
     */
    private parseFlags(
        view: DataView,
        nPoints: number,
        offset: number
    ): { flags: number[]; nextOffset: number } | null {
        const flags: number[] = [];
        let p = offset;

        try {
            while (flags.length < nPoints) {
                if (p >= view.byteLength) return null;
                const flag = this.reader.getUint8(view, p++);
                flags.push(flag);

                // Repeat flag (bit 3 set)
                if (flag & 0x08) {
                    if (p >= view.byteLength) return null;
                    const repeatCount = this.reader.getUint8(view, p++);
                    for (let r = 0; r < repeatCount; r++) {
                        flags.push(flag);
                    }
                }
            }
        } catch {
            return null;
        }

        return { flags, nextOffset: p };
    }

    /**
     * Parses glyph X and Y coordinates from delta values.
     * @param view - DataView containing the glyph data
     * @param flags - Flag array for each point
     * @param offset - Starting offset for coordinates
     * @returns Points array and next offset, or null if parsing fails
     */
    private parseCoordinates(
        view: DataView,
        flags: number[],
        offset: number
    ): { points: Point[]; nextOffset: number } | null {
        const nPoints = flags.length;
        const xs: number[] = new Array(nPoints);
        const ys: number[] = new Array(nPoints);

        let p = offset;

        // Parse X coordinates (deltas)
        try {
            for (let i = 0; i < nPoints; i++) {
                const f = flags[i];
                if (f & 0x02) {
                    // X-Short Vector: 1-byte delta
                    if (p >= view.byteLength) return null;
                    const val = this.reader.getUint8(view, p++);
                    xs[i] = (f & 0x10) ? val : -val; // Bit 4: positive if set
                } else {
                    if (f & 0x10) {
                        // X is same as previous (zero delta)
                        xs[i] = 0;
                    } else {
                        // 2-byte signed delta
                        if (p + 2 > view.byteLength) return null;
                        xs[i] = this.reader.getInt16(view, p);
                        p += 2;
                    }
                }
            }
        } catch {
            return null;
        }

        // Parse Y coordinates (deltas)
        try {
            for (let i = 0; i < nPoints; i++) {
                const f = flags[i];
                if (f & 0x04) {
                    // Y-Short Vector: 1-byte delta
                    if (p >= view.byteLength) return null;
                    const val = this.reader.getUint8(view, p++);
                    ys[i] = (f & 0x20) ? val : -val; // Bit 5: positive if set
                } else {
                    if (f & 0x20) {
                        // Y is same as previous (zero delta)
                        ys[i] = 0;
                    } else {
                        // 2-byte signed delta
                        if (p + 2 > view.byteLength) return null;
                        ys[i] = this.reader.getInt16(view, p);
                        p += 2;
                    }
                }
            }
        } catch {
            return null;
        }

        // Convert deltas to absolute coordinates
        const points: Point[] = new Array(nPoints);
        let curX = 0;
        let curY = 0;
        for (let i = 0; i < nPoints; i++) {
            curX += xs[i];
            curY += ys[i];
            points[i] = {
                x: curX,
                y: curY,
                onCurve: !!(flags[i] & 0x01) // Bit 0: on-curve flag
            };
        }

        return { points, nextOffset: p };
    }

    /**
     * Converts contour points into glyph outline commands.
     * Handles quadratic Bezier curves with consecutive off-curve points.
     * @param contours - Array of contours
     * @returns Array of glyph outline commands
     */
    private buildOutlineCommands(contours: Point[][]): GlyphOutlineCmd[] {
        const cmds: GlyphOutlineCmd[] = [];

        for (const contour of contours) {
            if (contour.length === 0) continue;

            const n = contour.length;
            const getIdx = (i: number) => ((i % n) + n) % n; // Wrap-around index

            // Find a starting on-curve point, if any
            let startPtIndex = -1;
            for (let i = 0; i < n; i++) {
                if (contour[i].onCurve) {
                    startPtIndex = i;
                    break;
                }
            }

            let firstPoint: Point;
            let curIndex: number;

            if (startPtIndex === -1) {
                // No on-curve points: create implied on-curve between last and first off-curve
                const p0 = contour[0];
                const plast = contour[n - 1];
                firstPoint = {
                    x: (plast.x + p0.x) / 2,
                    y: (plast.y + p0.y) / 2,
                    onCurve: true
                };
                curIndex = 0;
            } else {
                firstPoint = contour[startPtIndex];
                curIndex = startPtIndex;
            }

            cmds.push({ type: "moveTo", x: firstPoint.x, y: firstPoint.y });

            // Walk through contour points
            let i = curIndex + 1;
            let steps = 0;
            while (steps < n) {
                const idx = getIdx(i);
                const pt = contour[idx];
                const next = contour[getIdx(i + 1)];

                if (pt.onCurve) {
                    // Straight line to on-curve point
                    cmds.push({ type: "lineTo", x: pt.x, y: pt.y });
                } else {
                    // Off-curve point (quadratic control point)
                    if (next.onCurve) {
                        // Single control point -> quadratic curve
                        cmds.push({ type: "quadTo", cx: pt.x, cy: pt.y, x: next.x, y: next.y });
                        i++; // Consume next point
                        steps++;
                    } else {
                        // Consecutive off-curve points: create implied on-curve midpoint
                        const midx = (pt.x + next.x) / 2;
                        const midy = (pt.y + next.y) / 2;
                        cmds.push({ type: "quadTo", cx: pt.x, cy: pt.y, x: midx, y: midy });
                    }
                }

                i++;
                steps++;
            }

            cmds.push({ type: "close" });
        }

        return cmds;
    }
}
