import type { GlyphOutlineCmd } from "../../types/fonts.js";

/**
 * Represents a 2D affine transformation matrix with translation.
 * Used for transforming composite glyph components in TrueType fonts.
 * 
 * Matrix form:
 * | mxx  myx  tx |
 * | mxy  myy  ty |
 * |  0    0    1 |
 */
export class TransformationMatrix {
    constructor(
        public readonly mxx: number = 1,
        public readonly mxy: number = 0,
        public readonly myx: number = 0,
        public readonly myy: number = 1,
        public readonly tx: number = 0,
        public readonly ty: number = 0
    ) { }

    /**
     * Creates an identity transformation matrix (no transformation).
     */
    static identity(): TransformationMatrix {
        return new TransformationMatrix();
    }

    /**
     * Creates a uniform scale transformation matrix.
     * @param s - Scale factor for both X and Y axes
     */
    static scale(s: number): TransformationMatrix {
        return new TransformationMatrix(s, 0, 0, s, 0, 0);
    }

    /**
     * Creates a non-uniform scale transformation matrix.
     * @param sx - Scale factor for X axis
     * @param sy - Scale factor for Y axis
     */
    static scaleXY(sx: number, sy: number): TransformationMatrix {
        return new TransformationMatrix(sx, 0, 0, sy, 0, 0);
    }

    /**
     * Creates a translation transformation matrix.
     * @param tx - Translation along X axis
     * @param ty - Translation along Y axis
     */
    static translate(tx: number, ty: number): TransformationMatrix {
        return new TransformationMatrix(1, 0, 0, 1, tx, ty);
    }

    /**
     * Creates a transformation matrix from TrueType component transform data.
     * @param tx - Translation X
     * @param ty - Translation Y
     * @param mxx - Matrix element (1,1)
     * @param mxy - Matrix element (1,2)
     * @param myx - Matrix element (2,1)
     * @param myy - Matrix element (2,2)
     */
    static fromComponents(
        tx: number,
        ty: number,
        mxx: number = 1,
        mxy: number = 0,
        myx: number = 0,
        myy: number = 1
    ): TransformationMatrix {
        return new TransformationMatrix(mxx, mxy, myx, myy, tx, ty);
    }

    /**
     * Transforms a single point using this matrix.
     * @param x - X coordinate
     * @param y - Y coordinate
     * @returns Transformed coordinates
     */
    transformPoint(x: number, y: number): { x: number; y: number } {
        return {
            x: x * this.mxx + y * this.myx + this.tx,
            y: x * this.mxy + y * this.myy + this.ty
        };
    }

    /**
     * Applies this transformation to a list of glyph outline commands.
     * Creates new command objects with transformed coordinates.
     * @param cmds - Original glyph outline commands
     * @returns New array of transformed commands
     */
    applyToCommands(cmds: GlyphOutlineCmd[]): GlyphOutlineCmd[] {
        const out: GlyphOutlineCmd[] = [];

        for (const c of cmds) {
            switch (c.type) {
                case "moveTo": {
                    const { x, y } = this.transformPoint(c.x, c.y);
                    out.push({ type: "moveTo", x, y });
                    break;
                }
                case "lineTo": {
                    const { x, y } = this.transformPoint(c.x, c.y);
                    out.push({ type: "lineTo", x, y });
                    break;
                }
                case "quadTo": {
                    const cp = this.transformPoint(c.cx, c.cy);
                    const ep = this.transformPoint(c.x, c.y);
                    out.push({ type: "quadTo", cx: cp.x, cy: cp.y, x: ep.x, y: ep.y });
                    break;
                }
                case "cubicTo": {
                    const cp1 = this.transformPoint(c.cx1, c.cy1);
                    const cp2 = this.transformPoint(c.cx2, c.cy2);
                    const ep = this.transformPoint(c.x, c.y);
                    out.push({
                        type: "cubicTo",
                        cx1: cp1.x, cy1: cp1.y,
                        cx2: cp2.x, cy2: cp2.y,
                        x: ep.x, y: ep.y
                    });
                    break;
                }
                case "close": {
                    out.push({ type: "close" });
                    break;
                }
            }
        }

        return out;
    }
}
