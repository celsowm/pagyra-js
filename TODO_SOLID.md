# SOLID Principles Analysis & Refactoring TODO

This document outlines the identified violations of SOLID principles within the project's architecture. The issues are prioritized by severity to guide refactoring efforts.

---

## Part 1: CSS Processing Architecture Analysis

### High Severity

#### 1. Violation: Interface Segregation Principle (ISP) & Single Responsibility Principle (SRP)

- **Component:** `StyleAccumulator` interface and `ComputedStyle` class (`src/css/style.ts`).
- **Problem:** The `StyleAccumulator` is a "fat interface" that includes dozens of optional properties for every possible CSS style. Consequently, all `PropertyParser` implementations are forced to depend on this massive interface. The `ComputedStyle` class becomes a "God Object" responsible for managing all style-related data, leading to very low cohesion.
- **Impact:** High coupling, poor maintainability, and difficult testing.
- **Suggested Refactoring:** Decompose `StyleAccumulator` into smaller, cohesive interfaces (`FontStyles`, `BoxModelStyles`, etc.) and refine parser signatures to depend only on the interfaces they need.

---

### Medium Severity

#### 2. Violation: Open/Closed Principle (OCP) & Single Responsibility Principle (SRP)

- **Component:** `registerAllPropertyParsers` function (`src/css/parsers/register-parsers.ts`).
- **Problem:** This is a centralized function that must be modified to add any new CSS property parser. This violates OCP (not closed for modification) and SRP (knows about every parser).
- **Impact:** Extensibility bottleneck and reduced modularity.
- **Suggested Refactoring:** Implement an auto-registration mechanism where parser modules can register themselves, removing the need for a central registration function.

---
---

## Part 2: PDF Generation Architecture Analysis

### High Severity

#### 1. Violation: Dependency Inversion Principle (DIP) & Open/Closed Principle (OCP)

- **Component:** `PagePainter` class (`src/pdf/page-painter.ts`).
- **Problem:** High-level modules like `PagePainter` depend directly on concrete low-level implementations (e.g., `TextRenderer`), instantiating them directly. This violates DIP and OCP, as new renderers cannot be added without modifying `PagePainter`.
- **Impact:** High rigidity, strong coupling, and untestable code.
- **Suggested Refactoring:** Introduce renderer interfaces (e.g., `ITextRenderer`) and use Dependency Injection (DI) to provide concrete implementations to the `PagePainter` constructor.

#### 2. Violation: Single Responsibility Principle (SRP)

- **Component:** `convertNode` function (`src/pdf/layout-tree-builder.ts`).
- **Problem:** This is a "God function" that centralizes the conversion logic for all types of nodes and styles (text, images, backgrounds, shadows, etc.).
- **Impact:** Low cohesion, high complexity, and fragility.
- **Suggested Refactoring:** Decompose the function by responsibility or use a Strategy Pattern where different "Node Converters" can be registered for different node types.

---

### Medium Severity

#### 3. Violation: Interface Segregation Principle (ISP)

- **Component:** `RenderBox` interface (`src/pdf/types.ts`).
- **Problem:** `RenderBox` is a "fat interface" aggregating properties for all possible node types, forcing components to depend on irrelevant data.
- **Impact:** Unnecessary coupling and reduced type safety.
- **Suggested Refactoring:** Refactor `RenderBox` into a discriminated union type (`type RenderNode = ContainerNode | TextNode | ImageNode;`) where each type is specialized.

#### 4. Violation: Single Responsibility Principle (SRP)

- **Component:** `renderPdf` function (`src/pdf/render.ts`).
- **Problem:** The function orchestrates the rendering pipeline but also handles setup logic (font initialization, header/footer layout).
- **Impact:** Reduced cohesion, making the code harder to follow and test.
- **Suggested Refactoring:** Separate configuration from orchestration. Move setup logic into a "context" object that is passed to `renderPdf`.

---
---

## Part 3: Layout Architecture Analysis

### No Violations Found

- **Conclusion:** The layout architecture, centered around the `LayoutEngine` and the `LayoutStrategy` interface (`src/layout/pipeline/`), is an exemplary model of SOLID design within this project.
- **Key Strengths:**
    - **SRP:** `LayoutEngine` orchestrates, while individual strategies handle specific layout algorithms.
    - **OCP & DIP:** The engine depends on the `LayoutStrategy` abstraction, and concrete strategies are provided via Dependency Injection. This makes the system fully extensible to new layout types without modifying the engine.
    - **LSP & ISP:** The `LayoutStrategy` interface is a simple, robust contract that is well-defined and correctly implemented by all strategies.
- **Recommendation:** This architecture should be used as a reference or blueprint for refactoring the CSS and PDF modules. The patterns used here (Strategy Pattern, Dependency Injection) would directly solve many of the issues identified in the other modules.
