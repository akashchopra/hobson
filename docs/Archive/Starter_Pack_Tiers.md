# Starter Pack Tier Assignments

This document defines which items belong to each starter pack tier. Items are tagged with `starter-pack/bare`, `starter-pack/basic`, or `starter-pack/all` to control which tier they appear in.

Use the `kernel-export` library to generate starter packs:

```javascript
const ke = await api.require('kernel-export');
await ke.download('bare');   // → initial-kernel.json
await ke.download('basic');  // → starter-basic.json
await ke.download('all');    // → starter-all.json
```

---

## Tier: `starter-pack/bare`

*Minimal bootable system - just enough to render and navigate*

### Seed Types
| ID | Name |
|----|------|
| `00000000-0000-0000-0000-000000000000` | kernel:item (ATOM) |
| `11111111-0000-0000-0000-000000000000` | kernel:type-definition |
| `22222222-0000-0000-0000-000000000000` | kernel:code |
| `33333333-0000-0000-0000-000000000000` | kernel:module |
| `66666666-0000-0000-0000-000000000000` | kernel:library |
| `77777777-0000-0000-0000-000000000000` | kernel:viewport-type |
| `aaaaaaaa-0000-0000-0000-000000000000` | kernel:view |
| `e0e00000-0000-0000-0000-000000000000` | event-definition |

### Kernel Modules
| ID | Name |
|----|------|
| `33333333-1111-0000-0000-000000000000` | kernel:core |
| `33333333-2222-0000-0000-000000000000` | kernel:storage |
| `33333333-4444-0000-0000-000000000000` | kernel:module-system |
| `33333333-5555-0000-0000-000000000000` | kernel:rendering |
| `33333333-7777-0000-0000-000000000000` | kernel:safe-mode |
| `33333333-8888-0000-0000-000000000000` | kernel:styles |

### Core Views
| ID | Name |
|----|------|
| `aaaaaaaa-1111-0000-0000-000000000000` | kernel:default-view |
| `bd74da77-a459-454a-b001-48685d4b536d` | system:viewport-view |
| `e7707000-0000-0000-0000-000000000003` | system:error-view |

### Core Libraries
| ID | Name |
|----|------|
| `f1111111-0001-0000-0000-000000000000` | selection-manager |
| `f1111111-0002-0000-0000-000000000000` | viewport-manager |
| `f1111111-0003-0000-0000-000000000000` | repl-ui |
| `f1111111-0004-0000-0000-000000000000` | keyboard-shortcuts |

### Event Definitions
| ID | Name |
|----|------|
| `e0e00000-0001-0000-0000-000000000000` | item-event |
| `e0e00000-0001-0001-0000-000000000000` | item:created |
| `e0e00000-0001-0002-0000-000000000000` | item:updated |
| `e0e00000-0001-0003-0000-000000000000` | item:deleted |
| `e0e00000-0002-0000-0000-000000000000` | system-event |
| `e0e00000-0002-0001-0000-000000000000` | system:error |
| `e0e00000-0002-0002-0000-000000000000` | system:boot-complete |
| `e0e00000-0003-0000-0000-000000000000` | viewport-event |
| `e0e00000-0003-0001-0000-000000000000` | viewport:selection-changed |
| `e0e00000-0003-0002-0000-000000000000` | viewport:root-changed |

### Viewport
| ID | Name |
|----|------|
| `88888888-0000-0000-0000-000000000000` | viewport |

---

## Tier: `starter-pack/basic`

*Usable system with editing, navigation, and content types. Includes all bare items.*

### Type Definitions
| ID | Name |
|----|------|
| `871ae771-b9b1-4f40-8c7f-d9038bfb69c3` | note |
| `d1da8525-b0dc-4a79-8bef-0cbed1ed003d` | tag |
| `5c3f2631-cd4d-403a-be9c-e3a3c5ebdce9` | container |
| `bbbbbbbb-0000-0000-0000-000000000000` | view-spec |
| `4f4b7331-874c-4814-90b7-c344e199d711` | script |
| `23b66a83-5c61-4320-9517-5aa2abad2d1f` | css |
| `7ac3cf17-2c10-454a-bc06-24db64e440c4` | item-search |
| `05e72011-d70e-4ff3-ac78-fe6b7fc5d884` | tag-browser |
| `e7707000-0000-0000-0000-000000000001` | system:error (type) |
| `e7707000-0000-0000-0000-000000000010` | system:error-list (type) |

