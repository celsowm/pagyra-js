import express from "express";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  renderHtmlToPdf,
  DEFAULT_PAGE_WIDTH_PX,
  DEFAULT_PAGE_HEIGHT_PX,
  resolvePageMarginsPx,
  sanitizeDimension,
  maxContentDimension,
} from "../src/html-to-pdf.js";

interface RenderRequestBody {
  html?: string;
  css?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  pageWidth?: number;
  pageHeight?: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

const app = express();
app.use(express.json({ limit: "2mb" }));

// Add a logger middleware to debug static file requests
app.use((req, res, next) => {
  console.log(`[playground] request: ${req.method} ${req.url}`);
  next();
});

app.use(express.static(PUBLIC_DIR));

app.post("/render", async (req, res) => {
  try {
    const body = req.body as RenderRequestBody;
    if (!body || typeof body.html !== "string") {
      res.status(400).json({ error: "Request must include an 'html' field." });
      return;
    }

    const cssInput = typeof body.css === "string" ? body.css : "";
    const htmlInput = body.html;
    const pageWidth = sanitizeDimension(body.pageWidth, DEFAULT_PAGE_WIDTH_PX);
    const pageHeight = sanitizeDimension(body.pageHeight, DEFAULT_PAGE_HEIGHT_PX);
    const marginsPx = resolvePageMarginsPx(pageWidth, pageHeight);
    const maxContentWidth = maxContentDimension(pageWidth, marginsPx.left + marginsPx.right);
    const maxContentHeight = maxContentDimension(pageHeight, marginsPx.top + marginsPx.bottom);
    const viewportWidth = Math.min(sanitizeDimension(body.viewportWidth, maxContentWidth), maxContentWidth);
    const viewportHeight = Math.min(sanitizeDimension(body.viewportHeight, maxContentHeight), maxContentHeight);

    const pdfBytes = await renderHtmlToPdf({
      html: htmlInput,
      css: cssInput,
      viewportWidth,
      viewportHeight,
      pageWidth,
      pageHeight,
      margins: marginsPx,
      debugLevel: "TRACE" as const,
      debugCats: ["PARSE","STYLE","RENDER_TREE","ENCODING","FONT","PAINT"] as const,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error("[playground] render error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

const port = Number.parseInt(process.env.PORT ?? "", 10) || 5177;
const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (entryUrl === import.meta.url) {
  app.listen(port, () => {
    console.log(`Pagyra HTML-to-PDF playground running at http://localhost:${port}`);
  });
}
