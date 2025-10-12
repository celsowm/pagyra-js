export class TtfFontMetrics {
    metrics;
    glyphMetrics;
    cmap;
    constructor(metrics, glyphMetrics, cmap) {
        this.metrics = metrics;
        this.glyphMetrics = glyphMetrics;
        this.cmap = cmap;
    }
}
