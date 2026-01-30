# Naming Convention Migration Plan

## Overview

This document outlines the naming conventions for Hobson items and provides a migration plan from current names to the new standardized names.

## Naming Convention Rules

### 1. Namespaces

| Namespace | Principle | What Belongs |
|-----------|-----------|--------------|
| `kernel:` | The kernel has a hardcoded reference to this item's GUID | Kernel modules, foundational types (atom, type-definition, code, view, etc.), default views the kernel falls back to |
| `system:` | Items the system actively discovers and dispatches to | Views (render code), error handling, system instances |
| *(none)* | User-land items | Libraries, view-specs, field-views, user-defined types, user data items |

### 2. Case Conventions

| Item Category | Convention | Examples |
|---------------|------------|----------|
| Code items (any namespace) | kebab-case | `kernel:core`, `system:default-view`, `markdown-it` |
| Non-code items | Normal prose | `Hobson TODOs`, `My First Note`, `Item Browser` |

### 3. Namespace Boundary Clarifications

- **kernel:viewport** = the kernel module that manages viewport state
- **kernel:system-viewport** = the viewport instance item (GUID 88888888...) - kernel references this directly
- **system:** views (render code) that the rendering system discovers and dispatches to
- **userland (no namespace):** view-specs and field-views are data/config consumed by `system:generic-view`, not dispatched to by the kernel

---

## Migration Table

### Kernel Items (kernel:)

Items the kernel references by hardcoded GUID.

| GUID | Current Name | New Name | Type |
|------|--------------|----------|------|
| `00000000-0000-0000-0000-000000000000` | item | kernel:item | (self) |
| `11111111-0000-0000-0000-000000000000` | type-definition | kernel:type-definition | atom |
| `22222222-0000-0000-0000-000000000000` | code | kernel:code | type-definition |
| `33333333-0000-0000-0000-000000000000` | kernel-module | kernel:module | kernel:code |
| `33333333-1111-0000-0000-000000000000` | kernel-core | kernel:core | kernel-module |
| `33333333-2222-0000-0000-000000000000` | kernel-storage | kernel:storage | kernel-module |
| `33333333-3333-0000-0000-000000000000` | kernel-viewport | kernel:viewport | kernel-module |
| `33333333-4444-0000-0000-000000000000` | kernel-module-system | kernel:module-system | kernel-module |
| `33333333-5555-0000-0000-000000000000` | kernel-rendering | kernel:rendering | kernel-module |
| `33333333-6666-0000-0000-000000000000` | kernel-repl | kernel:repl | kernel-module |
| `33333333-7777-0000-0000-000000000000` | kernel-safe-mode | kernel:safe-mode | kernel-module |
| `33333333-8888-0000-0000-000000000000` | kernel-styles | kernel:styles | kernel-module |
| `66666666-0000-0000-0000-000000000000` | library | kernel:library | code |
| `77777777-0000-0000-0000-000000000000` | viewport_type | kernel:viewport-type | type-definition |
| `88888888-0000-0000-0000-000000000000` | system-viewport | kernel:system-viewport | viewport-type |
| `aaaaaaaa-0000-0000-0000-000000000000` | view | kernel:view | code |
| `aaaaaaaa-1111-0000-0000-000000000000` | default_view | kernel:default-view | view |

### System Items (system:)

Items the system actively discovers and dispatches to (views, error handling).

#### Views (type: view)

| GUID | Current Name | New Name |
|------|--------------|----------|
| `08f3da07-81e2-4031-bd89-b26f9ebea54d` | tag_browser_view | system:tag-browser-view |
| `69253de7-a08d-40e3-b8da-ec88ee33a25a` | sortable_list_view | system:sortable-list-view |
| `9428203f-c088-4a54-bbcb-fdbef244189e` | item_search_view | system:item-search-view |
| `99999999-1111-0000-0000-000000000000` | hobson_instance_view | system:hobson-instance-view |
| `9a73a969-122d-4a1b-8a93-d3fde6419d01` | script_view | system:script-view |
| `bd74da77-a459-454a-b001-48685d4b536d` | viewport_view | system:viewport-view |
| `d4e5f6a7-b8c9-4d0e-a1b2-c3d4e5f6a7b8` | compact_card_view | system:compact-card-view |
| `e7707000-0000-0000-0000-000000000003` | error_view | system:error-view |
| `e7707000-0000-0000-0000-000000000011` | error_list_view | system:error-list-view |
| `ef793c27-2d4b-4c99-b05a-2769db5bc5a9` | container_view | system:container-view |

#### Error Handling (system:)

