// Item: kernel-repl
// ID: 33333333-6666-0000-0000-000000000000
// Type: 33333333-0000-0000-0000-000000000000

// kernel-repl module
export class REPL {
  constructor(kernel) {
    this.kernel = kernel;
    this.history = [];
    this.historyIndex = 0;
    this.containerElement = null;
  }
  
  createContainer() {
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
    closeBtn.onclick = async () => await this.toggle();
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
    runBtn.onclick = () => this.run();
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

    // Add splitter drag functionality
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

    document.addEventListener("mousemove", (e) => {
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
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    });

    // Keyboard shortcuts
    input.addEventListener("keydown", (e) => {
      // Ctrl+Enter to run
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        this.run();
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
        if (this.historyIndex > 0) {
          this.historyIndex--;
          input.value = this.history[this.historyIndex];
          e.preventDefault();
          setTimeout(() => {
            input.selectionStart = input.selectionEnd = input.value.length;
          }, 0);
        }
      }
      
      if (e.key === "ArrowDown" && !e.shiftKey && !e.ctrlKey) {
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          input.value = this.history[this.historyIndex];
          e.preventDefault();
        } else if (this.historyIndex === this.history.length - 1) {
          this.historyIndex++;
          input.value = "";
          e.preventDefault();
        }
      }
    });
    
    this.containerElement = container;
    return container;
  }
  
  addTranscriptEntry(code, result, error) {
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
  
  async run() {
    const input = document.getElementById("repl-input");
    if (!input) return;
    
    const code = input.value.trim();
    if (!code) return;
    
    // Add to history
    if (this.history.length === 0 || this.history[this.history.length - 1] !== code) {
      this.history.push(code);
      if (this.history.length > 50) {
        this.history.shift();
      }
    }
    this.historyIndex = this.history.length;
    
    const api = this.kernel.createREPLAPI();
    
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
      
      this.addTranscriptEntry(code, resultStr, null);
      input.value = "";
      
    } catch (error) {
      const errorStr = `Error: ${error.message}\n${error.stack}`;
      this.addTranscriptEntry(code, null, errorStr);
    }
  }
  
  async toggle() {
    const repl = document.getElementById("repl-container");
    const mainView = document.getElementById("main-view");
    if (!repl || !mainView) return;
    
    const isVisible = repl.classList.contains("visible");
    if (isVisible) {
      // Hide REPL, show main view
      repl.classList.remove("visible");
      mainView.classList.remove("repl-active");
    } else {
      // Show REPL, hide main view
      repl.classList.add("visible");
      mainView.classList.add("repl-active");
      
      // Focus the input
      const input = document.getElementById("repl-input");
      if (input) input.focus();
    }
  }
}
