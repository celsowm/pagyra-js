import { setTemplatePopover, renderTemplateList, syncTemplateLabels } from "./templates.js";

export async function loadExample(dom, state, editors, previewApi, renderPdf, example) {
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

    if (!htmlResponse.ok) throw new Error(`Failed to load ${example.htmlUrl}`);
    if (example.cssUrl && !cssResponse.ok) throw new Error(`Failed to load ${example.cssUrl}`);
    if (example.headerUrl && !headerResponse.ok) throw new Error(`Failed to load ${example.headerUrl}`);
    if (example.footerUrl && !footerResponse.ok) throw new Error(`Failed to load ${example.footerUrl}`);

    const [html, css, header, footer] = await Promise.all([
      htmlResponse.text(),
      cssResponse.text(),
      headerResponse.text(),
      footerResponse.text(),
    ]);

    editors.setHtmlValue(html);
    editors.setCssValue(css);
    editors.setHeaderValue(header);
    editors.setFooterValue(footer);
    dom.exampleSelect.value = example.id;
    state.activeExampleId = example.id;
    syncTemplateLabels(dom, example);
    renderTemplateList(dom, state);
    setTemplatePopover(dom, state, false);

    void renderPdf();
    previewApi.updateHtmlPreview();
  } catch (error) {
    console.error(error);
    previewApi.setStatus(error instanceof Error ? error.message : "Failed to load example.", "error");
  }
}

export function createExampleChangeHandler(dom, state, editors, previewApi, renderPdf) {
  return function handleExampleChange(exampleId = dom.exampleSelect.value) {
    const selectedExample = state.exampleLookup.get(exampleId);
    if (selectedExample) {
      void loadExample(dom, state, editors, previewApi, renderPdf, selectedExample);
    }
  };
}
