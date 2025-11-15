# SOLID Principles Analysis & Refactoring TODO

This document outlines the identified violations of SOLID principles within the project's architecture. The issues are prioritized by severity to guide refactoring efforts.

---

## Part 1: CSS Processing Architecture Analysis

### High Severity

#### 1. Violation: Interface Segregation Principle (ISP) & Single Responsibility Principle (SRP)

- **Component:** `StyleAccumulator` interface and `ComputedStyle` class (`src/css/style.ts`).
- **Problem:** The `StyleAccumulator` is a "fat interface" that includes dozens of optional properties for every possible CSS style. Consequently, all `PropertyParser` implementations are forced to depend on this massive interface, even if they only need to set one or two properties (e.g., `parseColor` only needs `color` but depends on `width`, `margin`, `flexDirection`, etc.). The `ComputedStyle` class becomes a "God Object" responsible for managing all style-related data, leading to very low cohesion.
- **Impact:**
    - **High Coupling:** All style-related components are tightly coupled to this single, monolithic data structure.
    - **Poor Maintainability:** A change in any style property conceptually impacts all parsers.
    - **Difficult Testing:** Mocking the `StyleAccumulator` for unit tests is unnecessarily complex.
- **Suggested Refactoring:**
    1.  **Decompose `StyleAccumulator`:** Break it down into smaller, cohesive interfaces based on responsibility (e.g., `FontStyles`, `BoxModelStyles`).
    2.  **Refine Parser Signatures:** Modify the `PropertyParser` interface so that parsers receive only the specific style interface they need.
    3.  **Alternative (Functional Approach):** Parsers could return a well-typed value instead of mutating a large object. The style engine would then compose these objects into the final `ComputedStyle`.

---

### Medium Severity

#### 2. Violation: Open/Closed Principle (OCP) & Single Responsibility Principle (SRP)

- **Component:** `registerAllPropertyParsers` function (`src/css/parsers/register-parsers.ts`).
- **Problem:** This function is a centralized registry that explicitly knows about and registers every CSS property parser. To add a new property, this file must be modified. This violates the OCP (not closed for modification) and SRP (knows about every parser).
- **Impact:**
    - **Extensibility Bottleneck:** Makes adding new features error-prone and increases the chance of merge conflicts.
    - **Reduced Modularity:** The system's modularity is undermined by this central dependency.
- **Suggested Refactoring:**
    1.  **Implement Auto-Registration:** Allow parser modules to self-register, for example, by having a module loader dynamically import and call an `register` function from each parser module.
    2.  **Decentralize Registration:** Group related parsers and have a single registration function for each group (e.g., `registerBorderParsers()`).

---
---

## Part 2: PDF Generation Architecture Analysis

### High Severity

#### 1. Violation: Dependency Inversion Principle (DIP) & Open/Closed Principle (OCP)

- **Component:** `PagePainter` class (`src/pdf/page-painter.ts`) and its consumers like `paintLayoutPage`.
- **Problem:** High-level modules like `PagePainter` depend directly on concrete low-level implementations (e.g., `TextRenderer`, `ImageRenderer`), instantiating them directly in the constructor (`new TextRenderer(...)`). This violates DIP (high-level should not depend on low-level) and OCP (cannot add a new renderer without modifying `PagePainter`).
- **Impact:**
    - **High Rigidity & Coupling:** The architecture is tightly coupled, making it difficult to extend or modify.
    - **Untestable Code:** It is nearly impossible to unit test `PagePainter` in isolation because its dependencies cannot be replaced with mocks.
- **Suggested Refactoring:**
    1.  **Introduce Renderer Interfaces:** Define abstractions for each renderer (e.g., `ITextRenderer`, `IShapeRenderer`).
    2.  **Use Dependency Injection (DI):** Modify `PagePainter`'s constructor to accept these interfaces as arguments. The concrete renderers should be instantiated outside and injected into the `PagePainter`.

#### 2. Violation: Single Responsibility Principle (SRP)

- **Component:** `convertNode` function (`src/pdf/layout-tree-builder.ts`).
- **Problem:** This is a "God function" that centralizes the logic for converting a `LayoutNode` into a `RenderBox`. It handles numerous distinct responsibilities: text runs, list markers, images, SVGs, backgrounds, box shadows, text shadows, borders, and CSS transforms.
- **Impact:**
    - **Low Cohesion & High Complexity:** The function is extremely difficult to understand, debug, and maintain.
    - **Fragility:** A change in one area (e.g., how backgrounds are handled) has a high risk of unintentionally breaking another (e.g., how list markers are positioned).
- **Suggested Refactoring:**
    1.  **Decompose by Responsibility:** Break the function down into smaller, highly-focused functions (e.g., `createRenderBoxForText`, `createRenderBoxForImage`).
    2.  **Use a Strategy Pattern:** Implement a "Node Converter" registry where different strategies can be registered for different types of `LayoutNode` tags or kinds. The `convertNode` function would then become a simple dispatcher.

---

### Medium Severity

#### 3. Violation: Interface Segregation Principle (ISP)

- **Component:** `RenderBox` interface (`src/pdf/types.ts`).
- **Problem:** `RenderBox` is a "fat interface" that aggregates properties for all possible types of renderable nodes (containers, text, images, etc.). For example, a `RenderBox` for an image node will have irrelevant properties like `textRuns`.
- **Impact:**
    - **Unnecessary Coupling:** Components that process the render tree are forced to depend on a large data structure with many properties they don't use.
    - **Reduced Type Safety:** It's possible to accidentally access a property that shouldn't exist for a given node type (e.g., accessing `image` on a text node).
- **Suggested Refactoring:**
    1.  **Use a Discriminated Union:** Refactor `RenderBox` into a discriminated union type (`type RenderNode = ContainerNode | TextNode | ImageNode;`), where each type in the union only contains the properties relevant to it, identified by a `kind` property.

#### 4. Violation: Single Responsibility Principle (SRP)

- **Component:** `renderPdf` function (`src/pdf/render.ts`).
- **Problem:** This function orchestrates the entire PDF generation pipeline, but it also takes on setup and configuration responsibilities, such as font system initialization, header/footer layout, and page size calculation.
- **Impact:**
    - **Reduced Cohesion:** The core pipeline logic is mixed with setup logic, making the function harder to follow and test in isolation.
- **Suggested Refactoring:**
    1.  **Separate Configuration from Orchestration:** Move the setup and initialization logic into a separate "context" or "configuration" object. The `renderPdf` function would then take this pre-configured context as an argument and focus solely on orchestrating the rendering pipeline.

---

### No Violations Found

- **Liskov Substitution Principle (LSP):** The architecture favors composition over inheritance, which naturally avoids LSP violations.
- **CSS Module - Dependency Inversion Principle (DIP):** The CSS property parser system correctly depends on abstractions.
