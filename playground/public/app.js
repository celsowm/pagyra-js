/* global CodeMirror */

const DOM = {
  htmlInput: /** @type {HTMLTextAreaElement} */ (document.getElementById("html-input")),
  cssInput: /** @type {HTMLTextAreaElement} */ (document.getElementById("css-input")),
  headerInput: /** @type {HTMLTextAreaElement} */ (document.getElementById("header-input")),
  footerInput: /** @type {HTMLTextAreaElement} */ (document.getElementById("footer-input")),
  renderButton: /** @type {HTMLButtonElement} */ (document.getElementById("render-btn")),
  exampleSelect: /** @type {HTMLSelectElement} */ (document.getElementById("example-select")),
  status: /** @type {HTMLParagraphElement} */ (document.getElementById("status")),
  pdfViewer: /** @type {HTMLObjectElement} */ (document.getElementById("pdf-viewer")),
  htmlViewer: /** @type {HTMLIFrameElement} */ (document.getElementById("html-viewer")),
  editorTabButtons: /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll(".editor-panel .tab-button")),
  previewTabButtons: /** @type {NodeListOf<HTMLButtonElement>} */ (document.querySelectorAll(".preview-panel .tab-button")),
  viewportWidth: /** @type {HTMLInputElement} */ (document.getElementById("viewport-width")),
  viewportHeight: /** @type {HTMLInputElement} */ (document.getElementById("viewport-height")),
  ckeditorToggle: /** @type {HTMLInputElement} */ (document.getElementById("ckeditor-toggle")),
  ckeditorCss: /** @type {HTMLLinkElement} */ (document.getElementById("ckeditor-css")),
  ckeditorScript: /** @type {HTMLScriptElement} */ (document.getElementById("ckeditor-script")),
  logLevel: /** @type {HTMLSelectElement | null} */ (document.getElementById("log-level")),
  debugCategoriesContainer: /** @type {HTMLDivElement | null} */ (document.getElementById("debug-categories-container")),
  logSelectAll: /** @type {HTMLButtonElement | null} */ (document.getElementById("log-select-all")),
  logSelectNone: /** @type {HTMLButtonElement | null} */ (document.getElementById("log-select-none")),
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

const DEFAULT_PAGE_MARGINS_PX = {
  top: PAGE_MARGINS.top,
  right: PAGE_MARGINS.right,
  bottom: PAGE_MARGINS.bottom,
  left: PAGE_MARGINS.left,
};
const DEFAULT_PAGE_WIDTH_PX = PAGE_DIMENSIONS.widthPx;
const DEFAULT_PAGE_HEIGHT_PX = PAGE_DIMENSIONS.heightPx;
const DEFAULT_HEADER_FOOTER_MAX_HEIGHT_PX = 64;
const PLAYGROUND_MODE = (window.__PLAYGROUND_MODE ?? "node").toLowerCase();
const IS_BROWSER_MODE = PLAYGROUND_MODE === "browser";

let browserRenderHtmlToPdf = null;
let browserLogCategories = [];
let browserRendererPromise = null;

function sanitizeDimension(value, fallback) {
  if (!Number.isFinite(value ?? NaN)) {
    return fallback;
  }
  const sanitized = Number(value);
  return sanitized > 0 ? sanitized : fallback;
}

function maxContentDimension(total, marginsSum) {
  return Math.max(1, total - marginsSum);
}

function resolvePageMarginsPx(pageWidthPx, pageHeightPx) {
  const margins = { ...DEFAULT_PAGE_MARGINS_PX };
  const horizontalSum = margins.left + margins.right;
  const verticalSum = margins.top + margins.bottom;
  const usableWidth = maxContentDimension(pageWidthPx, 0);
  const usableHeight = maxContentDimension(pageHeightPx, 0);

  if (horizontalSum > usableWidth) {
    const scale = usableWidth / (horizontalSum || 1);
    margins.left *= scale;
    margins.right *= scale;
  }
  if (verticalSum > usableHeight) {
    const scale = usableHeight / (verticalSum || 1);
    margins.top *= scale;
    margins.bottom *= scale;
  }
  return margins;
}