| GUID | Current Name | New Name | Notes |
|------|--------------|----------|-------|
| `e7707000-0000-0000-0000-000000000001` | error | system:error | type definition |
| `e7707000-0000-0000-0000-000000000002` | default-error-handler | system:default-error-handler | library |
| `e7707000-0000-0000-0000-000000000010` | error-list | system:error-list | type definition |
| `7a45f818-9d23-4188-930b-522fc20ad3b5` | Error List | System Error List | instance (prose name) |

#### Other System Items

| GUID | Current Name | New Name | Notes |
|------|--------------|----------|-------|
| `00000000-0000-0000-0000-00000000000a` | system:preferences | system:preferences | already correct |
| `b429b19d-ef0d-4f4f-b2a2-b9e6f80451f2` | generic_view | system:generic-view | core view-spec interpreter |
| `ffd688d1-93a8-4c4b-b09a-127b249294f5` | generic-editor | system:generic-editor | core editor system |
| `dafc22a5-13bf-4b42-937d-52f002c4bc70` | view-update-watcher | system:view-update-watcher | watches for view code changes |

### View-Specs and Field-Views (no namespace)

These are userland types and instances - they're configuration/components used by `system:generic-view`, not things the kernel dispatches to directly.

#### Type Definitions

| GUID | Current Name | New Name | Notes |
|------|--------------|----------|-------|
| `bbbbbbbb-0000-0000-0000-000000000000` | view-spec | view-spec | already correct |
| `cccccccc-0000-0000-0000-000000000000` | field_view | field-view | underscore → kebab |

#### View-Spec Instances

| GUID | Current Name | New Name |
|------|--------------|----------|
| `0c6b89ae-29ac-42e5-af95-838a4df51bc3` | script_view_readonly | script-view-readonly |
| `2ac2dc31-5b49-4731-b53c-47b01adc4de4` | item_generic_view | item-generic-view |
| `3c5b0b26-863d-413b-b32e-e1189007b450` | code_view_editable | code-view-editable |
| `426f16cc-2049-421a-ae44-a091ce4ae06e` | code_view_readonly | code-view-readonly |
| `82a0838f-2b83-4b56-ab44-19cff07c8245` | note_view_editable | note-view-editable |
| `fa8102f6-2b26-4d48-8a7f-79c9ec436e25` | note_view_readonly | note-view-readonly |
| `fb383592-2433-4be0-8a2c-43c311c10354` | script_view_editable | script-view-editable |

#### Field-View Instances

| GUID | Current Name | New Name |
|------|--------------|----------|
| `205c0188-a13a-4c2b-b1d4-88de7eb9aa21` | field_view_object | field-view-object |
| `2ce4cf7d-518e-4cbb-b588-f601b0e38f31` | field_view_tags | field-view-tags |
| `43b8f6c8-a575-4610-83a4-fb3c6bd3d5d8` | field_view_heading | field-view-heading |
| `4a9ad08c-1dc6-4afb-9d3c-fefeaf1c13ea` | field_view_json | field-view-json |
| `56f77a00-baf5-43cc-9dc4-8ad0c66f1e8f` | field_view_markdown_editable | field-view-markdown-editable |
| `70b84e74-f079-4fa0-84c6-bb8d3ab31f61` | field_view_checkbox | field-view-checkbox |
| `7d55ee6d-a36e-4e8d-bdc3-47966dcaa587` | field_view_script_code | field-view-script-code |
| `8e2f3e95-cc2d-44a3-beeb-0569f400da7c` | field_view_code_readonly | field-view-code-readonly |
| `8fd956ff-01f4-48f5-8afb-42fc2718005b` | field_view_markdown_readonly | field-view-markdown-readonly |
| `9d2ad27f-76a6-41d7-9fa9-2f51d0346add` | field_view_timestamp | field-view-timestamp |
| `b0dd6871-7ac2-49c0-8caf-33ac416d784c` | field_view_item_ref | field-view-item-ref |
| `c116c28d-0903-4fc7-8534-e1c4f245f55d` | field_view_text | field-view-text |
| `da0b96ad-5a69-4d38-952d-6ff76b851023` | field_view_number | field-view-number |
| `e7b73a8e-2191-4ce5-ae9c-f721b5e30731` | field_view_code_editable | field-view-code-editable |
| `e933335e-5284-4943-8747-3b98333149ba` | field_view_textarea | field-view-textarea |

### Libraries (no namespace)

Libraries remain unnamespaced, converted to kebab-case.

