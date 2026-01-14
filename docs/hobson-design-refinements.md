# Hobson Design Refinements

## Issues Identified

### 1. REPL Omnipresence
**Problem:** REPL takes up valuable screen space despite frequent but not constant use.

**Solution:** Remove from default view. Provide access via:
- Keyboard shortcut (suggest Ctrl+` or similar)
- Menu/chrome access

### 2. Root Workspace Redundancy
**Problem:** Generic root workspace is pointless now that specialized workspaces exist (e.g., "My Notes").

**Solution:** Remember last location on app launch. No forced return to empty root.

**Note:** Multiple workspaces are expected. "My Notes" is just the first test case.

### 3. UI Through Custom Items
**Problem:** Top-level chrome buttons feel redundant. Why hardcode UI when items are universal?

**Proposal:** Migrate UI to editable items where possible.

**Key functions for minimal chrome (5-7 total):**
- Navigate to item
- Create item
- Access REPL
- Search (see below)
- Back/history (maybe)

**Open questions:**
- What is the irreducible kernel vs Safe Mode?
- Should chrome be hardcoded, privileged item, or default-but-overridable?
- Guardrails for editing system UI

## Search Architecture

**Principle:** Universal capability + specialized implementations

- **Universal search:** Available everywhere, searches all items (like Spotlight)
- **App-specific search:** Workspaces can provide optimized search for their context (like Finder search)

Not mutually exclusive - both should coexist.

## Practical Next Steps

### Phase 1: Quick Wins
1. Remove REPL from default view
2. Add keyboard shortcut for REPL toggle
3. Implement "remember last location" on launch (store in special system:preferences item; if missing/corrupted, don't show any item)
4. Remove or hide root workspace from default navigation

### Phase 2: Chrome as Items
5. Design minimal chrome UI (5-7 key functions)
6. Implement chrome as editable item(s)
7. Add REPL access to chrome
8. Consider safe mode/recovery mechanism

### Phase 3: Search
9. Implement universal search (search all items)
10. Ensure apps can override/extend with specialized search

## Philosophy

This moves Hobson closer to the Smalltalk/Lisp ideal: **the system is manipulable from within itself**. The UI is data. The chrome is items. The REPL is the meta-level for when items aren't enough.

The kernel shrinks to: render item, execute code, store/retrieve data.
