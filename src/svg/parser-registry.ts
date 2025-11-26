import type { SvgNode } from "./types.js";

/**
 * Context object passed to SVG element parsers.
 */
export interface SvgParseContext {
    warn: (message: string) => void;
}

/**
 * Function signature for parsing a specific SVG element type.
 * 
 * @param element - The DOM element to parse
 * @param context - Parsing context with utilities like warn
 * @returns Parsed SVG node or null if parsing fails
 */
export type ElementParser = (
    element: Element,
    context: SvgParseContext
) => SvgNode | null;

/**
 * Registry for SVG element parsers, enabling extensibility.
 * 
 * This class implements the Registry pattern to allow:
 * - Adding custom parsers for non-standard SVG elements
 * - Overriding default parsers with custom implementations
 * - Cleaner separation of concerns (Open/Closed Principle)
 */
export class ParserRegistry {
    private readonly parsers = new Map<string, ElementParser>();

    /**
     * Registers a parser for a specific SVG element tag.
     * 
     * @param tagName - The element tag name (lowercase)
     * @param parser - The parser function to handle this element
     */
    register(tagName: string, parser: ElementParser): void {
        this.parsers.set(tagName.toLowerCase(), parser);
    }

    /**
     * Parses an element using the registered parser for its tag.
     * 
     * @param element - The DOM element to parse
     * @param context - Parsing context
     * @returns Parsed SVG node or null if no parser is registered or parsing fails
     */
    parse(element: Element, context: SvgParseContext): SvgNode | null {
        const tag = element.tagName.toLowerCase();
        const parser = this.parsers.get(tag);

        if (!parser) {
            context.warn(`Unsupported <${tag}> element ignored.`);
            return null;
        }

        return parser(element, context);
    }

    /**
     * Checks if a parser is registered for the given tag.
     * 
     * @param tagName - The element tag name to check
     * @returns true if a parser is registered
     */
    has(tagName: string): boolean {
        return this.parsers.has(tagName.toLowerCase());
    }
}
