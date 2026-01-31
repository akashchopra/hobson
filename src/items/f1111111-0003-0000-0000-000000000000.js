// Item: repl-ui
// ID: f1111111-0003-0000-0000-000000000000
// Type: 66666666-0000-0000-0000-000000000000

// REPL UI Library
// Provides the REPL interface, moved from kernel to userland

let api = null;
let containerElement = null;
let history = [];
let historyIndex = 0;
let _documentMouseMoveHandler = null;
let _documentMouseUpHandler = null;

export async function onSystemBootComplete({ safeMode }, _api) {
  if (safeMode) return;  // No REPL in safe mode

  api = _api;

  // Create and attach REPL container
  containerElement = createContainer();
  document.getElementById('app').appendChild(containerElement);

  // Register keyboard handler for toggle (only if not already registered)
  if (!window._replKeyboardHandler) {
    window._replKeyboardHandler = async (e) => {
      if (e.key === 'Escape') {
        await toggle();
      } else if (e.ctrlKey && e.key === '\\') {
        await toggle();
      }
    };
    document.addEventListener('keydown', window._replKeyboardHandler);
  }
}

function createContainer() {
  const container = document.createElement("div");
  container.id = "repl-container";

  // Header with controls
  const header = document.createElement("div");
  header.className = "repl-header";

  const heading = document.createElement("h3");
  heading.textContent = "REPL";
  header.appendChild(heading);

  const statusMsg = document.createElement("div");
  statusMsg.id = "repl-status-message";
  statusMsg.style.cssText = "flex: 1; margin: 0 15px; font-size: 12px; color: #f80; display: none;";
  header.appendChild(statusMsg);

  const controls = document.createElement("div");
  controls.className = "repl-controls";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.onclick = async () => await toggle();
  controls.appendChild(closeBtn);

  header.appendChild(controls);
  container.appendChild(header);

  // Input panel (top half)
  const inputPanel = document.createElement("div");
  inputPanel.className = "repl-input-panel";

  const inputScroll = document.createElement("div");
  inputScroll.className = "repl-input-scroll";

  // Input area
  const input = document.createElement("textarea");
  input.id = "repl-input";
  input.placeholder = "Enter JavaScript... (api object is available)\nUse 'return' to see expression values\n\nCtrl+Enter to run | Escape to close | Up/Down for history";
  input.spellcheck = false;
  inputScroll.appendChild(input);
  inputPanel.appendChild(inputScroll);

  // Action buttons
  const actions = document.createElement("div");
  actions.className = "repl-actions";

  const runBtn = document.createElement("button");
  runBtn.textContent = "Run";
  runBtn.className = "primary";
  runBtn.onclick = () => run();
  actions.appendChild(runBtn);

  const clearInputBtn = document.createElement("button");
  clearInputBtn.textContent = "Clear";
  clearInputBtn.onclick = () => { input.value = ""; };
  actions.appendChild(clearInputBtn);

  const hint = document.createElement("span");
  hint.className = "repl-hint";
  hint.textContent = "Ctrl+Enter to run | Up/Down for history";
  actions.appendChild(hint);

  inputPanel.appendChild(actions);
  container.appendChild(inputPanel);

  // Splitter
  const splitter = document.createElement("div");
  splitter.className = "repl-splitter";
  container.appendChild(splitter);

  // Transcript panel (bottom half)
  const transcriptPanel = document.createElement("div");
  transcriptPanel.className = "repl-transcript-panel";

  const transcript = document.createElement("div");
  transcript.id = "repl-transcript";

  const transcriptHeader = document.createElement("div");
  transcriptHeader.className = "repl-transcript-header";

  const transcriptHeading = document.createElement("h4");
  transcriptHeading.textContent = "Transcript";
  transcriptHeader.appendChild(transcriptHeading);

  const clearTranscriptBtn = document.createElement("button");
  clearTranscriptBtn.textContent = "Clear Transcript";
  clearTranscriptBtn.onclick = () => {
    document.getElementById("repl-transcript-entries").innerHTML = "";
  };
  transcriptHeader.appendChild(clearTranscriptBtn);

  transcript.appendChild(transcriptHeader);

  const transcriptEntries = document.createElement("div");
  transcriptEntries.id = "repl-transcript-entries";
  transcript.appendChild(transcriptEntries);

  transcriptPanel.appendChild(transcript);
  container.appendChild(transcriptPanel);

  // Setup splitter drag functionality
  setupSplitterListeners(container);

  // Keyboard shortcuts for input
  input.addEventListener("keydown", (e) => {
    // Ctrl+Enter to run
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      run();
    }

    // Tab for indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.substring(0, start) + "  " + input.value.substring(end);
      input.selectionStart = input.selectionEnd = start + 2;
    }

    // Up/Down for history
    if (e.key === "ArrowUp" && !e.shiftKey && !e.ctrlKey) {
      if (historyIndex > 0) {
        historyIndex--;
        input.value = history[historyIndex];
        e.preventDefault();
        setTimeout(() => {
          input.selectionStart = input.selectionEnd = input.value.length;
        }, 0);
      }
    }

    if (e.key === "ArrowDown" && !e.shiftKey && !e.ctrlKey) {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        input.value = history[historyIndex];
        e.preventDefault();
      } else if (historyIndex === history.length - 1) {
        historyIndex++;
        input.value = "";
        e.preventDefault();
      }
    }
  });

  return container;
}

