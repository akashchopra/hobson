/* === THEME CONFIGURATION === */
/* Change these two values to theme the entire UI */
:root {
  --base-hue: {{content.hue}};        /* 0-360: Blue=220, Green=145, Purple=280, Orange=30, Teal=180, Red=0 */
  --tint-strength: {{content.tintStrength}};  /* 0=pure gray, 0.02=subtle tint, 0.05=noticeable, 0.1=strong */

  /* === DERIVED COLORS (auto-generated from base-hue) === */
  
  /* Primary accent */
  --color-primary: oklch(55% 0.2 var(--base-hue));
  --color-primary-hover: oklch(45% 0.22 var(--base-hue));
  --color-primary-light: oklch(92% 0.05 var(--base-hue));
  
  /* Backgrounds */
  --color-bg-body: oklch(96% var(--tint-strength) var(--base-hue));
  --color-bg-surface: oklch(100% 0 0);  /* white */
  --color-bg-surface-alt: oklch(97% var(--tint-strength) var(--base-hue));
  --color-bg-hover: oklch(94% var(--tint-strength) var(--base-hue));
  
  /* Borders */
  --color-border: oklch(80% var(--tint-strength) var(--base-hue));
  --color-border-light: oklch(88% var(--tint-strength) var(--base-hue));
  --color-border-dark: oklch(65% var(--tint-strength) var(--base-hue));
  
  /* Text */
  --color-text: oklch(25% var(--tint-strength) var(--base-hue));
  --color-text-secondary: oklch(45% var(--tint-strength) var(--base-hue));
  --color-text-tertiary: oklch(60% var(--tint-strength) var(--base-hue));
  
  /* Semantic colors (fixed hues for meaning) */
  --color-success: oklch(55% 0.18 145);
  --color-success-light: oklch(92% 0.05 145);
  --color-warning: oklch(75% 0.15 85);
  --color-warning-light: oklch(94% 0.08 85);
  --color-danger: oklch(55% 0.2 25);
  --color-danger-light: oklch(92% 0.06 25);
  
  /* Selection */
  --color-selection: oklch(65% 0.12 var(--base-hue));
  
  /* UI tokens */
  --border-radius: 4px;
  --border-radius-lg: 8px;
  --shadow-sm: 0 2px 4px oklch(0% 0 0 / 0.1);
  --shadow-md: 0 4px 12px oklch(0% 0 0 / 0.15);
}

/* === BASE STYLES === */
* {
  box-sizing: border-box;
}

html, body {
  height: 100%;
  margin: 0;
}

body {
  font-size: {{content.baseFontSize}}px;
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--color-bg-body);
  color: var(--color-text);
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
  background: var(--color-bg-surface);
  border-radius: var(--border-radius-lg);
  padding: 2px;
  box-shadow: var(--shadow-sm);
  min-height: 0;
  overflow: auto;
}

.render-error {
  background: var(--color-danger-light);
  border: 1px solid var(--color-danger);
  padding: 15px;
  border-radius: var(--border-radius);
}

.render-error h3 {
  color: var(--color-danger);
  margin-top: 0;
}

.render-error pre {
  background: var(--color-bg-surface);
  padding: 10px;
  overflow-x: auto;
  font-size: 12px;
}

.json-view {
  background: var(--color-bg-surface-alt);
  padding: 10px;
  border-radius: var(--border-radius);
  overflow-x: auto;
  font-size: 12px;
}

/* Selection indicator */
[data-item-id] {
  cursor: pointer;
}

[data-item-id].item-selected {
  outline: 2px outset var(--color-selection);
  outline-offset: 0px;
}

[data-item-id]:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Safe Mode Styles */
#safe-mode {
  max-width: 800px;
  margin: 0 auto;
}

#safe-mode h1 {
  color: var(--color-warning);
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
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  border-radius: var(--border-radius);
}

#safe-mode button:hover {
  background: var(--color-bg-hover);
}

.item-list {
  margin-top: 20px;
}

.item-preview {
  padding: 10px;
  border: 1px solid var(--color-border-light);
  margin-bottom: 8px;
  border-radius: var(--border-radius);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg-surface);
}

.item-preview .item-info {
  flex: 1;
}

.item-preview .item-name {
  font-weight: bold;
}

.item-preview .item-type {
  font-size: 12px;
  color: var(--color-text-secondary);
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
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
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
  border-bottom: 1px solid var(--color-border-light);
}

.nav-bar button {
  padding: 8px 16px;
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  border-radius: var(--border-radius);
}

.nav-bar button:hover {
  background: var(--color-bg-hover);
}

/* REPL Bottom Panel */
#repl-panel {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
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
  background: var(--color-bg-body);
  cursor: pointer;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-light);
  gap: 12px;
}

.repl-collapse-bar:hover {
  background: var(--color-bg-hover);
}

.repl-collapse-bar .repl-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text);
}

.repl-collapse-bar .repl-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.repl-collapse-bar .repl-expand-icon {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-secondary);
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
  border-right: 1px solid var(--color-border-light);
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
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
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
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.repl-actions button {
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  border-radius: var(--border-radius);
}

.repl-actions button:hover {
  background: var(--color-bg-hover);
}

.repl-actions button.primary {
  background: var(--color-primary);
  color: var(--color-bg-surface);
  border-color: var(--color-primary);
}

.repl-actions button.primary:hover {
  background: var(--color-primary-hover);
}

/* Vertical splitter between input and output */
.repl-vertical-splitter {
  width: 6px;
  background: var(--color-border);
  cursor: col-resize;
  flex-shrink: 0;
}

.repl-vertical-splitter:hover {
  background: var(--color-border-dark);
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
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.repl-transcript-header h4 {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.repl-transcript-header button {
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  border-radius: var(--border-radius);
}

.repl-transcript-header button:hover {
  background: var(--color-bg-hover);
}

#repl-transcript-entries {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.repl-entry {
  margin-bottom: 12px;
  padding: 10px;
  background: var(--color-bg-surface-alt);
  border-radius: var(--border-radius);
  border-left: 3px solid var(--color-border);
}

.repl-entry.error {
  background: var(--color-danger-light);
  border-left-color: var(--color-danger);
}

.repl-entry.success {
  border-left-color: var(--color-success);
}

.repl-entry-code {
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 12px;
  color: var(--color-text);
  margin-bottom: 8px;
  white-space: pre-wrap;
}

.repl-entry-console {
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  margin-bottom: 4px;
  padding: 4px 0;
  border-bottom: 1px solid var(--color-border);
  opacity: 0.8;
}

.repl-entry-output {
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.repl-entry-error {
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  font-size: 12px;
  color: var(--color-danger);
  white-space: pre-wrap;
}

/* Panel height resize handle */
#repl-panel-splitter {
  height: 6px;
  background: var(--color-border);
  cursor: row-resize;
  flex-shrink: 0;
}

#repl-panel-splitter:hover {
  background: var(--color-border-dark);
}

#repl-panel.collapsed ~ #repl-panel-splitter {
  display: none;
}

/* Element Inspector */
.hobson-inspect-mode { cursor: crosshair !important; }
.hobson-inspect-mode * { cursor: crosshair !important; }
.hobson-inspect-highlight { outline: 2px solid var(--color-primary) !important; outline-offset: 1px; }