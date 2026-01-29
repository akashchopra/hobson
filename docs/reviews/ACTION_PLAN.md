# Code Review Action Plan

*Generated: 2026-01-29*
*Last Updated: 2026-01-29*

This document outlines all issues found during the comprehensive code review, ordered by priority.

---

## Priority 1: Critical (Must Fix)

### 1.1 kernel-safe-mode: XSS Vulnerability ✅ FIXED
**File:** `33333333-7777-0000-0000-000000000000.json`
**Location:** `_renderItemList()` method
**Issue:** Item type was inserted into innerHTML without escaping.

**Fix Applied:** Added `this._escapeHtml(item.type)` to escape the type ID.

---

### 1.2 kernel-safe-mode: Undefined Name Sort Crash ✅ FIXED
**File:** `33333333-7777-0000-0000-000000000000.json`
**Location:** `_renderItemList()` method
**Issue:** Sort crashes when item.name is undefined.

**Fix Applied:** Changed to `items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));`

---

## Priority 2: High (Should Fix)

### 2.1 kernel-rendering: Inefficient View Resolution Queries ✅ FIXED
**File:** `33333333-5555-0000-0000-000000000000.json`
**Location:** `findView()` and `getViews()` methods
**Issue:** Queries all views/view-specs for each type in the chain.

**Fix Applied:** Moved storage queries outside the while loop. Now queries once and filters locally.

---

### 2.2 kernel-repl: Memory Leak - Document Event Listeners ✅ FIXED
**File:** `33333333-6666-0000-0000-000000000000.json`
**Location:** `createContainer()` method
**Issue:** Document-level event listeners for splitter drag were never removed.

**Fix Applied:**
- Added `_documentMouseMoveHandler` and `_documentMouseUpHandler` instance properties
- Added `_cleanupDocumentListeners()` method
- Added `_setupSplitterListeners()` method for reuse
- Cleanup called when REPL is hidden, re-added when shown

---

### 2.3 field-editor-itemref: Modal Not Keyboard Accessible ✅ FIXED
**File:** `bccf2a2b-c750-417e-9d86-b96699cc5078.json`
**Location:** `openModal()` function
**Issue:** No Escape key handling to close the modal.

**Fix Applied:** Now uses `modal-lib` which provides Escape key handling automatically.

---

## Priority 3: Medium (Maintenance)

### 3.1 container_view: File Too Large
**File:** `ef793c27-2d4b-4c99-b05a-2769db5bc5a9.json`
**Issue:** ~1000+ lines of code in a single item.
**Status:** Deferred - significant refactoring effort

**Recommendation:** Extract into multiple focused libraries:
- `container-window-manager` - Window positioning, z-order, minimize/maximize
- `container-banner-view` - Banner display and editing
- `container-context-menu` - Context menu building
- `container-drag-drop` - Drag and drop handling

---

### 3.2 Duplicate Modal Patterns ✅ FIXED
**Files:** Multiple items used similar modal overlay patterns.

**Fix Applied:**
- Created new `modal-lib` library (`modal-lib-0000-0000-0000-000000000000`)
- Updated `type-picker-lib` to use modal-lib
- Updated `field-editor-itemref` to use modal-lib
- Library provides: `showModal()`, `confirm()`, `alert()` with standard behavior

---

### 3.3 Inconsistent Element Creation ✅ PARTIALLY FIXED
**Files:** Some items use `api.createElement()`, others use `document.createElement()`.

**Fix Applied:**
- `field-editor-number`: Converted to use `api.createElement()`
- `field-editor-checkbox`: Converted to use `api.createElement()`

**Remaining:** Other field editors could be updated as needed.

---

### 3.4 hobson-markdown: Long Inline Code
**File:** `a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6.json`
**Issue:** ~300 lines of complex parsing logic in a single function.
**Status:** Deferred - significant refactoring effort

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

## Summary Statistics

| Category | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical Issues | 2 | 2 | 0 |
| High Priority | 3 | 3 | 0 |
| Medium Priority | 4 | 2 | 2 |
| Notes | 4 | 0 | 4 |
| **Total** | **13** | **7** | **6** |

### Commits Made:
1. `Fix critical security and crash bugs in kernel-safe-mode` - Issues 1.1, 1.2
2. `Fix high priority issues from code review` - Issues 2.1, 2.2, 2.3
3. `Add modal-lib and standardize element creation` - Issues 3.2, 3.3

### Remaining Work:
- **3.1** container_view splitting (deferred - large refactoring)
- **3.4** hobson-markdown splitting (deferred - large refactoring)
- **4.x** Low priority notes (backlog)
