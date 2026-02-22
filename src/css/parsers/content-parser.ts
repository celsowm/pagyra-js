import type { StyleAccumulator } from "../style.js";

/**
 * Represents a parsed content value that can be:
 * - A static string
 * - A counter reference
 * - An attribute reference
 * - A quote marker
 */
export type ContentValue =
    | { type: "string"; value: string }
    | { type: "counter"; counter: string; style?: CounterStyle }
    | { type: "attr"; attribute: string }
    | { type: "open-quote" }
    | { type: "close-quote" }
    | { type: "no-open-quote" }
    | { type: "no-close-quote" };

/**
 * Default quote pair if none specified
 */
const DEFAULT_QUOTE_PAIR = ["\u201C", "\u201D"];
export type CounterStyle =
    | "decimal"
    | "decimal-leading-zero"
    | "lower-roman"
    | "upper-roman"
    | "lower-alpha"
    | "upper-alpha";

/**
 * Parse a CSS content property value into ContentValue[]
 * Supports: strings, counter(), attr(), and quote functions
 */
export function parseContent(value: string, target: StyleAccumulator): void {
    const normalized = value.trim();
    if (normalized === "none" || normalized === "inherit") {
        target.content = undefined;
        return;
    }

    const parsed = parseContentValue(normalized);
    if (parsed.length > 0) {
        target.content = parsed;
    }
}

/**
 * Parse the content value string into an array of ContentValue parts
 */
