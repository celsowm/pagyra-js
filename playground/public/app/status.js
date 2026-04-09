import {
  DEFAULT_RENDER_LABEL,
  DEFAULT_RENDER_SUBTLE,
  STATUS_COLORS,
} from "./constants.js";

export function setStatus(dom, message, tone = "neutral") {
  if (!dom.status) {
    return;
  }
  dom.status.textContent = message;
  dom.status.style.color = STATUS_COLORS[tone] ?? STATUS_COLORS.neutral;
  if (dom.statusShell) {
    dom.statusShell.dataset.tone = tone;
  }
}

export function setRenderButtonState(dom, isRendering) {
  if (!dom.renderButton) {
    return;
  }
  dom.renderButton.disabled = isRendering;
  dom.renderButton.dataset.state = isRendering ? "rendering" : "idle";
  const label = dom.renderButton.querySelector(".button-label");
  const subtle = dom.renderButton.querySelector(".button-subtle");
  if (label) {
    label.textContent = isRendering ? "Rendering PDF…" : DEFAULT_RENDER_LABEL;
  }
  if (subtle) {
    subtle.textContent = isRendering
      ? "Pagyra is generating the next output"
      : DEFAULT_RENDER_SUBTLE;
  }
}

export function setPdfPreviewState(dom, hasDocument) {
  if (dom.pdfFrame) {
    dom.pdfFrame.classList.toggle("has-document", hasDocument);
  }
  if (dom.pdfEmptyState) {
    dom.pdfEmptyState.hidden = hasDocument;
  }
}

export function revokeCurrentObjectUrl(state) {
  if (!state.currentObjectUrl) {
    return;
  }
  URL.revokeObjectURL(state.currentObjectUrl);
  state.currentObjectUrl = "";
}

export function handleRenderSuccess(dom, state, blobUrl) {
  revokeCurrentObjectUrl(state);
  state.currentObjectUrl = blobUrl;
  if (dom.pdfViewer) {
    dom.pdfViewer.setAttribute("data", blobUrl);
  }
  setPdfPreviewState(dom, true);
  setStatus(dom, "PDF updated and ready for inspection.", "success");
}

export function handleRenderFailure(dom, state, message) {
  revokeCurrentObjectUrl(state);
  if (dom.pdfViewer) {
    dom.pdfViewer.removeAttribute("data");
  }
  setPdfPreviewState(dom, false);
  setStatus(dom, message, "error");
}
