import { DEFAULT_HEADER_FOOTER_MAX_HEIGHT_PX } from "./constants.js";

function waitForImageLoad(img) {
  return new Promise((resolve) => {
    if (img.complete) {
      resolve();
      return;
    }
    let settled = false;
    const done = () => {
      if (settled) {
        return;
      }
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

export async function resolveHeaderFooterHeights(headerHtml, footerHtml, contentWidthPx) {
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

export function buildHeaderFooter(headerHtml, footerHtml, heights) {
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
