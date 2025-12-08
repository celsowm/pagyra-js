# Antipatterns Analysis for Pagyra-JS

## 1. Global State and Singleton Pattern

### Issues Found:
- **Global Glyph Atlases**: `globalGlyphAtlas` and `globalGlyphAtlasMaxRects` in `src/pdf/font/glyph-atlas.ts` and `src/pdf/font/glyph-atlas-maxrects.ts`
- **Global Environment**: `globalThis.__PAGYRA_ENV__` in `src/environment/global.ts`
- **Global Debug Configuration**: `current` variable in `src/logging/debug.ts`
- **Singleton Services**: `ImageService.instance` in `src/image/image-service.ts`

### Problems:
- Makes testing difficult
- Creates hidden dependencies
- Hard to reason about state changes
- Prevents proper dependency injection

## 2. Excessive Use of Type Assertions (`as any`)

### Issues Found:
- **Widespread `as any` usage**: Found in numerous files including:
  - `src/html-to-pdf.ts` (multiple instances)
  - `src/pdf/renderers/text-shadow-renderer.ts`
  - `src/svg/render-svg.ts`
  - `src/css/compute-style.ts`
  - `src/pdf/renderers/shape-renderer.ts`

### Problems:
- Bypasses TypeScript's type safety
- Hides potential runtime errors
- Makes code harder to maintain and refactor
- Indicates poor type system design

## 3. Circular Dependencies

### Issues Found:
- **Complex import cycles**: Between modules like:
  - `src/pdf/font/font-registry.ts` ↔ `src/pdf/font/embedder.ts`
  - `src/layout/pipeline/engine.ts` ↔ `src/layout/pipeline/strategy.ts`
  - `src/css/style.ts` ↔ `src/css/compute-style.ts`

### Problems:
- Creates tight coupling between modules
- Makes code harder to test in isolation
- Can cause initialization order issues
- Slows down build times

## 4. God Objects and Large Classes

### Issues Found:
- **Massive classes**: `src/html-to-pdf.ts` (410 lines)
- **Overloaded responsibilities**: `src/pdf/font/font-registry.ts` handles font loading, embedding, subsetting, and resolution
- **Monolithic functions**: `prepareHtmlRender()` function is overly complex

### Problems:
- Violates Single Responsibility Principle
- Hard to test and maintain
- Difficult to understand and modify
- High cognitive complexity

## 5. Inconsistent Error Handling

### Issues Found:
- **Mixed error handling**: Some functions throw errors, others return null/undefined
- **Inconsistent error types**: Mix of Error objects, strings, and custom error formats
- **Lack of proper error boundaries**

### Problems:
- Makes error handling unpredictable
- Hard to handle errors consistently
- Can lead to runtime crashes

## 6. Overuse of Global Variables and Constants

### Issues Found:
- **Global constants**: `BASE_FONT_ALIASES`, `GENERIC_FAMILIES` in `src/pdf/font/font-config.ts`
- **Global registries**: `defaultParserRegistry` in `src/svg/parser.ts`
- **Global state**: `propertyParserRegistry` in `src/css/parsers/registry.ts`

### Problems:
- Creates hidden dependencies
- Makes testing difficult
- Can cause unintended side effects

## 7. Complex Conditional Logic

### Issues Found:
- **Deep nesting**: In `src/html-to-pdf.ts` and `src/layout/strategies/table.ts`
- **Complex boolean expressions**: Throughout the codebase
- **Multiple return points**: In many functions

### Problems:
- Hard to understand control flow
- Difficult to test all code paths
- High cyclomatic complexity

## 8. Inconsistent Naming Conventions

### Issues Found:
- **Mixed naming styles**: camelCase vs PascalCase vs snake_case
- **Inconsistent terminology**: "font" vs "typeface", "layout" vs "render"
- **Ambiguous names**: Many generic names like "utils", "helpers"

### Problems:
- Makes code harder to understand
- Creates cognitive overhead
- Can lead to naming collisions

## 9. Overengineered Abstractions

### Issues Found:
- **Excessive abstraction layers**: Multiple layers of indirection
- **Overly generic interfaces**: Many interfaces with too many optional properties
- **Unnecessary complexity**: In some utility functions

### Problems:
- Makes code harder to follow
- Adds unnecessary cognitive load
- Can impact performance

## 10. Lack of Proper Dependency Injection

### Issues Found:
- **Hardcoded dependencies**: Many classes create their own dependencies
- **Static method calls**: Direct calls to static methods
- **Global service access**: Direct access to global services

### Problems:
- Makes testing difficult
- Creates tight coupling
- Hard to mock dependencies for testing

## Refactoring Recommendations

### 1. Dependency Injection System
- Replace global state with proper dependency injection
- Use constructor injection for all dependencies
- Create a DI container for managing service lifetimes

### 2. Type System Improvements
- Eliminate `as any` usage with proper type definitions
- Create comprehensive type hierarchies
- Use type guards and discriminated unions

### 3. Module Structure Refactoring
- Break down large modules into smaller, focused ones
- Implement proper layering (UI → Domain → Infrastructure)
- Use feature-based organization instead of technical grouping

### 4. Error Handling Standardization
- Create consistent error handling patterns
- Use Result types or Either monads for error handling
- Implement proper error boundaries

### 5. Testing Infrastructure
- Add comprehensive unit tests
- Implement integration testing
- Add property-based testing for complex logic

### 6. Documentation Improvements
- Add JSDoc comments for all public APIs
- Create architecture decision records
- Document module boundaries and responsibilities

### 7. Performance Optimization
- Profile and optimize critical paths
- Implement proper caching strategies
- Reduce unnecessary object creation

### 8. Code Quality Tooling
- Add stricter ESLint rules
- Implement pre-commit hooks
- Add code coverage requirements

## Priority Recommendations

1. **Critical**: Fix global state and singleton issues first
2. **High**: Eliminate `as any` usage and improve type safety
3. **Medium**: Break down large classes and functions
4. **Low**: Standardize naming conventions and error handling