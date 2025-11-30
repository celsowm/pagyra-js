import { describe, it, expect } from 'vitest';
import { NodeEnvironment } from '../../src/environment/node-environment.js';
import { BrowserEnvironment } from '../../src/environment/browser-environment.js';
import path from 'node:path';

describe('Path Resolution', () => {
    describe('NodeEnvironment', () => {
        it('resolves leading-slash paths relative to base', () => {
            const env = new NodeEnvironment();
            const base = path.resolve('/var/www/public');
            const resolved = env.resolveLocal('/images/duck.jpg', base);
            const expected = path.join(base, 'images', 'duck.jpg');
            expect(path.normalize(resolved)).toBe(path.normalize(expected));
        });

        it('resolves relative paths normally', () => {
            const env = new NodeEnvironment();
            const base = path.resolve('/var/www/public');
            const resolved = env.resolveLocal('images/duck.jpg', base);
            const expected = path.join(base, 'images', 'duck.jpg');
            expect(path.normalize(resolved)).toBe(path.normalize(expected));
        });

        it('passes through HTTP URLs unchanged', () => {
            const env = new NodeEnvironment();
            const url = 'https://example.com/image.jpg';
            expect(env.resolveLocal(url)).toBe(url);
        });

        it('passes through protocol-relative URLs unchanged', () => {
            const env = new NodeEnvironment();
            const url = '//example.com/image.jpg';
            expect(env.resolveLocal(url)).toBe(url);
        });

        it('passes through data URIs unchanged', () => {
            const env = new NodeEnvironment();
            const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
            expect(env.resolveLocal(dataUri)).toBe(dataUri);
        });

        it('resolves paths without base using current directory', () => {
            const env = new NodeEnvironment();
            const resolved = env.resolveLocal('test.jpg');
            expect(path.isAbsolute(resolved)).toBe(true);
            expect(resolved).toContain('test.jpg');
        });

        it('strips leading slash even on Windows', () => {
            const env = new NodeEnvironment();
            const base = 'C:\\Users\\test\\public';
            const resolved = env.resolveLocal('/images/duck.jpg', base);
            // Should resolve to C:\Users\test\public\images\duck.jpg, not C:\images\duck.jpg
            expect(resolved).toContain('public');
            expect(resolved).toContain('images');
            expect(resolved).toContain('duck.jpg');
            expect(resolved).not.toBe(path.join('C:', 'images', 'duck.jpg'));
        });
    });

    describe('BrowserEnvironment', () => {
        it('resolves leading-slash paths relative to base URL', () => {
            const env = new BrowserEnvironment();
            const resolved = env.resolveLocal('/images/duck.jpg', 'http://localhost:3000/');
            expect(resolved).toBe('http://localhost:3000/images/duck.jpg');
        });

        it('resolves relative paths normally', () => {
            const env = new BrowserEnvironment();
            const resolved = env.resolveLocal('images/duck.jpg', 'http://localhost:3000/');
            expect(resolved).toBe('http://localhost:3000/images/duck.jpg');
        });

        it('passes through absolute URLs unchanged', () => {
            const env = new BrowserEnvironment();
            const url = 'https://example.com/image.jpg';
            expect(env.resolveLocal(url)).toBe(url);
        });

        it('passes through protocol-relative URLs unchanged', () => {
            const env = new BrowserEnvironment();
            const url = '//example.com/image.jpg';
            expect(env.resolveLocal(url)).toBe(url);
        });

        it('passes through data URIs unchanged', () => {
            const env = new BrowserEnvironment();
            const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
            expect(env.resolveLocal(dataUri)).toBe(dataUri);
        });

        it('throws error when resolving without base', () => {
            const env = new BrowserEnvironment();
            expect(() => env.resolveLocal('test.jpg')).toThrow('Local path resolution is not supported');
        });

        it('resolves leading-slash paths to origin root (standard URL behavior)', () => {
            const env = new BrowserEnvironment();
            const resolved = env.resolveLocal('/images/duck.jpg', 'http://localhost:3000/examples/');
            // Leading slash in URL context resolves to origin root, not relative to base path
            expect(resolved).toBe('http://localhost:3000/images/duck.jpg');
        });
    });
});