function parseContentValue(value: string): ContentValue[] {
    const result: ContentValue[] = [];
    let i = 0;

    while (i < value.length) {
        // Handle quoted strings
        if (value[i] === '"' || value[i] === "'") {
            const quoteChar = value[i];
            let str = "";
            i++; // Skip opening quote

            while (i < value.length && value[i] !== quoteChar) {
                // Handle escape sequences
                if (value[i] === "\\" && i + 1 < value.length) {
                    const next = value[i + 1];
                    // Common escape sequences
                    if (next === "n") {
                        str += "\n";
                        i += 2;
                    } else if (next === "t") {
                        str += "\t";
                        i += 2;
                    } else if (next === quoteChar) {
                        str += quoteChar;
                        i += 2;
                    } else if (next === "\\") {
                        str += "\\";
                        i += 2;
                    } else {
                        // Hex escape \xNN or Unicode escape \uNNNN
                        if ((next === "x" || next === "u") && i + 3 < value.length) {
                            const hex = value.slice(i + 2, i + 4);
                            if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
                                str += String.fromCharCode(parseInt(hex, 16));
                                i += 4;
                                continue;
                            }
                        }
                        // Just add the escaped character
                        str += next;
                        i += 2;
                    }
                } else {
                    str += value[i];
                    i++;
                }
            }
            i++; // Skip closing quote
            result.push({ type: "string", value: str });
            continue;
        }

        // Handle counter() function
        if (value.slice(i).startsWith("counter(")) {
            const match = /^counter\(\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*(?:,\s*(decimal-leading-zero|decimal|lower-roman|upper-roman|lower-alpha|upper-alpha))?\s*\)/i.exec(value.slice(i));
            if (match) {
                result.push({
                    type: "counter",
                    counter: match[1],
                    style: match[2] as CounterStyle | undefined,
                });
                i += match[0].length;
                continue;
            }
        }

        // Handle counters() function (plural - for nested counters)
        if (value.slice(i).startsWith("counters(")) {
            const match = /^counters\(\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*,\s*(["'])(.*)\2\s*(?:,\s*(decimal-leading-zero|decimal|lower-roman|upper-roman|lower-alpha|upper-alpha))?\s*\)/i.exec(value.slice(i));
            if (match) {
                result.push({
                    type: "counter",
                    counter: match[1],
                    style: match[4] as CounterStyle | undefined,
                });
                i += match[0].length;
                continue;
            }
        }

        // Handle attr() function
        if (value.slice(i).startsWith("attr(")) {
            const match = /^attr\(\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*\)/i.exec(value.slice(i));
            if (match) {
                result.push({ type: "attr", attribute: match[1] });
                i += match[0].length;
                continue;
            }
        }

        // Handle quote functions
        if (value.slice(i).startsWith("open-quote")) {
            result.push({ type: "open-quote" });
            i += 10;
            continue;
        }
        if (value.slice(i).startsWith("close-quote")) {
            result.push({ type: "close-quote" });
            i += 11;
            continue;
        }
        if (value.slice(i).startsWith("no-open-quote")) {
            result.push({ type: "no-open-quote" });
            i += 14;
            continue;
        }
        if (value.slice(i).startsWith("no-close-quote")) {
            result.push({ type: "no-close-quote" });
            i += 15;
            continue;
        }

        // Skip any unrecognized content (could be spaces between items)
        i++;
    }

    return result;
}

/**
 * Format a counter value according to the specified style
 */
export function formatCounterValue(value: number, style?: string): string {
    if (!style || style === "decimal") {
        return String(value);
    }

    const lower = style.toLowerCase();
    if (lower === "decimal-leading-zero") {
        const sign = value < 0 ? "-" : "";
        const abs = Math.abs(Math.trunc(value));
        return `${sign}${String(abs).padStart(2, "0")}`;
    }

    if (lower === "lower-roman") {
        return toRomanNumeral(value)?.toLowerCase() ?? String(value);
    }
    if (lower === "upper-roman") {
        return toRomanNumeral(value)?.toUpperCase() ?? String(value);
    }
    if (lower === "lower-alpha") {
        return toAlphaSequence(value).toLowerCase();
    }
    if (lower === "upper-alpha") {
        return toAlphaSequence(value).toUpperCase();
    }

    return String(value);
}

function toRomanNumeral(n: number): string | undefined {
    if (!Number.isFinite(n) || n <= 0 || n >= 4000) {
        return undefined;
    }
    const romanPairs: Array<[number, string]> = [
        [1000, "M"],
        [900, "CM"],
        [500, "D"],
        [400, "CD"],
        [100, "C"],
        [90, "XC"],
        [50, "L"],
        [40, "XL"],
        [10, "X"],
        [9, "IX"],
        [5, "V"],
        [4, "IV"],
        [1, "I"],
    ];
    let remainder = Math.floor(n);
    let result = "";
    for (const [val, numeral] of romanPairs) {
        while (remainder >= val) {
            result += numeral;
            remainder -= val;
        }
        if (remainder === 0) break;
    }
    return result;
}

function toAlphaSequence(n: number): string {
    let num = Math.max(1, Math.floor(n));
    let result = "";
    while (num > 0) {
        num -= 1;
        const charCode = 65 + (num % 26);
        result = String.fromCharCode(charCode) + result;
        num = Math.floor(num / 26);
    }
    return result;
}

/**
 * Evaluate ContentValue[] to a final string, given a context
 */
export function evaluateContent(
    values: ContentValue[],
    context: {
        getCounter: (name: string) => number;
        getAttribute: (name: string) => string | null;
        quoteDepth: number;
    }
): string {
    let result = "";
    let depth = context.quoteDepth;

    for (const part of values) {
        switch (part.type) {
            case "string":
                result += part.value;
                break;
            case "counter": {
                const counterValue = context.getCounter(part.counter);
                result += formatCounterValue(counterValue, part.style);
                break;
            }
            case "attr": {
                const attrValue = context.getAttribute(part.attribute);
                if (attrValue !== null) {
                    result += attrValue;
                }
                break;
            }
            case "open-quote": {
                const openPair = DEFAULT_QUOTE_PAIR;
                result += openPair[0];
                depth++;
                break;
            }
            case "close-quote": {
                const closePair = DEFAULT_QUOTE_PAIR;
                result += closePair[1];
                depth = Math.max(0, depth - 1);
                break;
            }
            case "no-open-quote":
                depth++;
                break;
            case "no-close-quote":
                depth = Math.max(0, depth - 1);
                break;
        }
    }

    return result;
}
