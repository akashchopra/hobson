// Item: field_view_script_code
// ID: 7d55ee6d-a36e-4e8d-bdc3-47966dcaa587
// Type: cccccccc-0000-0000-0000-000000000000


// Script code field view (readonly with run/copy buttons)
export async function render(value, options, api) {
  const { label, language = 'javascript' } = options;
  const code = value || '';

  const wrapper = api.createElement('div', { className: 'field-script-code' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
    wrapper.appendChild(labelEl);
  }

  // Load CSS and CodeMirror
  const cssLoader = await api.require('css-loader-lib');
  await cssLoader.loadCSS('codemirror-css', api);
  await api.require('codemirror');
  await api.require('codemirror-javascript');
  const CodeMirror = window.CodeMirror;

  // Editor container
  const editorContainer = api.createElement('div');
  editorContainer.style.cssText = 'border: 1px solid #d0d0d0; border-radius: 6px; overflow: hidden;';
  wrapper.appendChild(editorContainer);

  // Create CodeMirror instance in readonly mode
  const cm = CodeMirror(editorContainer, {
    value: code,
    mode: language,
    lineNumbers: true,
    lineWrapping: true,
    theme: 'default',
    readOnly: true,
    cursorBlinkRate: -1,
    viewportMargin: 2000
  });

  cm.setSize('100%', '300px');

  // Refresh after layout
  requestAnimationFrame(() => cm.refresh());

  // Action buttons
  const buttons = api.createElement('div');
  buttons.style.cssText = 'display: flex; gap: 10px;';

  // Run Script button
  const runBtn = api.createElement('button');
  runBtn.textContent = 'Run Script';
  runBtn.style.cssText = 'padding: 10px 20px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; font-weight: 500;';
  runBtn.onclick = async () => {
    runBtn.disabled = true;
    runBtn.textContent = 'Running...';

    try {
      // Get the REPL API which has the helper functions
      const replApi = api.createREPLContext();

      // Execute the script code with REPL API
      const asyncFn = new Function('api', `
        return (async () => {
          ${code}
        })();
      `);

      const result = await asyncFn(replApi);
      alert('Script executed!\n\nResult: ' + (
        result !== undefined
          ? JSON.stringify(result, null, 2)
          : 'No return value'
      ));
    } catch (error) {
      alert('Error executing script:\n\n' + error.message);
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = 'Run Script';
    }
  };
  buttons.appendChild(runBtn);

  // Copy Code button
  const copyBtn = api.createElement('button');
  copyBtn.textContent = 'Copy Code';
  copyBtn.style.cssText = 'padding: 10px 20px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px; background: white;';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(code);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy Code'; }, 1000);
  };
  buttons.appendChild(copyBtn);

  wrapper.appendChild(buttons);

  return wrapper;
}
