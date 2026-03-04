/* hob-structural-css — Syntax coloring, selection, and status bar styles for the Hob structural editor */

/* Container */
.hob-editor {
  font-family: "SF Mono", Monaco, "Courier New", monospace;
  font-size: 0.8125rem;
  line-height: 1.5;
  padding: 12px;
  white-space: pre;
  overflow: auto;
  outline: none;
  cursor: default;
  flex: 1;
  min-height: 0;
}

.hob-editor:focus {
  outline: none;
}

/* Syntax coloring */
.hob-symbol { color: var(--color-text); }
.hob-special { color: oklch(50% 0.2 300); font-weight: 600; }
.hob-keyword { color: oklch(50% 0.15 195); }
.hob-string { color: oklch(50% 0.15 145); }
.hob-number { color: oklch(50% 0.15 260); }
.hob-boolean { color: oklch(50% 0.15 195); font-style: italic; }
.hob-nil { color: oklch(50% 0.15 195); font-style: italic; }
.hob-delim { color: var(--color-text-tertiary); padding: 0 1px; }
.hob-comment { color: var(--color-text-tertiary); font-style: italic; }

/* Item references */
.hob-item-ref {
  background: var(--color-primary-light, oklch(95% 0.03 250));
  color: var(--color-primary, #0066cc);
  padding: 1px 6px;
  border-radius: 3px;
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
}

.hob-item-ref:hover {
  background: var(--color-primary, #0066cc);
  color: white;
}

/* Selection */
.hob-selected {
  background: oklch(90% 0.05 250);
  outline: 1px solid oklch(70% 0.1 250);
  border-radius: 2px;
}

.hob-ancestor {
  border-radius: 2px;
}

/* Status bar */
.hob-status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 12px;
  font-size: 0.75rem;
  border-top: 1px solid var(--color-border-light, #e0e0e0);
  color: var(--color-text-secondary, #666);
  background: var(--color-bg-surface-alt, #f8f8f8);
  gap: 12px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  flex-shrink: 0;
}

.hob-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.hob-breadcrumbs span {
  cursor: pointer;
}

.hob-breadcrumbs span:hover {
  color: var(--color-primary, #0066cc);
}

.hob-breadcrumb-sep {
  color: var(--color-text-tertiary, #999);
  cursor: default !important;
}

.hob-breadcrumb-sep:hover {
  color: var(--color-text-tertiary, #999) !important;
}

.hob-node-info {
  white-space: nowrap;
  color: var(--color-text-tertiary, #999);
}

.hob-mode {
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

/* Autocomplete dropdown */
.hob-autocomplete {
  background: var(--color-bg-surface, #fff);
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  max-height: 240px;
  overflow-y: auto;
  z-index: 10000;
  font-family: "SF Mono", Monaco, "Courier New", monospace;
  font-size: 0.8125rem;
  min-width: 180px;
  max-width: 320px;
}

.hob-ac-item {
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.hob-ac-item:hover { background: oklch(95% 0.02 250); }
.hob-ac-selected { background: oklch(90% 0.05 250); }

.hob-ac-detail {
  color: var(--color-text-tertiary, #999);
  font-size: 0.75rem;
  flex-shrink: 0;
}

.hob-ac-empty {
  padding: 8px;
  color: var(--color-text-tertiary, #999);
  font-style: italic;
  text-align: center;
}

/* Blinking cursor */
.hob-cursor {
  display: inline-block;
  width: 0;
  border-left: 2px solid var(--color-text, #333);
  margin: 0 -1px;
  animation: hob-blink 1s step-end infinite;
}

@keyframes hob-blink {
  50% { opacity: 0; }
}

.hob-hole-active.hob-selected {
  padding: 0 2px;
}

/* Insert-between hover (editable mode only) */
.hob-editable [data-insert-after]:hover {
  background: oklch(85% 0.08 250);
  border-radius: 1px;
  cursor: text;
}

/* Empty state */
.hob-empty {
  color: var(--color-text-tertiary, #999);
  font-style: italic;
  padding: 24px;
  text-align: center;
}

/* Indentation guides — faint vertical line at each 2-space level (from level 2 onward) */
.hob-guide {
  box-shadow: inset 1px 0 0 0 oklch(88% 0.01 250);
}

/* Binding pairs in let vectors */
.hob-binding-pair { display: inline; }

/* Side-effect bindings (_ name) — faint amber tint */
.hob-binding-effect {
  background: oklch(97% 0.02 60);
  border-radius: 2px;
}

/* Fold toggle triangle */
.hob-fold-toggle {
  color: var(--color-text-tertiary, #999);
  cursor: pointer;
  user-select: none;
  font-size: 0.6rem;
  padding-right: 2px;
  vertical-align: middle;
}
.hob-fold-toggle:hover {
  color: var(--color-text, #333);
}

/* Collapsed list summary */
.hob-collapsed-summary {
  color: var(--color-text-secondary, #666);
  font-style: italic;
}