async function ensureBrowserRenderer() {
  if (!IS_BROWSER_MODE) {
    return;
  }
  if (browserRendererPromise) {
    return browserRendererPromise;
  }
  browserRendererPromise = import("./vendor/pagyra-playground-browser.js")
    .then((module) => {
      browserRenderHtmlToPdf = module.renderHtmlToPdfBrowser;
      browserLogCategories = Array.isArray(module.LOG_CATEGORIES) ? module.LOG_CATEGORIES : [];
    })
    .catch((error) => {
      browserRendererPromise = null;
      console.error("[playground] failed to load browser renderer bundle:", error);
      throw error;
    });
  return browserRendererPromise;
}

function computeBrowserResourceBase(documentPath) {
  const origin = window.location.origin;
  const defaultBase = origin.endsWith("/") ? origin : `${origin}/`;
  if (!documentPath) {
    return { resourceBaseDir: defaultBase, assetRootDir: defaultBase };
  }
  try {
    const normalized = documentPath.startsWith("/") ? documentPath : `/${documentPath}`;
    const docUrl = new URL(normalized, origin);
    docUrl.hash = "";
    docUrl.search = "";
    const directory = new URL(".", docUrl);
    return { resourceBaseDir: directory.toString(), assetRootDir: defaultBase };
  } catch (error) {
    console.warn("[playground] failed to compute resource base:", error);
    return { resourceBaseDir: defaultBase, assetRootDir: defaultBase };
  }
}

function waitForImageLoad(img) {
  return new Promise((resolve) => {
    if (img.complete) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
    window.setTimeout(done, 250);
  });
}

async function estimateHtmlHeightPx(html, widthPx, fallbackPx) {
  if (!html) {
    return 0;
  }

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.width = `${Math.max(1, Math.floor(widthPx))}px`;
  host.style.visibility = "hidden";
  host.style.pointerEvents = "none";
  host.style.zIndex = "-1";
  host.innerHTML = html;

  document.body.appendChild(host);
  try {
    const images = Array.from(host.querySelectorAll("img"));
    if (images.length > 0) {
      await Promise.all(images.map(waitForImageLoad));
    }
    const measured = Math.ceil(host.getBoundingClientRect().height);
    return Math.max(fallbackPx, measured || 0);
  } finally {
    host.remove();
  }
}

async function resolveHeaderFooterHeights(headerHtml, footerHtml, contentWidthPx) {
  const [headerMaxHeightPx, footerMaxHeightPx] = await Promise.all([
    headerHtml
      ? estimateHtmlHeightPx(headerHtml, contentWidthPx, DEFAULT_HEADER_FOOTER_MAX_HEIGHT_PX)
      : Promise.resolve(0),
    footerHtml
      ? estimateHtmlHeightPx(footerHtml, contentWidthPx, DEFAULT_HEADER_FOOTER_MAX_HEIGHT_PX)
      : Promise.resolve(0),
  ]);

  return { headerMaxHeightPx, footerMaxHeightPx };
}

function buildHeaderFooter(headerHtml, footerHtml, heights) {
  const headerFooter = {};
  if (headerHtml) {
    headerFooter.headerHtml = headerHtml;
    headerFooter.maxHeaderHeightPx = heights?.headerMaxHeightPx || DEFAULT_HEADER_FOOTER_MAX_HEIGHT_PX;
  }
  if (footerHtml) {
    headerFooter.footerHtml = footerHtml;
    headerFooter.maxFooterHeightPx = heights?.footerMaxHeightPx || DEFAULT_HEADER_FOOTER_MAX_HEIGHT_PX;
  }
  return Object.keys(headerFooter).length ? headerFooter : undefined;
}

