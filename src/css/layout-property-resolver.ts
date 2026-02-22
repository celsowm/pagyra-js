import type { TrackDefinitionInput, TrackSizeInput, TrackDefinition, TrackSize } from "./style.js";
import { resolveNumberLike } from "./length.js";

/**
 * Layout property resolver
 * Responsibility: Resolve complex layout properties (grid, flexbox)
 */
export class LayoutPropertyResolver {
    /**
     * Resolve a track size input to absolute values
     */
    static resolveTrackSizeInputToAbsolute(
        track: TrackSizeInput,
        fontSize: number,
        rootFontSize: number
    ): TrackSize {
        switch (track.kind) {
            case "fixed":
                return {
                    kind: "fixed",
                    size: resolveNumberLike(track.size, fontSize, rootFontSize) ?? 0,
                };
            case "flex":
                return {
                    kind: "flex",
                    flex: track.flex,
                    min: resolveNumberLike(track.min, fontSize, rootFontSize),
                    max: resolveNumberLike(track.max, fontSize, rootFontSize),
                };
            case "auto":
                return {
                    kind: "auto",
                    min: resolveNumberLike(track.min, fontSize, rootFontSize),
                    max: resolveNumberLike(track.max, fontSize, rootFontSize),
                };
            case "clamp":
                return {
                    kind: "clamp",
                    min: resolveNumberLike(track.min, fontSize, rootFontSize) ?? 0,
                    preferred: resolveNumberLike(track.preferred, fontSize, rootFontSize) ?? 0,
                    max: resolveNumberLike(track.max, fontSize, rootFontSize) ?? 0,
                };
            default:
                return {
                    kind: "auto",
                };
        }
    }

    /**
     * Resolve track definitions (for CSS Grid)
     */
    static resolveTrackDefinitionsInput(
        definitions: TrackDefinitionInput[] | undefined,
        fontSize: number,
        rootFontSize: number
    ): TrackDefinition[] | undefined {
        if (!definitions) {
            return undefined;
        }
        return definitions.map((definition) => {
            if (definition.kind === "repeat") {
                return {
                    kind: "repeat",
                    count: definition.count,
                    track: LayoutPropertyResolver.resolveTrackSizeInputToAbsolute(
                        definition.track,
                        fontSize,
                        rootFontSize
                    ),
                };
            }
            if (definition.kind === "repeat-auto") {
                return {
                    kind: "repeat-auto",
                    mode: definition.mode,
                    track: LayoutPropertyResolver.resolveTrackSizeInputToAbsolute(
                        definition.track,
                        fontSize,
                        rootFontSize
                    ),
                };
            }
            return LayoutPropertyResolver.resolveTrackSizeInputToAbsolute(definition, fontSize, rootFontSize);
        });
    }
}
