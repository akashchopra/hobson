# Review: generic_view

**Item ID:** Not found in exports - this is referenced but may be named differently

*Note: The generic view that interprets VIEW_SPEC items was referenced in kernel-rendering but the actual item may be named `generic_view` or similar. Searching for its implementation...*

---

Based on kernel-rendering code at line 240:
```javascript
if (isViewSpec) {
  viewModule = await this.kernel.moduleSystem.require('generic_view');
  viewSpecItem = view;
}
```

This library interprets declarative VIEW_SPEC items with `ui_hints`.

---

## Expected Responsibilities

1. Load and render VIEW_SPEC items declaratively
2. Process `ui_hints` field configurations
3. Resolve field_view types for each field
4. Handle editable vs readonly modes
5. Support layout options (dividers, sizing)

---

## Review Note

The actual `generic_view` item should be reviewed separately when located. Based on usage in kernel-rendering, it should:

- Accept `(item, viewSpec, api)` signature
- Iterate through `ui_hints` fields
- Load appropriate `field_view_*` items
- Pass field values and onChange callbacks

---

## Related Items Using VIEW_SPEC Pattern

| Item | for_type | Fields |
|------|----------|--------|
| code_view_readonly | code | name, modified, description, code |
| code_view_editable | code | name, description, code |
| note_view_readonly | note | name, tags, modified, description |
| note_view_editable | note | name, tags, description |
| script_view_readonly | script | name, description, code |

---

## Verdict

**Status:** ⏳ Needs separate review when item located

The VIEW_SPEC system is well-designed architecturally. The individual implementation should be reviewed for correctness of field resolution and layout handling.
