# Code Review Action Plan

*Generated: 2026-01-29*

This document outlines all issues found during the comprehensive code review, ordered by priority.

---

## Priority 1: Critical (Must Fix)

### 1.1 kernel-safe-mode: XSS Vulnerability
**File:** `33333333-7777-0000-0000-000000000000.json`
**Location:** `_renderItemList()` method
**Issue:** Item names are inserted into innerHTML without escaping.

```javascript
// VULNERABLE CODE (line ~55):
preview.innerHTML = `
  <div class="item-info">
    <div class="item-name">${this._escapeHtml(item.name || item.id)}</div>
    ...
  </div>
`;
```

The `_escapeHtml` method exists but the actual code in `_renderItemList` doesn't use it consistently. The template literal directly interpolates values into innerHTML.

**Impact:** An attacker who can create an item with a malicious name could execute arbitrary JavaScript when Safe Mode displays the item list.

**Fix:** Ensure all dynamic values are escaped before insertion into innerHTML, or preferably use DOM APIs (`createElement`, `textContent`) instead of innerHTML.

---

### 1.2 kernel-safe-mode: Undefined Name Sort Crash
**File:** `33333333-7777-0000-0000-000000000000.json`
**Location:** `_renderItemList()` method
**Issue:** Sort crashes when item.name is undefined.

```javascript
// PROBLEMATIC CODE:
items.sort((a,b) => a.name.localeCompare(b.name));
```

**Impact:** If any item lacks a `name` property, Safe Mode item listing crashes with "Cannot read property 'localeCompare' of undefined".

**Fix:**
```javascript
items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
```

---

## Priority 2: High (Should Fix)

### 2.1 kernel-rendering: Inefficient View Resolution Queries
**File:** `33333333-5555-0000-0000-000000000000.json`
**Location:** `findView()` and `getViews()` methods
**Issue:** Queries all views/view-specs for each type in the chain.

```javascript
// Inefficient - queries ALL views for each iteration:
while (currentType && !visited.has(currentType)) {
  const views = await this.kernel.storage.query({ type: IDS.VIEW });
  const view = views.find(v => v.content?.for_type === currentType);
  // ...
}
```

**Impact:** For deep type chains (e.g., 5 levels), this performs 10+ storage queries per render operation.

**Fix:** Query once and filter locally:
```javascript
async findView(typeId) {
  const allViews = await this.kernel.storage.query({ type: IDS.VIEW });
  const allViewSpecs = await this.kernel.storage.query({ type: IDS.VIEW_SPEC });

  let currentType = typeId;
  while (currentType && !visited.has(currentType)) {
    const view = allViews.find(v => v.content?.for_type === currentType)
               || allViewSpecs.find(v => v.content?.for_type === currentType);
    if (view) return view;
    // ... continue up chain
  }
}
```

---

### 2.2 kernel-repl: Memory Leak - Document Event Listeners
**File:** `33333333-6666-0000-0000-000000000000.json`
**Location:** `createContainer()` method
**Issue:** Document-level event listeners for splitter drag are never removed.

```javascript
// These listeners persist even after REPL container is removed:
document.addEventListener("mousemove", (e) => { ... });
document.addEventListener("mouseup", () => { ... });
```

**Impact:** Memory leak grows if REPL is repeatedly opened/closed. Event listeners accumulate.

**Fix:** Store references and remove on container destruction:
```javascript
this._mousemoveHandler = (e) => { ... };
this._mouseupHandler = () => { ... };
document.addEventListener("mousemove", this._mousemoveHandler);
document.addEventListener("mouseup", this._mouseupHandler);

// In a destroy method:
document.removeEventListener("mousemove", this._mousemoveHandler);
document.removeEventListener("mouseup", this._mouseupHandler);
```

---

### 2.3 field-editor-itemref: Modal Not Keyboard Accessible
**File:** `bccf2a2b-c750-417e-9d86-b96699cc5078.json`
**Location:** `openModal()` function
**Issue:** No Escape key handling to close the modal.

**Impact:** Users must click to close the modal; keyboard-only users are stuck.

**Fix:** Add keydown listener for Escape:
```javascript
overlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.body.removeChild(overlay);
  }
});
```

---

## Priority 3: Medium (Maintenance)

### 3.1 container_view: File Too Large
**File:** `ef793c27-2d4b-4c99-b05a-2769db5bc5a9.json`
**Issue:** ~1000+ lines of code in a single item.