function renderDebugCategoryCheckboxes(categories) {
  if (!DOM.debugCategoriesContainer) return;
  DOM.debugCategoriesContainer.innerHTML = "";
  if (!categories.length) {
    DOM.debugCategoriesContainer.textContent = "No categories available.";
    return;
  }
  for (const cat of categories) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = cat;
    input.className = "log-cat";
    label.append(input, ` ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
    DOM.debugCategoriesContainer.append(label);
  }
}

const STATUS_COLORS = {
  neutral: "#94a3b8",
  success: "#38bdf8",
  error: "#f97316",
};

let currentObjectUrl = "";
/** @type {CodeMirror.EditorFromTextArea | null} */
let htmlEditor = null;
/** @type {CodeMirror.EditorFromTextArea | null} */
let cssEditor = null;
/** @type {CodeMirror.EditorFromTextArea | null} */
let headerEditor = null;
/** @type {CodeMirror.EditorFromTextArea | null} */
let footerEditor = null;
/** @type {any} */
let ckeditorInstance = null;
/** @type {boolean} */
let useCKEditor = false;

const CODEMIRROR_BASE_OPTIONS = {
  theme: "darcula",
  lineNumbers: true,
  lineWrapping: true,
  tabSize: 2,
  indentUnit: 2,
  indentWithTabs: false,
};

function getHtmlValue() {
  if (useCKEditor && ckeditorInstance) {
    return ckeditorInstance.getData();
  }
  if (htmlEditor) {
    return htmlEditor.getValue();
  }
  return DOM.htmlInput.value;
}

function getCssValue() {
  if (cssEditor) {
    return cssEditor.getValue();
  }
  return DOM.cssInput.value;
}

function getHeaderValue() {
  if (headerEditor) {
    return headerEditor.getValue();
  }
  return DOM.headerInput.value;
}

function getFooterValue() {
  if (footerEditor) {
    return footerEditor.getValue();
  }
  return DOM.footerInput.value;
}

function setHtmlValue(value) {
  if (useCKEditor && ckeditorInstance) {
    ckeditorInstance.setData(value);
  } else if (htmlEditor) {
    htmlEditor.setValue(value);
    htmlEditor.refresh();
  } else {
    DOM.htmlInput.value = value;
  }
}

function setCssValue(value) {
  if (cssEditor) {
    cssEditor.setValue(value);
    cssEditor.refresh();
  } else {
    DOM.cssInput.value = value;
  }
}

function setHeaderValue(value) {
  if (headerEditor) {
    headerEditor.setValue(value);
    headerEditor.refresh();
  } else {
    DOM.headerInput.value = value;
  }
}

function setFooterValue(value) {
  if (footerEditor) {
    footerEditor.setValue(value);
    footerEditor.refresh();
  } else {
    DOM.footerInput.value = value;
  }
}

function initializeEditors() {
  if (typeof CodeMirror === "undefined") {
    console.warn("CodeMirror not loaded. Falling back to plain textareas.");
    return;
  }

  if (DOM.htmlInput && !htmlEditor) {
    htmlEditor = CodeMirror.fromTextArea(DOM.htmlInput, {
      ...CODEMIRROR_BASE_OPTIONS,
      mode: "htmlmixed",
    });
    htmlEditor.setSize("100%", "100%");
    htmlEditor.on("change", handleInputChange);
  }

  if (DOM.cssInput && !cssEditor) {
    cssEditor = CodeMirror.fromTextArea(DOM.cssInput, {
      ...CODEMIRROR_BASE_OPTIONS,
      mode: "css",
    });
    cssEditor.setSize("100%", "100%");
    cssEditor.on("change", handleInputChange);
  }

  if (DOM.headerInput && !headerEditor) {
    headerEditor = CodeMirror.fromTextArea(DOM.headerInput, {
      ...CODEMIRROR_BASE_OPTIONS,
      mode: "htmlmixed",
    });
    headerEditor.setSize("100%", "100%");
  }

  if (DOM.footerInput && !footerEditor) {
    footerEditor = CodeMirror.fromTextArea(DOM.footerInput, {
      ...CODEMIRROR_BASE_OPTIONS,
      mode: "htmlmixed",
    });
    footerEditor.setSize("100%", "100%");
  }
}

/**
 * @typedef {{ id: string; label: string; htmlUrl: string; cssUrl?: string; headerUrl?: string; footerUrl?: string }} PlaygroundExample
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

function getDebugConfig() {
  const level = DOM.logLevel?.value || "info";
  const checkboxes = document.querySelectorAll(".log-cat");
  const cats = Array.from(checkboxes)
    .filter(cb => /** @type {HTMLInputElement} */(cb).checked)
    .map(cb => /** @type {HTMLInputElement} */(cb).value);
  return { level, cats };
}

async function renderPdf() {
  const html = getHtmlValue();
  const css = getCssValue();
  const headerHtml = getHeaderValue().trim();
  const footerHtml = getFooterValue().trim();
  const viewport = getViewportDimensions();
  const page = computePageSize(viewport);
  const selectedExample = activeExampleId ? exampleLookup.get(activeExampleId) : undefined;
  const documentPath = selectedExample?.htmlUrl;
  const debug = getDebugConfig();

  const sanitizedPageWidth = sanitizeDimension(page.width, DEFAULT_PAGE_WIDTH_PX);
  const sanitizedPageHeight = sanitizeDimension(page.height, DEFAULT_PAGE_HEIGHT_PX);
  const margins = resolvePageMarginsPx(sanitizedPageWidth, sanitizedPageHeight);
  const maxContentWidth = maxContentDimension(sanitizedPageWidth, margins.left + margins.right);
  const maxContentHeight = maxContentDimension(sanitizedPageHeight, margins.top + margins.bottom);
  const viewportWidth = Math.min(sanitizeDimension(viewport.width, maxContentWidth), maxContentWidth);
  const viewportHeight = Math.min(sanitizeDimension(viewport.height, maxContentHeight), maxContentHeight);
  const headerFooterHeights = await resolveHeaderFooterHeights(headerHtml, footerHtml, maxContentWidth);
  const headerFooter = buildHeaderFooter(headerHtml, footerHtml, headerFooterHeights);
  const serverPayload = {
    html,
    css,
    headerHtml: headerHtml || undefined,
    footerHtml: footerHtml || undefined,
    headerMaxHeightPx: headerFooter?.maxHeaderHeightPx,
    footerMaxHeightPx: headerFooter?.maxFooterHeightPx,
    viewportWidth,
    viewportHeight,
    pageWidth: sanitizedPageWidth,
    pageHeight: sanitizedPageHeight,
    documentPath,
    debugLevel: debug.level,
    debugCats: debug.cats.length > 0 ? debug.cats : undefined,
  };
  const { resourceBaseDir, assetRootDir } = computeBrowserResourceBase(documentPath);
  const browserOptions = {
    html,
    css,
    viewportWidth,
    viewportHeight,
    pageWidth: sanitizedPageWidth,
    pageHeight: sanitizedPageHeight,
    margins,
    debugLevel: debug.level,
    debugCats: debug.cats.length > 0 ? debug.cats : undefined,
    resourceBaseDir,
    assetRootDir,
    ...(headerFooter ? { headerFooter } : {}),
  };

  setStatus("Rendering...", "neutral");
  DOM.renderButton.disabled = true;

  try {
    if (IS_BROWSER_MODE) {
      await ensureBrowserRenderer();
      if (!browserRenderHtmlToPdf) {
        throw new Error("Browser renderer bundle is not ready");
      }
      const pdfBytes = await browserRenderHtmlToPdf(browserOptions);
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      handleRenderSuccess(URL.createObjectURL(blob));
      return;
    }

    const response = await fetch("/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serverPayload),
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

async function fetchAndRenderDebugCategories() {
  if (!DOM.debugCategoriesContainer) return;

  if (IS_BROWSER_MODE) {
    try {
      await ensureBrowserRenderer();
      renderDebugCategoryCheckboxes(browserLogCategories);
      return;
    } catch (error) {
      console.warn("[playground] falling back to server debug categories:", error);
    }
  }

  try {
    const response = await fetch("/debug-categories");
    if (!response.ok) throw new Error("Failed to fetch debug categories");
    const categories = await response.json();
    renderDebugCategoryCheckboxes(Array.isArray(categories) ? categories : []);
  } catch (error) {
    console.error("Failed to load debug categories:", error);
    DOM.debugCategoriesContainer.textContent = "Failed to load categories.";
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
  // Use rounded defaults so the playground starts with the intended A4 content
  // width (~698px) and avoids tiny floating point noise in the input field.
  DOM.viewportWidth.value = Math.round(CONTENT_DEFAULTS.widthPx).toString();
  DOM.viewportHeight.value = Math.round(CONTENT_DEFAULTS.heightPx).toString();
}

async function loadExample(example) {
  if (!example) {
    return;
  }

  try {
    const [htmlResponse, cssResponse, headerResponse, footerResponse] = await Promise.all([
      fetch(example.htmlUrl),
      example.cssUrl ? fetch(example.cssUrl) : Promise.resolve(new Response("")),
      example.headerUrl ? fetch(example.headerUrl) : Promise.resolve(new Response("")),
      example.footerUrl ? fetch(example.footerUrl) : Promise.resolve(new Response("")),
    ]);

    if (!htmlResponse.ok) {
      throw new Error(`Failed to load ${example.htmlUrl}`);
    }
    if (example.cssUrl && !cssResponse.ok) {
      throw new Error(`Failed to load ${example.cssUrl}`);
    }
    if (example.headerUrl && !headerResponse.ok) {
      throw new Error(`Failed to load ${example.headerUrl}`);
    }
    if (example.footerUrl && !footerResponse.ok) {
      throw new Error(`Failed to load ${example.footerUrl}`);
    }

    const [html, css, header, footer] = await Promise.all([
      htmlResponse.text(),
      cssResponse.text(),
      headerResponse.text(),
      footerResponse.text(),
    ]);

    setHtmlValue(html);
    setCssValue(css);
    setHeaderValue(header);
    setFooterValue(footer);
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

    if (isActive) {
      if (pane.id === "editor-html-tab" && htmlEditor) {
        htmlEditor.refresh();
      }
      if (pane.id === "editor-css-tab" && cssEditor) {
        cssEditor.refresh();
      }
      if (pane.id === "editor-header-tab" && headerEditor) {
        headerEditor.refresh();
      }
      if (pane.id === "editor-footer-tab" && footerEditor) {
        footerEditor.refresh();
      }
    }
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

  const html = getHtmlValue();
  const css = getCssValue();
  const viewport = getViewportDimensions();
  const page = computePageSize(viewport);
  const marginTop = PAGE_MARGINS.top.toFixed(2);
  const marginRight = PAGE_MARGINS.right.toFixed(2);
  const marginBottom = PAGE_MARGINS.bottom.toFixed(2);
  const marginLeft = PAGE_MARGINS.left.toFixed(2);

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
          html {
            margin: 0;
            padding: 32px 0;
            background: #e2e8f0;
            min-height: 100%;
          }
          body {
            margin: 0 auto;
            width: ${page.width.toFixed(2)}px;
            min-height: ${page.height.toFixed(2)}px;
            padding: ${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px;
            background: #fff;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
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

async function enableCKEditor() {
  if (useCKEditor) {
    return;
  }

  try {
    // Load CKEditor CSS
    DOM.ckeditorCss.media = "all";

    // Wait for CKEditor script to load if not already loaded
    if (typeof ClassicEditor === "undefined") {
      await new Promise((resolve, reject) => {
        DOM.ckeditorScript.onload = resolve;
        DOM.ckeditorScript.onerror = reject;
        if (DOM.ckeditorScript.src && !DOM.ckeditorScript.loading) {
          // Script already loaded
          resolve();
        }
      });
    }

    // Get current HTML content
    const currentHtml = getHtmlValue();

    // Destroy CodeMirror instance if it exists
    if (htmlEditor) {
      htmlEditor.toTextArea();
      htmlEditor = null;
    }

    // Create CKEditor instance
    ckeditorInstance = await ClassicEditor.create(DOM.htmlInput, {
      toolbar: [
        'heading', '|',
        'bold', 'italic', 'link', 'bulletedList', 'numberedList', '|',
        'indent', 'outdent', '|',
        'blockQuote', 'insertTable', 'mediaEmbed', 'undo', 'redo'
      ],
      language: 'en'
    });

    // Set the content
    ckeditorInstance.setData(currentHtml);

    // Listen for changes
    ckeditorInstance.model.document.on('change:data', () => {
      updateHtmlPreview();
    });

    useCKEditor = true;
    setStatus("CKEditor enabled.", "success");
  } catch (error) {
    console.error("Failed to enable CKEditor:", error);
    setStatus("Failed to enable CKEditor.", "error");
  }
}

async function disableCKEditor() {
  if (!useCKEditor) {
    return;
  }

  try {
    // Get current content from CKEditor
    const currentHtml = ckeditorInstance ? ckeditorInstance.getData() : "";

    // Destroy CKEditor instance
    if (ckeditorInstance) {
      await ckeditorInstance.destroy();
      ckeditorInstance = null;
    }

    // Hide CKEditor CSS
    DOM.ckeditorCss.media = "none";

    // Recreate CodeMirror instance
    if (DOM.htmlInput && !htmlEditor) {
      htmlEditor = CodeMirror.fromTextArea(DOM.htmlInput, {
        ...CODEMIRROR_BASE_OPTIONS,
        mode: "htmlmixed",
      });
      htmlEditor.setSize("100%", "100%");
      htmlEditor.on("change", handleInputChange);
    }

    // Set the content back
    setHtmlValue(currentHtml);

    useCKEditor = false;
    setStatus("CKEditor disabled.", "success");
  } catch (error) {
    console.error("Failed to disable CKEditor:", error);
    setStatus("Failed to disable CKEditor.", "error");
  }
}

function handleCKEditorToggle() {
  if (DOM.ckeditorToggle.checked) {
    void enableCKEditor();
  } else {
    void disableCKEditor();
  }
}

async function init() {
  if (!DOM.renderButton) {
    return;
  }

  setViewportDefaults();
  initializeEditors();

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
  if (DOM.htmlInput) {
    DOM.htmlInput.addEventListener("input", handleInputChange);
  }
  if (DOM.cssInput) {
    DOM.cssInput.addEventListener("input", handleInputChange);
  }
  if (DOM.viewportWidth) {
    DOM.viewportWidth.addEventListener("input", handleInputChange);
  }
  if (DOM.viewportHeight) {
    DOM.viewportHeight.addEventListener("input", handleInputChange);
  }

  // CKEditor toggle
  if (DOM.ckeditorToggle) {
    DOM.ckeditorToggle.addEventListener("change", handleCKEditorToggle);
  }

  if (DOM.logSelectAll) {
    DOM.logSelectAll.addEventListener("click", () => {
      const checkboxes = document.querySelectorAll(".log-cat");
      checkboxes.forEach(cb => {
        /** @type {HTMLInputElement} */ (cb).checked = true;
      });
    });
  }
  if (DOM.logSelectNone) {
    DOM.logSelectNone.addEventListener("click", () => {
      const checkboxes = document.querySelectorAll(".log-cat");
      checkboxes.forEach(cb => {
        /** @type {HTMLInputElement} */ (cb).checked = false;
      });
    });
  }

  await fetchAndRenderDebugCategories();

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
