# Viewport Chrome Simplification

**Status**: Completed
**Date**: 2026-01-26
**Author**: System Design Review
**Completed**: 2026-01-26

## Completion Notes

Implementation completed across two commits:
- `20df2cc` - Simplify viewport chrome: remove navbar, add keyboard shortcuts
- `a21fb06` - Refactor: move item decoration from kernel to viewport

**Key implementation decisions:**
- "Add Child Item" is a context menu option on ANY item (not just containers)
- Item decoration (data-item-id, tooltips) uses decorator pattern passed from viewport_view
- Decorator propagates through render context automatically to nested items
- Item list is now a modal overlay (not page replacement) to avoid history issues
- Global error handlers added for uncaught promise rejections
- Selection now stores element reference to fix duplicate-item-in-DOM bug

---

## Problem Statement

The current viewport chrome occupies significant vertical space (navbar + border) and contains elements that are either redundant or could be better accessed through alternative means:

1. **← Back button**: Duplicates browser back functionality
2. **+ New Item button**: Creates items in root container - could be context menu action
3. **All Items button**: Useful functionality but contributes to chrome weight
4. **"Viewing: [name]" status**: Informational but takes space

This runs counter to Conway's principle of **Transparency**: "The tool seems invisible and the artisan's hands are directly on the working material."

---

## Philosophical Alignment

### Conway's Humane Dozen

**Transparency**: The viewport chrome creates a visible "frame" around the working material. Reducing or eliminating it would make the tool more transparent.

**Self-revealing**: Keyboard shortcuts and context menus can be more self-revealing than always-visible buttons if properly discoverable.

**Inspectable**: The ability to inspect items shouldn't depend on chrome - it's already available via context menu and REPL.

### Obenauer's Itemized OS

Universal navigation should emerge from the item graph itself, not from permanent chrome. The viewport should be a minimal window into items, not a traditional application frame.

---

## Proposed Changes

### 1. Remove Back Button

**Rationale**: 
- Completely duplicates browser back button behavior
- Users expect browser controls to work
- Removing it reduces visual clutter without losing functionality

**Implementation**:
- Simply remove the button from viewport_renderer
- Existing URL-based navigation continues to work with browser back/forward
- No API changes needed

**Risk**: None - browser functionality is unchanged

---

### 2. Move "Add Item" to Context Menu

**Rationale**:
- "Add item to container" is conceptually a container operation
- Container renderer already has extensive context menu
- Aligns with spatial metaphor - right-click on canvas to add

**Implementation**:

1. **Remove** "+ New Item" button from viewport navbar

2. **Add to root container's context menu**:
   - Detect when root item is a container
   - Add "Add Item Here" option to canvas background context menu
   - Reuse existing type picker modal logic
   - Place new items at click location (or center if context menu triggered by keyboard)

3. **For non-container roots**:
   - Show message in empty state: "Press Cmd+K to search items, or open REPL (Esc) to create items"
   - Can still create items via REPL or by navigating to a container

**Code Changes**:
- Remove new item button from `viewport_renderer`
- Add canvas background context menu to `container_renderer`
- Extract type picker modal to shared utility library

**Risk**: Low - functionality moves but doesn't disappear

---

### 3. Add Keyboard Shortcut for Item List

**Rationale**:
- Item list is important but not constantly needed
- Keyboard shortcut is faster than mouse click
- Follows modern application patterns (VS Code Cmd+P, Sublime Cmd+Shift+P, etc.)
- Eliminates need for permanent chrome

**Implementation**:

1. **Add global keyboard listener** in kernel or viewport renderer:
   ```javascript
   // Cmd/Ctrl+K for item list (or Cmd+P as alternative)
   document.addEventListener('keydown', (e) => {
     if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
       e.preventDefault();
       api.showItemList();
     }
   });
   ```

2. **Enhance item list modal** (if not already done):
   - Fuzzy search by name/id
   - Show item type
   - Recently viewed items at top
   - Keyboard navigation (arrow keys, Enter to select)
   - Escape to close

3. **Make discoverable**:
   - Update empty state messages to mention Cmd+K
   - Add help tooltip (? icon) or Cmd+? for keyboard shortcuts help
   - REPL can show `help()` command listing shortcuts

**Alternative Shortcuts Considered**:
- **Cmd+K**: Common for "quick open" (Slack, Discord)
- **Cmd+P**: VS Code convention for file picker
- **Cmd+O**: Traditional "open" but might conflict with browser

**Recommendation**: Use **Cmd+K** (more modern, less conflict risk)

