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
        if (track.kind === "fixed") {
            return {
                kind: "fixed",
                size: resolveNumberLike(track.size, fontSize, rootFontSize) ?? 0,
            };
        }
        if (track.kind === "flex") {
            return {
                kind: "flex",
                flex: track.flex,
                min: resolveNumberLike(track.min, fontSize, rootFontSize),
                max: resolveNumberLike(track.max, fontSize, rootFontSize),
            };
        }
        return {
            kind: "auto",
            min: resolveNumberLike(track.min, fontSize, rootFontSize),
            max: resolveNumberLike(track.max, fontSize, rootFontSize),
        };
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
