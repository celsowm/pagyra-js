/**
 * Strategy pattern for text alignment calculations.
 * Each strategy determines how to offset content within available space.
 */
export interface TextAlignmentStrategy {
    /**
     * Calculate the horizontal offset for aligning content.
     * @param lineWidth The actual width of content on the line
     * @param availableWidth The total available width for the line
     * @returns The offset (in pixels) to apply to the line start position
     */
    calculateOffset(lineWidth: number, availableWidth: number): number;
}

/**
 * Left alignment strategy - content starts at the beginning
 */
export class LeftAlignment implements TextAlignmentStrategy {
    calculateOffset(): number {
        return 0;
    }
}

/**
 * Center alignment strategy - centers content within available space
 */
export class CenterAlignment implements TextAlignmentStrategy {
    calculateOffset(lineWidth: number, availableWidth: number): number {
        const slack = Math.max(availableWidth - lineWidth, 0);
        return slack / 2;
    }
}

/**
 * Right/End alignment strategy - content ends at the end of available space
 */
export class RightAlignment implements TextAlignmentStrategy {
    calculateOffset(lineWidth: number, availableWidth: number): number {
        const slack = Math.max(availableWidth - lineWidth, 0);
        return slack;
    }
}

/**
 * Justify alignment strategy - same as left for now (full justification handled separately via space adjustment)
 */
export class JustifyAlignment implements TextAlignmentStrategy {
    calculateOffset(): number {
        return 0;
    }
}

/**
 * Factory function to get the appropriate alignment strategy based on text-align value.
 * @param textAlign The CSS text-align value (normalized)
 * @returns The corresponding alignment strategy
 */
export function getAlignmentStrategy(textAlign?: string): TextAlignmentStrategy {
    switch (textAlign) {
        case "center":
            return new CenterAlignment();
        case "right":
        case "end":
            return new RightAlignment();
        case "justify":
            return new JustifyAlignment();
        default:
            return new LeftAlignment();
    }
}
