# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hobson is a personal information management system inspired by Conway's Humane Dozen, Smalltalk live environments, Lisp REPL-first development, Obsidian linking, and Obenauer's itemized OS concept. It's a browser-based system where everything (data, code, UI) is an item.

## Development Commands

No traditional build system - the project is a single HTML file (`src/hobson.html`) with embedded CSS that runs directly in the browser.

- **Run:** Open `src/hobson.html` in a browser (Chrome, Firefox, Safari)
- **Safe Mode:** Hold Shift while loading to boot kernel only (no user code items) - useful for recovery
- **Testing:** Manual testing via the built-in REPL

## Architecture

### Core Concepts

- **Item-centric data model:** Everything is an item with unified GUID structure
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
00000000-0000-0000-0000-000000000000 - atom (self-referential base)
00000000-0000-0000-0000-000000000001 - type_definition
00000000-0000-0000-0000-000000000002 - code
00000000-0000-0000-0000-000000000003 - renderer
00000000-0000-0000-0000-000000000004 - library
00000000-0000-0000-0000-000000000005 - default_renderer
00000000-0000-0000-0000-000000000006 - workspace (default root)
```

### Code Items

**Renderers:**
- Type: `renderer`, must have `content.for_type`
- Export `render(item, api)` function returning DOM nodes
- Read-only API access - no write operations in renderers

**Libraries:**
- Type: `library`
- Export utility functions via standard JavaScript exports
- Loaded via `await api.require('name')`

### Spatial Windowing

Children can be positioned objects for 2D canvas layout:
```javascript
children: [{ id: "item-1", x: 20, y: 20, width: 400, height: 300, z: 0 }]
```

## Key Documentation Files

- `docs/Design_Decisions_Log.md` - Source of truth for architectural decisions
- `docs/Technical_Implementation_Notes.md` - Code-level implementation details
- `docs/PROJECT_MEMORY.md` - User preferences and working context
- `docs/Code_Items.md` - Catalog of in-system code items

## Working Style Context

- **Critique first, implement second** - Discuss trade-offs before coding
- **Minimal kernel** - Bootstrap small, build everything else in system
- **Challenge assumptions** - Direct and questioning approach preferred
- **Known friction:** Code item creation via REPL requires multi-level string escaping (use JSON editor as workaround)
- **Navigation pain point:** Finding previously created items is difficult - address if blocking progress

## Open Design Tension

**REPL-first vs UI-first** remains unresolved:
- REPL-first: Code is primary, UI is secondary
- UI-first: Visual navigation is primary, code extends it
