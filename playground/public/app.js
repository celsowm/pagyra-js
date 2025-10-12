const htmlInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("html-input"));
const cssInput = /** @type {HTMLTextAreaElement} */ (document.getElementById("css-input"));
const renderButton = /** @type {HTMLButtonElement} */ (document.getElementById("render-btn"));
const statusEl = /** @type {HTMLParagraphElement} */ (document.getElementById("status"));
const pdfObject = /** @type {HTMLObjectElement} */ (document.getElementById("pdf-viewer"));
const viewportWidthInput = /** @type {HTMLInputElement} */ (document.getElementById("viewport-width"));
const viewportHeightInput = /** @type {HTMLInputElement} */ (document.getElementById("viewport-height"));

const defaultHtml = `<!DOCTYPE html>
<html>
  <body>
    <header class="hero">
      <h1>Pagyra Playground</h1>
      <p>Experiment with HTML → PDF rendering directly in your browser.</p>
    </header>
    <main class="content">
      <section class="card">
        <h2>Features</h2>
        <ul>
          <li>Block + inline layout</li>
          <li>Margin & padding support</li>
          <li>Floats and basic typography</li>
        </ul>
      </section>
      <section class="card highlight">
        <h2>Get Started</h2>
        <p>Modify the HTML/CSS here and click convert to rebuild the PDF preview.</p>
      </section>
    </main>
    <footer class="footer">
      <p>Generated with Pagyra.</p>
    </footer>
  </body>
</html>`;

const defaultCss = `body {
  font-family: "Inter", sans-serif;
  margin: 0;
  padding: 0;
  color: #0f172a;
}

.hero {
  padding: 48px 40px;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  color: white;
  border-bottom: 4px solid #0f172a;
}

.content {
  display: flex;
  gap: 24px;
  padding: 32px 40px;
}

.card {
  background: #f8fafc;
  padding: 24px;
  border-radius: 16px;
  border: 1px solid #cbd5f5;
  width: 50%;
}

.card.highlight {
  background: #0f172a;
  color: #f8fafc;
  border: 1px solid #38bdf8;
}

.footer {
  padding: 24px 40px;
  text-align: center;
  background: #e2e8f0;
  margin-top: 24px;
}`;

htmlInput.value = defaultHtml;
cssInput.value = defaultCss;

renderButton.addEventListener("click", async () => {
  const html = htmlInput.value;
  const css = cssInput.value;
  const viewportWidth = Number.parseInt(viewportWidthInput.value, 10) || 800;
  const viewportHeight = Number.parseInt(viewportHeightInput.value, 10) || 1120;

  statusEl.textContent = "Rendering…";
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
        pageWidth: viewportWidth,
        pageHeight: viewportHeight,
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
let currentObjectUrl = "";
