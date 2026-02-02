// Item: kernel-styles
// ID: 33333333-8888-0000-0000-000000000000
// Type: 33333333-0000-0000-0000-000000000000

/* Minimal styling - intentionally basic, to be replaced from within */
* {
  box-sizing: border-box;
}

html, body {
  height: 100%;
  margin: 0;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #f5f5f5;
  color: #333;
  display: flex;
  flex-direction: column;
}

#app {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

#main-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  padding: 2px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  min-height: 0;
  overflow: auto;
}

.render-error {
  background: #fff0f0;
  border: 1px solid #ffcccc;
  padding: 15px;
  border-radius: 4px;
}

.render-error h3 {
  color: #cc0000;
  margin-top: 0;
}

.render-error pre {
  background: #fff8f8;
  padding: 10px;
  overflow-x: auto;
  font-size: 12px;
}

.json-view {
  background: #f8f8f8;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 12px;
}

/* Selection indicator */
[data-item-id] {
  cursor: pointer;
}

[data-item-id].item-selected {
  outline: 2px outset #999999;
  outline-offset: 0px;
}

[data-item-id]:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}

/* Safe Mode Styles */
#safe-mode {
  max-width: 800px;
  margin: 0 auto;
}

#safe-mode h1 {
  color: #cc6600;
}

#safe-mode .actions {
  display: flex;
  gap: 10px;
  margin: 20px 0;
  flex-wrap: wrap;
}

#safe-mode button {
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
}

#safe-mode button:hover {
  background: #f0f0f0;
}

.item-list {
  margin-top: 20px;
}

.item-preview {
  padding: 10px;
  border: 1px solid #ddd;
  margin-bottom: 8px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
}

.item-preview .item-info {
  flex: 1;
}

.item-preview .item-name {
  font-weight: bold;
}

.item-preview .item-type {
  font-size: 12px;
  color: #666;
}

/* Raw Editor Styles */
.raw-editor {
  max-width: 1000px;
  margin: 0 auto;
}

.raw-editor textarea {
  width: 100%;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 13px;
  padding: 15px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.raw-editor .actions {
  margin-top: 10px;
  display: flex;
  gap: 10px;
}

/* Navigation */
.nav-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.nav-bar button {
  padding: 8px 16px;
  cursor: pointer;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
}

.nav-bar button:hover {
  background: #f0f0f0;
}

/* REPL Bottom Panel */
#repl-panel {
  display: flex;
  flex-direction: column;
  background: white;
  border-top: 1px solid #ccc;
  min-height: 36px;
}

#repl-panel.collapsed {
  flex: 0 0 36px;
}

#repl-panel.expanded {
  flex: 0 0 300px;
}

/* Collapse bar - always visible */
.repl-collapse-bar {
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: #f5f5f5;
  cursor: pointer;
  flex-shrink: 0;
  border-bottom: 1px solid #eee;
  gap: 12px;
}

.repl-collapse-bar:hover {
  background: #eee;
}

.repl-collapse-bar .repl-title {
  font-weight: 600;
  font-size: 13px;
  color: #333;
}

.repl-collapse-bar .repl-hint {
  font-size: 12px;
  color: #999;
}

.repl-collapse-bar .repl-expand-icon {
  margin-left: auto;
  font-size: 12px;
  color: #666;
}

/* Panel content - horizontal layout */
#repl-panel.collapsed .repl-panel-content {
  display: none;
}

.repl-panel-content {
  display: flex;
  flex-direction: row;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Input section (left) */
.repl-input-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 200px;
  border-right: 1px solid #eee;
}

.repl-input-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

#repl-input {
  width: 100%;
  height: 100%;
  min-height: 80px;
  font-family: 'SF Mono', Monaco, Menlo, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: none;
  tab-size: 2;
  -moz-tab-size: 2;
  box-sizing: border-box;
}

.repl-actions {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  align-items: center;
  background: white;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}

.repl-actions button {
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
}

.repl-actions button:hover {
  background: #f0f0f0;
}

.repl-actions button.primary {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.repl-actions button.primary:hover {
  background: #0056b3;
}

/* Vertical splitter between input and output */
.repl-vertical-splitter {
  width: 6px;
  background: #e0e0e0;
  cursor: col-resize;
  flex-shrink: 0;
}

.repl-vertical-splitter:hover {
  background: #d0d0d0;
}

/* Output section (right) */
.repl-output-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 200px;
  overflow: hidden;
}

.repl-transcript-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.repl-transcript-header h4 {
  margin: 0;
  font-size: 13px;
  color: #666;
}

.repl-transcript-header button {
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
}

.repl-transcript-header button:hover {
  background: #f0f0f0;
}

#repl-transcript-entries {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.repl-entry {
  margin-bottom: 12px;
  padding: 10px;
  background: #f8f8f8;
  border-radius: 4px;
  border-left: 3px solid #ccc;
}

.repl-entry.error {
  background: #fff5f5;
  border-left-color: #cc0000;
}

.repl-entry.success {
  border-left-color: #00aa00;
}

.repl-entry-code {
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 12px;
  color: #333;
  margin-bottom: 8px;
  white-space: pre-wrap;
}

.repl-entry-output {
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 12px;
  color: #666;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.repl-entry-error {
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 12px;
  color: #cc0000;
  white-space: pre-wrap;
}

/* Panel height resize handle */
#repl-panel-splitter {
  height: 6px;
  background: #e0e0e0;
  cursor: row-resize;
  flex-shrink: 0;
}

#repl-panel-splitter:hover {
  background: #d0d0d0;
}

#repl-panel.collapsed ~ #repl-panel-splitter {
  display: none;
}

/* Element Inspector */
.hobson-inspect-mode { cursor: crosshair !important; }
.hobson-inspect-mode * { cursor: crosshair !important; }
.hobson-inspect-highlight { outline: 2px solid #2196f3 !important; outline-offset: 1px; }