**Code Changes**:
- Add keyboard listener to kernel or viewport
- Remove "All Items" button from navbar
- Update help documentation

**Risk**: Low - adds functionality, removes button only after shortcut is working

---

### 4. Simplify or Remove Navbar Entirely

**Rationale**:
- With all buttons removed, navbar serves minimal purpose
- "Viewing: [name]" can be shown elsewhere (browser tab, hover)
- Maximizes content area

**Options**:

**Option A: Remove navbar completely** (Recommended)
- Cleanest solution
- Maximum content area
- Viewport just renders the root item directly
- Status shown via browser tab title + hover tooltips

**Option B: Minimal status bar**
- Very thin bar (16-20px) showing current item name
- Subtle styling (light gray, small font)
- Could be toggleable with keyboard shortcut

**Option C: Floating status widget**
- Small floating indicator in corner
- Shows item name on hover
- Can be dismissed

**Recommendation**: **Option A** - Remove entirely, but add browser tab title and hover tooltips to maintain inspectability.

**Implementation** (Option A):
```javascript
// viewport_renderer simplified structure:
export async function render(item, api) {
  // Get root from viewport attachments
  const rootSpec = item.attachments?.[0];
  const rootId = rootSpec?.id || rootSpec;
  const rootRendererId = rootSpec?.renderer || null;

  // Create simple container
  const container = api.createElement('div', {
    'data-item-id': rootId,
    class: 'viewport-content',
    style: 'width: 100%; height: 100%; display: flex; flex-direction: column;'
  }, []);

  if (!rootId) {
    // Empty state with instructions
    const empty = api.createElement('div', {
      style: 'padding: 60px 20px; text-align: center; color: #666;'
    }, [
      api.createElement('h2', { style: 'margin: 0 0 16px 0; font-weight: 400;' }, 
        ['No item selected']),
      api.createElement('p', { style: 'margin: 0 0 8px 0;' }, 
        ['Press Cmd+K to search items']),
      api.createElement('p', { style: 'margin: 0; font-size: 14px; color: #999;' }, 
        ['Or open REPL (Esc) to create items'])
    ]);
    container.appendChild(empty);
    return container;
  }

  // Render root item
  const rootNode = await api.renderItem(rootId, rootRendererId);
  container.appendChild(rootNode);

  // Context menu setup (remains same)
  // ... existing context menu code ...

  return container;
}
```

**Code Changes**:
- Simplify viewport_renderer to remove navbar
- Adjust container styling (remove flex: 1 calculations)
- Update empty state message
- Test that context menus still work without navbar

**Risk**: Medium - significant visual change, but functionally equivalent

---

### 5. Browser Tab Title for Root Item Name

**Rationale**:
- Browser tab already shows a title - use it!
- Provides context without taking content area
- Visible when switching between tabs
- Users already look at tabs to orient themselves
- Aligns with "Transparent" principle - use existing browser chrome

**Implementation**:
```javascript
// In viewport_renderer, after determining rootId:
async function updateBrowserTitle(rootId, api) {
  if (!rootId) {
    document.title = 'Hobson';
    return;
  }
  
  const rootItem = await api.get(rootId);
  const itemName = rootItem?.content?.title || rootItem?.name || rootItem.id.slice(0, 8);
  document.title = `${itemName} - Hobson`;
}
```

**When to update**:
- When viewport root changes
- When root item is modified (name/title changes)
- On page load

**Benefits**:
- Zero visual space cost
- Familiar pattern (every web app does this)
- Useful when multiple Hobson tabs are open
- Shows in bookmarks and history

---

### 6. Hover Tooltips for All Items

**Rationale**:
- Enhances inspectability without permanent visual clutter
- Users can discover item names/IDs on demand
- Especially useful in containers with many items
- Standard web pattern (title attribute)

**Implementation**:

**Option A: At rendering time** (Recommended)
Add title attributes when items are rendered:

```javascript
// In rendering system (kernel or renderer helper):
export function renderItemWithMetadata(itemId, renderId, api) {
  const item = await api.get(itemId);
  const node = await api.renderItem(itemId, rendererId);
  
  // Add metadata attributes
  if (node && node.setAttribute) {
    const itemName = item?.content?.title || item?.name || item.id;
    const typeName = await getTypeName(item.type, api);
    
    // Set title (shown on hover)
    node.setAttribute('title', `${itemName}\nType: ${typeName}\nID: ${item.id.slice(0, 8)}...`);
    
    // Already has data-item-id for selection
    node.setAttribute('data-item-id', itemId);
  }
  
  return node;
}
```