### Views
| ID | Name |
|----|------|
| `fa8102f6-2b26-4d48-8a7f-79c9ec436e25` | note-view-readonly |
| `82a0838f-2b83-4b56-ab44-19cff07c8245` | note-view-editable |
| `2ac2dc31-5b49-4731-b53c-47b01adc4de4` | item-generic-view |
| `69253de7-a08d-40e3-b8da-ec88ee33a25a` | system:sortable-list-view |
| `ef793c27-2d4b-4c99-b05a-2769db5bc5a9` | system:spatial-canvas-view |
| `9428203f-c088-4a54-bbcb-fdbef244189e` | system:item-search-view |
| `08f3da07-81e2-4031-bd89-b26f9ebea54d` | system:tag-browser-view |
| `d4e5f6a7-b8c9-4d0e-a1b2-c3d4e5f6a7b8` | system:compact-card-view |
| `426f16cc-2049-421a-ae44-a091ce4ae06e` | code-view-readonly |
| `3c5b0b26-863d-413b-b32e-e1189007b450` | code-view-editable |
| `0c6b89ae-29ac-42e5-af95-838a4df51bc3` | script-view-readonly |
| `fb383592-2433-4be0-8a2c-43c311c10354` | script-view-editable |
| `e7707000-0000-0000-0000-000000000011` | system:error-list-view |

### Libraries
| ID | Name |
|----|------|
| `08d5ecd2-01a1-43f1-ad50-314027db231a` | markdown-it |
| `3a206d5a-54bb-4045-827e-20bf1a09f3de` | markdown-it-wrapper |
| `d484eea8-06b5-4d8d-ba10-0077fc8f637a` | marked |
| `a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6` | hobson-markdown |
| `ad3bddac-95ce-41ae-aa11-6f6e6f537bc6` | codemirror |
| `cf50f0f0-3163-4283-9734-59e163ecf185` | codemirror-wrapper |
| `84fd20bb-0415-4061-ac27-af99a5b85290` | codemirror-javascript |
| `cf994900-3472-41ea-8b01-a51f5897744c` | codemirror-markdown |
| `2264e4e7-4ff7-4013-9f09-5393ff0e3116` | modal-lib |
| `f1111111-0005-0000-0000-000000000000` | item-palette |
| `f1111111-0006-0000-0000-000000000000` | help-dialog |
| `f1111111-0007-0000-0000-000000000000` | json-editor |
| `6734035b-e30b-4c2a-829e-d57b3d1fd5dc` | item-search-lib |
| `c3cebc22-4a33-4182-b9a7-166316ba004e` | css-loader-lib |
| `b429b19d-ef0d-4f4f-b2a2-b9e6f80451f2` | system:generic-view |
| `ffd688d1-93a8-4c4b-b09a-127b249294f5` | system:generic-editor |
| `cccccccc-0000-0000-0000-000000000000` | field-view (base) |
| `98760f63-7e5f-40fb-b26f-a843f3f5b341` | tag-tree-builder |
| `e05faa99-120f-4ca9-b1f2-8cb3b5bf718e` | tag-picker-ui |
| `a1b2c3d4-type-pick-0000-000000000000` | type-picker-lib |
| `e7707000-0000-0000-0000-000000000002` | system:default-error-handler |
| `dafc22a5-13bf-4b42-937d-52f002c4bc70` | system:view-update-watcher |

### Field Views
| ID | Name |
|----|------|
| `c116c28d-0903-4fc7-8534-e1c4f245f55d` | field-view-text |
| `e933335e-5284-4943-8747-3b98333149ba` | field-view-textarea |
| `43b8f6c8-a575-4610-83a4-fb3c6bd3d5d8` | field-view-heading |
| `da0b96ad-5a69-4d38-952d-6ff76b851023` | field-view-number |
| `70b84e74-f079-4fa0-84c6-bb8d3ab31f61` | field-view-checkbox |
| `9d2ad27f-76a6-41d7-9fa9-2f51d0346add` | field-view-timestamp |
| `b0dd6871-7ac2-49c0-8caf-33ac416d784c` | field-view-item-ref |
| `2ce4cf7d-518e-4cbb-b588-f601b0e38f31` | field-view-tags |
| `4a9ad08c-1dc6-4afb-9d3c-fefeaf1c13ea` | field-view-json |
| `205c0188-a13a-4c2b-b1d4-88de7eb9aa21` | field-view-object |
| `56f77a00-baf5-43cc-9dc4-8ad0c66f1e8f` | field-view-markdown-editable |
| `8fd956ff-01f4-48f5-8afb-42fc2718005b` | field-view-markdown-readonly |
| `7d55ee6d-a36e-4e8d-bdc3-47966dcaa587` | field-view-script-code |
| `8e2f3e95-cc2d-44a3-beeb-0569f400da7c` | field-view-code-readonly |
| `e7b73a8e-2191-4ce5-ae9c-f721b5e30731` | field-view-code-editable |

### Field Editors
| ID | Name |
|----|------|
| `958dd20b-c30d-4eaa-b1f7-d73d2414c390` | field-editor-text |
| `8271c69e-ec45-485b-9233-89efd8b562ab` | field-editor-textarea |
| `beef5317-d6dc-4287-8c6d-de2f0635f5f9` | field-editor-number |
| `a5e1fd60-8c4c-4cee-a0e0-f060aa75f739` | field-editor-checkbox |
| `c28eeb82-aac7-4bea-9d7b-7d17c1fd73e7` | field-editor-select |
| `bccf2a2b-c750-417e-9d86-b96699cc5078` | field-editor-itemref |

---

## Tier: `starter-pack/all`

*Complete system with sample content and developer tools. Includes all basic items.*

