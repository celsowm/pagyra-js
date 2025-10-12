import { LayoutEngine } from "./engine.js";
import { DisplayNoneStrategy } from "../strategies/display-none.js";
import { BlockLayoutStrategy } from "../strategies/block.js";
import { FlexLayoutStrategy } from "../strategies/flex.js";
import { GridLayoutStrategy } from "../strategies/grid.js";
import { TableLayoutStrategy } from "../strategies/table.js";
import { FallbackStrategy } from "../strategies/fallback.js";
import { InlineLayoutStrategy } from "../strategies/inline.js";
export function createDefaultLayoutEngine() {
    const strategies = [
        new DisplayNoneStrategy(),
        new InlineLayoutStrategy(),
        new BlockLayoutStrategy(),
        new FlexLayoutStrategy(),
        new GridLayoutStrategy(),
        new TableLayoutStrategy(),
        new FallbackStrategy(),
    ];
    return new LayoutEngine({ strategies });
}
