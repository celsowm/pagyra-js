import type { LengthInput, LengthLike, RelativeLength } from "./length.js";
import { resolveLengthInput, resolveNumberLike } from "./length.js";

/**
 * CSS unit resolver
 * Responsibility: Resolve CSS units (px, em, rem, %) to absolute values
 */
export class CssUnitResolver {
    constructor(
        private readonly fontSize: number,
        private readonly rootFontSize: number
    ) { }

    /**
     * Resolve a LengthInput to absolute pixels
     */
    resolveLengthInput(value: LengthInput | undefined): LengthLike | undefined {
        return resolveLengthInput(value, this.fontSize, this.rootFontSize);
    }

    /**
     * Resolve a numeric length (number or relative) to pixels
     */
    resolveNumberLike(value: number | RelativeLength | undefined): number | undefined {
        return resolveNumberLike(value, this.fontSize, this.rootFontSize);
    }

    /**
     * Resolve shadow length with optional clamping to non-negative
     */
    resolveShadowLength(value: number | RelativeLength | undefined, clamp = false): number {
        const resolved = this.resolveNumberLike(value);
        if (resolved === undefined) {
            return 0;
        }
        if (clamp && resolved < 0) {
            return 0;
        }
        return resolved;
    }

    /**
     * Create a callback to assign resolved length
     */
    createLengthAssigner(setter: (resolved: LengthLike) => void) {
        return (value: LengthInput | undefined): void => {
            const resolved = this.resolveLengthInput(value);
            if (resolved !== undefined) {
                setter(resolved);
            }
        };
    }

    /**
     * Create a callback to assign resolved numeric length
     */
    createNumberAssigner(setter: (resolved: number) => void) {
        return (value: number | RelativeLength | undefined): void => {
            const resolved = this.resolveNumberLike(value);
            if (resolved !== undefined) {
                setter(resolved);
            }
        };
    }
}
