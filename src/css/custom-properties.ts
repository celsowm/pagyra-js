// src/css/custom-properties.ts

/**
 * CSS Custom Properties (CSS Variables) support
 * Implements variable definition and resolution per CSS Custom Properties spec
 */

/**
 * Storage for custom properties (CSS variables)
 * Maps variable names (e.g., "--primary-color") to their raw string values
 */
export class CustomPropertiesMap {
    private properties: Map<string, string> = new Map();

    /**
     * Set a custom property value
     */
    set(name: string, value: string): void {
        // Ensure the property name starts with --
        if (!name.startsWith('--')) {
            return;
        }
        this.properties.set(name, value.trim());
    }

    /**
     * Get a custom property value
     */
    get(name: string): string | undefined {
        return this.properties.get(name);
    }

    /**
     * Check if a custom property exists
     */
    has(name: string): boolean {
        return this.properties.has(name);
    }

    /**
     * Clone the custom properties map
     */
    clone(): CustomPropertiesMap {
        const cloned = new CustomPropertiesMap();
        this.properties.forEach((value, key) => {
            cloned.set(key, value);
        });
        return cloned;
    }

    /**
     * Inherit properties from a parent map
     * Child properties override parent properties
     */
    inherit(parent: CustomPropertiesMap | undefined): CustomPropertiesMap {
        if (!parent) {
            return this.clone();
        }

        const inherited = parent.clone();
        this.properties.forEach((value, key) => {
            inherited.set(key, value);
        });
        return inherited;
    }

    /**
     * Get all property names
     */
    keys(): string[] {
        return Array.from(this.properties.keys());
    }

    /**
     * Get the number of properties
     */
    get size(): number {
        return this.properties.size;
    }
}

/**
 * Regular expression to match var() function calls
 * Matches: var(--name) or var(--name, fallback)
 */
const VAR_FUNCTION_REGEX = /var\s*\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\s*\)/g;

/**
 * Check if a CSS value contains var() references
 */
export function containsVariableReference(value: string): boolean {
    return value.includes('var(');
}

/**
 * Extract variable name from var() function
 * Example: "var(--primary-color)" -> "--primary-color"
 */
export function extractVariableName(varFunctionCall: string): string | null {
    const match = varFunctionCall.match(/var\s*\(\s*(--[a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}

/**
 * Parse var() function to extract variable name and fallback
 * Returns: { name: string, fallback?: string }
 */
export function parseVarFunction(varFunctionCall: string): { name: string; fallback?: string } | null {
    const trimmed = varFunctionCall.trim();

    // Match var(--name) or var(--name, fallback)
    const match = trimmed.match(/^var\s*\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*(.+))?\s*\)$/);

    if (!match) {
        return null;
    }

    return {
        name: match[1],
        fallback: match[2]?.trim(),
    };
}

/**
 * Resolve CSS value by replacing var() references with actual values
 * Supports nested var() calls and fallback values
 */
export function resolveVariableReferences(
    value: string,
    customProperties: CustomPropertiesMap,
    maxDepth = 10
): string {
    if (!containsVariableReference(value)) {
        return value;
    }

    if (maxDepth <= 0) {
        // Prevent infinite recursion
        console.warn('CSS variable resolution depth limit reached');
        return value;
    }

    let resolved = value;
    const matches = value.matchAll(VAR_FUNCTION_REGEX);

    for (const match of matches) {
        const fullMatch = match[0];
        const varName = match[1];
        const fallback = match[2]?.trim();

        // Try to get the variable value
        let replacement = customProperties.get(varName);

        // If variable not found, use fallback
        if (replacement === undefined) {
            if (fallback !== undefined) {
                replacement = fallback;
            } else {
                // If no fallback, leave the var() call as-is (invalid)
                console.warn(`CSS variable ${varName} not found and no fallback provided`);
                continue;
            }
        }

        // Replace this var() call
        resolved = resolved.replace(fullMatch, replacement);
    }

    // Recursively resolve any nested var() calls
    if (containsVariableReference(resolved)) {
        resolved = resolveVariableReferences(resolved, customProperties, maxDepth - 1);
    }

    return resolved.trim();
}

/**
 * Apply custom properties from declarations to the custom properties map
 * Extracts all properties that start with "--"
 */
export function extractCustomProperties(
    declarations: Record<string, string>
): CustomPropertiesMap {
    const customProps = new CustomPropertiesMap();

    for (const [property, value] of Object.entries(declarations)) {
        if (property.startsWith('--')) {
            customProps.set(property, value);
        }
    }

    return customProps;
}

/**
 * Resolve all property values in declarations by replacing var() references
 */
export function resolveDeclarationsWithVariables(
    declarations: Record<string, string>,
    customProperties: CustomPropertiesMap
): Record<string, string> {
    const resolved: Record<string, string> = {};

    for (const [property, value] of Object.entries(declarations)) {
        // Don't resolve custom properties themselves (they can contain var())
        if (property.startsWith('--')) {
            resolved[property] = value;
        } else {
            // Resolve var() references in regular properties
            resolved[property] = resolveVariableReferences(value, customProperties);
        }
    }

    return resolved;
}
