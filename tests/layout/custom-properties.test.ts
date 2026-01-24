import { CustomPropertiesMap, resolveVariableReferences } from '../../src/css/custom-properties.js';

describe('CSS Custom Properties', () => {

    it('should resolve simple variable references', () => {
        const customProps = new CustomPropertiesMap();
        customProps.set('--main-color', 'red');

        expect(resolveVariableReferences('var(--main-color)', customProps)).toBe('red');
        expect(resolveVariableReferences('1px solid var(--main-color)', customProps)).toBe('1px solid red');
    });

    it('should handle fallback values', () => {
        const customProps = new CustomPropertiesMap();

        expect(resolveVariableReferences('var(--unknown, blue)', customProps)).toBe('blue');
        expect(resolveVariableReferences('var(--unknown, 10px)', customProps)).toBe('10px');
    });

    it('should handle nested variable references', () => {
        const customProps = new CustomPropertiesMap();
        customProps.set('--primary', 'blue');
        customProps.set('--accent', 'var(--primary)');

        expect(resolveVariableReferences('var(--accent)', customProps)).toBe('blue');
    });

    it('should handle circular references gracefully (depth limit)', () => {
        const customProps = new CustomPropertiesMap();
        customProps.set('--a', 'var(--b)');
        customProps.set('--b', 'var(--a)');

        // Should not crash, but return the unresolved reference eventually
        const result = resolveVariableReferences('var(--a)', customProps);
        expect(result).toContain('var(');
    });
});