**Impact:** Difficult to maintain, test, and understand. High cognitive load.

**Recommendation:** Extract into multiple focused libraries:
- `container-window-manager` - Window positioning, z-order, minimize/maximize
- `container-banner-view` - Banner display and editing
- `container-context-menu` - Context menu building
- `container-drag-drop` - Drag and drop handling

---

### 3.2 Duplicate Modal Patterns
**Files:** Multiple items use similar modal overlay patterns:
- `type-picker-lib` (`a1b2c3d4-type-pick-0000-000000000000.json`)
- `field-editor-itemref` (`bccf2a2b-c750-417e-9d86-b96699cc5078.json`)
- `tag-picker-ui` (`e05faa99-120f-4ca9-b1f2-8cb3b5bf718e.json`)
- kernel-core (various modals)

**Issue:** Each implements its own modal overlay styling and behavior.

**Recommendation:** Create a shared `modal-lib` library:
```javascript
export function showModal(content, options = {}) {
  // Standardized modal creation
  // Handles: backdrop, centering, Escape key, focus trap
  return { close: () => {...} };
}
```

---

### 3.3 Inconsistent Element Creation
**Files:** Some items use `api.createElement()`, others use `document.createElement()`.

**Examples:**
- `field-editor-number`: Uses `document.createElement()`
- `field_view_number`: Uses `api.createElement()`

**Issue:** Inconsistent API usage makes code harder to understand.

**Recommendation:** Standardize on `api.createElement()` for all view code. It provides consistent interface and could be enhanced later (e.g., for SSR, testing).

---

### 3.4 hobson-markdown: Long Inline Code
**File:** `a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6.json`
**Issue:** ~300 lines of complex parsing logic in a single function.

**Recommendation:** Extract helpers into separate library items:
- `markdown-transclusion-handler`
- `markdown-query-executor`
- `markdown-link-processor`

---

## Priority 4: Notes (Nice to Have)

### 4.1 Error Handling Compliance
**Status:** Mostly compliant with Error_Handling_System.md

**Observations:**
- kernel-module-system: Correctly calls `captureError()` on evaluation failures ✓
- kernel-rendering: Correctly calls `captureError()` on render failures ✓
- default-error-handler: Correctly implements watch system ✓
- error_view: Provides clickable stack traces ✓

**Minor Gap:** Some field editors silently swallow errors (e.g., `field_view_tags` catches errors when loading tags but only logs to console).

---

### 4.2 Third-Party Libraries
**Files:** Several third-party libraries are included as items:
- `codemirror` (ad3bddac-95ce-41ae-aa11-6f6e6f537bc6.json) - 85k+ tokens
- `codemirror-javascript` (84fd20bb-0415-4061-ac27-af99a5b85290.json)
- `markdown-it` (08d5ecd2-01a1-43f1-ad50-314027db231a.json) - 72k+ tokens
- `codemirror-markdown` (cf994900-3472-41ea-8b01-a51f5897744c.json)

**Observation:** These are minified third-party code, not candidates for review or modification. They're correctly stored with `source_url` and `imported_at` metadata.

---

### 4.3 Unused Code
**File:** generic-editor (`ffd688d1-93a8-4c4b-b09a-127b249294f5.json`)
**Observation:** Contains `collectAllFields()` helper for "unhinted fields" but the feature appears incomplete. The separator and "Other Fields" section is rendered but may not work correctly for deeply nested content.

---

## Implementation Order

1. **Immediate (Security):**
   - Fix 1.1 (XSS in safe-mode)
   - Fix 1.2 (Sort crash in safe-mode)

2. **Next Sprint:**
   - Fix 2.1 (View resolution performance)
   - Fix 2.2 (REPL memory leak)
   - Fix 2.3 (Modal keyboard accessibility)

3. **Ongoing Maintenance:**
   - Address 3.1-3.4 during related feature work
   - Create shared libraries when touching modal code

4. **Backlog:**
   - Address 4.x items as time permits

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Critical Issues | 2 |
| High Priority | 3 |
| Medium Priority | 4 |
| Notes | 4 |
| **Total** | **13** |

| Item Category | Items Reviewed |
|---------------|----------------|
| Kernel Modules | 8 |
| Views | 12 |
| Libraries | 15 |
| Field Views | 12 |
| Field Editors | 6 |
| Third-Party | 4 |
| Type Definitions | 15+ |
| **Total JS Items** | **~57** |
