// Type Workshop view — visual form for creating new Hobson types

export async function render(workshop, api) {
  const container = api.createElement('div', {
    style: 'width: 100%; max-width: 800px; margin: 0 auto; padding: 20px; box-sizing: border-box;'
  }, []);

  // Constants
  const TYPE_DEFINITION = '11111111-0000-0000-0000-000000000000';
  const ITEM_TYPE = '00000000-0000-0000-0000-000000000000';
  const VIEW_TYPE = 'aaaaaaaa-0000-0000-0000-000000000000';

  const DELEGATE_CODE = [
    'export async function render(item, api) {',
    "  const genericView = await api.require('generic-view');",
    '  return genericView.render(item, api);',
    '}'
  ].join('\n');

  const FIELD_VIEWS = [
    'heading', 'text', 'textarea', 'markdown', 'code',
    'checkbox', 'number', 'timestamp', 'tags', 'item-ref', 'json', 'object'
  ];

  const MODES = ['both', 'readonly', 'editable'];

  // State — initialize from persisted content or defaults
  const state = {
    typeName: workshop.content?.typeName || '',
    extendsType: workshop.content?.extendsType || ITEM_TYPE,
    typeDescription: workshop.content?.typeDescription || '',
    fields: (workshop.content?.fields || []).map(f => ({ ...f, options: { ...(f.options || {}) } }))
  };

  // Fetch all type-defs for the extends dropdown
  const allItems = await api.getAll();
  const typeDefs = allItems
    .filter(i => i.type === TYPE_DEFINITION)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Persist state to workshop item (symbol-browser pattern)
  const persistState = () => {
    workshop.content = { ...workshop.content, ...state };
    workshop.modified = Date.now();
    api.set(workshop);
  };

  // --- Shared Styles ---
  const inputStyle = 'width: 100%; padding: 8px 12px; font-size: 0.875rem; border: 1px solid var(--color-border); border-radius: var(--border-radius); background: var(--color-bg-surface); color: var(--color-text); outline: none; box-sizing: border-box;';
  const selectStyle = inputStyle + ' cursor: pointer;';
  const labelStyle = 'font-size: 0.75rem; font-weight: 500; color: var(--color-text-secondary); margin-bottom: 4px;';
  const btnStyle = 'padding: 6px 12px; font-size: 0.8125rem; border: 1px solid var(--color-border); border-radius: var(--border-radius); background: var(--color-bg-surface); color: var(--color-text); cursor: pointer;';
  const primaryBtnStyle = 'padding: 10px 20px; font-size: 0.875rem; border: none; border-radius: var(--border-radius); background: var(--color-primary); color: white; cursor: pointer; font-weight: 500;';

  function makeLabel(text) {
    return api.createElement('div', { style: labelStyle }, [text]);
  }

  // ==============================
  // Header
  // ==============================
  const header = api.createElement('div', {
    style: 'margin-bottom: 24px; padding-bottom: 15px; border-bottom: 2px solid var(--color-border-light);'
  }, []);
  header.appendChild(api.createElement('h2', {
    style: 'margin: 0; font-size: 1.25rem;'
  }, ['Type Workshop']));
  container.appendChild(header);

  // ==============================
  // Type Metadata Section
  // ==============================
  const typeSection = api.createElement('div', { style: 'margin-bottom: 24px;' }, []);

  // Type Name
  const nameGroup = api.createElement('div', { style: 'margin-bottom: 12px;' }, []);
  nameGroup.appendChild(makeLabel('Type Name (kebab-case)'));
  const nameInput = api.createElement('input', {
    type: 'text',
    placeholder: 'my-custom-type',
    value: state.typeName,
    style: inputStyle
  }, []);
  nameInput.oninput = (e) => {
    state.typeName = e.target.value;
    persistState();
    renderSummary();
  };
  nameGroup.appendChild(nameInput);
  typeSection.appendChild(nameGroup);

  // Extends dropdown
  const extendsGroup = api.createElement('div', { style: 'margin-bottom: 12px;' }, []);
  extendsGroup.appendChild(makeLabel('Extends'));
  const extendsSelect = api.createElement('select', { style: selectStyle }, []);
  for (const td of typeDefs) {
    const opt = api.createElement('option', { value: td.id }, [td.name || td.id.substring(0, 8)]);
    if (td.id === state.extendsType) opt.selected = true;
    extendsSelect.appendChild(opt);
  }
  extendsSelect.onchange = () => {
    state.extendsType = extendsSelect.value;
    persistState();
    renderSummary();
  };
  extendsGroup.appendChild(extendsSelect);
  typeSection.appendChild(extendsGroup);

  // Description
  const descGroup = api.createElement('div', { style: 'margin-bottom: 12px;' }, []);
  descGroup.appendChild(makeLabel('Description'));
  const descInput = api.createElement('textarea', {
    placeholder: 'Describe what this type represents...',
    rows: '3',
    style: inputStyle + ' resize: vertical; font-family: inherit;'
  }, []);
  descInput.value = state.typeDescription;
  descInput.oninput = (e) => {
    state.typeDescription = e.target.value;
    persistState();
  };
  descGroup.appendChild(descInput);
  typeSection.appendChild(descGroup);

  container.appendChild(typeSection);

  // ==============================
  // Fields Section
  // ==============================
  const fieldsHeader = api.createElement('div', {
    style: 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;'
  }, []);
  fieldsHeader.appendChild(api.createElement('h3', {
    style: 'margin: 0; font-size: 1rem;'
  }, ['Fields']));

  const addBtn = api.createElement('button', { style: btnStyle }, ['+ Add Field']);
  addBtn.onclick = () => {
    state.fields.push({
      id: crypto.randomUUID(),
      path: '',
      label: '',
      fieldView: 'text',
      mode: 'both',
      options: {}
    });
    persistState();
    rebuildFields();
    renderSummary();
  };
  fieldsHeader.appendChild(addBtn);
  container.appendChild(fieldsHeader);

  const fieldsContainer = api.createElement('div', {
    style: 'display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;'
  }, []);
  container.appendChild(fieldsContainer);

  // ==============================
  // Field Card Rendering
  // ==============================
  function renderFieldCard(field, index) {
    const card = api.createElement('div', {
      style: 'border: 1px solid var(--color-border); border-radius: var(--border-radius); padding: 14px; background: var(--color-bg-surface-alt);'
    }, []);

    // Row 1: path + label
    const row1 = api.createElement('div', {
      style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;'
    }, []);

    const pathGroup = api.createElement('div', {}, []);
    pathGroup.appendChild(makeLabel('Path (e.g. content.title)'));
    const pathInput = api.createElement('input', {
      type: 'text',
      placeholder: 'content.myField',
      value: field.path,
      style: inputStyle
    }, []);
    pathInput.oninput = (e) => {
      field.path = e.target.value;
      persistState();
      renderSummary();
    };
    pathGroup.appendChild(pathInput);
    row1.appendChild(pathGroup);

    const labelGroup = api.createElement('div', {}, []);
    labelGroup.appendChild(makeLabel('Label'));
    const labelInput = api.createElement('input', {
      type: 'text',
      placeholder: 'Display Label',
      value: field.label,
      style: inputStyle
    }, []);
    labelInput.oninput = (e) => {
      field.label = e.target.value;
      persistState();
    };
    labelGroup.appendChild(labelInput);
    row1.appendChild(labelGroup);

    card.appendChild(row1);

    // Row 2: field-view + mode
    const row2 = api.createElement('div', {
      style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;'
    }, []);

    const fvGroup = api.createElement('div', {}, []);
    fvGroup.appendChild(makeLabel('Field View'));
    const fvSelect = api.createElement('select', { style: selectStyle }, []);
    for (const fv of FIELD_VIEWS) {
      const opt = api.createElement('option', { value: fv }, [fv]);
      if (fv === field.fieldView) opt.selected = true;
      fvSelect.appendChild(opt);
    }
    fvGroup.appendChild(fvSelect);
    row2.appendChild(fvGroup);

    const modeGroup = api.createElement('div', {}, []);
    modeGroup.appendChild(makeLabel('Mode'));
    const modeSelect = api.createElement('select', { style: selectStyle }, []);
    for (const m of MODES) {
      const opt = api.createElement('option', { value: m }, [m]);
      if (m === field.mode) opt.selected = true;
      modeSelect.appendChild(opt);
    }
    modeSelect.onchange = () => {
      field.mode = modeSelect.value;
      persistState();
      renderSummary();
    };
    modeGroup.appendChild(modeSelect);
    row2.appendChild(modeGroup);

    card.appendChild(row2);

    // Row 3: field-view-specific options (dynamic container)
    const optionsContainer = api.createElement('div', {}, []);
    renderFieldOptions(field, optionsContainer);
    card.appendChild(optionsContainer);

    // Wire up field-view change after optionsContainer exists
    fvSelect.onchange = () => {
      field.fieldView = fvSelect.value;
      field.options = {
        dividerAfter: field.options.dividerAfter,
        collapsible: field.options.collapsible,
        startCollapsed: field.options.startCollapsed
      };
      persistState();
      renderFieldOptions(field, optionsContainer);
      renderSummary();
    };

    // Row 4: common options
    const commonRow = api.createElement('div', {
      style: 'display: flex; gap: 16px; align-items: center; margin-bottom: 10px; flex-wrap: wrap;'
    }, []);

    // dividerAfter
    const dividerLabel = api.createElement('label', {
      style: 'display: flex; align-items: center; gap: 4px; font-size: 0.8125rem; cursor: pointer; color: var(--color-text-secondary);'
    }, []);
    const dividerCb = api.createElement('input', { type: 'checkbox' }, []);
    dividerCb.checked = !!field.options.dividerAfter;
    dividerCb.onchange = () => {
      field.options.dividerAfter = dividerCb.checked;
      persistState();
    };
    dividerLabel.appendChild(dividerCb);
    dividerLabel.appendChild(api.createElement('span', {}, [' Divider after']));
    commonRow.appendChild(dividerLabel);

    // collapsible
    const collapsibleLabel = api.createElement('label', {
      style: 'display: flex; align-items: center; gap: 4px; font-size: 0.8125rem; cursor: pointer; color: var(--color-text-secondary);'
    }, []);
    const collapsibleCb = api.createElement('input', { type: 'checkbox' }, []);
    collapsibleCb.checked = !!field.options.collapsible;
    collapsibleLabel.appendChild(collapsibleCb);
    collapsibleLabel.appendChild(api.createElement('span', {}, [' Collapsible']));
    commonRow.appendChild(collapsibleLabel);

    // startCollapsed (visible only when collapsible is checked)
    const startCollapsedLabel = api.createElement('label', {
      style: 'display: ' + (field.options.collapsible ? 'flex' : 'none') + '; align-items: center; gap: 4px; font-size: 0.8125rem; cursor: pointer; color: var(--color-text-secondary);'
    }, []);
    const startCollapsedCb = api.createElement('input', { type: 'checkbox' }, []);
    startCollapsedCb.checked = !!field.options.startCollapsed;
    startCollapsedCb.onchange = () => {
      field.options.startCollapsed = startCollapsedCb.checked;
      persistState();
    };
    startCollapsedLabel.appendChild(startCollapsedCb);
    startCollapsedLabel.appendChild(api.createElement('span', {}, [' Start collapsed']));
    commonRow.appendChild(startCollapsedLabel);

    collapsibleCb.onchange = () => {
      field.options.collapsible = collapsibleCb.checked;
      startCollapsedLabel.style.display = collapsibleCb.checked ? 'flex' : 'none';
      if (!collapsibleCb.checked) {
        field.options.startCollapsed = false;
        startCollapsedCb.checked = false;
      }
      persistState();
    };

    card.appendChild(commonRow);

    // Row 5: action buttons
    const actionsRow = api.createElement('div', {
      style: 'display: flex; gap: 8px; justify-content: flex-end;'
    }, []);

    if (index > 0) {
      const upBtn = api.createElement('button', { style: btnStyle }, ['\u2191']);
      upBtn.title = 'Move up';
      upBtn.onclick = () => moveField(index, -1);
      actionsRow.appendChild(upBtn);
    }

    if (index < state.fields.length - 1) {
      const downBtn = api.createElement('button', { style: btnStyle }, ['\u2193']);
      downBtn.title = 'Move down';
      downBtn.onclick = () => moveField(index, 1);
      actionsRow.appendChild(downBtn);
    }

    const removeBtn = api.createElement('button', {
      style: btnStyle + ' color: var(--color-danger); border-color: var(--color-danger);'
    }, ['Remove']);
    removeBtn.onclick = () => removeField(index);
    actionsRow.appendChild(removeBtn);

    card.appendChild(actionsRow);
    return card;
  }

  // ==============================
  // Field-View-Specific Options
  // ==============================
  function renderFieldOptions(field, target) {
    target.innerHTML = '';
    const fv = field.fieldView;
    const opts = field.options;
    const row = api.createElement('div', {
      style: 'display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;'
    }, []);

    let hasOptions = false;

    if (fv === 'heading') {
      hasOptions = true;
      const g = api.createElement('div', {}, []);
      g.appendChild(makeLabel('Level'));
      const sel = api.createElement('select', { style: selectStyle + ' width: 80px;' }, []);
      for (let l = 1; l <= 6; l++) {
        const opt = api.createElement('option', { value: String(l) }, ['H' + l]);
        if (l === (opts.level || 2)) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.onchange = () => { opts.level = parseInt(sel.value); persistState(); };
      g.appendChild(sel);
      row.appendChild(g);
    }

    if (fv === 'text' || fv === 'textarea') {
      hasOptions = true;
      const g = api.createElement('div', { style: 'flex: 1;' }, []);
      g.appendChild(makeLabel('Placeholder'));
      const inp = api.createElement('input', {
        type: 'text', placeholder: 'Placeholder text...', value: opts.placeholder || '', style: inputStyle
      }, []);
      inp.oninput = (e) => { opts.placeholder = e.target.value; persistState(); };
      g.appendChild(inp);
      row.appendChild(g);
    }

    if (fv === 'textarea') {
      hasOptions = true;
      const g = api.createElement('div', {}, []);
      g.appendChild(makeLabel('Rows'));
      const inp = api.createElement('input', {
        type: 'number', value: String(opts.rows || 4), min: '1', max: '30',
        style: inputStyle + ' width: 80px;'
      }, []);
      inp.oninput = (e) => { opts.rows = parseInt(e.target.value) || 4; persistState(); };
      g.appendChild(inp);
      row.appendChild(g);
    }

    if (fv === 'markdown') {
      hasOptions = true;
      const g = api.createElement('div', {}, []);
      g.appendChild(makeLabel('Sizing'));
      const sel = api.createElement('select', { style: selectStyle + ' width: 120px;' }, []);
      for (const s of ['auto', 'fill']) {
        const opt = api.createElement('option', { value: s }, [s]);
        if (s === (opts.sizing || 'auto')) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.onchange = () => { opts.sizing = sel.value; persistState(); };
      g.appendChild(sel);
      row.appendChild(g);
    }

    if (fv === 'code') {
      hasOptions = true;
      const g = api.createElement('div', {}, []);
      g.appendChild(makeLabel('Language'));
      const sel = api.createElement('select', { style: selectStyle + ' width: 150px;' }, []);
      const languages = ['javascript', 'css', 'html', 'json', 'python', 'markdown', 'sql', 'shell', 'yaml', 'xml'];
      for (const lang of languages) {
        const opt = api.createElement('option', { value: lang }, [lang]);
        if (lang === (opts.language || 'javascript')) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.onchange = () => { opts.language = sel.value; persistState(); };
      g.appendChild(sel);
      row.appendChild(g);
    }

    if (fv === 'number') {
      hasOptions = true;
      for (const [lbl, key, ph] of [['Min', 'min', ''], ['Max', 'max', ''], ['Step', 'step', '1']]) {
        const g = api.createElement('div', {}, []);
        g.appendChild(makeLabel(lbl));
        const inp = api.createElement('input', {
          type: 'number', placeholder: ph,
          value: opts[key] != null ? String(opts[key]) : '',
          style: inputStyle + ' width: 80px;'
        }, []);
        inp.oninput = (e) => {
          opts[key] = e.target.value !== '' ? parseFloat(e.target.value) : undefined;
          persistState();
        };
        g.appendChild(inp);
        row.appendChild(g);
      }
      const g = api.createElement('div', { style: 'flex: 1;' }, []);
      g.appendChild(makeLabel('Placeholder'));
      const inp = api.createElement('input', {
        type: 'text', placeholder: 'Placeholder...', value: opts.placeholder || '', style: inputStyle
      }, []);
      inp.oninput = (e) => { opts.placeholder = e.target.value; persistState(); };
      g.appendChild(inp);
      row.appendChild(g);
    }

    if (fv === 'timestamp') {
      hasOptions = true;
      const g = api.createElement('div', {}, []);
      g.appendChild(makeLabel('Format'));
      const sel = api.createElement('select', { style: selectStyle + ' width: 120px;' }, []);
      for (const f of ['full', 'date', 'time', 'relative']) {
        const opt = api.createElement('option', { value: f }, [f]);
        if (f === (opts.format || 'full')) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.onchange = () => { opts.format = sel.value; persistState(); };
      g.appendChild(sel);
      row.appendChild(g);
    }

    if (hasOptions) target.appendChild(row);
  }

  // ==============================
  // Field Management
  // ==============================
  function rebuildFields() {
    fieldsContainer.innerHTML = '';
    state.fields.forEach((field, index) => {
      fieldsContainer.appendChild(renderFieldCard(field, index));
    });
  }

  function removeField(index) {
    state.fields.splice(index, 1);
    persistState();
    rebuildFields();
    renderSummary();
  }

  function moveField(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.fields.length) return;
    const temp = state.fields[index];
    state.fields[index] = state.fields[newIndex];
    state.fields[newIndex] = temp;
    persistState();
    rebuildFields();
  }

  // ==============================
  // Summary Section
  // ==============================
  const summarySection = api.createElement('div', { style: 'margin-bottom: 24px;' }, []);
  summarySection.appendChild(api.createElement('h3', {
    style: 'margin: 0 0 12px 0; font-size: 1rem;'
  }, ['Summary']));

  const summaryContent = api.createElement('div', {
    style: 'padding: 14px; border: 1px solid var(--color-border); border-radius: var(--border-radius); background: var(--color-bg-surface-alt); font-size: 0.8125rem; line-height: 1.6; font-family: monospace;'
  }, []);
  summarySection.appendChild(summaryContent);
  container.appendChild(summarySection);

  function renderSummary() {
    summaryContent.innerHTML = '';
    const name = state.typeName || '(unnamed)';
    const extendsName = typeDefs.find(t => t.id === state.extendsType)?.name || 'kernel:item';

    const lines = [
      'Type: ' + name + ' (extends ' + extendsName + ')',
      '',
      'Will create 3 items:',
      '  1. Type definition: ' + name,
      '  2. Readonly view: ' + name + '-view-readonly',
      '  3. Editable view: ' + name + '-view-editable',
    ];

    if (state.fields.length > 0) {
      lines.push('');
      lines.push('Fields (' + (state.fields.length + 1) + '):');
      lines.push('  name \u2014 heading (auto-included)');
      for (const f of state.fields) {
        const path = f.path || '(no path)';
        const fvResolved = f.fieldView === 'markdown' || f.fieldView === 'code'
          ? f.fieldView + '-readonly / ' + f.fieldView + '-editable'
          : f.fieldView;
        lines.push('  ' + path + ' \u2014 ' + fvResolved + ' (' + f.mode + ')');
      }
    } else {
      lines.push('');
      lines.push('No fields defined yet.');
    }

    for (const line of lines) {
      const div = api.createElement('div', {}, [line]);
      if (line.startsWith('  ')) div.style.paddingLeft = '12px';
      summaryContent.appendChild(div);
    }
  }

  // ==============================
  // Actions
  // ==============================
  const actionsSection = api.createElement('div', {
    style: 'display: flex; gap: 12px; flex-wrap: wrap;'
  }, []);

  const createBtn = api.createElement('button', { style: primaryBtnStyle }, ['Create Type']);
  createBtn.onclick = () => generateItems(false);
  actionsSection.appendChild(createBtn);

  const createAndInstanceBtn = api.createElement('button', { style: btnStyle }, ['Create Type + Instance']);
  createAndInstanceBtn.onclick = () => generateItems(true);
  actionsSection.appendChild(createAndInstanceBtn);

  container.appendChild(actionsSection);

  // Status message area
  const statusArea = api.createElement('div', { style: 'margin-top: 12px;' }, []);
  container.appendChild(statusArea);

  function showStatus(msg, isError) {
    statusArea.innerHTML = '';
    const el = api.createElement('div', {
      style: 'padding: 10px 14px; border-radius: var(--border-radius); ' +
        (isError
          ? 'background: rgba(239,68,68,0.1); color: var(--color-danger); border: 1px solid var(--color-danger);'
          : 'background: rgba(34,197,94,0.1); color: #22c55e; border: 1px solid #22c55e;')
    }, [msg]);
    statusArea.appendChild(el);
  }

  // ==============================
  // Validation
  // ==============================
  function validate() {
    const errors = [];
    if (!state.typeName.trim()) {
      errors.push('Type name is required.');
    } else if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(state.typeName)) {
      errors.push('Type name must be kebab-case (e.g. my-custom-type).');
    }
    if (state.fields.length === 0) {
      errors.push('At least one field is required.');
    }
    for (let i = 0; i < state.fields.length; i++) {
      if (!state.fields[i].path.trim()) {
        errors.push('Field ' + (i + 1) + ' is missing a path.');
      }
    }
    // Warn on name collision
    const existing = typeDefs.find(t => t.name === state.typeName);
    if (existing) {
      errors.push('Warning: A type named "' + state.typeName + '" already exists.');
    }
    return errors;
  }

  // ==============================
  // Generation
  // ==============================
  function resolveFieldViewForMode(fieldView, viewMode) {
    if (fieldView === 'markdown') return 'markdown-' + viewMode;
    if (fieldView === 'code') return 'code-' + viewMode;
    return fieldView;
  }

  function buildUiHints(viewMode) {
    const hints = {};

    // Always include name as an editable heading (first field)
    hints['name'] = { field_view: 'heading', mode: viewMode, level: 2 };

    for (const field of state.fields) {
      // Skip fields not relevant to this view mode
      if (field.mode !== 'both' && field.mode !== viewMode) continue;

      const hint = {
        field_view: resolveFieldViewForMode(field.fieldView, viewMode),
        mode: viewMode
      };

      if (field.label) hint.label = field.label;

      // Field-view-specific options
      const opts = field.options || {};
      if (field.fieldView === 'heading' && opts.level) hint.level = opts.level;
      if ((field.fieldView === 'text' || field.fieldView === 'textarea') && opts.placeholder) hint.placeholder = opts.placeholder;
      if (field.fieldView === 'textarea' && opts.rows) hint.rows = opts.rows;
      if (field.fieldView === 'markdown' && opts.sizing) hint.sizing = opts.sizing;
      if (field.fieldView === 'code' && opts.language) hint.language = opts.language;
      if (field.fieldView === 'number') {
        if (opts.min != null) hint.min = opts.min;
        if (opts.max != null) hint.max = opts.max;
        if (opts.step != null) hint.step = opts.step;
        if (opts.placeholder) hint.placeholder = opts.placeholder;
      }
      if (field.fieldView === 'timestamp' && opts.format) hint.format = opts.format;

      // Common options
      if (opts.dividerAfter) hint.dividerAfter = true;
      if (opts.collapsible) hint.collapsible = true;
      if (opts.startCollapsed) hint.startCollapsed = true;

      hints[field.path] = hint;
    }
    return hints;
  }

  async function generateItems(createInstance) {
    const errors = validate();
    const hardErrors = errors.filter(e => !e.startsWith('Warning:'));
    if (hardErrors.length > 0) {
      showStatus(hardErrors.join(' '), true);
      return;
    }

    const now = Date.now();
    const typeDefId = crypto.randomUUID();
    const readonlyViewId = crypto.randomUUID();
    const editableViewId = crypto.randomUUID();

    // 1. Type definition
    const typeDef = {
      id: typeDefId,
      name: state.typeName,
      type: TYPE_DEFINITION,
      extends: state.extendsType,
      preferredView: readonlyViewId,
      created: now,
      modified: now,
      content: { description: state.typeDescription || '' },
      attachments: []
    };

    // 2. Readonly view
    const readonlyView = {
      id: readonlyViewId,
      name: state.typeName + '-view-readonly',
      type: VIEW_TYPE,
      created: now,
      modified: now,
      content: {
        for_type: typeDefId,
        displayName: state.typeName + ' (readonly)',
        code: DELEGATE_CODE,
        ui_hints: buildUiHints('readonly')
      },
      attachments: []
    };

    // 3. Editable view
    const editableView = {
      id: editableViewId,
      name: state.typeName + '-view-editable',
      type: VIEW_TYPE,
      created: now,
      modified: now,
      content: {
        for_type: typeDefId,
        displayName: state.typeName + ' (editable)',
        code: DELEGATE_CODE,
        ui_hints: buildUiHints('editable')
      },
      attachments: []
    };

    try {
      await api.set(typeDef);
      await api.set(readonlyView);
      await api.set(editableView);

      let msg = 'Created: ' + state.typeName + ' type + readonly view + editable view.';

      if (createInstance) {
        const instance = {
          id: crypto.randomUUID(),
          name: 'New ' + state.typeName,
          type: typeDefId,
          created: Date.now(),
          modified: Date.now(),
          content: {},
          attachments: []
        };
        await api.set(instance);
        msg += ' Opened new instance.';
        const parentId = api.getParentId();
        if (parentId) {
          await api.attach(parentId, instance.id);
        } else {
          api.navigate(instance.id);
        }
      }

      showStatus(msg, false);
    } catch (e) {
      showStatus('Generation failed: ' + e.message, true);
    }
  }

  // ==============================
  // Initial Render
  // ==============================
  rebuildFields();
  renderSummary();

  return container;
}
