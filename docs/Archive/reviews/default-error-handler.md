# Review: default-error-handler

**Item ID:** `e7707000-0000-0000-0000-000000000002`
**Type:** library (66666666-0000-0000-0000-000000000000)

---

## Responsibilities

1. Watch `system:error` events
2. Parse stack traces to extract item IDs
3. Create error items with structured data
4. Show toast notifications with click-to-view

---

## Code Review

### Strengths

- **Follows error handling spec:** Correctly implements Tier 2 of Error_Handling_System.md
- **Stack trace parsing:** Extracts item IDs from blob URLs for navigation
- **Non-blocking toasts:** Auto-dismiss with click-to-navigate
- **Error item structure:** Includes frames, context, timestamp, resolved flag

### Issues Found

**None critical.**

### Minor Observations

1. **Line number extraction:** The stack parsing extracts item IDs but not line/column numbers:
   ```javascript
   const blobMatch = line.match(/blob:[^/]+\/([a-f0-9-]+)/);
   ```
   Consider also extracting `:line:col` for precise navigation.

2. **Toast styling:** Hardcoded styles. Could use CSS class from context-menu-css pattern.

3. **Error list management:** Creates error items but doesn't manage the error list item's attachments. The error_list_view uses `api.query({ type: errorType })` which works but means errors aren't hierarchically organized.

---

## API Surface

| Export | Description |
|--------|-------------|
| `onSystemError({ error, context, timestamp }, api)` | Main handler |

Declares watch:
```javascript
watches: [{ event: 'system:error' }]
```

---

## Recommendations

1. **LOW:** Enhance stack parsing to extract line numbers for clickable navigation:
   ```javascript
   const match = line.match(/blob:[^/]+\/([a-f0-9-]+)\.js:(\d+):(\d+)/);
   if (match) {
     return {
       itemId: match[1],
       line: parseInt(match[2]),
       col: parseInt(match[3]),
       navigable: true
     };
   }
   ```

2. **LOW:** Consider adding errors as attachments of the Error List item for better organization.

---

## Verdict

**Status:** ✓ No changes required

Correctly implements the documented error handling pattern. The toast UX is good and the error items have the right structure for the error_view renderer.
