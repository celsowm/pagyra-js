const DOM = {
  htmlInput: /** @type {HTMLTextAreaElement} */ (document.getElementById("html-input")),
  cssInput: /** @type {HTMLTextAreaElement} */ (document.getElementById("css-input")),
  renderButton: /** @type {HTMLButtonElement} */ (document.getElementById("render-btn")),
  exampleSelect: /** @type {HTMLSelectElement} */ (document.getElementById("example-select")),
  status: /** @type {HTMLParagraphElement} */ (document.getElementById("status")),
  pdfViewer: /** @type {HTMLObjectElement} */ (document.getElementById("pdf-viewer")),
  htmlViewer: /** @type {HTMLIFrameElement} */ (document.getElementById("html-viewer")),
  editorTabButtons: /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll(".editor-panel .tab-button")),
  previewTabButtons: /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll(".preview-panel .tab-button")),
  viewportWidth: /** @type {HTMLInputElement} */ (document.getElementById("viewport-width")),
  viewportHeight: /** @type {HTMLInputElement} */ (document.getElementById("viewport-height")),
};

const PAGE_DEFAULTS = {
  pxPerPt: 96 / 72,
  widthPt: 595.28,
  heightPt: 841.89,
  marginPt: 36,
};

const PAGE_DIMENSIONS = {
  widthPx: PAGE_DEFAULTS.widthPt * PAGE_DEFAULTS.pxPerPt,
  heightPx: PAGE_DEFAULTS.heightPt * PAGE_DEFAULTS.pxPerPt,
  marginPx: PAGE_DEFAULTS.marginPt * PAGE_DEFAULTS.pxPerPt,
};

const PAGE_MARGINS = {
  top: PAGE_DIMENSIONS.marginPx,
  right: PAGE_DIMENSIONS.marginPx,
  bottom: PAGE_DIMENSIONS.marginPx,
  left: PAGE_DIMENSIONS.marginPx,
};

const CONTENT_DEFAULTS = {
  widthPx: PAGE_DIMENSIONS.widthPx - PAGE_DIMENSIONS.marginPx * 2,
  heightPx: PAGE_DIMENSIONS.heightPx - PAGE_DIMENSIONS.marginPx * 2,
};

const STATUS_COLORS = {
  neutral: "#94a3b8",
  success: "#38bdf8",
  error: "#f97316",
};

let currentObjectUrl = "";

/**
 * @typedef {{ id: string; label: string; htmlUrl: string; cssUrl?: string }} PlaygroundExample
 */

/** @type {PlaygroundExample[]} */
let examples = [];
/** @type {Map<string, PlaygroundExample>} */
let exampleLookup = new Map();
let activeExampleId = "";

function setStatus(message, tone = "neutral") {
  if (!DOM.status) {
    return;
  }
  DOM.status.textContent = message;
  DOM.status.style.color = STATUS_COLORS[tone] ?? STATUS_COLORS.neutral;
}

function revokeCurrentObjectUrl() {
  if (!currentObjectUrl) {
    return;
  }
  URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = "";
}

function handleRenderSuccess(blobUrl) {
  revokeCurrentObjectUrl();
  currentObjectUrl = blobUrl;
  if (DOM.pdfViewer) {
    DOM.pdfViewer.setAttribute("data", blobUrl);
  }
  setStatus("PDF updated.", "success");
}

function handleRenderFailure(message) {
  revokeCurrentObjectUrl();
  if (DOM.pdfViewer) {
    DOM.pdfViewer.removeAttribute("data");
  }
  setStatus(message, "error");
}

function getViewportDimensions() {
  const width = Number.parseFloat(DOM.viewportWidth.value) || CONTENT_DEFAULTS.widthPx;
  const height = Number.parseFloat(DOM.viewportHeight.value) || CONTENT_DEFAULTS.heightPx;
  return {
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  };
}

function computePageSize(viewport) {
  return {
    width: viewport.width + PAGE_MARGINS.left + PAGE_MARGINS.right,
    height: viewport.height + PAGE_MARGINS.top + PAGE_MARGINS.bottom,
  };
}

async function renderPdf() {
  const html = DOM.htmlInput.value;
  const css = DOM.cssInput.value;
  const viewport = getViewportDimensions();
  const page = computePageSize(viewport);
  const selectedExample = activeExampleId ? exampleLookup.get(activeExampleId) : undefined;
  const documentPath = selectedExample?.htmlUrl;

  setStatus("Rendering...", "neutral");
  DOM.renderButton.disabled = true;

  try {
    const response = await fetch("/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        css,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        pageWidth: page.width,
        pageHeight: page.height,
        documentPath,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Unexpected error" }));
      throw new Error(payload.error ?? "Failed to render PDF");
    }

    const buffer = await response.arrayBuffer();
    const blob = new Blob([buffer], { type: "application/pdf" });
    handleRenderSuccess(URL.createObjectURL(blob));
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to render PDF.";
    handleRenderFailure(message);
  } finally {
    DOM.renderButton.disabled = false;
  }
}