**Option B: Global hover handler**
Add a document-level mouseover handler that shows tooltips:

```javascript
// In kernel or viewport:
document.addEventListener('mouseover', async (e) => {
  const itemElement = e.target.closest('[data-item-id]');
  if (itemElement && !itemElement.hasAttribute('data-tooltip-added')) {
    const itemId = itemElement.getAttribute('data-item-id');
    const item = await api.get(itemId);
    const itemName = item?.content?.title || item?.name || item.id;
    const typeName = await getTypeName(item.type, api);
    
    itemElement.setAttribute('title', `${itemName}\nType: ${typeName}\nID: ${item.id.slice(0, 8)}...`);
    itemElement.setAttribute('data-tooltip-added', 'true');
  }
});
```

**Recommendation**: **Option A** - Add at render time. More predictable, less runtime overhead.

**Tooltip Content Options**:

**Minimal** (just name):
```
Task: Review design document
```

**Standard** (name + type):
```
Task: Review design document
Type: note
```

**Detailed** (name + type + ID):
```
Task: Review design document
Type: note
ID: 3f7a8b9c...
```

**Recommendation**: **Standard** - shows name and type, which is most useful for orientation.

**Special Cases**:
- **Root item**: Could show "(root)" indicator in tooltip
- **Container attachments**: Already have titles in window title bars
- **Nested items**: Show parent context if useful

---

## Implementation Plan

### Phase 1: Preparation (No User-Visible Changes)
1. Extract type picker modal to utility library
2. Enhance item list modal with keyboard navigation
3. Add Cmd+K keyboard shortcut (alongside existing button)
4. **Add browser tab title updates**
5. **Add hover tooltip system to rendering**
6. Test in parallel with existing UI

### Phase 2: Navigation Changes
1. Remove Back button from navbar
2. Test browser back/forward still works correctly
3. Verify browser title updates correctly
4. Update any documentation

### Phase 3: Add Item Migration  
1. Add "Add Item Here" to container canvas context menu
2. Test thoroughly with various container states
3. Remove "+ New Item" button from navbar once context menu works

### Phase 4: Final Simplification
1. Remove "All Items" button (shortcut already working)
2. Remove navbar entirely
3. Verify browser title and tooltips provide adequate context
4. Update empty state messages
5. Update any help documentation or tooltips

### Phase 5: Polish
1. Add keyboard shortcuts help (Cmd+?)
2. Fine-tune tooltip content (name + type vs. more detail)
3. Consider adding discoverable hints (e.g., "💡 Tip: Press Cmd+K to search" on first load)
4. Update Technical Overview document

---

## Edge Cases & Considerations

### 1. Browser Back Behavior
**Issue**: What if user navigates to external link then back?  
**Solution**: Already works - viewport state is in URL and IndexedDB

### 2. Non-Container Roots
**Issue**: Can't right-click to add items if root isn't a container  
**Solution**: 
- Document that containers are the spatial organization metaphor
- Items can be created via REPL: `api.create({...})`
- Navigate to a container to use spatial organization

### 3. Discoverability
**Issue**: How do new users discover Cmd+K?  
**Solution**:
- Empty state messages
- Keyboard shortcuts help screen (Cmd+?)
- Could show subtle hint on first 2-3 launches
- REPL `help()` command

### 4. Mobile/Touch
**Issue**: No Cmd key on mobile  
**Solution**:
- Could add small floating search button for touch devices
- Detect touch device and adjust UI accordingly
- Out of scope for initial implementation (Hobson is primarily desktop-focused)

### 5. Context Menu Trigger on Empty Canvas
**Issue**: How to trigger context menu on empty container canvas?  
**Solution**: 
- Already handled - canvas element receives right-click
- May need to ensure empty canvas has minimum height

### 6. Browser Title Updates
**Issue**: When should browser title update? What if item name changes?  
**Solution**:
- Update on navigation (already part of viewport state change)
- Update on item modification (listen for updates to root item)
- Keep implementation simple - title updates are cheap

### 7. Tooltip Performance
**Issue**: Adding tooltips to every rendered item could be expensive  
**Solution**:
- Title attribute is native browser feature - very lightweight
- Only add to elements with data-item-id (already selective)
- If performance issue, can lazy-load on first hover (Option B)

---

## Benefits

