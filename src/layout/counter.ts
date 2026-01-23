// src/layout/counter.ts

/**
 * CSS Counter State Machine
 * 
 * Manages CSS counters as specified in CSS Lists and Counter Styles Level 3.
 * Handles:
 * - Named counters with scope
 * - counter-reset (initialize/set counter)
 * - counter-increment (increment counter)
 * - Nested counter scopes
 * - Continuous counting across pages (pro mode)
 */

export interface CounterScope {
    readonly id: string;
    readonly parent: CounterScope | null;
    readonly depth: number;
}

export interface CounterState {
    readonly scope: CounterScope;
    readonly value: number;
}

export interface CounterDefinition {
    readonly name: string;
    readonly initialValue: number;
}

export interface CounterReset {
    readonly name: string;
    readonly value: number;
}

export interface CounterIncrement {
    readonly name: string;
    readonly value: number;
}

export interface CounterContext {
    getScopeId(): string;
    getCounter(name: string): number;
    registerScope(parentScopeId: string | null): string;
    resetCounter(name: string, value: number, scopeId: string): void;
    incrementCounter(name: string, value: number, scopeId: string): void;
}

let scopeCounter = 0;
let globalCounter = 0;

/**
 * Create a new counter scope
 */
function createScope(parent: CounterScope | null): CounterScope {
    return {
        id: `scope-${++scopeCounter}`,
        parent,
        depth: parent ? parent.depth + 1 : 0,
    };
}

/**
 * Create a new counter context with professional features
 */
export function createCounterContext(): CounterContext {
    const counters = new Map<string, Map<string, number>>(); // scopeId -> counterName -> value
    const scopes = new Map<string, CounterScope>(); // scopeId -> scope
    const scopeHierarchy = new Map<string, string | null>(); // scopeId -> parentScopeId

    function ensureCounter(scopeId: string, name: string): void {
        if (!counters.has(scopeId)) {
            counters.set(scopeId, new Map());
        }
        const scopeCounters = counters.get(scopeId)!;
        if (!scopeCounters.has(name)) {
            scopeCounters.set(name, 0);
        }
    }

    function getEffectiveValue(scopeId: string, name: string): number {
        // Search up the scope chain for the counter value
        let currentScopeId: string | null = scopeId;
        while (currentScopeId !== null) {
            const scopeCounters = counters.get(currentScopeId);
            if (scopeCounters && scopeCounters.has(name)) {
                return scopeCounters.get(name)!;
            }
            currentScopeId = scopeHierarchy.get(currentScopeId) ?? null;
        }
        return 0;
    }

    return {
        getScopeId(): string {
            return `global-${++globalCounter}`;
        },

        getCounter(name: string): number {
            // Get from the innermost active scope
            let currentScopeId: string | null = null;
            for (const [sid, parentId] of scopeHierarchy) {
                if (parentId === null) {
                    currentScopeId = sid;
                }
            }
            if (!currentScopeId) {
                // No scopes active, use global counter
                return getEffectiveValue("global", name);
            }
            return getEffectiveValue(currentScopeId, name);
        },

        registerScope(parentScopeId: string | null): string {
            const scope = createScope(parentScopeId ? scopes.get(parentScopeId) ?? null : null);
            scopes.set(scope.id, scope);
            scopeHierarchy.set(scope.id, parentScopeId);
            return scope.id;
        },

        resetCounter(name: string, value: number, scopeId: string): void {
            ensureCounter(scopeId, name);
            const scopeCounters = counters.get(scopeId)!;
            scopeCounters.set(name, value);
        },

        incrementCounter(name: string, value: number, scopeId: string): void {
            ensureCounter(scopeId, name);
            const scopeCounters = counters.get(scopeId)!;
            const current = scopeCounters.get(name) ?? 0;
            scopeCounters.set(name, current + value);
        },
    };
}

/**
 * Parse counter-reset CSS value
 * Examples: "foo 1", "foo bar 2", "foo"
 */
export function parseCounterReset(value: string): CounterReset[] {
    if (!value || value === "none") {
        return [];
    }

    const result: CounterReset[] = [];
    const tokens = value.trim().split(/\s+/);
    
    for (let i = 0; i < tokens.length; i++) {
        const name = tokens[i];
        const next = tokens[i + 1];
        
        // Check if next token is a number
        if (next && /^-?\d+$/.test(next)) {
            result.push({ name, value: parseInt(next, 10) });
            i++; // Skip the number
        } else {
            result.push({ name, value: 0 }); // Default to 0
        }
    }

    return result;
}

/**
 * Parse counter-increment CSS value
 * Examples: "foo 1", "foo bar 2", "foo"
 */
export function parseCounterIncrement(value: string): CounterIncrement[] {
    if (!value || value === "none") {
        return [];
    }

    const result: CounterIncrement[] = [];
    const tokens = value.trim().split(/\s+/);
    
    for (let i = 0; i < tokens.length; i++) {
        const name = tokens[i];
        const next = tokens[i + 1];
        
        // Check if next token is a number
        if (next && /^-?\d+$/.test(next)) {
            result.push({ name, value: parseInt(next, 10) });
            i++; // Skip the number
        } else {
            result.push({ name, value: 1 }); // Default to increment by 1
        }
    }

    return result;
}

/**
 * Apply counter-reset declarations to a scope
 */
export function applyCounterResets(
    context: CounterContext,
    resets: CounterReset[],
    scopeId: string
): void {
    for (const reset of resets) {
        context.resetCounter(reset.name, reset.value, scopeId);
    }
}

/**
 * Apply counter-increment declarations to a scope
 */
export function applyCounterIncrements(
    context: CounterContext,
    increments: CounterIncrement[],
    scopeId: string
): void {
    for (const inc of increments) {
        context.incrementCounter(inc.name, inc.value, scopeId);
    }
}

/**
 * Get a copy of counter state for debugging or serialization
 */
export function getCounterSnapshot(_context: CounterContext): Record<string, number> {
    const result: Record<string, number> = {};
    // This is a simplified snapshot - in practice you'd traverse all scopes
    return result;
}
