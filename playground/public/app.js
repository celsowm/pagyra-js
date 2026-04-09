import { bindCKEditorToggle } from "./app/ckeditor.js";
import { createDom } from "./app/dom.js";
import { bindDebugSelection, fetchAndRenderDebugCategories } from "./app/debug.js";
import { createEditorBindings, initializeEditors } from "./app/editors.js";
import { createExampleChangeHandler, loadExample } from "./app/examples.js";
import { setViewportDefaults } from "./app/page.js";
import { updateHtmlPreview } from "./app/preview.js";
import { createRenderPdf } from "./app/render.js";
import { createPlaygroundState } from "./app/state.js";
import {
  setPdfPreviewState,
  setRenderButtonState,
  setStatus,
} from "./app/status.js";
import { createTabClickHandler } from "./app/tabs.js";
import {
  populateExampleSelect,
  syncTemplateLabels,
} from "./app/templates.js";

const dom = createDom();
const state = createPlaygroundState();

function init() {
  if (!dom.renderButton) {
    return;
  }

  /** @type {ReturnType<typeof createEditorBindings> | null} */
  let editors = null;
  const previewApi = {
    updateHtmlPreview: () => {
      if (editors) {
        updateHtmlPreview(dom, editors);
      }
    },
    setStatus: (message, tone) => setStatus(dom, message, tone),
  };

  function handleInputChange() {
    previewApi.updateHtmlPreview();
  }

  setViewportDefaults(dom);
  initializeEditors(dom, state, handleInputChange);
  editors = createEditorBindings(dom, state);
  const renderPdf = createRenderPdf(dom, state, editors);
  const handleExampleChange = createExampleChangeHandler(dom, state, editors, previewApi, renderPdf);
  const handleTabClick = createTabClickHandler(dom, state);

  setRenderButtonState(dom, false);
  setPdfPreviewState(dom, false);
  setStatus(dom, "Ready to render.", "neutral");

  dom.renderButton.addEventListener("click", () => {
    void renderPdf();
  });

  dom.exampleSelect.addEventListener("change", () => {
    handleExampleChange();
  });

  dom.editorTabButtons.forEach((button) => {
    button.addEventListener("click", handleTabClick);
  });
  dom.previewTabButtons.forEach((button) => {
    button.addEventListener("click", handleTabClick);
  });

  if (dom.htmlInput) {
    dom.htmlInput.addEventListener("input", handleInputChange);
  }
  if (dom.cssInput) {
    dom.cssInput.addEventListener("input", handleInputChange);
  }
  if (dom.viewportWidth) {
    dom.viewportWidth.addEventListener("input", handleInputChange);
  }
  if (dom.viewportHeight) {
    dom.viewportHeight.addEventListener("input", handleInputChange);
  }

  bindCKEditorToggle(dom, state, editors, previewApi.setStatus, handleInputChange);
  bindDebugSelection(dom);

  void bootstrapExamples(renderPdf, editors, previewApi);

  async function bootstrapExamples(renderPdfFn, editorBindings, previewBindings) {
    await fetchAndRenderDebugCategories(dom, state);

    try {
      const response = await fetch("examples.json");
      if (!response.ok) {
        throw new Error("Failed to load examples.json");
      }

      const loadedExamples = await response.json();
      state.examples = loadedExamples;
      state.exampleLookup = new Map(state.examples.map((example) => [example.id, example]));

      if (state.examples.length > 0) {
        populateExampleSelect(dom, state.examples);
        const initialExample = state.examples[0];
        syncTemplateLabels(dom, initialExample);
        await loadExample(dom, state, editorBindings, previewBindings, renderPdfFn, initialExample);
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to initialize app.";
      setStatus(dom, message, "error");
    }
  }
}

init();
