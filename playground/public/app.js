const htmlInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("html-input"));
const cssInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("css-input"));
const renderButton = /** @type {HTMLButtonElement} */ (document.getElementById("render-btn"));
const statusEl = /** @type {HTMLParagraphElement} */ (document.getElementById("status"));
const pdfObject = /** @type {HTMLObjectElement} */ (document.getElementById("pdf-viewer"));
const viewportWidthInput = /** @type {HTMLInputElement} */ (document.getElementById("viewport-width"));
const viewportHeightInput = /** @type {HTMLInputElement} */ (document.getElementById("viewport-height"));

const PX_PER_PT = 96 / 72;
const DEFAULT_PAGE_WIDTH_PT = 595.28;
const DEFAULT_PAGE_HEIGHT_PT = 841.89;
const DEFAULT_PAGE_MARGIN_PT = 36;
const DEFAULT_PAGE_WIDTH_PX = DEFAULT_PAGE_WIDTH_PT * PX_PER_PT;
const DEFAULT_PAGE_HEIGHT_PX = DEFAULT_PAGE_HEIGHT_PT * PX_PER_PT;
const DEFAULT_MARGIN_PX = DEFAULT_PAGE_MARGIN_PT * PX_PER_PT;
const DEFAULT_MARGINS_PX = {
  top: DEFAULT_MARGIN_PX,
  right: DEFAULT_MARGIN_PX,
  bottom: DEFAULT_MARGIN_PX,
  left: DEFAULT_MARGIN_PX,
};
const DEFAULT_CONTENT_WIDTH_PX = DEFAULT_PAGE_WIDTH_PX - DEFAULT_MARGIN_PX * 2;
const DEFAULT_CONTENT_HEIGHT_PX = DEFAULT_PAGE_HEIGHT_PX - DEFAULT_MARGIN_PX * 2;

let currentObjectUrl = "";


const defaultHtml = `<!DOCTYPE html>
<html>
  <body>
    <main>
      <h1>Pagyra Sample Report</h1>
      <p class="lead">
        Start from this clean A4-friendly layout and adapt the content to your needs.
      </p>
      <h2>Checklist</h2>
      <ul>
        <li>Keep copy within the content area defined by the margins.</li>
        <li>Use headings, paragraphs, and lists for structure.</li>
        <li>Update styles to match your brand.</li>
      </ul>
      <p>
        Need multiple pages? Just let the text flow — Pagyra will handle the pagination.
      </p>
      <footer>
        <small>Prepared with Pagyra • <time datetime="2025-10-12">October 12, 2025</time></small>
      </footer>
    </main>
  </body>
</html>`;

const defaultCss = `body {
  font-family: "Segoe UI", Arial, sans-serif;
  background: #f5f5f5;
  color: #1f2937;
  margin: 0;
  padding: 24px;
}

main {
  background: #ffffff;
  margin: 0 auto;
  max-width: 560px;
  padding: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}

h1 {
  font-size: 26px;
  margin: 0 0 8px;
  color: #111827;
}

p.lead {
  margin: 0;
  color: #4b5563;
  line-height: 1.6;
}

h2 {
  font-size: 18px;
  margin: 0 0 8px;
  color: #1f2937;
}

p {
  margin: 0 0 12px;
  line-height: 1.6;
}

ul {
  margin: 0 0 16px;
  padding-left: 20px;
}

footer {
  margin-top: 32px;
  font-size: 12px;
  color: #6b7280;
  text-align: right;
}`;

htmlInput.value = defaultHtml;
cssInput.value = defaultCss;
viewportWidthInput.value = DEFAULT_CONTENT_WIDTH_PX.toFixed(2);
viewportHeightInput.value = DEFAULT_CONTENT_HEIGHT_PX.toFixed(2);

renderButton.addEventListener("click", async () => {
  const html = htmlInput.value;
  const css = cssInput.value;
  const viewportWidth = Math.max(Number.parseFloat(viewportWidthInput.value) || DEFAULT_CONTENT_WIDTH_PX, 1);
  const viewportHeight = Math.max(Number.parseFloat(viewportHeightInput.value) || DEFAULT_CONTENT_HEIGHT_PX, 1);
  const pageWidth = viewportWidth + DEFAULT_MARGINS_PX.left + DEFAULT_MARGINS_PX.right;
  const pageHeight = viewportHeight + DEFAULT_MARGINS_PX.top + DEFAULT_MARGINS_PX.bottom;

  statusEl.textContent = "Rendering...";
  statusEl.style.color = "#94a3b8";
  renderButton.disabled = true;

  try {
    const response = await fetch("/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        css,
        viewportWidth,
        viewportHeight,
        pageWidth,
        pageHeight,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Unexpected error" }));
      throw new Error(payload.error ?? "Failed to render PDF");
    }

    const buffer = await response.arrayBuffer();
    const blob = new Blob([buffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
    }
    currentObjectUrl = url;
    pdfObject.setAttribute("data", url);
    statusEl.textContent = "PDF updated.";
    statusEl.style.color = "#38bdf8";
  } catch (error) {
    console.error(error);
    statusEl.textContent = error instanceof Error ? error.message : "Failed to render PDF.";
    statusEl.style.color = "#f97316";
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = "";
    }
    pdfObject.removeAttribute("data");
  } finally {
    renderButton.disabled = false;
  }
});

// Render initial example automatically on load.
renderButton.click();
