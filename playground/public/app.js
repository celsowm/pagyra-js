const DOM = {
  htmlInput: /** @type {HTMLTextAreaElement} */ (document.getElementById("html-input")),
  cssInput: /** @type {HTMLTextAreaElement} */ (document.getElementById("css-input")),
  renderButton: /** @type {HTMLButtonElement} */ (document.getElementById("render-btn")),
  exampleSelect: /** @type {HTMLSelectElement} */ (document.getElementById("example-select")),
  status: /** @type {HTMLParagraphElement} */ (document.getElementById("status")),
  pdfViewer: /** @type {HTMLObjectElement} */ (document.getElementById("pdf-viewer")),
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
 * @typedef {{ id: string; label: string; html: string; css: string }} PlaygroundExample
 */

/** @type {PlaygroundExample[]} */
const EXAMPLES = [
  {
    id: "starter-report",
    label: "Starter Report (EN)",
    html: `<!DOCTYPE html>
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
        Need multiple pages? Just let the text flow - Pagyra will handle the pagination.
      </p>
      <footer>
        <small>Prepared with Pagyra &copy; <time datetime="2025-10-12">October 12, 2025</time></small>
      </footer>
    </main>
  </body>
</html>`,
    css: `body {
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
}`,
  },
  {
    id: "monthly-summary",
    label: "Relat\u00F3rio B\u00E1sico (pt-BR)",
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <title>Relat&oacute;rio B&aacute;sico</title>
    <style>
        body {
            font-family: PagyraDefault, sans-serif;
            font-size: 14pt;
            line-height: 1.5;
            color: #222222;
        }
        h1 {
            font-size: 24pt;
            margin-bottom: 12pt;
            text-align: center;
        }
        p {
            margin: 0 0 10pt 0;
        }
        p.intro {
            font-size: 16pt;
        }
        a {
            color: #1a73e8;
            text-decoration: underline;
        }
        ul {
            margin: 8pt 0 12pt 30pt;
        }
        li {
            margin-bottom: 4pt;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16pt;
        }
        th {
            background-color: #f0f4ff;
            font-weight: bold;
            text-align: left;
        }
        th, td {
            padding: 6pt 8pt;
            border: 1px solid #d0d6e2;
        }
        .note {
            font-size: 12pt;
            color: #555555;
        }
    </style>
</head>
<body>
    <h1>Resumo Mensal</h1>
    <p class="intro">Este documento demonstra o fluxo HTML b&aacute;sico renderizado pelo Pagyra usando o novo conversor HtmlToPdfConverter.</p>
    <p>Voc&ecirc; pode combinar <strong>&ecirc;nfase</strong>, <em>it&aacute;lico</em> e at&eacute; mesmo refer&ecirc;ncias externas como <a href="https://pagyra.dev">site oficial</a>.</p>

    <p>Principais destaques:</p>
    <ul>
        <li>Compatibilidade com estilos inline e CSS embutido</li>
        <li>Suporte a links clic&aacute;veis</li>
        <li>Renderiza&ccedil;&atilde;o simplificada de tabelas</li>
    </ul>

    <table>
        <thead>
            <tr>
                <th>Indicador</th>
                <th>Valor</th>
                <th>Varia&ccedil;&atilde;o</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Receita</td>
                <td>R$ 128.450</td>
                <td style="color: #0a8a0a;">+8,2%</td>
            </tr>
            <tr>
                <td>Novos clientes</td>
                <td>276</td>
                <td style="color: #0a8a0a;">+5,5%</td>
            </tr>
            <tr>
                <td>Tickets</td>
                <td>412</td>
                <td style="color: #c8261b;">-2,1%</td>
            </tr>
        </tbody>
    </table>

    <p class="note">Observa&ccedil;&atilde;o: os dados acima s&atilde;o fict&iacute;cios e servem apenas para fins de demonstra&ccedil;&atilde;o.</p>
</body>
</html>`,
    css: "",
  },
];

const EXAMPLE_LOOKUP = new Map(EXAMPLES.map(example => [example.id, example]));
const DEFAULT_EXAMPLE_ID = EXAMPLES[0]?.id ?? "";

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

function applyExample(example) {
  DOM.htmlInput.value = example.html;
  DOM.cssInput.value = example.css ?? "";
  DOM.exampleSelect.value = example.id;
}

function setViewportDefaults() {
  DOM.viewportWidth.value = CONTENT_DEFAULTS.widthPx.toFixed(2);
  DOM.viewportHeight.value = CONTENT_DEFAULTS.heightPx.toFixed(2);
}

function handleExampleChange() {
  const selectedId = DOM.exampleSelect.value;
  const selectedExample = EXAMPLE_LOOKUP.get(selectedId);
  if (!selectedExample) {
    return;
  }
  applyExample(selectedExample);
  void renderPdf();
}

function init() {
  if (EXAMPLES.length === 0 || !DOM.renderButton) {
    return;
  }

  populateExampleSelect(EXAMPLES);
  setViewportDefaults();

  DOM.renderButton.addEventListener("click", () => {
    void renderPdf();
  });

  DOM.exampleSelect.addEventListener("change", handleExampleChange);

  const initialExample = EXAMPLE_LOOKUP.get(DEFAULT_EXAMPLE_ID) ?? EXAMPLES[0];
  if (initialExample) {
    applyExample(initialExample);
  }

  void renderPdf();
}

init();
