# Transclusion Design

## Core Concept

Transclusion is a **rendering instruction** for attached items, not a separate relationship mechanism.

Writing `![Item Name](item://item-id)` means:
1. This item is related to my item (structural relationship)
2. I want it displayed inline (rendering preference)

## Syntax

Transclusion uses standard markdown image syntax with the `item://` protocol:

```markdown
![Item Name](item://item-id)  → Transclude item inline
[Item Name](item://item-id)   → Link to navigate (already supported)
```

**Rationale:** The `!` prefix in markdown already means "embed this" (for images). Transclusion is just embedding an item instead of an image. This reuses existing markdown conventions rather than inventing custom syntax.

## Relationship Model

**Single mechanism:** Children array tracks all relationships

```javascript
{
  id: "meeting-note",
  type: "note",
  attachments: [{id: "agenda"}, {id: "alice-contact"}, {id: "template"}],
  content: {
    description: "![Agenda](item://agenda) ![Template](item://template) ..."
  }
}
```

- "agenda" and "template" are transcluded (rendered inline)
- "alice-contact" is attached but not transcluded (would be shown in viewport's attachments panel)
- All three appear in attachments array

## Implementation Flow

### At Save Time (Editor)

When user saves markdown content:
1. Parse content for `![...](item://item-id)` patterns using regex
2. Extract all unique transcluded item IDs
3. Ensure each transcluded ID exists in attachments array
4. Add missing ones via `api.attach(itemId)`
   - This provides cycle detection (prevents A→B→A loops)
   - This provides duplicate prevention (same child only appears once)
   - This ensures consistent structure: `{id: itemId}`
5. Save updated item

**Rationale:** Typing the syntax declares the relationship. Save operation makes it real.

### At Render Time (Markdown Renderer)

When rendering markdown content:
1. **Before** passing to markdown-it, scan for `![...](item://item-id)` patterns
2. For each pattern:
   - Extract the item ID from the URL
   - Fetch the item via `api.get(itemId)`
   - Render it fully via `api.renderItem(itemId)` (uses item's own renderer)
   - Wrap rendered content in visual container with:
     - Light background/border for distinction
     - Header: "Transcluded from: [item-name]" (clickable to navigate)
     - The rendered DOM node
   - Replace the markdown pattern with this rendered HTML
3. Handle missing items: show `[Missing: alt-text]` in styled div
4. Pass the modified content to markdown-it for final rendering

**Rationale:** Rendering is read-only, no side effects. Using full renderer supports all item types consistently.

## Edge Cases

### Non-existent Item ID

User types `![Agenda](item://typo-id)` where "typo-id" doesn't exist:
- At save: Added to attachments array anyway via `api.attach()`
- At render: Shows `[Missing: Agenda]` (using the alt text)
- User must fix manually (correct ID or delete syntax)

### Deleted Item

Item was transcluded, then source item deleted:
- Kernel's delete operation removes from all parents' attachments arrays
- Markdown still contains `![...](item://deleted-id)` syntax
- Renders as `[Missing: ...]` (using alt text as fallback)
- User should edit to remove stale transclusion

### Duplicate Transclusion

Same item transcluded multiple times: `![X](item://id) ... ![X](item://id)`
- Only appears once in attachments array (api.attach prevents duplicates)
- Renders fully inline at each location
- Valid use case (show same content in different contexts)

## Rendering Details

### Transcluded Content Display

Transcluded items render with their full renderer via `api.renderItem(itemId)`:
- Note → full markdown renderer output
- Contact → whatever the contact renderer produces
- Code → syntax highlighted view
- Container → rendered by its renderer (may be complex)

This approach is **type-agnostic** - any item type can be transcluded, and it will use its own rendering logic.

### Visual Distinction

Transcluded content is wrapped in a container with:
- Light background/border (`background: #f9f9f9; border: 1px solid #e0e0e0`)
- Header showing "Transcluded from: [item-name]"
- Header is clickable via `api.navigate(itemId)` to jump to source
- Padding and border-radius for visual separation

### Non-Transcluded Children

Children that aren't transcluded are **not shown in the note renderer**. The viewport's attachments panel will display all attachments (both transcluded and non-transcluded). This keeps the note renderer focused on content display.

## Comparison with Other References

### Transclusion vs Markdown Links

```markdown
![Agenda](item://agenda-id)  → Full content rendered inline (transclusion)
[Agenda](item://agenda-id)   → Hyperlink, click to navigate (link)
```

- Links: navigation affordance only, no attachments relationship
- Transclusion: embedded content + creates attachments relationship
- Both use the same `item://` protocol
- The `!` prefix distinguishes embed from navigate

### Transclusion vs Spatial Windows

Both show item content, different contexts:
- Transclusion: embedded within note flow
- Window: independent, positioned, user-arranged
- Same item can be both transcluded AND pulled into viewport as window

## Future Considerations

### Transclusion Options

Potential syntax extensions using URL fragment/query patterns:

- `![Item](item://id#content)` - transclude only the content field
- `![Item](item://id#code)` - transclude only the code field
- `![Item](item://id?view=compact)` - use compact renderer variant
- `![Item](item://id?lines=1-10)` - partial transclusion
- `![Item](item://id?readonly)` - disable inline editing

These would be parsed at render time to modify what/how the item is displayed.

### Circular Transclusion

What if A transcludes B, and B transcludes A?

**Current approach:** No depth limit or cycle detection. This may cause infinite loops.

**Future options:**
- Track rendering depth, stop at level 3-5
- Track visited items, detect cycles, show "[Circular reference]"
- Both: depth limit as safety + cycle detection for UX

Deferred until we see if it's a real problem in practice.

### Inline Editing

Should transcluded content be editable inline, or read-only with "edit source" button?

- Editable: More powerful, but complex (need to save to source item)
- Read-only: Simpler, clearer mental model
- Hybrid: View-only by default, click to edit source in modal

Initial implementation: **read-only** (just renders the item).
