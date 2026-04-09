import { PAGE_MARGINS } from "./constants.js";
import { computePageSize, getViewportDimensions } from "./page.js";

export function extractPreviewDocumentParts(rawHtml) {
  const hasFullDocument = /<\s*html[\s>]/i.test(rawHtml);
  if (!hasFullDocument) {
    return { bodyHtml: rawHtml, styleTags: "", linkTags: "" };
  }

  try {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(rawHtml, "text/html");
    const bodyHtml = parsed.body?.innerHTML ?? rawHtml;
    const styleTags = parsed.head
      ? Array.from(parsed.head.querySelectorAll("style")).map((node) => node.outerHTML).join("\n")
      : "";
    const linkTags = parsed.head
      ? Array.from(parsed.head.querySelectorAll('link[rel="stylesheet"]')).map((node) => node.outerHTML).join("\n")
      : "";
    return { bodyHtml, styleTags, linkTags };
  } catch (error) {
    console.warn("[playground] failed to parse HTML preview document:", error);
    return { bodyHtml: rawHtml, styleTags: "", linkTags: "" };
  }
}

export function updateHtmlPreview(dom, editors) {
  if (!dom.htmlViewer) {
    return;
  }

  const rawHtml = editors.getHtmlValue();
  const css = editors.getCssValue();
  const { bodyHtml, styleTags, linkTags } = extractPreviewDocumentParts(rawHtml);
  const viewport = getViewportDimensions(dom);
  const page = computePageSize(viewport);
  const marginTop = PAGE_MARGINS.top.toFixed(2);
  const marginRight = PAGE_MARGINS.right.toFixed(2);
  const marginBottom = PAGE_MARGINS.bottom.toFixed(2);
  const marginLeft = PAGE_MARGINS.left.toFixed(2);

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>HTML Preview</title>
        <style>
          * { box-sizing: border-box; }
          html { margin: 0; min-height: 100%; }
          body {
            margin: 0 !important;
            padding: 32px 0;
            background:
              radial-gradient(circle at top, rgba(78, 205, 196, 0.14), transparent 30%),
              linear-gradient(180deg, #dfe7f1 0%, #cfd9e7 100%);
            min-height: 100%;
            display: flex;
            justify-content: center;
          }
          .preview-page {
            width: ${page.width.toFixed(2)}px;
            min-height: ${page.height.toFixed(2)}px;
            padding: ${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px;
            background: #fff;
            box-shadow: 0 28px 60px rgba(15, 23, 42, 0.22);
            font-family: 'Times New Roman', Times, serif;
            font-size: 16px;
            line-height: 1.2;
            color: #000;
          }
        </style>
        ${css ? `<style>${css}</style>` : ""}
        ${styleTags}
        ${linkTags}
      </head>
      <body>
        <div class="preview-page">
          ${bodyHtml}
        </div>
      </body>
    </html>
  `;

  const iframeDoc = dom.htmlViewer.contentDocument || dom.htmlViewer.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();
}
