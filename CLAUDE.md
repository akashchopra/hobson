# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation

**Start here:** Read [`docs/system-orientation.md`](docs/system-orientation.md) for a complete overview of the system — philosophy, architecture, features, and links to all detailed docs. This is the recommended first read at session start.

Detailed documentation lives in the item system. Key items for deep dives:

| Item | ID | Purpose |
|------|----|---------|
| [System Layers](src/items/c0c0c0c0-0091-0000-0000-000000000000.json) | `c0c0c0c0-0091-0000-0000-000000000000` | Three-layer architecture, boot flow, layer responsibilities |
| [Project Context](src/items/c0c0c0c0-0030-0000-0000-000000000000.json) | `c0c0c0c0-0030-0000-0000-000000000000` | User preferences, working style, open design tensions |
| [Roadmap](src/items/c0c0c0c0-0090-0000-0000-000000000000.json) | `c0c0c0c0-0090-0000-0000-000000000000` | Current priorities and recent accomplishments |

Documentation items follow the `c0c0c0c0-XXXX-0000-0000-000000000000` GUID pattern. The system orientation doc links to all of them by topic.


## Development Commands

No traditional build system - the project is a single HTML file (`src/bootloader.html`) with embedded CSS that runs directly in the browser.

- **Run:** Open `src/bootloader.html` in a browser (Chrome, Firefox, Safari)
- **Safe Mode:** Add `?safe=1` to URL to boot kernel only (no user code items) - useful for recovery
- **Testing:** Manual testing via the built-in REPL

## Key Source Files

- `src/bootloader.html` - The minimal bootloader. Almost never modified; contains no kernel or application logic.
- `src/items/{guid}.json` - The most recent export of item with id {guid}. Use these as the reference implementation for all items.
- `src/items/backup.json` - The most recent dump of all items in the database. Do not read this file! Use the individual item exports.

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

- **NEVER, EVER, MAKE CODE CHANGES WITHOUT CONFIRMATION. ALL USER REQUESTS SHOULD BE INTERPRETED AS REQUESTS FOR INVESTIGATION AND EXPLANATION, NOT AS REQUESTS FOR AUTOMATIC FIXING.**
- **DO NOT USE TOOLS THAT REQUIRE CONTINUAL APPROVAL. FOR EXAMPLE, USE OF SED ALWAYS RESULTS IN THE PROMPT "sed command contains operations that require explicit approval". ANOTHER EXAMPLE "Command contains a backslash before a shell operator (;, |, &, <, >) which can hide command structure". NEVER USE SUCH TOOLS.**
- Before editing existing items, *always* confirm that the `src/items` directory contains the latest versions.
- **Edit JSON files directly** rather than writing REPL scripts. Edit the exported JSON files in `src/items/*.json` - this makes changes immediately ready for git commit. The user will import the updated files into Hobson.
- If REPL scripts are needed for some reason, place them in `src/REPL Scripts` (not /tmp).
