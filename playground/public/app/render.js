import {
  IS_BROWSER_MODE,
  PAGED_BODY_MARGIN_MODE,
} from "./constants.js";
import { computeBrowserResourceBase, ensureBrowserRenderer } from "./browser-renderer.js";
import { getDebugConfig } from "./debug.js";
import { buildHeaderFooter, resolveHeaderFooterHeights } from "./header-footer.js";
import { getSanitizedPageMetrics, getViewportDimensions } from "./page.js";
import {
  handleRenderFailure,
  handleRenderSuccess,
  setRenderButtonState,
  setStatus,
} from "./status.js";

export function createRenderPdf(dom, state, editors) {
  return async function renderPdf() {
    const html = editors.getHtmlValue();
    const css = editors.getCssValue();
    const headerHtml = editors.getHeaderValue().trim();
    const footerHtml = editors.getFooterValue().trim();
    const viewport = getViewportDimensions(dom);
    const pageMetrics = getSanitizedPageMetrics(viewport);
    const selectedExample = state.activeExampleId ? state.exampleLookup.get(state.activeExampleId) : undefined;
    const documentPath = selectedExample?.htmlUrl;
    const debug = getDebugConfig(dom);

    const headerFooterHeights = await resolveHeaderFooterHeights(
      headerHtml,
      footerHtml,
      pageMetrics.maxContentWidth,
    );
    const headerFooter = buildHeaderFooter(headerHtml, footerHtml, headerFooterHeights);

    const serverPayload = {
      html,
      css,
      headerHtml: headerHtml || undefined,
      footerHtml: footerHtml || undefined,
      headerMaxHeightPx: headerFooter?.maxHeaderHeightPx,
      footerMaxHeightPx: headerFooter?.maxFooterHeightPx,
      viewportWidth: pageMetrics.viewportWidth,
      viewportHeight: pageMetrics.viewportHeight,
      pageWidth: pageMetrics.pageWidth,
      pageHeight: pageMetrics.pageHeight,
      documentPath,
      debugLevel: debug.level,
      debugCats: debug.cats.length > 0 ? debug.cats : undefined,
      pagedBodyMargin: PAGED_BODY_MARGIN_MODE,
    };

    const { resourceBaseDir, assetRootDir } = computeBrowserResourceBase(documentPath);
    const browserOptions = {
      html,
      css,
      viewportWidth: pageMetrics.viewportWidth,
      viewportHeight: pageMetrics.viewportHeight,
      pageWidth: pageMetrics.pageWidth,
      pageHeight: pageMetrics.pageHeight,
      margins: pageMetrics.margins,
      debugLevel: debug.level,
      debugCats: debug.cats.length > 0 ? debug.cats : undefined,
      pagedBodyMargin: PAGED_BODY_MARGIN_MODE,
      resourceBaseDir,
      assetRootDir,
      ...(headerFooter ? { headerFooter } : {}),
    };

    setStatus(dom, "Rendering PDF and refreshing the preview stage…", "neutral");
    setRenderButtonState(dom, true);

    try {
      if (IS_BROWSER_MODE) {
        await ensureBrowserRenderer(state);
        if (!state.browserRenderHtmlToPdf) {
          throw new Error("Browser renderer bundle is not ready");
        }
        const pdfBytes = await state.browserRenderHtmlToPdf(browserOptions);
        const blob = new Blob([pdfBytes], { type: "application/pdf" });
        handleRenderSuccess(dom, state, URL.createObjectURL(blob));
        return;
      }

      const response = await fetch("/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serverPayload),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Unexpected error" }));
        throw new Error(payload.error ?? "Failed to render PDF");
      }

      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], { type: "application/pdf" });
      handleRenderSuccess(dom, state, URL.createObjectURL(blob));
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to render PDF.";
      handleRenderFailure(dom, state, message);
    } finally {
      setRenderButtonState(dom, false);
    }
  };
}