| GUID | Current Name | New Name |
|------|--------------|----------|
| `08d5ecd2-01a1-43f1-ad50-314027db231a` | markdown-it | markdown-it | (already correct) |
| `2264e4e7-4ff7-4013-9f09-5393ff0e3116` | modal-lib | modal-lib | (already correct) |
| `3a206d5a-54bb-4045-827e-20bf1a09f3de` | markdown-it-wrapper | markdown-it-wrapper | (already correct) |
| `6734035b-e30b-4c2a-829e-d57b3d1fd5dc` | item-search-lib | item-search-lib | (already correct) |
| `8271c69e-ec45-485b-9233-89efd8b562ab` | field-editor-textarea | field-editor-textarea | (already correct) |
| `84fd20bb-0415-4061-ac27-af99a5b85290` | codemirror-javascript | codemirror-javascript | (already correct) |
| `958dd20b-c30d-4eaa-b1f7-d73d2414c390` | field-editor-text | field-editor-text | (already correct) |
| `98760f63-7e5f-40fb-b26f-a843f3f5b341` | tag-tree-builder | tag-tree-builder | (already correct) |
| `a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6` | hobson-markdown | hobson-markdown | (already correct) |
| `a1b2c3d4-type-pick-0000-000000000000` | type-picker-lib | type-picker-lib | (already correct) |
| `a5e1fd60-8c4c-4cee-a0e0-f060aa75f739` | field-editor-checkbox | field-editor-checkbox | (already correct) |
| `ad3bddac-95ce-41ae-aa11-6f6e6f537bc6` | codemirror | codemirror | (already correct) |
| `bccf2a2b-c750-417e-9d86-b96699cc5078` | field-editor-itemref | field-editor-itemref | (already correct) |
| `beef5317-d6dc-4287-8c6d-de2f0635f5f9` | field-editor-number | field-editor-number | (already correct) |
| `c28eeb82-aac7-4bea-9d7b-7d17c1fd73e7` | field-editor-select | field-editor-select | (already correct) |
| `c3cebc22-4a33-4182-b9a7-166316ba004e` | css-loader-lib | css-loader-lib | (already correct) |
| `cf50f0f0-3163-4283-9734-59e163ecf185` | codemirror-wrapper | codemirror-wrapper | (already correct) |
| `cf994900-3472-41ea-8b01-a51f5897744c` | codemirror-markdown | codemirror-markdown | (already correct) |
| `d484eea8-06b5-4d8d-ba10-0077fc8f637a` | marked | marked | (already correct) |
| `e05faa99-120f-4ca9-b1f2-8cb3b5bf718e` | tag-picker-ui | tag-picker-ui | (already correct) |
| `eeee0000-0000-0000-0000-000000000001` | element-inspector | element-inspector | (already correct) |
| `f939abc4-2e9e-4d6a-a049-c9361fb3590d` | hobson-instance-lifecycle | hobson-instance-lifecycle | (already correct) |

### User-Defined Types (no namespace)

Type definitions that are not kernel-referenced, converted to kebab-case.

| GUID | Current Name | New Name |
|------|--------------|----------|
| `05e72011-d70e-4ff3-ac78-fe6b7fc5d884` | tag-browser | tag-browser | (already correct) |
| `23b66a83-5c61-4320-9517-5aa2abad2d1f` | css | css | (already correct) |
| `4f4b7331-874c-4814-90b7-c344e199d711` | script | script | (already correct) |
| `5c3f2631-cd4d-403a-be9c-e3a3c5ebdce9` | container | container | (already correct) |
| `7ac3cf17-2c10-454a-bc06-24db64e440c4` | item-search | item-search | (already correct) |
| `871ae771-b9b1-4f40-8c7f-d9038bfb69c3` | note | note | (already correct) |
| `99999999-0000-0000-0000-000000000000` | hobson-instance | hobson-instance | (already correct) |
| `d1da8525-b0dc-4a79-8bef-0cbed1ed003d` | tag | tag | (already correct) |

### User Data Items (no namespace, prose names)

These are user-created items with normal prose names. No changes needed unless they're incorrectly using kebab-case.

| GUID | Current Name | Notes |
|------|--------------|-------|
| `163e1a0a-f1d9-45f9-9490-50a37aa9c259` | Item Search | Correct (prose) |
| `716cc99c-8cb5-4339-a7d6-96c2ff1bc193` | Item Browser | Correct (prose) |
| `b59c81dd-d383-4123-8d25-a199ae0eecbb` | Tag Browser | Correct (prose) |
| `b3e6eac6-631d-4131-b446-bab697f428be` | My First Note | Correct (prose) |
| `c3f4c6ad-e827-4999-bf22-724873a5aade` | Hobson | Correct (prose) |
| `e62219e1-939f-4955-a427-ce67016b9079` | Hobson TODOs | Correct (prose) |
| Various notes | Various | Correct (prose) |

### CSS Items (no namespace)

