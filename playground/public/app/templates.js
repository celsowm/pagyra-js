export function populateExampleSelect(dom, examples) {
  dom.exampleSelect.innerHTML = "";
  const groups = new Map();
  for (const example of examples) {
    const groupName = example.group || "Other";
    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName).push(example);
  }
  for (const [groupName, items] of groups) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = groupName;
    for (const example of items) {
      const option = document.createElement("option");
      option.value = example.id;
      option.textContent = example.label;
      optgroup.append(option);
    }
    dom.exampleSelect.append(optgroup);
  }
}

function getTemplateFilterResults(state) {
  const query = state.templateSearchValue.trim().toLowerCase();
  if (!query) {
    return state.examples;
  }
  return state.examples.filter((example) => example.label.toLowerCase().includes(query));
}

export function syncTemplateLabels(dom, example) {
  const label = example?.label ?? "Choose a template";
  if (dom.templateTriggerValue) {
    dom.templateTriggerValue.textContent = label;
  }
  if (dom.activeTemplateName) {
    dom.activeTemplateName.textContent = label;
  }
}

export function renderTemplateList(dom, state) {
  if (!dom.templateList) {
    return;
  }

  dom.templateList.innerHTML = "";
  const filtered = getTemplateFilterResults(state);
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "template-empty";
    empty.textContent = "No templates match this search.";
    dom.templateList.append(empty);
    return;
  }

  for (const example of filtered) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "template-option";
    button.dataset.exampleId = example.id;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", (example.id === state.activeExampleId).toString());
    if (example.id === state.activeExampleId) {
      button.classList.add("active");
    }
    button.innerHTML = `<strong>${example.label}</strong><span>${example.id}</span>`;
    dom.templateList.append(button);
  }
}

export function setTemplatePopover(dom, state, open) {
  if (!dom.templatePopover || !dom.templateTrigger) {
    return;
  }
  state.templatePopoverOpen = open;
  dom.templatePopover.hidden = !open;
  dom.templateTrigger.setAttribute("aria-expanded", open.toString());
  if (open) {
    renderTemplateList(dom, state);
    window.setTimeout(() => dom.templateSearch?.focus(), 0);
  }
}

export function bindTemplatePicker(dom, state, onTemplateSelect) {
  if (dom.templateTrigger) {
    dom.templateTrigger.addEventListener("click", () => {
      setTemplatePopover(dom, state, !state.templatePopoverOpen);
    });
  }

  if (dom.templateSearch) {
    dom.templateSearch.addEventListener("input", () => {
      state.templateSearchValue = dom.templateSearch.value;
      renderTemplateList(dom, state);
    });
  }

  if (dom.templateList) {
    dom.templateList.addEventListener("click", (event) => {
      const option = /** @type {HTMLElement} */ (event.target).closest(".template-option");
      if (!(option instanceof HTMLButtonElement)) {
        return;
      }
      const exampleId = option.dataset.exampleId;
      if (!exampleId) {
        return;
      }
      dom.exampleSelect.value = exampleId;
      onTemplateSelect(exampleId);
    });
  }

  document.addEventListener("click", (event) => {
    if (!state.templatePopoverOpen || !dom.templatePicker) {
      return;
    }
    const target = /** @type {Node} */ (event.target);
    if (!dom.templatePicker.contains(target)) {
      setTemplatePopover(dom, state, false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.templatePopoverOpen) {
      setTemplatePopover(dom, state, false);
      dom.templateTrigger?.focus();
    }
  });
}