function populateExampleSelect(examples) {
  DOM.exampleSelect.innerHTML = "";
  for (const example of examples) {
    const option = document.createElement("option");
    option.value = example.id;
    option.textContent = example.label;
    DOM.exampleSelect.append(option);
  }
}


function setViewportDefaults() {
  DOM.viewportWidth.value = CONTENT_DEFAULTS.widthPx.toFixed(2);
  DOM.viewportHeight.value = CONTENT_DEFAULTS.heightPx.toFixed(2);
}

async function loadExample(example) {
  if (!example) {
    return;
  }

  try {
    const [htmlResponse, cssResponse] = await Promise.all([
      fetch(example.htmlUrl),
      example.cssUrl ? fetch(example.cssUrl) : Promise.resolve(new Response("")),
    ]);

    if (!htmlResponse.ok) {
      throw new Error(`Failed to load ${example.htmlUrl}`);
    }
    if (!cssResponse.ok) {
      throw new Error(`Failed to load ${example.cssUrl ?? ""}`);
    }

    const [html, css] = await Promise.all([htmlResponse.text(), cssResponse.text()]);

    DOM.htmlInput.value = html;
    DOM.cssInput.value = css;
    DOM.exampleSelect.value = example.id;
    activeExampleId = example.id;

    // Update both previews
    void renderPdf();
    updateHtmlPreview();
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to load example.";
    setStatus(message, "error");
  }
}

function handleExampleChange() {
  const selectedId = DOM.exampleSelect.value;
  const selectedExample = exampleLookup.get(selectedId);
  if (selectedExample) {
    void loadExample(selectedExample);
  }
}

function switchEditorTab(tabName) {
  // Update editor tab buttons
  DOM.editorTabButtons.forEach(button => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive.toString());
  });

  // Update editor tab panes
  const editorTabPanes = document.querySelectorAll(".editor-panel .tab-pane");
  editorTabPanes.forEach(pane => {
    const isActive = pane.id === `editor-${tabName}-tab`;
    pane.classList.toggle("active", isActive);
    pane.setAttribute("aria-hidden", (!isActive).toString());
  });
}

function switchPreviewTab(tabName) {
  // Update preview tab buttons
  DOM.previewTabButtons.forEach(button => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive.toString());
  });

  // Update preview tab panes
  const previewTabPanes = document.querySelectorAll(".preview-panel .tab-pane");
  previewTabPanes.forEach(pane => {
    const isActive = pane.id === `preview-${tabName}-tab`;
    pane.classList.toggle("active", isActive);
    pane.setAttribute("aria-hidden", (!isActive).toString());
  });
}

function updateHtmlPreview() {
  if (!DOM.htmlViewer) {
    return;
  }

  const html = DOM.htmlInput.value;
  const css = DOM.cssInput.value;

  // Create a complete HTML document with the user's input
  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>HTML Preview</title>
        <style>
          /* Reset styles for consistent preview */
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          /* User styles */
          ${css}
        </style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `;

  // Write to iframe
  const iframeDoc = DOM.htmlViewer.contentDocument || DOM.htmlViewer.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();
}

function handleTabClick(event) {
  const button = event.target;
  const tabName = button.dataset.tab;
  if (tabName) {
    if (button.closest('.editor-panel')) {
      switchEditorTab(tabName);
    } else if (button.closest('.preview-panel')) {
      switchPreviewTab(tabName);
    }
  }
}

function handleInputChange() {
  // Update HTML preview when inputs change
  updateHtmlPreview();
}

async function init() {
  if (!DOM.renderButton) {
    return;
  }

  setViewportDefaults();

  // Add event listeners
  DOM.renderButton.addEventListener("click", () => {
    void renderPdf();
  });

  DOM.exampleSelect.addEventListener("change", handleExampleChange);

  // Tab functionality
  DOM.editorTabButtons.forEach(button => {
    button.addEventListener("click", handleTabClick);
  });
  DOM.previewTabButtons.forEach(button => {
    button.addEventListener("click", handleTabClick);
  });

  // Update HTML preview when inputs change
  DOM.htmlInput.addEventListener("input", handleInputChange);
  DOM.cssInput.addEventListener("input", handleInputChange);

  try {
    const response = await fetch("examples.json");
    if (!response.ok) {
      throw new Error("Failed to load examples.json");
    }
    /** @type {PlaygroundExample[]} */
    const loadedExamples = await response.json();
    examples = loadedExamples;
    exampleLookup = new Map(examples.map(e => [e.id, e]));

    if (examples.length > 0) {
      populateExampleSelect(examples);
      const initialExample = examples[0];
      if (initialExample) {
        await loadExample(initialExample);
      }
    }
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to initialize app.";
    setStatus(message, "error");
  }
}

init();
