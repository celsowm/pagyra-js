import { CODEMIRROR_BASE_OPTIONS } from "./constants.js";

function getCodeMirror() {
  return globalThis.CodeMirror;
}

export function initializeEditors(dom, state, onHtmlChange) {
  const CodeMirror = getCodeMirror();
  if (typeof CodeMirror === "undefined") {
    console.warn("CodeMirror not loaded. Falling back to plain textareas.");
    return;
  }

  if (dom.htmlInput && !state.htmlEditor) {
    state.htmlEditor = CodeMirror.fromTextArea(dom.htmlInput, {
      ...CODEMIRROR_BASE_OPTIONS,
      mode: "htmlmixed",
    });
    state.htmlEditor.setSize("100%", "100%");
    state.htmlEditor.on("change", onHtmlChange);
  }

  if (dom.cssInput && !state.cssEditor) {
    state.cssEditor = CodeMirror.fromTextArea(dom.cssInput, {
      ...CODEMIRROR_BASE_OPTIONS,
      mode: "css",
    });
    state.cssEditor.setSize("100%", "100%");
    state.cssEditor.on("change", onHtmlChange);
  }

  if (dom.headerInput && !state.headerEditor) {
    state.headerEditor = CodeMirror.fromTextArea(dom.headerInput, {
      ...CODEMIRROR_BASE_OPTIONS,
      mode: "htmlmixed",
    });
    state.headerEditor.setSize("100%", "100%");
  }

  if (dom.footerInput && !state.footerEditor) {
    state.footerEditor = CodeMirror.fromTextArea(dom.footerInput, {
      ...CODEMIRROR_BASE_OPTIONS,
      mode: "htmlmixed",
    });
    state.footerEditor.setSize("100%", "100%");
  }
}

export function createEditorBindings(dom, state) {
  return {
    getHtmlValue() {
      if (state.useCKEditor && state.ckeditorInstance) {
        return state.ckeditorInstance.getData();
      }
      if (state.htmlEditor) {
        return state.htmlEditor.getValue();
      }
      return dom.htmlInput.value;
    },
    getCssValue() {
      return state.cssEditor ? state.cssEditor.getValue() : dom.cssInput.value;
    },
    getHeaderValue() {
      return state.headerEditor ? state.headerEditor.getValue() : dom.headerInput.value;
    },
    getFooterValue() {
      return state.footerEditor ? state.footerEditor.getValue() : dom.footerInput.value;
    },
    setHtmlValue(value) {
      if (state.useCKEditor && state.ckeditorInstance) {
        state.ckeditorInstance.setData(value);
      } else if (state.htmlEditor) {
        state.htmlEditor.setValue(value);
        state.htmlEditor.refresh();
      } else {
        dom.htmlInput.value = value;
      }
    },
    setCssValue(value) {
      if (state.cssEditor) {
        state.cssEditor.setValue(value);
        state.cssEditor.refresh();
      } else {
        dom.cssInput.value = value;
      }
    },
    setHeaderValue(value) {
      if (state.headerEditor) {
        state.headerEditor.setValue(value);
        state.headerEditor.refresh();
      } else {
        dom.headerInput.value = value;
      }
    },
    setFooterValue(value) {
      if (state.footerEditor) {
        state.footerEditor.setValue(value);
        state.footerEditor.refresh();
      } else {
        dom.footerInput.value = value;
      }
    },
  };
}
