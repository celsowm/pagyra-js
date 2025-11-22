/**
 * Parse inline style attribute
 * Responsibility: Convert style string to property map
 */
export function parseInlineStyle(style: string): Record<string, string> {
    const properties: Record<string, string> = {};

    if (!style || typeof style !== 'string') {
        return properties;
    }

    const declarations = style.split(';');

    for (const decl of declarations) {
        const colonIndex = decl.indexOf(':');
        if (colonIndex === -1) continue;

        const property = decl.substring(0, colonIndex).trim();
        const value = decl.substring(colonIndex + 1).trim();

        if (property && value) {
            properties[property] = value;
        }
    }

    return properties;
}
