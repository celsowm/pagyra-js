import { IS_BROWSER_MODE } from "./constants.js";

export async function ensureBrowserRenderer(state) {
  if (!IS_BROWSER_MODE) {
    return;
  }
  if (state.browserRendererPromise) {
    return state.browserRendererPromise;
  }

  state.browserRendererPromise = import("../vendor/pagyra-playground-browser.js")
    .then((module) => {
      state.browserRenderHtmlToPdf = module.renderHtmlToPdfBrowser;
      state.browserLogCategories = Array.isArray(module.LOG_CATEGORIES) ? module.LOG_CATEGORIES : [];
    })
    .catch((error) => {
      state.browserRendererPromise = null;
      console.error("[playground] failed to load browser renderer bundle:", error);
      throw error;
    });

  return state.browserRendererPromise;
}

export function computeBrowserResourceBase(documentPath) {
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
