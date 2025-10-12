export class LayoutEnvironment {
    options;
    constructor(options) {
        this.options = options;
    }
    get viewport() {
        return this.options.viewport;
    }
}