1. **More Content Area**: Viewport chrome reduction frees ~40-50px vertical space
2. **Cleaner Aesthetics**: No visual barrier between user and content
3. **Better Metaphor**: Content is not "inside" a frame - it IS the viewport
4. **Keyboard Efficiency**: Power users can navigate faster
5. **Philosophical Alignment**: Tool becomes more transparent
6. **Reduced Complexity**: Less code in viewport renderer
7. **Enhanced Inspectability**: Hover tooltips provide on-demand context without clutter
8. **Browser Integration**: Uses native browser tab title for context (familiar pattern)

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Users don't discover Cmd+K | Medium | Empty state hints, help screen, REPL help |
| Breaking existing workflows | Low | All functionality preserved, just relocated |
| Context menu on empty canvas fails | Low | Test thoroughly, add minimum height to canvas |
| Visual disorientation without navbar | Medium | Test with users, could add subtle breadcrumb if needed |

---

## Success Metrics

- Users successfully navigate without Back button (browser back works)
- Users successfully add items via container context menu
- Users discover and use Cmd+K shortcut
- Overall UI feels cleaner and less cluttered
- No functionality is lost or harder to access

---

## Future Enhancements

1. **Breadcrumb Trail**: Optional subtle breadcrumb showing navigation path
2. **Quick Actions Palette**: Cmd+Shift+P for command palette (create, search, navigate)
3. **Recent Items**: Cmd+E for recently viewed items
4. **Spatial History**: Visual history navigation (not linear back/forward)
5. **Search Everywhere**: Cmd+Shift+F for content search across all items

---

## Open Questions

1. ~~Should we keep any minimal status indicator?~~ **Resolved: No - use browser tab + tooltips**
2. Should Cmd+K open search or recently viewed? (recommendation: search with recents at top)
3. Should we add Cmd+? for keyboard shortcuts help immediately? (recommendation: yes)
4. Should empty containers show a hint about right-clicking? (recommendation: yes, subtle)
5. **What should tooltip content include?** (recommendation: item name + type)
6. **Should browser title show just item name or "name - Hobson"?** (recommendation: "name - Hobson" for clarity)
7. **Should tooltips show on container window title bars?** (recommendation: no, they already show name)

---

## Appendix: Keyboard Shortcuts Reference

Proposed keyboard shortcuts for Hobson:

| Shortcut | Action | Priority |
|----------|--------|----------|
| **Esc** | Toggle REPL | Existing |
| **Cmd+K** | Search/open items | New - P1 |
| **Cmd+?** | Show keyboard help | New - P2 |
| **Cmd+Shift+P** | Command palette | Future |
| **Cmd+E** | Recent items | Future |
| **Right-click** | Context menu | Existing |

---

## Implementation Checklist

- [x] Phase 1: Extract type picker to library (`type-picker-lib`)
- [x] Phase 1: Enhance item list with keyboard nav (modal overlay with search)
- [x] Phase 1: Add Cmd+K listener
- [x] Phase 1: Test keyboard shortcut
- [x] **Phase 1: Implement browser tab title updates**
- [x] **Phase 1: Add tooltip system to rendering** (via decorator pattern)
- [x] **Phase 1: Test tooltips on various item types**
- [x] Phase 2: Remove Back button
- [x] Phase 2: Test browser navigation
- [x] Phase 2: Verify browser title updates on navigation
- [x] Phase 3: Add "Add Child Item" to context menu (on ANY item, not just containers)
- [x] Phase 3: Test context menu placement
- [x] Phase 3: Remove "+ New Item" button
- [x] Phase 4: Remove "All Items" button
- [x] Phase 4: Remove navbar div entirely
- [x] Phase 4: Update viewport_view
- [x] Phase 4: Verify tooltips provide adequate context
- [x] Phase 4: Update empty state messages
- [x] Phase 5: Add Cmd+? help screen
- [x] Phase 5: Fine-tune tooltip content format (name + type)
- [x] Phase 5: Test all functionality
- [x] Phase 5: Update documentation

**Additional work completed:**
- [x] Add global error handlers for uncaught promise rejections (kernel-core)
- [x] Fix empty viewport state (render viewport even without root)
- [x] Fix right-click on empty viewport shows context menu
- [x] Refactor: move decoration logic from kernel to viewport (decorator pattern)
- [x] Fix selection bug when same item appears multiple times in DOM

---

## References

- Technical Overview: `/mnt/project/Technical_Overview.md`
- Conway's Humane Dozen: `/mnt/project/humanedozen.pdf`
- Current viewport_renderer: `item_backup.json` (viewport_renderer item)
- Current container_renderer: `item_backup.json` (container_renderer item)
