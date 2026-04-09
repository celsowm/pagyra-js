import { CODEMIRROR_BASE_OPTIONS } from "./constants.js";

function getClassicEditor() {
  return globalThis.ClassicEditor;
}

function getCodeMirror() {
  return globalThis.CodeMirror;
}

async function ensureCkeditorLoaded(dom) {
  if (typeof getClassicEditor() !== "undefined") {
    return;
  }

  await new Promise((resolve, reject) => {
    dom.ckeditorScript.addEventListener("load", resolve, { once: true });
    dom.ckeditorScript.addEventListener("error", reject, { once: true });
    if (dom.ckeditorScript.dataset.loaded === "true") {
      resolve(undefined);
    }
  });
}

export async function enableCKEditor(dom, state, editors, setStatus, onHtmlChange) {
  if (state.useCKEditor) {
    return;
  }

  try {
    dom.ckeditorCss.media = "all";
    await ensureCkeditorLoaded(dom);
    dom.ckeditorScript.dataset.loaded = "true";
    const currentHtml = editors.getHtmlValue();

    if (state.htmlEditor) {
      state.htmlEditor.toTextArea();
      state.htmlEditor = null;
    }

    const ClassicEditor = getClassicEditor();
    state.ckeditorInstance = await ClassicEditor.create(dom.htmlInput, {
      toolbar: [
        "heading", "|",
        "bold", "italic", "link", "bulletedList", "numberedList", "|",
        "indent", "outdent", "|",
        "blockQuote", "insertTable", "mediaEmbed", "undo", "redo",
      ],
      language: "en",
    });

    state.ckeditorInstance.setData(currentHtml);
    state.ckeditorInstance.model.document.on("change:data", onHtmlChange);
    state.useCKEditor = true;
    setStatus("Rich text mode enabled for the HTML tab.", "success");
  } catch (error) {
    console.error("Failed to enable CKEditor:", error);
    setStatus("Failed to enable CKEditor.", "error");
  }
}

export async function disableCKEditor(dom, state, editors, setStatus, onHtmlChange) {
  if (!state.useCKEditor) {
    return;
  }

  try {
    const currentHtml = state.ckeditorInstance ? state.ckeditorInstance.getData() : "";

    if (state.ckeditorInstance) {
      await state.ckeditorInstance.destroy();
      state.ckeditorInstance = null;
    }

    dom.ckeditorCss.media = "none";

    if (dom.htmlInput && !state.htmlEditor) {
      const CodeMirror = getCodeMirror();
      state.htmlEditor = CodeMirror.fromTextArea(dom.htmlInput, {
        ...CODEMIRROR_BASE_OPTIONS,
        mode: "htmlmixed",
      });
      state.htmlEditor.setSize("100%", "100%");
      state.htmlEditor.on("change", onHtmlChange);
    }

    state.useCKEditor = false;
    editors.setHtmlValue(currentHtml);
    setStatus("Rich text mode disabled.", "success");
  } catch (error) {
    console.error("Failed to disable CKEditor:", error);
    setStatus("Failed to disable CKEditor.", "error");
  }
}

export function bindCKEditorToggle(dom, state, editors, setStatus, onHtmlChange) {
  if (!dom.ckeditorToggle) {
    return;
  }
  dom.ckeditorToggle.addEventListener("change", () => {
    if (dom.ckeditorToggle.checked) {
      void enableCKEditor(dom, state, editors, setStatus, onHtmlChange);
    } else {
      void disableCKEditor(dom, state, editors, setStatus, onHtmlChange);
    }
  });
}
