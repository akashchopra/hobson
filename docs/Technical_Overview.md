# Hobson: Technical Overview

## Summary

Hobson is an offline-first, self-modifying personal information management system implemented as a single-file browser application. The system runs continuously without compile/restart cycles, persists all state to IndexedDB, and treats everything—data, types, UI code, and system infrastructure—as uniformly-structured items. This enables live modification of running behavior, including the UI that renders itself.

The architecture draws from Smalltalk's image-based persistence, Lisp's REPL-driven development, and itemized OS concepts. Extension happens by creating new items rather than modifying external source files. A minimal kernel provides bootstrap infrastructure (storage, code execution, renderer dispatch), while all higher-level functionality—editors, navigation, specialized views—exists as items within the running system that users can inspect and modify.

## Key Concepts

### Items

The universal data structure. Every entity in the system—notes, type definitions, executable code, UI components—is an item with the same structure: a unique identifier, a type reference, timestamps, a children array for composition, and an arbitrary content map. There are no special cases; the kernel treats all items identically.

Items reference types which reference types, forming chains that terminate at a self-referential base called "atom." The kernel validates these chains on every write, ensuring structural integrity without interpreting content semantics.

### Kernel

The minimal runtime providing core services: IndexedDB storage with validation, dynamic ES module execution for code items, type-chain-based renderer lookup, and viewport state management. The kernel never interprets item content—that responsibility belongs to renderers.

Safe mode (activated via URL parameter) boots the kernel without executing user code, providing a recovery path when code items contain errors that would crash normal operation.

### Code Items

Items whose type chain includes the "code" type. Two primary subtypes exist:

**Renderers** produce DOM trees from items. They receive an item and a read-only API, returning visual output. Renderers have no side effects and cannot modify storage—they transform data into presentation.

**Libraries** export reusable functions loaded via an async require mechanism. Third-party JavaScript libraries are stored as code items, making them available offline and loadable through the same mechanism as user-written code.

Code items are cached after evaluation and automatically re-evaluated when their modification timestamp changes. Evaluation errors display inline without crashing the system.

### Type System

Types are items. Every item points to a type item, forming chains terminating at atom. This creates an inheritance hierarchy: when looking up a renderer, the kernel walks the type chain until finding a match, falling back to a default JSON view.

Users create new types by making items that describe them. Instances of those types reference them. No compilation or restart required—create a type item, create a renderer for it, and items of that type immediately render with the new UI.

### Renderers

Discovered by walking an item's type chain. Each renderer specifies which type it handles. Multiple renderers can exist for one type, enabling view switching (compact vs. detail, card vs. list). A context menu built into the viewport chrome allows selecting among available renderers at runtime.

Renderers compose hierarchically via recursive rendering calls. A container renderer renders its children with their own appropriate renderers, creating arbitrarily deep UI hierarchies from simple building blocks.

### Editors

Parallel to renderers but for editing. Editor items provide editing UI through declarative specifications (field hints interpreted by a generic editor) or imperative code (full custom control). When no editor exists for a type, the system falls back to a structured JSON editor that works for any item.

### Viewport

A special item managing view state: which item is currently displayed and with which renderer. The viewport persists between sessions, remembers recent locations, and provides the navigation chrome (toolbar, context menus, REPL toggle) that wraps rendered content. The kernel renders the viewport, which in turn renders the user's current root item inside itself.

## Bootstrapping Journey

**Bare Kernel**: On first boot with empty storage, the kernel creates seed items establishing the type hierarchy: atom (the base), type_definition, code, renderer, library, and a default renderer showing everything as JSON. At this point the system is functional but primitive—all items display as raw data.

**First Code Items**: Using the built-in REPL, create initial infrastructure: helper libraries, basic types (note, container), and renderers for those types. Everything feels REPL-driven at this stage—typing JavaScript to create items that will eventually enable UI-driven workflows.

**Container Infrastructure**: Build container types that display children as positioned windows on a 2D canvas. Children become draggable, stackable, and spatially organized. This transforms the system from "render one item" to "navigate a spatial workspace of items."

**Viewport Infrastructure**: Build a viewport renderer providing navigation controls, context menus for renderer/editor selection, and REPL access. The viewport becomes the shell wrapping all user interaction.

**Editing Infrastructure**: Create a generic editor interpreting declarative field specifications, generating forms with appropriate input widgets. For specialized needs, create custom editor code. Now items can be created and edited through UI rather than REPL.

At this point the system reaches usability: create items via buttons, edit with generated forms, view with custom renderers, navigate spatially. The REPL remains available for scripting but daily use happens through UI built as items.

## First Use Case: Notes

**Goal**: Store and interlink text notes with markdown support.

**Creating the Type**: Use the REPL to create a "note" type item describing what notes are.

**Building the Renderer**: Create a renderer item for notes. The renderer parses markdown content, handles formatting, and detects wiki-style links to other items. Clicking a link navigates the viewport to the linked item.

**Enabling Editing**: Create an editor specification declaring which fields notes have (text content, tags). The generic editor interprets this to show a textarea and tag input. Alternatively, build a custom editor for richer interaction.

**Using Notes**: Click "New Item," select the note type, fill the generated form. Notes render as formatted text immediately. Edit via right-click context menu. Link notes by referencing other item IDs in the text.

**What It Took**: One type item, one renderer item with markdown parsing and link handling, one editor specification. All created as items within the running system—no external code changes, no restart. The note-taking functionality can be inspected, modified, or replaced at runtime by editing those items.

## Current State

The system implements the full bootstrapping sequence. Current capabilities include spatial container navigation, markdown notes with linking, context-menu driven renderer/editor selection, and REPL for scripting. The tension between REPL-first and UI-first development remains unresolved—both paths work, and the right balance depends on the task at hand.
