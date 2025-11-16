"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TtfFontMetrics = void 0;
var TtfFontMetrics = /** @class */ (function () {
    function TtfFontMetrics(metrics, glyphMetrics, cmap, 
    // optional head bbox in font units [xMin, yMin, xMax, yMax]
    headBBox, 
    /**
     * Optional hook that returns a glyph's outline command sequence.
     * Present to prepare the API for future glyf / CFF parsing; placeholder
     * implementations should return null when outlines aren't available.
     */
    getGlyphOutline) {
        this.metrics = metrics;
        this.glyphMetrics = glyphMetrics;
        this.cmap = cmap;
        this.headBBox = headBBox;
        this.getGlyphOutline = getGlyphOutline;
    }
    return TtfFontMetrics;
}());
exports.TtfFontMetrics = TtfFontMetrics;
