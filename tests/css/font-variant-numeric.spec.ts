import { registerAllPropertyParsers } from "../../src/css/parsers/register-parsers.js";
import { parseFontVariantNumeric, hasFontVariantNumeric } from "../../src/css/properties/typography.js";
import { parseFontVariantNumeric as parseFromFontParser } from "../../src/css/parsers/font-parser.js";
import type { StyleAccumulator } from "../../src/css/style.js";

describe("font-variant-numeric CSS property", () => {
    beforeAll(() => {
        registerAllPropertyParsers();
    });

    it("parses tabular-nums", () => {
        const result = parseFontVariantNumeric("tabular-nums");
        expect(result).toEqual(["tabular-nums"]);
    });

    it("parses slashed-zero", () => {
        const result = parseFontVariantNumeric("slashed-zero");
        expect(result).toEqual(["slashed-zero"]);
    });

    it("parses ordinal", () => {
        const result = parseFontVariantNumeric("ordinal");
        expect(result).toEqual(["ordinal"]);
    });

    it("parses multiple values", () => {
        const result = parseFontVariantNumeric("tabular-nums slashed-zero");
        expect(result).toEqual(["tabular-nums", "slashed-zero"]);
    });

    it("parses normal", () => {
        const result = parseFontVariantNumeric("normal");
        expect(result).toEqual(["normal"]);
    });

    it("ignores invalid values", () => {
        const result = parseFontVariantNumeric("tabular-nums invalid-feature");
        // Only valid values should be kept
        expect(result).toEqual(["tabular-nums"]);
    });

    it("hasFontVariantNumeric returns true when present", () => {
        const values = parseFontVariantNumeric("tabular-nums slashed-zero");
        expect(hasFontVariantNumeric(values, "tabular-nums")).toBe(true);
        expect(hasFontVariantNumeric(values, "slashed-zero")).toBe(true);
        expect(hasFontVariantNumeric(values, "ordinal")).toBe(false);
    });

    it("hasFontVariantNumeric returns false for normal", () => {
        const values = parseFontVariantNumeric("normal");
        expect(hasFontVariantNumeric(values, "tabular-nums")).toBe(false);
    });

    it("can parse from CSS via font-parser", () => {
        const target: StyleAccumulator = {};
        parseFromFontParser("tabular-nums slashed-zero", target);
        expect(target.fontVariantNumeric).toEqual(["tabular-nums", "slashed-zero"]);
    });
});
