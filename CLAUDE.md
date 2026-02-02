# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hobson is a personal information management system inspired by Conway's Humane Dozen, Smalltalk live environments, Lisp REPL-first development, Obsidian linking, and Obenauer's itemized OS concept. It's a browser-based system where everything (data, code, UI) is an item.

## Development Commands

No traditional build system - the project is a single HTML file (`src/bootloader.html`) with embedded CSS that runs directly in the browser.

- **Run:** Open `src/bootloader.html` in a browser (Chrome, Firefox, Safari)
- **Safe Mode:** Add `?safe=1` to URL to boot kernel only (no user code items) - useful for recovery
- **Testing:** Manual testing via the built-in REPL

## Architecture

### Core Concepts

- **Item-centric data model:** Everything is an item with unified item structure
- **Type hierarchy:** Items reference types, which reference types, terminating at "atom"
- **Code as data:** Renderers and libraries are stored as items with executable code
- **Image-based persistence:** IndexedDB storage, browser app runs continuously

### Item Structure
```javascript
{
  id: String,                    // GUID
  name?: String,                 // Required for code items only
  type: String,                  // GUID of type item
  created: Timestamp,
  modified: Timestamp,
  children: String[],            // Array of child IDs (or positioned objects)
  content: Map<String, Any>
}
```

### Seed Item GUIDs
```
ATOM: "00000000-0000-0000-0000-000000000000",
TYPE_DEFINITION: "11111111-0000-0000-0000-000000000000",
CODE: "22222222-0000-0000-0000-000000000000",
KERNEL_MODULE: "33333333-0000-0000-0000-000000000000",
KERNEL_CORE: "33333333-1111-0000-0000-000000000000",
KERNEL_STORAGE: "33333333-2222-0000-0000-000000000000",
KERNEL_VIEWPORT: "33333333-3333-0000-0000-000000000000",
KERNEL_MODULE_SYSTEM: "33333333-4444-0000-0000-000000000000",
KERNEL_RENDERING_SYSTEM: "33333333-5555-0000-0000-000000000000",
KERNEL_REPL: "33333333-6666-0000-0000-000000000000",
KERNEL_SAFE_MODE: "33333333-7777-0000-0000-000000000000",
KERNEL_STYLES: "33333333-8888-0000-0000-000000000000",
RENDERER: "44444444-0000-0000-0000-000000000000",
DEFAULT_RENDERER: "44444444-1111-0000-0000-000000000000",
EDITOR: "55555555-0000-0000-0000-000000000000",
DEFAULT_EDITOR: "55555555-1111-0000-0000-000000000000",
LIBRARY: "66666666-0000-0000-0000-000000000000",
VIEWPORT_TYPE: "77777777-0000-0000-0000-000000000000",
VIEWPORT: "88888888-0000-0000-0000-000000000000"
```

### Code Items

**Renderers:**
- Type: `renderer`, must have `content.for_type`
- Export `render(item, api)` function returning DOM nodes

**Libraries:**
- Type: `library`
- Export utility functions via standard JavaScript exports
- Loaded via `await api.require('name')`

### Item Naming Conventions

**Namespaces:**
| Namespace | Meaning | Examples |
|-----------|---------|----------|
| `kernel:` | Kernel has hardcoded GUID reference to this item | `kernel:core`, `kernel:item`, `kernel:view` |
| `system:` | System actively discovers and dispatches to this item | `system:generic-view`, `system:error-view` |
| *(none)* | Userland items | `markdown-it`, `field-view-text`, `note-view-editable` |

**Case Conventions:**
- Code items: kebab-case (`field-view-markdown-editable`, `item-search-lib`)
- Non-code items: Normal prose (`Hobson TODOs`, `My First Note`)

**Key Distinctions:**
- Views (`kernel:view` type) use `system:` because the rendering system dispatches to them
- View-specs and field-views are userland (no namespace) - they're config consumed by `system:generic-view`
- Libraries are userland (no namespace) - loaded via `api.require('name')`

### Spatial Windowing

Children can be positioned objects for 2D canvas layout:
```javascript
children: [{ id: "item-1", x: 20, y: 20, width: 400, height: 300, z: 0 }]
```

## Key Documentation Files

- `docs/Design_Decisions_Log.md` - Source of truth for architectural decisions
- `docs/Technical_Implementation_Notes.md` - Code-level implementation details
- `docs/PROJECT_MEMORY.md` - User preferences and working context

## Key Source Files

- `src\bootloader.html` - The application code.
- `src\items\{guid}.json` - The most recent export of item with id {guid}. Use these as the reference implementation for all items.
- `src\items\backup.json` - The most recent dump of all the items in the database. Do not read this file! Use the individual item exports.

## Working Style Context

- **Critique first, implement second** - Discuss trade-offs before coding
- **Minimal kernel** - Bootstrap small, build everything else in system
- **Challenge assumptions** - Direct and questioning approach preferred
- **Known friction:** Code item creation via REPL requires multi-level string escaping (use JSON editor as workaround)
- **Navigation pain point:** Finding previously created items is difficult - address if blocking progress

## Working Rules

These rules are very important!

- Before editing existing items, *always* confirm that the `src/items` directory contains the latest versions.
- **Edit JSON files directly** rather than writing REPL scripts. Edit the exported JSON files in `src/items/*.json` - this makes changes immediately ready for git commit. The user will import the updated files into Hobson.
- If REPL scripts are needed for some reason, place them in `src/REPL Scripts` (not /tmp). 

## Open Design Tension

**REPL-first vs UI-first** remains unresolved:
- REPL-first: Code is primary, UI is secondary
- UI-first: Visual navigation is primary, code extends it
