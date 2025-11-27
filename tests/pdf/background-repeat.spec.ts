import { describe, it, expect, beforeAll } from "vitest";
import { registerAllPropertyParsers } from "../../src/css/parsers/register-parsers.js";
import { applyBackgroundRepeatDecl } from "../../src/css/parsers/background-parser-extended.js";
import { parseBackgroundImage, parseBackground } from "../../src/css/parsers/background-parser-extended.js";
import type { ImageBackgroundLayer, GradientBackgroundLayer } from "../../src/css/background-types.js";

interface StyleAccumulator {
    backgroundLayers?: Array<ImageBackgroundLayer | GradientBackgroundLayer>;
    [key: string]: any;
}

describe("background-repeat CSS parsing", () => {
    beforeAll(() => {
        registerAllPropertyParsers();
    });

    it("parses background-repeat: no-repeat", () => {
        const target: StyleAccumulator = {};
        parseBackgroundImage('url(test.png)', target);
        applyBackgroundRepeatDecl('no-repeat', target);

        expect(target.backgroundLayers).toBeDefined();
        const imageLayer = target.backgroundLayers?.find((l) => l.kind === "image") as ImageBackgroundLayer;
        expect(imageLayer).toBeDefined();
        expect(imageLayer?.repeat).toBe("no-repeat");
    });

    it("parses background-repeat: repeat", () => {
        const target: StyleAccumulator = {};
        parseBackgroundImage('url(test.png)', target);
        applyBackgroundRepeatDecl('repeat', target);

        expect(target.backgroundLayers).toBeDefined();
        const imageLayer = target.backgroundLayers?.find((l) => l.kind === "image") as ImageBackgroundLayer;
        expect(imageLayer).toBeDefined();
        expect(imageLayer?.repeat).toBe("repeat");
    });

    it("parses background-repeat: repeat-x", () => {
        const target: StyleAccumulator = {};
        parseBackgroundImage('url(test.png)', target);
        applyBackgroundRepeatDecl('repeat-x', target);

        expect(target.backgroundLayers).toBeDefined();
        const imageLayer = target.backgroundLayers?.find((l) => l.kind === "image") as ImageBackgroundLayer;
        expect(imageLayer).toBeDefined();
        expect(imageLayer?.repeat).toBe("repeat-x");
    });

    it("parses background-repeat: repeat-y", () => {
        const target: StyleAccumulator = {};
        parseBackgroundImage('url(test.png)', target);
        applyBackgroundRepeatDecl('repeat-y', target);

        expect(target.backgroundLayers).toBeDefined();
        const imageLayer = target.backgroundLayers?.find((l) => l.kind === "image") as ImageBackgroundLayer;
        expect(imageLayer).toBeDefined();
        expect(imageLayer?.repeat).toBe("repeat-y");
    });

    it("parses background-repeat: space", () => {
        const target: StyleAccumulator = {};
        parseBackgroundImage('url(test.png)', target);
        applyBackgroundRepeatDecl('space', target);

        expect(target.backgroundLayers).toBeDefined();
        const imageLayer = target.backgroundLayers?.find((l) => l.kind === "image") as ImageBackgroundLayer;
        expect(imageLayer).toBeDefined();
        expect(imageLayer?.repeat).toBe("space");
    });

    it("parses background-repeat: round", () => {
        const target: StyleAccumulator = {};
        parseBackgroundImage('url(test.png)', target);
        applyBackgroundRepeatDecl('round', target);

        expect(target.backgroundLayers).toBeDefined();
        const imageLayer = target.backgroundLayers?.find((l) => l.kind === "image") as ImageBackgroundLayer;
        expect(imageLayer).toBeDefined();
        expect(imageLayer?.repeat).toBe("round");
    });

    it("defaults to repeat when background-repeat is not specified", () => {
        const target: StyleAccumulator = {};
        parseBackgroundImage('url(test.png)', target);

        expect(target.backgroundLayers).toBeDefined();
        const imageLayer = target.backgroundLayers?.find((l) => l.kind === "image") as ImageBackgroundLayer;
        expect(imageLayer).toBeDefined();
        expect(imageLayer?.repeat).toBe("repeat");
    });

    it("parses background-repeat from background shorthand", () => {
        const target: StyleAccumulator = {};
        parseBackground('url(test.png) no-repeat', target);

        expect(target.backgroundLayers).toBeDefined();
        const imageLayer = target.backgroundLayers?.find((l) => l.kind === "image") as ImageBackgroundLayer;
        expect(imageLayer).toBeDefined();
        expect(imageLayer?.repeat).toBe("no-repeat");
    });

    it("applies background-repeat to gradients", () => {
        const target: StyleAccumulator = {};
        parseBackgroundImage('linear-gradient(red, blue)', target);
        applyBackgroundRepeatDecl('no-repeat', target);

        expect(target.backgroundLayers).toBeDefined();
        const gradientLayer = target.backgroundLayers?.find((l) => l.kind === "gradient") as GradientBackgroundLayer;
        expect(gradientLayer).toBeDefined();
        expect(gradientLayer?.repeat).toBe("no-repeat");
    });

    it("overrides background-repeat when specified after background shorthand", () => {
        const target: StyleAccumulator = {};
        parseBackground('url(test.png) repeat', target);
        applyBackgroundRepeatDecl('no-repeat', target);

        expect(target.backgroundLayers).toBeDefined();
        const imageLayer = target.backgroundLayers?.find((l) => l.kind === "image") as ImageBackgroundLayer;
        expect(imageLayer).toBeDefined();
        expect(imageLayer?.repeat).toBe("no-repeat");
    });


    it("ignores invalid background-repeat values", () => {
        const target: StyleAccumulator = {};
        parseBackgroundImage('url(test.png)', target);
        applyBackgroundRepeatDecl('invalid-value', target);

        expect(target.backgroundLayers).toBeDefined();
        const imageLayer = target.backgroundLayers?.find((l) => l.kind === "image") as ImageBackgroundLayer;
        expect(imageLayer).toBeDefined();
        // Should keep the default 'repeat' value
        expect(imageLayer?.repeat).toBe("repeat");
    });
});
