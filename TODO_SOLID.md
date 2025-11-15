# SOLID Principles Analysis & Refactoring TODO

This document outlines the identified violations of SOLID principles within the project's CSS processing architecture. The issues are prioritized by severity to guide refactoring efforts.

---

## High Severity

### 1. Violation: Interface Segregation Principle (ISP) & Single Responsibility Principle (SRP)

- **Component:** `StyleAccumulator` interface and `ComputedStyle` class (`src/css/style.ts`).
- **Problem:** The `StyleAccumulator` is a "fat interface" that includes dozens of optional properties for every possible CSS style. Consequently, all `PropertyParser` implementations are forced to depend on this massive interface, even if they only need to set one or two properties (e.g., `parseColor` only needs `color` but depends on `width`, `margin`, `flexDirection`, etc.). The `ComputedStyle` class becomes a "God Object" responsible for managing all style-related data, leading to very low cohesion.
- **Impact:**
    - **High Coupling:** All style-related components are tightly coupled to this single, monolithic data structure.
    - **Poor Maintainability:** A change in any style property (e.g., adding a new grid property) conceptually impacts all parsers.
    - **Difficult Testing:** Mocking the `StyleAccumulator` for unit tests is unnecessarily complex.
- **Suggested Refactoring:**
    1.  **Decompose `StyleAccumulator`:** Break down the `StyleAccumulator` into smaller, more cohesive interfaces based on responsibility (e.g., `FontStyles`, `BoxModelStyles`, `FlexContainerStyles`).
    2.  **Refine Parser Signatures:** Modify the `PropertyParser` interface so that parsers receive only the specific style interface they need to operate on.
    3.  **Alternative (Functional Approach):** Instead of mutating a large object, parsers could return a well-typed value or a specific style object. The style engine would then be responsible for composing these objects into the final `ComputedStyle`. This would make the parsers pure functions and easier to test.

---

## Medium Severity

### 2. Violation: Open/Closed Principle (OCP) & Single Responsibility Principle (SRP)

- **Component:** `registerAllPropertyParsers` function (`src/css/parsers/register-parsers.ts`).
- **Problem:** This function acts as a centralized registry that explicitly knows about and registers every single CSS property parser. To add support for a new CSS property, a developer must modify this file to import and register the new parser function. This violates the OCP because the module is not closed for modification. It also violates the SRP because its single responsibility should be to orchestrate registration, not to have detailed knowledge of every parser.
- **Impact:**
    - **Extensibility Bottleneck:** Makes adding new features more error-prone and increases the chance of merge conflicts in a collaborative environment.
    - **Reduced Modularity:** The system's modularity is undermined by this central point of dependency.
- **Suggested Refactoring:**
    1.  **Implement Auto-Registration:** Refactor the system to allow parser modules to self-register. This could be achieved in several ways:
        - Each parser module could have a small registration script that calls `registerPropertyParser`.
        - A "module loader" could dynamically import all files from the `parsers` directory and call an `register` function exported from each module.
    2.  **Decentralize Registration:** Group related parsers into modules (e.g., `border-parsers`, `flex-parsers`) and have a single registration function for each module (e.g., `registerBorderParsers()`). The main `registerAllPropertyParsers` would then only call these group-level functions, reducing its direct dependencies.

---

## No Violations Found

- **Liskov Substitution Principle (LSP):** The `PropertyParser` interface provides a strong contract that all implementations adhere to correctly.
- **Dependency Inversion Principle (DIP):** High-level modules correctly depend on abstractions (`PropertyParser` interface and the registry) instead of concrete low-level implementations.
