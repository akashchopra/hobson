# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hobson is a personal information management system inspired by Conway's Humane Dozen, Smalltalk live environments, Lisp REPL-first development, Obsidian linking, and Obenauer's itemized OS concept. It's a browser-based system where everything (data, code, UI) is an item.

## Development Commands

No traditional build system - the project is a single HTML file (`src/bootloader.html`) with embedded CSS that runs directly in the browser.

- **Run:** Open `src/bootloader.html` in a browser (Chrome, Firefox, Safari)
- **Safe Mode:** Add `?safe=1` to URL to boot kernel only (no user code items) - useful for recovery
- **Testing:** Manual testing via the built-in REPL

## System Architecture: Three-Layer Split

Hobson has three distinct layers. **Respect these boundaries strictly** — logic must live in the correct layer.

| Layer | Responsibility | May depend on |
|-------|---------------|---------------|
| **Kernel** | Storage, events, code/module loading, bootstrap. **No UI** (except safe-mode fallback). | Nothing — it is the foundation |
| **Viewport** | Rendering engine, navigation, view resolution, chrome (REPL bar, help dialog). Built from regular items but rarely modified by users. | Kernel |
| **Userland** | Views, libraries, type definitions, user data, documentation. Everything the user creates or customizes. | Kernel + Viewport |

**The kernel boundary rule:** If it can be built as a userland/viewport item, it **must not** be in the kernel. The kernel provides only what cannot be implemented as items: IndexedDB storage, the event bus, code evaluation, and bootstrap sequencing.

**Rendering is NOT in the kernel.** It lives in `viewport-rendering` (a library item). The kernel has no rendering code.

For full details, read the [System Layers](src/items/c0c0c0c0-0091-0000-0000-000000000000.json) doc.

## Documentation

All documentation lives in the item system. Read these items for full context:

| Item | ID | Purpose |
|------|----|---------|
| [System Layers](src/items/c0c0c0c0-0091-0000-0000-000000000000.json) | `c0c0c0c0-0091-0000-0000-000000000000` | Three-layer architecture (kernel/viewport/userland), boot flow, responsibilities |
| [Feature Overview](src/items/c0c0c0c0-0092-0000-0000-000000000000.json) | `c0c0c0c0-0092-0000-0000-000000000000` | All user-facing features with descriptions and links |
| [Architecture Overview](src/items/a0a0a0a0-d0c0-4000-8000-000000000003.json) | `a0a0a0a0-d0c0-4000-8000-000000000003` | System architecture, kernel modules, storage, bootstrap |
| [Core Concepts](src/items/a0a0a0a0-d0c0-4000-8000-000000000002.json) | `a0a0a0a0-d0c0-4000-8000-000000000002` | Items, types, code, libraries, views |
| [Project Context](src/items/c0c0c0c0-0030-0000-0000-000000000000.json) | `c0c0c0c0-0030-0000-0000-000000000000` | User preferences, working style, open design tensions |

Documentation items follow the `c0c0c0c0-XXXX-0000-0000-000000000000` GUID pattern and are tagged with the `concept` tag.

## Key Source Files

- `src/bootloader.html` - The application code
- `src/items/{guid}.json` - The most recent export of item with id {guid}. Use these as the reference implementation for all items.
- `src/items/backup.json` - The most recent dump of all items in the database. Do not read this file! Use the individual item exports.

## Seed Item GUIDs
```
ATOM: "00000000-0000-0000-0000-000000000000",
TYPE_DEFINITION: "11111111-0000-0000-0000-000000000000",
CODE: "22222222-0000-0000-0000-000000000000",
KERNEL_MODULE: "33333333-0000-0000-0000-000000000000",
KERNEL_CORE: "33333333-1111-0000-0000-000000000000",
KERNEL_STORAGE: "33333333-2222-0000-0000-000000000000",
KERNEL_MODULE_SYSTEM: "33333333-4444-0000-0000-000000000000",
KERNEL_SAFE_MODE: "33333333-7777-0000-0000-000000000000",
KERNEL_STYLES: "33333333-8888-0000-0000-000000000000",
LIBRARY: "66666666-0000-0000-0000-000000000000",
VIEW: "aaaaaaaa-0000-0000-0000-000000000000",
DEFAULT_VIEW: "aaaaaaaa-1111-0000-0000-000000000000",
NOTE: "871ae771-b9b1-4f40-8c7f-d9038bfb69c3"
```

## Item Structure
```javascript
{
  id: String,                    // GUID
  name?: String,                 // Required for code items only
  type: String,                  // GUID of type item
  created: Timestamp,
  modified: Timestamp,
  attachments: String[],         // Compositional - items attached to this item (or positioned objects)
  content: Map<String, Any>      // content.parent for taxonomical hierarchy
}
```

## Item Naming Conventions

**Namespaces:**
| Namespace | Meaning | Examples |
|-----------|---------|----------|
| `kernel:` | Kernel has hardcoded GUID reference to this item | `kernel:core`, `kernel:item`, `kernel:view`, `kernel:boot-complete` |
| *(none)* | Everything else (views, libraries, type-defs, user items) | `generic-view`, `markdown-it`, `field-view-text`, `note-view-editable` |

**Case Conventions:**
- Code items: kebab-case (`field-view-markdown-editable`, `item-search-lib`)
- Non-code items: Normal prose (`Hobson TODOs`, `My First Note`)

**Key Distinctions:**
- Views, libraries, and type-defs are all unprefixed userland items
- View-specs and field-views are config consumed by `generic-view`
- Libraries are loaded via `api.require('name')`

## Working Rules

These rules are very important!

- Before editing existing items, *always* confirm that the `src/items` directory contains the latest versions.
- **Edit JSON files directly** rather than writing REPL scripts. Edit the exported JSON files in `src/items/*.json` - this makes changes immediately ready for git commit. The user will import the updated files into Hobson.
- If REPL scripts are needed for some reason, place them in `src/REPL Scripts` (not /tmp).
