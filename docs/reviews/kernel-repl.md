# Review: kernel-repl

**Item ID:** `33333333-6666-0000-0000-000000000000`
**Type:** kernel-module

---

## Responsibilities

1. Provide interactive JavaScript console UI
2. Manage command history with navigation
3. Execute code with REPL API context
4. Display results in transcript panel

---

## Code Review

### Strengths

- **Clean UI construction:** Well-organized DOM creation
- **History management:** Proper up/down arrow navigation
- **Keyboard shortcuts:** Tab indent, Ctrl+Enter run, Escape close
- **Splitter functionality:** Draggable divider between input and transcript

### Issues Found

**HIGH PRIORITY:**

1. **Lines 116-130:** Document-level event listeners are never cleaned up:
   ```javascript
   document.addEventListener("mousemove", (e) => {
     if (!isDragging) return;
     // ... handle resize
   });

   document.addEventListener("mouseup", () => {
     if (isDragging) {
       isDragging = false;
       // ...
     }
   });
   ```

   **Impact:** Memory leak. These listeners persist even after REPL is hidden/destroyed.

   **Fix:**
   ```javascript
   // In createContainer():
   this._mousemoveHandler = (e) => { ... };
   this._mouseupHandler = () => { ... };
   document.addEventListener("mousemove", this._mousemoveHandler);
   document.addEventListener("mouseup", this._mouseupHandler);

   // Add destroy method:
   destroy() {
     document.removeEventListener("mousemove", this._mousemoveHandler);
     document.removeEventListener("mouseup", this._mouseupHandler);
   }
   ```

### Minor Observations

1. **Line 86:** History limit is hardcoded to 50. Consider making configurable.

2. **Lines 170-195:** Arrow key history navigation works on any cursor position. Consider only triggering when cursor is at start/end of input.

3. **Transcript scrolling:** Uses `scrollIntoView({ behavior: "smooth" })` which is good UX.

---

## API Surface

| Method | Description | Notes |
|--------|-------------|-------|
| `createContainer()` | Build REPL DOM | Called once |
| `toggle()` | Show/hide REPL | Manages visibility |
| `run()` | Execute input | Adds to history |
| `addTranscriptEntry(code, result, error)` | Add to transcript | Scrolls to bottom |

---

## Recommendations

1. **HIGH:** Add `destroy()` method and call from `toggle()` when hiding, or use a single set of listeners that check REPL visibility.

2. **LOW:** Make history limit configurable via content property.

3. **LOW:** Consider only triggering history navigation when cursor is at appropriate position.

---

## Verdict

**Status:** ⚠️ Needs memory leak fix

The UI is well-constructed but the document-level event listeners need cleanup handling.
