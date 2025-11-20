import type { FontResolver, UnifiedFont } from "../fonts/types.js";
import type { FontRegistry } from "../pdf/font/font-registry.js";

/**
 * Adapter that implements FontResolver using FontRegistry.
 * Allows the layout system to resolve fonts during render tree building.
 */
export class FontRegistryResolver implements FontResolver {
    constructor(private readonly fontRegistry: FontRegistry) { }

    async resolve(family: string, weight?: number, style?: string): Promise<UnifiedFont> {
        const fontResource = await this.fontRegistry.ensureFontResource(family, weight, style);

        if (fontResource.metrics) {
            return {
                metrics: {
                    metrics: fontResource.metrics.metrics,
                    glyphMetrics: fontResource.metrics.glyphMetrics,
                    cmap: fontResource.metrics.cmap,
                    headBBox: fontResource.metrics.headBBox,
                },
                program: {
                    sourceFormat: "ttf",
                    unitsPerEm: fontResource.metrics.metrics.unitsPerEm,
                    glyphCount: fontResource.metrics.glyphMetrics.size,
                    getGlyphOutline: fontResource.metrics.getGlyphOutline,
                },
                css: {
                    family,
                    weight: weight ?? 400,
                    style: (style as 'normal' | 'italic') ?? 'normal',
                },
            };
        }

        return this.createFallbackFont(family, weight, style);
    }

    resolveSync(family: string, weight?: number, style?: string): UnifiedFont | undefined {
        const fontResource = this.fontRegistry.ensureFontResourceSync(family, weight, style);

        if (fontResource.metrics) {
            return {
                metrics: {
                    metrics: fontResource.metrics.metrics,
                    glyphMetrics: fontResource.metrics.glyphMetrics,
                    cmap: fontResource.metrics.cmap,
                    headBBox: fontResource.metrics.headBBox,
                },
                program: {
                    sourceFormat: "ttf",
                    unitsPerEm: fontResource.metrics.metrics.unitsPerEm,
                    glyphCount: fontResource.metrics.glyphMetrics.size,
                    getGlyphOutline: fontResource.metrics.getGlyphOutline,
                },
                css: {
                    family,
                    weight: weight ?? 400,
                    style: (style as 'normal' | 'italic') ?? 'normal',
                },
            };
        }

        // Return undefined if no metrics - text rendering will fall back to legacy path
        return undefined;
    }

    private createFallbackFont(family: string, weight?: number, style?: string): UnifiedFont {
        return {
            metrics: {
                metrics: {
                    unitsPerEm: 1000,
                    ascender: 800,
                    descender: -200,
                    lineGap: 0,
                    capHeight: 700,
                    xHeight: 500,
                },
                glyphMetrics: new Map([
                    [0, { advanceWidth: 500, leftSideBearing: 0 }],
                ]),
                cmap: {
                    getGlyphId: () => 0,
                    hasCodePoint: () => false,
                    unicodeMap: new Map(),
                },
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: 1000,
                glyphCount: 1,
            },
            css: {
                family,
                weight: weight ?? 400,
                style: (style as 'normal' | 'italic') ?? 'normal',
            },
        };
    }
}
