# Project Memory

Notes about user preferences, working style, and interesting directions to explore. This file helps future conversations pick up where we left off without re-learning context.

**Note:** Technical/architectural decisions belong in `Design_Decisions_Log.md`, not here.

---

## User Preferences & Working Style

### Communication
- **Direct and questioning** - Challenge assumptions, don't be sycophantic
- **Critique first, implement second** - Discuss trade-offs before coding
- **Discover through dialogue** - The goal is to figure out what to build, not just build it

### Technical Values
- **Self-documenting code** - Clarity over brevity (e.g., chose `createElement` over `h`)
- **Principle-driven** - Humane Dozen principles guide decisions
- **Minimal kernel** - Keep bootstrap small, build everything else in the system
- **Offline-first** - System must work without network, online is enhancement

### Design Approach
- Inspired by: Smalltalk (live environments), Lisp (REPLs), Obsidian (note-taking), itemized OS
- Everything is an item (unified data model)
- Extend the system by writing code within the system

### User Working Style - Important Discovery
- Has strong negative reaction to friction/unnecessary hurdles in workflow
- Reaction intensity is disproportionate to actual impact (user is self-aware of this)
- Even minor friction can create mental block that derails focus
- Solution: Address the specific friction point quickly (15 min fix) before moving forward
- Prefers concrete action over extended discussion once direction is clear

---

## Project Goals

### Project Goals Clarified:
- Reframed from "research project" to "iterative tool building with interesting ideas"
- Goal: Have fun exploring + implement ideas + end up with useful tool
- Not pure research - not willing to throw away working code for experiments
- User phrase: "a hobby project that interests me"

### Bootstrap Philosophy Established:
- REPL is foundational tool during early development, not yak-shaving
- It's acceptable to build initial tools externally (IDE) then import
- Distinction: "kernel" = hobson.html, "within system" = items in database
- Most improvements don't require kernel changes (can be built as items)
- Use REPL heavily during bootstrap phase, UI improvements come later

## Interesting Directions to Explore

### Discoverability (Not Editor Features)
- ~~Syntax highlighting~~ - REJECTED: Violates minimal kernel, adds 1MB+ dependencies, purely cosmetic
- ~~Traditional autocomplete~~ - REJECTED: Wrong approach, adds complexity, feels like "better IDE"
- Real problem: Users can't discover what's available in the system
- Better approach: Self-revealing API
  - `api.help()` - show available methods
  - `api.examples()` - show common patterns
  - Persistent scripts (scratchpad) - library of reusable commands
- Distinction: Discoverability is about *items in system*, not API methods
- Keep `api.` prefix everywhere (including REPL) for consistency with code items

### Offline/Online Architecture
- User emphasized offline-first requirement
- Caching strategy for online resources
- How to handle data sync when online?
- Conflict resolution approach?

### Mobile Experience
- User wants to use app from laptop AND phone
- Touch interactions vs mouse/keyboard
- Screen size adaptations
- Consider: Progressive enhancement? Separate mobile UI?

### Import/Export Strategy
- What formats to support?
- How to preserve relationships between items?
- Backup and restore workflows
- Consider: Plain text exports for longevity?

### Type System Evolution
- Current types are quite loose
- Schema validation needed?
- Type inheritance or composition?
- How formal should the type system become?

### "Inspectable" in Practice
- Humane Dozen principle: "All parts can be examined"
- What does this mean for our UI?
- Developer tools integration?
- Item introspection views?

### Navigation & Browsing
- How to move between items efficiently?
- History/breadcrumbs?
- Search and filter capabilities?
- Graph/network visualization of relationships?

---

## Current Focus & Open Questions

### Key Tension: REPL-First vs UI-First
- **Unresolved:** Which should drive the system design?
- REPL-first: Code is primary interface, UI is secondary
- UI-first: Visual navigation is primary, code extends it
- Both eventually needed, but priority order shapes the system
- Current stance: Use documentation exercise to reveal which path enables progress
- Not about end state, about what enables the next week of exploration

### Bootstrap Dilemma (Critical Juncture)
- **The problem:** Need tools to build tools, but building takes time from using
- Priority paralysis: Can see multiple paths forward, can't tell which unblocks most
- Options considered:
  - Scriptable REPL (persistent scripts, build up recipe library)
  - Search/Recent items (find things you've created)
  - Better item browser (understand what exists)
- **Resolution strategy:** Pick smallest improvement (2 hours max) that enables today's work
- Avoid "excellent REPL" or "excellent UI" thinking - too abstract
- Focus: What specific friction makes you give up on a real task?
- Documentation task will reveal the answer

### Navigation Pain Point
- **Hypothesis:** Main pain is "can't navigate your own system"
- Current navigation: URL bar with GUIDs, All Items JSON dump, REPL typing GUIDs
- Creating items: Easy
- Using items once: Easy
- Finding items again: Impossible
- May need basic navigation before REPL improvements or UI beauty matter

---

## Known Friction Points

### Code Item Creation via REPL
- **The problem:** Creating code items (renderers, libraries) via `api.helpers.createRenderer()` is fragile
- **Why:** Multi-level string escaping required (backticks, backslashes) - error-prone and hard to debug
- **Current workaround:** Use JSON editor instead of REPL:
  1. Create skeleton item with placeholder code via REPL
  2. Navigate to it and click "Edit Current"
  3. Paste actual code directly into `content.code` field (no escaping!)
  4. Save
- **Why this works:** Editing data directly (transparent), no hidden escaping, copy/paste from external editor
- **Proper fix options (later):**
  - Code item creation UI with raw code input
  - Import from file functionality  
  - Multi-line REPL mode with raw string handling
- **Status:** Documented as known issue, acceptable workaround exists, revisit Week 4-5
- **Humane Dozen violation:** Violates "Robust" - creating code items can easily break with wrong escaping

---


## Ideas Worth Revisiting

- **Rich text editing** - Beyond plain text notes
- **Bidirectional links** - Automatic backlinks between items
- **Version history** - Track changes over time
- **Collaborative features** - If/when online sync exists
- **Plugin system** - How to extend without modifying kernel?
- **Scripting and automation** - Beyond manual UI interactions

---

