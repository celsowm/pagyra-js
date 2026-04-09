export function switchEditorTab(dom, state, tabName) {
  dom.editorTabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive.toString());
  });

  const panes = document.querySelectorAll(".editor-panel .tab-pane");
  panes.forEach((pane) => {
    const isActive = pane.id === `editor-${tabName}-tab`;
    pane.classList.toggle("active", isActive);
    pane.setAttribute("aria-hidden", (!isActive).toString());

    if (!isActive) {
      return;
    }
    if (pane.id === "editor-html-tab" && state.htmlEditor) state.htmlEditor.refresh();
    if (pane.id === "editor-css-tab" && state.cssEditor) state.cssEditor.refresh();
    if (pane.id === "editor-header-tab" && state.headerEditor) state.headerEditor.refresh();
    if (pane.id === "editor-footer-tab" && state.footerEditor) state.footerEditor.refresh();
  });
}

export function switchPreviewTab(dom, tabName) {
  dom.previewTabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", isActive.toString());
  });

  const panes = document.querySelectorAll(".preview-panel .tab-pane");
  panes.forEach((pane) => {
    const isActive = pane.id === `preview-${tabName}-tab`;
    pane.classList.toggle("active", isActive);
    pane.setAttribute("aria-hidden", (!isActive).toString());
  });
}

export function createTabClickHandler(dom, state) {
  return function handleTabClick(event) {
    const button = /** @type {HTMLElement} */ (event.target).closest(".tab-button");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    const tabName = button.dataset.tab;
    if (!tabName) {
      return;
    }
    if (button.closest(".editor-panel")) {
      switchEditorTab(dom, state, tabName);
    } else if (button.closest(".preview-panel")) {
      switchPreviewTab(dom, tabName);
    }
  };
}