### Developer Tools
| ID | Name |
|----|------|
| `eeee0000-0000-0000-0000-000000000001` | element-inspector |
| `e64adaeb-f701-400a-a3b7-a3cd36eb7b16` | theme-hot-reload |
| `ce370c3d-7bba-4786-95b6-068d68f46bf4` | 3rd Party Library Downloader |
| `aaaa0001-1000-0000-0000-000000000000` | kernel-export |

### CSS Items
| ID | Name |
|----|------|
| `10673b31-3637-4027-a22a-6e098ef33ddf` | codemirror-css |
| `d4e149ab-35fa-44a4-a858-779015bdee70` | context-menu-css |

### Instance Support
| ID | Name |
|----|------|
| `99999999-0000-0000-0000-000000000000` | hobson-instance (type) |
| `99999999-1111-0000-0000-000000000000` | system:hobson-instance-view |
| `f939abc4-2e9e-4d6a-a049-c9361fb3590d` | hobson-instance-lifecycle |

### Sample Content
| ID | Name |
|----|------|
| `c3f4c6ad-e827-4999-bf22-724873a5aade` | Hobson (main note) |
| `e62219e1-939f-4955-a427-ce67016b9079` | Hobson TODOs |
| `b3e6eac6-631d-4131-b446-bab697f428be` | My First Note |
| `a0a0a0a0-d0c0-4000-8000-000000000001` | Philosophy & Inspirations |
| `a0a0a0a0-d0c0-4000-8000-000000000002` | Core Concepts |
| `a0a0a0a0-d0c0-4000-8000-000000000003` | Architecture Overview |
| `a0a0a0a0-d0c0-4000-8000-000000000004` | Views & Rendering |
| `a0a0a0a0-d0c0-4000-8000-000000000005` | Spatial Windowing |
| `a0a0a0a0-d0c0-4000-8000-000000000006` | Events System |

### Containers
| ID | Name |
|----|------|
| `716cc99c-8cb5-4339-a7d6-96c2ff1bc193` | Item Browser |
| `b59c81dd-d383-4123-8d25-a199ae0eecbb` | Tag Browser |
| `7a45f818-9d23-4188-930b-522fc20ad3b5` | System Error List |

### Sample Scripts
| ID | Name |
|----|------|
| `2a7835b6-ddfb-4743-9b19-5f7acd904ade` | list-all-types |
| `31140f02-e8ac-4758-8b67-f00e62d80e00` | duplicate-item |

### Item Search
| ID | Name |
|----|------|
| `163e1a0a-f1d9-45f9-9490-50a37aa9c259` | Item Search |

### Sample Tags
| ID | Name |
|----|------|
| `1ead909b-492d-4559-897f-a33f7d156301` | idea |
| `3422c691-b0d5-460e-8c73-eaf98c423d2a` | personal |
| `b3ac1e05-5dc5-456b-9281-99caf09e6a73` | personal (duplicate) |
| `45077a3b-4cfc-474c-86de-39e2bc4cb8ca` | work |
| `e0e074dd-15d7-4303-94c8-86c5a47de9f9` | work (duplicate) |
| `8ff612c0-9a97-48ba-8503-27c26e8bb3ea` | project |
| `5009f5e3-15bf-4f13-9cff-0b3bcb23ebe2` | projects |
| `17443a09-8710-4535-b4d6-101d5e384830` | feature |
| `f158e936-e2a1-40e2-a9ce-3b714a60e289` | bug |
| `c1d2e85e-fb69-4de6-afe2-ade6eb79567f` | task |
| `8d25bd16-2655-439d-aaab-105375472561` | urgent |
| `2c3f2ab8-d3b7-440e-9763-7aa2858cc159` | question |
| `86591ade-8b78-49d1-b421-c57c58f6fcfc` | question (duplicate) |
| `ee933926-c068-418b-ad23-9a315b31dc44` | health |
| `ff4ba130-b103-4c44-a1cc-e4a4b3a657a4` | meetings |

### Preferences
| ID | Name |
|----|------|
| `00000000-0000-0000-0000-00000000000a` | system:preferences |

---

## Summary

| Tier | Items | Description |
|------|-------|-------------|
| bare | ~35 | Can boot, render viewport, show errors, use REPL |
| basic | ~70 additional (~105 total) | Can create/edit notes, navigate spatially, use item palette |
| all | ~50 additional (~155 total) | Full dev experience with samples and debugging tools |

---

## Applying Tags

To tag items for export, use the REPL:

```javascript
// Tag a single item
const item = await api.get('item-id');
item.tags = item.tags || [];
item.tags.push('aaaa0001-0001-0000-0000-000000000000'); // starter-pack/bare
await api.set(item);

// Or use a batch script to tag multiple items
const bareItems = ['00000000-0000-0000-0000-000000000000', ...];
for (const id of bareItems) {
  const item = await api.get(id);
  item.tags = item.tags || [];
  if (!item.tags.includes('aaaa0001-0001-0000-0000-000000000000')) {
    item.tags.push('aaaa0001-0001-0000-0000-000000000000');
    await api.set(item);
  }
}
```