function setupSplitterListeners(container) {
  const inputPanel = container.querySelector('.repl-input-panel');
  const transcriptPanel = container.querySelector('.repl-transcript-panel');
  const header = container.querySelector('.repl-header');
  const splitter = container.querySelector('.repl-splitter');

  if (!inputPanel || !transcriptPanel || !header || !splitter) return;

  let isDragging = false;
  let startY = 0;
  let startInputHeight = 0;

  splitter.addEventListener("mousedown", (e) => {
    isDragging = true;
    startY = e.clientY;
    startInputHeight = inputPanel.offsetHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  _documentMouseMoveHandler = (e) => {
    if (!isDragging) return;

    const delta = e.clientY - startY;
    const newInputHeight = startInputHeight + delta;
    const containerHeight = container.offsetHeight;
    const headerHeight = header.offsetHeight;
    const splitterHeight = 6;

    const minHeight = 100;
    const maxHeight = containerHeight - headerHeight - splitterHeight - 100;

    if (newInputHeight >= minHeight && newInputHeight <= maxHeight) {
      inputPanel.style.flex = "none";
      inputPanel.style.height = newInputHeight + "px";
      transcriptPanel.style.flex = "1";
    }
  };

  _documentMouseUpHandler = () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  };

  document.addEventListener("mousemove", _documentMouseMoveHandler);
  document.addEventListener("mouseup", _documentMouseUpHandler);
}

function cleanupDocumentListeners() {
  if (_documentMouseMoveHandler) {
    document.removeEventListener("mousemove", _documentMouseMoveHandler);
    _documentMouseMoveHandler = null;
  }
  if (_documentMouseUpHandler) {
    document.removeEventListener("mouseup", _documentMouseUpHandler);
    _documentMouseUpHandler = null;
  }
}

function addTranscriptEntry(code, result, error) {
  const container = document.getElementById("repl-transcript-entries");
  if (!container) return;

  const entry = document.createElement("div");
  entry.className = "repl-entry" + (error ? " error" : " success");

  const codeDiv = document.createElement("div");
  codeDiv.className = "repl-entry-code";
  codeDiv.textContent = "> " + code;
  entry.appendChild(codeDiv);

  const outputDiv = document.createElement("div");
  outputDiv.className = error ? "repl-entry-error" : "repl-entry-output";
  outputDiv.textContent = error || result;
  entry.appendChild(outputDiv);

  container.appendChild(entry);

  // Scroll to bottom
  entry.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export async function run() {
  const input = document.getElementById("repl-input");
  if (!input || !api) return;

  const code = input.value.trim();
  if (!code) return;

  // Add to history
  if (history.length === 0 || history[history.length - 1] !== code) {
    history.push(code);
    if (history.length > 50) {
      history.shift();
    }
  }
  historyIndex = history.length;

  try {
    // Wrap in async function to allow await
    const asyncFn = new Function("api", `
      return (async () => {
        ${code}
      })();
    `);

    const result = await asyncFn(api);

    let resultStr;
    if (result === undefined) {
      resultStr = "// Executed successfully (no return value)";
    } else if (typeof result === 'string' && result.includes('\n')) {
      resultStr = result;
    } else {
      resultStr = JSON.stringify(result, null, 2);
    }

    addTranscriptEntry(code, resultStr, null);
    input.value = "";

  } catch (error) {
    const errorStr = `Error: ${error.message}\n${error.stack}`;
    addTranscriptEntry(code, null, errorStr);
  }
}

export async function toggle() {
  const repl = document.getElementById("repl-container");
  const mainView = document.getElementById("main-view");
  if (!repl || !mainView) return;

  const isVisible = repl.classList.contains("visible");
  if (isVisible) {
    // Hide REPL, show main view
    repl.classList.remove("visible");
    mainView.classList.remove("repl-active");
    // Clean up document-level listeners when hiding
    cleanupDocumentListeners();
  } else {
    // Show REPL, hide main view
    repl.classList.add("visible");
    mainView.classList.add("repl-active");

    // Re-add document listeners if they were cleaned up
    if (!_documentMouseMoveHandler && containerElement) {
      setupSplitterListeners(containerElement);
    }

    // Focus the input
    const input = document.getElementById("repl-input");
    if (input) input.focus();
  }
}

// Export for external use
export function isVisible() {
  const repl = document.getElementById("repl-container");
  return repl?.classList.contains("visible") || false;
}
