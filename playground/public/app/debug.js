import { IS_BROWSER_MODE } from "./constants.js";
import { ensureBrowserRenderer } from "./browser-renderer.js";

export function renderDebugCategoryCheckboxes(dom, categories) {
  if (!dom.debugCategoriesContainer) {
    return;
  }
  dom.debugCategoriesContainer.innerHTML = "";
  if (!categories.length) {
    dom.debugCategoriesContainer.textContent = "No categories available.";
    return;
  }

  for (const cat of categories) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = cat;
    input.className = "log-cat";
    label.append(input, ` ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
    dom.debugCategoriesContainer.append(label);
  }
}

export async function fetchAndRenderDebugCategories(dom, state) {
  if (!dom.debugCategoriesContainer) {
    return;
  }

  if (IS_BROWSER_MODE) {
    try {
      await ensureBrowserRenderer(state);
      renderDebugCategoryCheckboxes(dom, state.browserLogCategories);
      return;
    } catch (error) {
      console.warn("[playground] falling back to server debug categories:", error);
    }
  }

  try {
    const response = await fetch("/debug-categories");
    if (!response.ok) {
      throw new Error("Failed to fetch debug categories");
    }
    const categories = await response.json();
    renderDebugCategoryCheckboxes(dom, Array.isArray(categories) ? categories : []);
  } catch (error) {
    console.error("Failed to load debug categories:", error);
    dom.debugCategoriesContainer.textContent = "Failed to load categories.";
  }
}

export function getDebugConfig(dom) {
  const level = dom.logLevel?.value || "info";
  const checkboxes = document.querySelectorAll(".log-cat");
  const cats = Array.from(checkboxes)
    .filter((cb) => /** @type {HTMLInputElement} */ (cb).checked)
    .map((cb) => /** @type {HTMLInputElement} */ (cb).value);
  return { level, cats };
}

export function bindDebugSelection(dom) {
  if (dom.logSelectAll) {
    dom.logSelectAll.addEventListener("click", () => {
      const checkboxes = document.querySelectorAll(".log-cat");
      checkboxes.forEach((cb) => {
        /** @type {HTMLInputElement} */ (cb).checked = true;
      });
    });
  }
  if (dom.logSelectNone) {
    dom.logSelectNone.addEventListener("click", () => {
      const checkboxes = document.querySelectorAll(".log-cat");
      checkboxes.forEach((cb) => {
        /** @type {HTMLInputElement} */ (cb).checked = false;
      });
    });
  }
}