| GUID | Current Name | New Name |
|------|--------------|----------|
| `10673b31-3637-4027-a22a-6e098ef33ddf` | codemirror-css | codemirror-css | (already correct) |
| `d4e149ab-35fa-44a4-a858-779015bdee70` | context-menu-css | context-menu-css | (already correct) |

### Script Items (no namespace)

| GUID | Current Name | New Name |
|------|--------------|----------|
| `2a7835b6-ddfb-4743-9b19-5f7acd904ade` | list-all-types | list-all-types | (already correct) |
| `31140f02-e8ac-4758-8b67-f00e62d80e00` | duplicate-item | duplicate-item | (already correct) |
| `ce370c3d-7bba-4786-95b6-068d68f46bf4` | 3rd Party Library Downloader | Third Party Library Downloader | (prose, capitalize consistently) |

### Tags (no namespace, prose)

Tags are user-created type instances with simple lowercase names. No changes needed.

| Current Names |
|---------------|
| feature, idea, work, personal, journal, task, bug, health, urgent, project, meetings, question |

### Error Items (to be deleted)

These appear to be error artifacts that should be cleaned up:

| GUID | Current Name |
|------|--------------|
| `1f427b78-265f-4fb9-9e01-22e961ad808d` | Error: Cannot delete seed item... |
| `45a763e9-a969-45a2-bb9a-8e88f35c025e` | Error: Cannot delete seed item... |
| `53e473df-fc69-464b-99a4-b3ef394e42cc` | Error: Item not found... |
| `57d60ce9-0872-4adc-8be1-6974e31b3e92` | Error: Item not found... |
| `e88f70fa-d6b3-4222-9259-9c3e48de2803` | Error: Item not found... |

---

## Migration Plan

### Phase 1: Update Kernel References

The kernel-core module has hardcoded GUID lookups by name in `api.require()`. Before renaming items, we need to ensure the module system can resolve both old and new names during the transition.

**Option A: Update module system to use GUIDs directly**
- The module system already supports lookup by GUID
- For items with hardcoded references, use GUID instead of name
- This is the cleanest approach

**Option B: Add name aliases**
- Temporarily support both old and new names
- More complex, not recommended

**Recommendation**: Option A - the kernel should reference items by GUID, not by name.

### Phase 2: Rename Items

Order of operations (to avoid breaking dependencies):

1. **Kernel foundational types** (item, type-definition, code, library, view, view-spec, field-view)
2. **Kernel modules** (kernel-core, kernel-storage, etc.)
3. **System views and field-views**
4. **User types and libraries** (minimal changes)

### Phase 3: Update require() Calls

After renaming, update any `api.require('old-name')` calls in code items to use the new names:

```javascript
// Before
const lib = await api.require('generic_view');

// After
const lib = await api.require('system:generic-view');
```

### Phase 4: Cleanup

1. Delete error artifact items
2. Export all items to src/items/*.json
3. Update CLAUDE.md with new naming conventions

### Future Refactoring (out of scope for this migration)

**Remove view-spec/field-view from kernel IDS** - The kernel currently has `IDS.VIEW_SPEC` and `IDS.FIELD_VIEW` with special-case handling in the rendering system. A cleaner design would:
1. Remove these from the kernel's IDS
2. Make `view-spec` just another type with `generic-view` registered as its view
3. Let the rendering system dispatch to `generic-view` naturally, rather than special-casing view-specs

This would make the kernel simpler and the view-spec pattern truly userland.

---

## Summary Statistics

| Category | Count | Changes Needed |
|----------|-------|----------------|
| Kernel items | 17 | 17 renames |
| System views | 10 | 10 renames |
| System error handling | 4 | 4 renames |
| System other | 4 | 3 renames |
| View-spec type + instances | 8 | 8 renames |
| Field-view type + instances | 16 | 16 renames |
| Libraries | 22 | 0 (already correct) |
| User types | 8 | 0 (already correct) |
| User items | ~30 | 0 (already correct) |
| Error artifacts | 5 | Delete |

**Total renames needed: 58 items**
**Total deletions: 5 items**

---

## Decisions Made

1. **`kernel:module`** - Use the shorter form for the kernel module type definition.

2. **Error types use `system:`** - `error` and `error-list` type definitions become `system:error` and `system:error-list`.

3. **`generic-view` and `generic-editor` use `system:`** - These are core to the rendering system, so they become `system:generic-view` and `system:generic-editor`.

4. **Delete error artifacts** - The 5 error items that are garbage from failed operations should be deleted.

5. **`view-spec` and `field-view` are userland** - These type definitions (and their instances) are NOT kernel items. They're userland concepts used by `system:generic-view`. The kernel currently has special-case handling for view-specs in rendering, but this is a leaky abstraction that could be refactored later. For now, these get no namespace, just kebab-case.
