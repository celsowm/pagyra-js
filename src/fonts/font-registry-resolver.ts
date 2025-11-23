import type { FontResolver, UnifiedFont } from "../fonts/types.js";
import type { FontRegistry, FontResource } from "../pdf/font/font-registry.js";

/**
 * Adapter that implements FontResolver using FontRegistry.
 * Allows the layout system to resolve fonts during render tree building.
 */
export class FontRegistryResolver implements FontResolver {
    private readonly rawTableAccessors = new WeakMap<FontResource, (tag: string) => Uint8Array | null>();

    constructor(private readonly fontRegistry: FontRegistry) { }

    async resolve(family: string, weight?: number, style?: string): Promise<UnifiedFont> {
        const fontResource = await this.fontRegistry.ensureFontResource(family, weight, style);

        return this.toUnifiedFont(fontResource, family, weight, style) ?? this.createFallbackFont(family, weight, style);
    }

    resolveSync(family: string, weight?: number, style?: string): UnifiedFont | undefined {
        const fontResource = this.fontRegistry.ensureFontResourceSync(family, weight, style);

        return this.toUnifiedFont(fontResource, family, weight, style);
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

    private toUnifiedFont(fontResource: FontResource, family: string, weight?: number, style?: string): UnifiedFont | undefined {
        const metrics = fontResource.metrics;
        if (!metrics) return undefined;

        const getRawTableData = this.lookupRawTableAccessor(fontResource);
        return {
            metrics: {
                metrics: metrics.metrics,
                glyphMetrics: metrics.glyphMetrics,
                cmap: metrics.cmap,
                headBBox: metrics.headBBox,
            },
            program: {
                sourceFormat: "ttf",
                unitsPerEm: metrics.metrics.unitsPerEm,
                glyphCount: metrics.glyphMetrics.size,
                getGlyphOutline: metrics.getGlyphOutline,
                getRawTableData,
            },
            css: {
                family,
                weight: weight ?? 400,
                style: (style as 'normal' | 'italic') ?? 'normal',
            },
        };
    }

    private lookupRawTableAccessor(fontResource: FontResource): ((tag: string) => Uint8Array | null) | undefined {
        const rawBytes: Uint8Array | undefined = fontResource.embedded?.subset;
        if (!rawBytes || rawBytes.byteLength < 12) {
            return undefined;
        }

        const cached = this.rawTableAccessors.get(fontResource);
        if (cached) return cached;

        const accessor = createRawTableAccessor(rawBytes);
        this.rawTableAccessors.set(fontResource, accessor);
        return accessor;
    }
}

function createRawTableAccessor(ttfBytes: Uint8Array): (tag: string) => Uint8Array | null {
    const directory = parseTtfTableDirectory(ttfBytes);
    return (tag: string) => directory.get(tag) ?? null;
}

function parseTtfTableDirectory(ttfBytes: Uint8Array): Map<string, Uint8Array> {
    const tables = new Map<string, Uint8Array>();
    if (ttfBytes.byteLength < 12) return tables;

    const view = new DataView(ttfBytes.buffer, ttfBytes.byteOffset, ttfBytes.byteLength);
    const numTables = view.getUint16(4, false);

    for (let i = 0; i < numTables; i++) {
        const entryOffset = 12 + i * 16;
        if (entryOffset + 16 > ttfBytes.byteLength) break;

        const tag = String.fromCharCode(
            ttfBytes[entryOffset],
            ttfBytes[entryOffset + 1],
            ttfBytes[entryOffset + 2],
            ttfBytes[entryOffset + 3]
        );

        const offset = view.getUint32(entryOffset + 8, false);
        const length = view.getUint32(entryOffset + 12, false);

        if (offset + length > ttfBytes.byteLength) continue;
        tables.set(tag, ttfBytes.subarray(offset, offset + length));
    }

    return tables;
}
