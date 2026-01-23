import { describe, expect, it, beforeAll } from "vitest";
import { registerAllPropertyParsers } from "../../src/css/parsers/register-parsers.js";
import { parseContent, formatCounterValue, evaluateContent } from "../../src/css/parsers/content-parser.js";
import type { StyleAccumulator } from "../../src/css/style.js";

describe("content CSS property parsing", () => {
    beforeAll(() => {
        registerAllPropertyParsers();
    });

    it("parses simple string content", () => {
        const target: StyleAccumulator = {};
        parseContent('"• "', target);
        expect(target.content).toBeDefined();
        expect(target.content).toHaveLength(1);
        expect(target.content![0].type).toBe("string");
        expect((target.content![0] as any).value).toBe("• ");
    });

    it("parses counter() function", () => {
        const target: StyleAccumulator = {};
        parseContent("counter(step)", target);
        expect(target.content).toBeDefined();
        expect(target.content).toHaveLength(1);
        expect(target.content![0].type).toBe("counter");
        expect((target.content![0] as any).counter).toBe("step");
    });

    it("parses counter() with style", () => {
        const target: StyleAccumulator = {};
        parseContent("counter(counter, decimal)", target);
        expect(target.content).toBeDefined();
        expect((target.content![0] as any).style).toBe("decimal");
    });

    it("parses attr() function", () => {
        const target: StyleAccumulator = {};
        parseContent('attr(data-index)', target);
        expect(target.content).toBeDefined();
        expect(target.content![0].type).toBe("attr");
        expect((target.content![0] as any).attribute).toBe("data-index");
    });

    it("parses open-quote", () => {
        const target: StyleAccumulator = {};
        parseContent("open-quote", target);
        expect(target.content).toBeDefined();
        expect(target.content![0].type).toBe("open-quote");
    });

    it("parses close-quote", () => {
        const target: StyleAccumulator = {};
        parseContent("close-quote", target);
        expect(target.content).toBeDefined();
        expect(target.content![0].type).toBe("close-quote");
    });

    it("handles none value", () => {
        const target: StyleAccumulator = {};
        parseContent("none", target);
        expect(target.content).toBeUndefined();
    });
});

describe("formatCounterValue", () => {
    it("formats decimal", () => {
        expect(formatCounterValue(1)).toBe("1");
        expect(formatCounterValue(42)).toBe("42");
    });

    it("formats lower-roman", () => {
        expect(formatCounterValue(1, "lower-roman")).toBe("i");
        expect(formatCounterValue(4, "lower-roman")).toBe("iv");
        expect(formatCounterValue(9, "lower-roman")).toBe("ix");
        expect(formatCounterValue(3999, "lower-roman")).toBe("mmmcmxcix");
    });

    it("formats upper-roman", () => {
        expect(formatCounterValue(1, "upper-roman")).toBe("I");
        expect(formatCounterValue(4, "upper-roman")).toBe("IV");
        expect(formatCounterValue(9, "upper-roman")).toBe("IX");
    });

    it("formats lower-alpha", () => {
        expect(formatCounterValue(1, "lower-alpha")).toBe("a");
        expect(formatCounterValue(26, "lower-alpha")).toBe("z");
        expect(formatCounterValue(27, "lower-alpha")).toBe("aa");
    });

    it("formats upper-alpha", () => {
        expect(formatCounterValue(1, "upper-alpha")).toBe("A");
        expect(formatCounterValue(26, "upper-alpha")).toBe("Z");
        expect(formatCounterValue(27, "upper-alpha")).toBe("AA");
    });
});

describe("evaluateContent", () => {
    it("evaluates string content", () => {
        const values = [{ type: "string" as const, value: "Hello" }];
        const result = evaluateContent(values, {
            getCounter: () => 0,
            getAttribute: () => null,
            quoteDepth: 0,
        });
        expect(result).toBe("Hello");
    });

    it("evaluates counter content", () => {
        const values = [{ type: "counter" as const, counter: "step", style: "decimal" as const }];
        const result = evaluateContent(values, {
            getCounter: (name) => (name === "step" ? 5 : 0),
            getAttribute: () => null,
            quoteDepth: 0,
        });
        expect(result).toBe("5");
    });

    it("evaluates attr content", () => {
        const values = [{ type: "attr" as const, attribute: "data-id" }];
        const result = evaluateContent(values, {
            getCounter: () => 0,
            getAttribute: (name) => (name === "data-id" ? "item-123" : null),
            quoteDepth: 0,
        });
        expect(result).toBe("item-123");
    });

    it("evaluates mixed content", () => {
        const values = [
            { type: "string" as const, value: "Step " },
            { type: "counter" as const, counter: "step", style: "decimal" as const },
            { type: "string" as const, value: ": " },
        ];
        const result = evaluateContent(values, {
            getCounter: (name) => (name === "step" ? 3 : 0),
            getAttribute: () => null,
            quoteDepth: 0,
        });
        expect(result).toBe("Step 3: ");
    });
});
