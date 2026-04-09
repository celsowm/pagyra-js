export function createPlaygroundState() {
  return {
    currentObjectUrl: "",
    htmlEditor: null,
    cssEditor: null,
    headerEditor: null,
    footerEditor: null,
    ckeditorInstance: null,
    useCKEditor: false,
    templatePopoverOpen: false,
    templateSearchValue: "",
    browserRenderHtmlToPdf: null,
    browserLogCategories: [],
    browserRendererPromise: null,
    examples: [],
    exampleLookup: new Map(),
    activeExampleId: "",
  };
}
