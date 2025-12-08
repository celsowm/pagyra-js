# Refactoring Plan for Pagyra-JS

## Phase 1: Critical Infrastructure Improvements (Week 1-2)

### 1.1 Dependency Injection System
**Goal**: Eliminate global state and implement proper dependency injection

**Tasks:**
- [ ] Create DI container interface and implementation
- [ ] Replace `globalGlyphAtlas` with injectable service
- [ ] Replace `ImageService.instance` with DI-managed instance
- [ ] Replace `globalThis.__PAGYRA_ENV__` with proper environment injection
- [ ] Update all consumers to use injected dependencies

**Files to modify:**
- `src/pdf/font/glyph-atlas.ts`
- `src/pdf/font/glyph-atlas-maxrects.ts`
- `src/image/image-service.ts`
- `src/environment/global.ts`
- All files that import these globals

### 1.2 Type System Cleanup
**Goal**: Eliminate `as any` usage and improve type safety

**Tasks:**
- [ ] Create comprehensive type hierarchies for core domains
- [ ] Replace `as any` with proper type guards
- [ ] Add discriminated unions for complex types
- [ ] Implement runtime type checking for critical paths

**Files to modify:**
- `src/html-to-pdf.ts` (highest priority)
- `src/pdf/renderers/text-shadow-renderer.ts`
- `src/svg/render-svg.ts`
- `src/css/compute-style.ts`

## Phase 2: Module Restructuring (Week 3-4)

### 2.1 Break Down Large Modules
**Goal**: Reduce complexity of monolithic files

**Tasks:**
- [ ] Split `src/html-to-pdf.ts` into smaller, focused modules
- [ ] Extract font-related logic from `src/pdf/font/font-registry.ts`
- [ ] Create separate modules for different responsibilities

**New files to create:**
- `src/html/render-preparation.ts`
- `src/html/resource-loading.ts`
- `src/pdf/font/font-loader.ts`
- `src/pdf/font/font-embedder.ts`
- `src/pdf/font/font-subsetter.ts`

### 2.2 Circular Dependency Resolution
**Goal**: Eliminate circular imports

**Tasks:**
- [ ] Identify and document all circular dependencies
- [ ] Introduce interface modules to break cycles
- [ ] Use dependency inversion principle
- [ ] Implement proper layering

**Files to modify:**
- `src/pdf/font/font-registry.ts`
- `src/pdf/font/embedder.ts`
- `src/layout/pipeline/engine.ts`
- `src/layout/pipeline/strategy.ts`

## Phase 3: Error Handling Standardization (Week 5)

### 3.1 Consistent Error Handling
**Goal**: Standardize error handling across the codebase

**Tasks:**
- [ ] Create `Result` type for functional error handling
- [ ] Implement consistent error types
- [ ] Add proper error boundaries
- [ ] Update all functions to use consistent error patterns

**New files to create:**
- `src/utils/result.ts`
- `src/errors/error-types.ts`
- `src/utils/error-handling.ts`

## Phase 4: Testing Infrastructure (Week 6)

### 4.1 Unit Testing Framework
**Goal**: Add comprehensive test coverage

**Tasks:**
- [ ] Set up test infrastructure
- [ ] Add unit tests for core modules
- [ ] Implement integration tests
- [ ] Add property-based testing

**Files to create:**
- `test/unit/**/*.test.ts`
- `test/integration/**/*.test.ts`
- `test/utils/test-helpers.ts`

## Phase 5: Documentation and Code Quality (Ongoing)

### 5.1 Documentation Improvements
**Goal**: Improve code documentation and maintainability

**Tasks:**
- [ ] Add JSDoc comments to all public APIs
- [ ] Create architecture decision records
- [ ] Document module boundaries
- [ ] Add code examples and usage patterns

### 5.2 Code Quality Tooling
**Goal**: Enforce code quality standards

**Tasks:**
- [ ] Add stricter ESLint rules
- [ ] Implement pre-commit hooks
- [ ] Add code coverage requirements
- [ ] Set up continuous integration

## Implementation Strategy

### Step-by-Step Approach:
1. **Start with critical infrastructure** (DI, type safety)
2. **Fix most problematic areas first** (global state, large classes)
3. **Maintain backward compatibility** during refactoring
4. **Add tests incrementally** as modules are refactored
5. **Document changes thoroughly** for team adoption

### Risk Mitigation:
- **Feature flags**: For major changes that might break existing functionality
- **Incremental rollout**: Refactor one module at a time
- **Comprehensive testing**: Ensure no regressions
- **Code reviews**: For all major changes

### Success Metrics:
- **Reduction in global state usage** (target: 80% reduction)
- **Elimination of `as any`** (target: 95% reduction)
- **Improved test coverage** (target: 80%+ coverage)
- **Reduced cyclomatic complexity** (target: 20% reduction)
- **Faster build times** (target: 30% improvement)

## Timeline Estimate

| Phase | Duration | Focus |
|-------|----------|-------|
| 1. Critical Infrastructure | 2 weeks | DI, Type Safety |
| 2. Module Restructuring | 2 weeks | Architecture, Circular Deps |
| 3. Error Handling | 1 week | Consistency, Reliability |
| 4. Testing | 1 week | Quality, Maintainability |
| 5. Documentation & Quality | Ongoing | Sustainability |

## Team Recommendations

1. **Dedicated refactoring team**: 2-3 senior developers
2. **Regular sync meetings**: 2-3 times per week
3. **Pair programming**: For complex refactoring tasks
4. **Knowledge sharing**: Document decisions and patterns
5. **Incremental adoption**: Allow team to adapt gradually

## Tools and Technologies

1. **Dependency Injection**: Use a lightweight DI container
2. **Type System**: Leverage TypeScript's advanced features
3. **Testing**: Jest/Vitest + property-based testing
4. **Documentation**: TypeDoc + Markdown ADRs
5. **Code Quality**: ESLint + Prettier + Husky

## Expected Benefits

1. **Improved maintainability**: Easier to understand and modify
2. **Better testability**: Proper DI enables mocking
3. **Enhanced reliability**: Stronger type system
4. **Faster development**: Clear module boundaries
5. **Easier onboarding**: Better documentation
6. **Future-proof**: Solid foundation for growth