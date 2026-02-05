# Preferred View Implementation Plan

*Decision Date: 2026-01-28*

---

## Problem Statement

Currently, when multiple views exist for a type, the kernel selects the first one found during the type chain walk. Users have no way to customize view selection at either the item or type level.

**Existing override mechanisms:**
- **Viewport root**: `viewport.rootViewId` overrides the view for the currently displayed root item
- **Per-child in container**: Parent's child spec can include `view: { type: "view-id" }` to override a specific child's view

**The gaps:**

1. **Item-level preference**: A note used as a workspace should default to `container_view`, while a standalone note should default to `note-view-readonly`. This is an item-specific decision about that item's role.

2. **Type-level preference**: When working with notes generally, a user might prefer `note-view-editable` over `note-view-readonly` as the default. This is a user preference about how they work with a type.

These are orthogonal concerns that both need addressing.

---

## Design Decision

### Two Levels of Preference

| Level | Question answered | Example |
|-------|-------------------|---------|
| **Item preference** | "What is this specific item's role?" | "This note is a workspace" → container_view |
| **Type preference** | "How do I prefer to work with this type?" | "I like notes editable by default" → note-view-editable |

Both use the same field name `preferredView`, stored as a top-level field (not in `content`) because the kernel needs to read it during view lookup. The meaning is determined by context:

- On a regular item: "this item's preferred view"
- On a type definition: "preferred view for all items of this type"

```javascript
// Item with item-level preference
{
  id: "my-workspace-note",
  type: "note-type-id",
  preferredView: "container-view-id",  // ← This item's preferred view
  // ...
}

// Type definition with type-level preference
{
  id: "note-type-id",
  type: TYPE_DEFINITION,
  name: "note",
  preferredView: "note-view-editable",  // ← Preferred view for all notes
  content: {
    description: "A markdown note"
  }
}
```

### Why Top-Level, Not in `content`

The `content` field is documented as "arbitrary key-value data" that the kernel doesn't interpret—it's the domain of views. Since the kernel needs these preferences during view lookup, they're system metadata, not content.

### Why Same Field Name

Using `preferredView` uniformly keeps the model simple. The kernel resolution logic walks: item → type definition → type chain. At each step it checks `preferredView`. No need for different field names at different levels.

**Edge case:** If you want to set a preferred view for viewing a type definition item *itself* (not for items of that type), this conflicts. Considered rare enough not to warrant additional complexity.

---

## View Resolution Order

After implementation, view resolution becomes:

```
1. Explicit viewId passed to renderItem(itemId, viewId)  → use that
2. Parent's child spec has view.type                     → use that (contextual override)
3. Item has preferredView field                          → use that (item's preference)
4. Type definition has preferredView field               → use that (type's preference)
5. Walk type chain for first VIEW/VIEW_SPEC              → use first match
6. DEFAULT_VIEW                                          → fallback (JSON inspector)
```

**Key insight:**
- Steps 1-2 are *contextual* (where/how the item is being shown right now)
- Step 3 is the *item's self-declared preference* (this specific item prefers this view)
- Step 4 is the *type's preference* (user's general preference for this type)
- Steps 5-6 are *system defaults* (what the system picks when no preferences exist)

---

## User Experience

### Two Context Menu Options

| Menu Item | What it does | Where it's stored |
|-----------|--------------|-------------------|
| **View As...** | Override view in this context (quick access for common read/edit switching) | Parent's child spec `view.type` or `viewport.rootViewId` |
| **View Settings...** | Open modal to configure item and type preferences | Item's `preferredView` and type definition's `preferredView` |

### Design Rationale

The most common view-switching action is toggling between read and edit modes, which needs to be quick and prominent. "View As..." provides this as a direct submenu.

The item-level and type-level preferences are less frequent configuration actions. Putting them in a modal provides space to:
- Show all three levels at once for understanding
- Explain what each level does
- Show the current effective view and why

### Menu Structure

```
Right-click item →
  ...
  View As...        → [list of views with checkmark on current contextual override]
  View Settings...  → [opens modal]
```

### View Settings Modal

```
┌──────────────────────────────────────────────────────┐
│  View Settings for "My Note"                     ✕   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Currently showing: container_view                   │
│                                                      │
│  ───────────────────────────────────────────────     │
│                                                      │
│  In this context                                     │
│  Override for this location only (set via           │
│  "View As..." menu)                                  │
│  Current: container_view                    [Clear]  │
│                                                      │
│  ───────────────────────────────────────────────     │
│                                                      │
│  For this item                                       │
│  Default view wherever this item appears             │
│  [ None                    ▼]               [Clear]  │
│                                                      │
│  ───────────────────────────────────────────────     │
│                                                      │
│  For all Notes                                       │
│  Default view for items of this type                 │
│  [ note-view-editable      ▼]               [Clear]  │
│                                                      │
│  ───────────────────────────────────────────────     │
│                                                      │
│  Resolution order: context → item → type → system    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Modal Behavior

**"In this context" section:**
- Read-only display of current contextual override (if any)
- "Clear" button removes the contextual override
- Note explains this is set via the "View As..." menu

**"For this item" section:**
- Dropdown to select item's `preferredView`
- "None" option means no preference (fall through to type/system)
- "Clear" button removes the field
- Changes trigger re-render of this item

**"For all [Type]s" section:**
- Label is dynamic based on item's type name
- Dropdown to select type definition's `preferredView`
- "None" option means no preference (fall through to system)
- "Clear" button removes the field
- Changes trigger re-render of all items of this type (that don't have item-level preferences)

---

## Implementation Phases

### Phase 1: Kernel Changes

**Goal:** Make the kernel respect `preferredView` on both items and type definitions during view lookup.

#### Task 1.1: Modify `renderItem` in kernel-rendering

**File:** `kernel-rendering` item (ID: `33333333-5555-0000-0000-000000000000`)

**Current flow in `renderItem`:**
```javascript
async renderItem(itemId, viewId = null, viewConfig = {}, context = {}) {
  // ...
  const item = await this.kernel.storage.get(itemId);

  // Use specified view or find default for item's type
  let view;
  if (viewId) {
    view = await this.kernel.storage.get(viewId);
  } else {
    view = await this.findView(item.type);  // ← Only considers type chain
  }
  // ...
}
```

**New flow:**
```javascript
async renderItem(itemId, viewId = null, viewConfig = {}, context = {}) {
  // ...
  const item = await this.kernel.storage.get(itemId);

  // Use specified view or find default via preference hierarchy
  let view;
  if (viewId) {
    // Explicit view specified by caller (highest priority)
    view = await this.kernel.storage.get(viewId);
  } else {
    // Use preference hierarchy
    view = await this.resolveView(item);
  }
  // ...
}

// New method: resolve view using preference hierarchy
async resolveView(item) {
  const IDS = this.kernel.IDS;

  // 1. Check item's preferred view
  if (item.preferredView) {
    try {
      return await this.kernel.storage.get(item.preferredView);
    } catch (e) {
      console.warn(`Preferred view ${item.preferredView} not found for item ${item.id}, checking type preference`);
    }
  }

  // 2. Check type definition's preferred view
  try {
    const typeItem = await this.kernel.storage.get(item.type);
    if (typeItem.preferredView) {
      try {
        return await this.kernel.storage.get(typeItem.preferredView);
      } catch (e) {
        console.warn(`Preferred view ${typeItem.preferredView} not found for type ${typeItem.name}, using type chain lookup`);
      }
    }
  } catch (e) {
    // Type not found - fall through to type chain lookup
  }

  // 3. Fall back to type chain lookup
  return await this.findView(item.type);
}
```

**Testing:**
- Item without preferences → uses type-chain lookup (existing behavior preserved)
- Item with `preferredView` → uses that view
- Item without `preferredView` but type has `preferredView` → uses type's preference
- Item with `preferredView` and type has `preferredView` → uses item's preference (item wins)
- Invalid item `preferredView` with valid type `preferredView` → falls back to type's preference
- Invalid item `preferredView` and invalid type `preferredView` → falls back to type-chain lookup
- Explicit `viewId` parameter still takes precedence over everything

#### Task 1.2: Add `getEffectiveView` Method

```javascript
// Get the view that would be used for a specific item (full preference hierarchy)
async getEffectiveView(itemId) {
  const item = await this.kernel.storage.get(itemId);
  return await this.resolveView(item);
}

// Get the type-level preferred view (for showing in modal)
async getTypePreferredView(typeId) {
  try {
    const typeItem = await this.kernel.storage.get(typeId);
    if (typeItem.preferredView) {
      return await this.kernel.storage.get(typeItem.preferredView);
    }
  } catch (e) {
    // Fall through
  }
  return await this.findView(typeId);
}
```

**Testing:**
- `getEffectiveView` returns item's preferred view when set
- `getEffectiveView` returns type's preferred view when item has no preference
- `getEffectiveView` returns type-chain view when neither preference exists
- `getTypePreferredView` returns type's preferred view when set
- `getTypePreferredView` returns first-found view when no preference set

---

### Phase 2: API Extensions

**Goal:** Provide clean API methods for setting/clearing preferences at both levels.

Since both item-level and type-level preferences use the same `preferredView` field, the API can be unified. The `setPreferredView` method works on any item, including type definitions.

#### Task 2.1: Add Preference Methods to Renderer API

**File:** `kernel-rendering` item, in `createRendererAPI` method

```javascript
// Set preferred view for any item (works for both regular items and type definitions)
setPreferredView: async (itemId, viewId) => {
  const item = await kernel.storage.get(itemId);
  if (viewId) {
    item.preferredView = viewId;
  } else {
    delete item.preferredView;
  }
  item.modified = Date.now();
  await kernel.saveItem(item);

  // If this is a type definition, re-render all items of this type
  if (item.type === kernel.IDS.TYPE_DEFINITION) {
    await rendering.rerenderByType(itemId);
  } else {
    await rendering.rerenderItem(itemId);
  }
},

getPreferredView: async (itemId) => {
  const item = await kernel.storage.get(itemId);
  return item.preferredView || null;
},
```

#### Task 2.2: Add Convenience Method for Type-Level Access

For easier use when you have an item and want to set its type's preference:

```javascript
// Set preferred view for an item's type (convenience method)
setTypePreferredView: async (itemId, viewId) => {
  const item = await kernel.storage.get(itemId);
  const typeItem = await kernel.storage.get(item.type);
  if (viewId) {
    typeItem.preferredView = viewId;
  } else {
    delete typeItem.preferredView;
  }
  typeItem.modified = Date.now();
  await kernel.saveItem(typeItem);
  await rendering.rerenderByType(item.type);
},

getTypePreferredView: async (itemId) => {
  const item = await kernel.storage.get(itemId);
  const typeItem = await kernel.storage.get(item.type);
  return typeItem.preferredView || null;
},
```

#### Task 2.3: Add `rerenderByType` Method

This re-renders all currently-displayed items of a given type (for when type preference changes):

```javascript
// In RenderingSystem class
async rerenderByType(typeId) {
  const instances = this.registry.getAll();
  let updated = 0;

  for (const instance of instances) {
    try {
      const item = await this.kernel.storage.get(instance.itemId);
      // Only re-render if item is of this type AND doesn't have its own preference
      if (item.type === typeId && !item.preferredView) {
        await this.rerenderItem(instance.itemId);
        updated++;
      }
    } catch (e) {
      // Item may have been deleted - skip
    }
  }

  return { updated };
}
```

#### Task 2.4: Add Shared Helper Methods

```javascript
// Get the effective view for an item (full hierarchy)
getEffectiveView: (itemId) => rendering.getEffectiveView(itemId),

// Get the type name for an item (for modal labels)
getTypeName: async (itemId) => {
  const item = await kernel.storage.get(itemId);
  const typeItem = await kernel.storage.get(item.type);
  return typeItem.name || typeItem.id.slice(0, 8);
},

// Get contextual view override (from parent's child spec)
getContextualView: async (itemId, parentId) => {
  if (!parentId) return null;
  const parent = await kernel.storage.get(parentId);
  const childSpec = parent.attachments?.find(c =>
    (typeof c === 'string' ? c : c.id) === itemId
  );
  if (childSpec && typeof childSpec === 'object' && childSpec.view?.type) {
    return childSpec.view.type;
  }
  return null;
},
```

#### Task 2.5: Add to REPL API

**File:** `kernel-core` item, in `createREPLAPI` method

```javascript
// Works for any item (including type definitions)
setPreferredView: async (itemId, viewId) => {
  const item = await kernel.storage.get(itemId);
  if (viewId) {
    item.preferredView = viewId;
  } else {
    delete item.preferredView;
  }
  item.modified = Date.now();
  await kernel.saveItem(item);
  if (kernel.currentRoot) {
    await kernel.renderRoot(kernel.currentRoot);
  }
  return item.preferredView || null;
},

getPreferredView: async (itemId) => {
  const item = await kernel.storage.get(itemId);
  return item.preferredView || null;
},

// Shared
getEffectiveView: (itemId) => kernel.rendering.getEffectiveView(itemId),
```

**Testing:**
- `api.setPreferredView(itemId, viewId)` sets item preference
- `api.setPreferredView(itemId, null)` clears item preference
- `api.setPreferredView(typeId, viewId)` on a type definition sets the type's preference
- `api.setTypePreferredView(itemId, viewId)` sets the preference on the item's type
- `api.getEffectiveView(itemId)` returns the view that would be used
- Setting type preference triggers re-render of affected items

---

### Phase 3: Context Menu and Modal Integration

**Goal:** Add "View As..." submenu and "View Settings..." modal to the context menu.

#### Task 3.1: Add "View As..." Submenu (Contextual Override)

**File:** `viewport_view` item

This may already exist. Ensure it sets the contextual override (parent's child spec or viewport.rootViewId).

```javascript
async function buildViewAsSubmenu(itemId, api, context) {
  const item = await api.get(itemId);
  const views = await api.getViews(item.type);
  const currentContextual = await api.getContextualView(itemId, context.parentId);

  const menuItems = views.map(({ view, inherited, isDefault }) => ({
    label: view.name + (inherited ? ' (inherited)' : '') + (isDefault ? ' (fallback)' : ''),
    checked: view.id === currentContextual,
    action: async () => {
      await api.setContextualView(itemId, view.id, context);
    }
  }));

  // Add "Clear" option if there's a contextual override
  if (currentContextual) {
    menuItems.push({ separator: true });
    menuItems.push({
      label: 'Clear Override',
      action: async () => {
        await api.setContextualView(itemId, null, context);
      }
    });
  }

  return {
    label: 'View As...',
    submenu: menuItems
  };
}
```

#### Task 3.2: Add "View Settings..." Menu Item

```javascript
menuItems.push({
  label: 'View Settings...',
  action: async () => {
    await showViewSettingsModal(itemId, api, context);
  }
});
```

#### Task 3.3: Implement View Settings Modal

```javascript
async function showViewSettingsModal(itemId, api, context) {
  const item = await api.get(itemId);
  const typeItem = await api.get(item.type);
  const typeName = typeItem.name || 'item';
  const views = await api.getViews(item.type);
  const effectiveView = await api.getEffectiveView(itemId);

  // Get current values at each level
  const contextualViewId = await api.getContextualView(itemId, context.parentId);
  const itemPreferredViewId = item.preferredView || null;
  const typePreferredViewId = typeItem.preferredView || null;

  // Build modal content
  const modal = document.createElement('div');
  modal.className = 'view-settings-modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>View Settings for "${item.name || item.id.slice(0, 8)}"</h3>
        <button class="modal-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="current-view">
          Currently showing: <strong>${effectiveView.name}</strong>
        </div>

        <hr>

        <div class="setting-section">
          <div class="setting-label">In this context</div>
          <div class="setting-description">
            Override for this location only (set via "View As..." menu)
          </div>
          <div class="setting-control">
            <span class="current-value">${contextualViewId ? (await api.get(contextualViewId)).name : 'None'}</span>
            ${contextualViewId ? '<button class="clear-btn" data-level="context">Clear</button>' : ''}
          </div>
        </div>

        <hr>

        <div class="setting-section">
          <div class="setting-label">For this item</div>
          <div class="setting-description">
            Default view wherever this item appears
          </div>
          <div class="setting-control">
            <select data-level="item">
              <option value="">None</option>
              ${views.map(({ view }) =>
                `<option value="${view.id}" ${view.id === itemPreferredViewId ? 'selected' : ''}>${view.name}</option>`
              ).join('')}
            </select>
            ${itemPreferredViewId ? '<button class="clear-btn" data-level="item">Clear</button>' : ''}
          </div>
        </div>

        <hr>

        <div class="setting-section">
          <div class="setting-label">For all ${typeName}s</div>
          <div class="setting-description">
            Default view for items of this type
          </div>
          <div class="setting-control">
            <select data-level="type">
              <option value="">None</option>
              ${views.map(({ view }) =>
                `<option value="${view.id}" ${view.id === typePreferredViewId ? 'selected' : ''}>${view.name}</option>`
              ).join('')}
            </select>
            ${typePreferredViewId ? '<button class="clear-btn" data-level="type">Clear</button>' : ''}
          </div>
        </div>

        <hr>

        <div class="resolution-note">
          Resolution order: context → item → type → system
        </div>
      </div>
    </div>
  `;

  // Event handlers
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.querySelector('.modal-overlay').onclick = () => modal.remove();

  modal.querySelector('select[data-level="item"]').onchange = async (e) => {
    await api.setPreferredView(itemId, e.target.value || null);
    modal.remove();
    await showViewSettingsModal(itemId, api, context); // Refresh
  };

  modal.querySelector('select[data-level="type"]').onchange = async (e) => {
    await api.setPreferredView(item.type, e.target.value || null);
    modal.remove();
    await showViewSettingsModal(itemId, api, context); // Refresh
  };

  modal.querySelectorAll('.clear-btn').forEach(btn => {
    btn.onclick = async () => {
      const level = btn.dataset.level;
      if (level === 'context') {
        await api.setContextualView(itemId, null, context);
      } else if (level === 'item') {
        await api.setPreferredView(itemId, null);
      } else if (level === 'type') {
        await api.setPreferredView(item.type, null);
      }
      modal.remove();
      await showViewSettingsModal(itemId, api, context); // Refresh
    };
  });

  document.body.appendChild(modal);
}
```

#### Task 3.4: Add Modal Styles

```css
.view-settings-modal .modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.view-settings-modal .modal-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
  z-index: 1001;
}

.view-settings-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.view-settings-modal .modal-body {
  padding: 16px;
}

.view-settings-modal .setting-section {
  margin: 12px 0;
}

.view-settings-modal .setting-label {
  font-weight: 600;
  margin-bottom: 4px;
}

.view-settings-modal .setting-description {
  font-size: 0.85em;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.view-settings-modal .setting-control {
  display: flex;
  gap: 8px;
  align-items: center;
}

.view-settings-modal .resolution-note {
  font-size: 0.85em;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 12px;
}
```

**Testing:**
- "View As..." submenu appears and works (contextual override)
- "View Settings..." opens the modal
- Modal displays current values at all three levels
- Modal shows effective view at top
- Selecting from dropdowns updates preferences
- Clear buttons remove preferences
- Modal refreshes after changes
- Resolution order note is visible

---

### Phase 4: Edge Cases and Robustness

#### Task 4.1: Handle Deleted Views

If a `preferredView` references a deleted view, the system should gracefully fall back.

**Already handled in Task 1.1:** The `try/catch` around loading views handles this case, falling through the hierarchy.

#### Task 4.2: Handle Type Mismatch

What if `preferredView` points to a view not designed for this type?

**Recommendation:** Allow it (trust the user). Rationale:
- Users have intentionally set this preference
- Views are generally robust to unexpected item types
- Enables creative use cases (viewing any item as JSON, any item as container)
- Consistent with "View As..." which already allows arbitrary view selection

#### Task 4.3: Interaction with Contextual Overrides

The resolution order ensures contextual overrides (explicit viewId, parent's child spec) always take precedence:

1. `renderItem(id, explicitViewId)` → uses explicitViewId
2. Parent's `child.view.type` → passed as explicitViewId
3. Then preferences are consulted

**Testing:**
- Item with `preferredView` in container with `view.type` override → uses container's override
- Item with `preferredView` as viewport root with `rootViewId` → uses viewport's override
- Clearing contextual override → falls back to item preference → type preference → type chain

#### Task 4.4: Type Hierarchy and preferredView

Should `preferredView` on type definitions inherit through the type chain? E.g., if `note` type has no `preferredView` but its parent type does?

**Recommendation:** No inheritance for now. Rationale:
- Keeps the model simple
- Type-chain inheritance already happens at the view level (views can have `for_type` on parent types)
- User sets `preferredView` on the specific type they care about
- Can add inheritance later if needed

#### Task 4.5: Type Definition's Own View

Edge case: Setting `preferredView` on a type definition affects how items of that type are viewed, NOT how the type definition itself is viewed.

If a user wants to set a preferred view for viewing the type definition item itself (e.g., always show the "note" type definition as JSON), this conflicts with the type-level preference.

**Recommendation:** Accept this limitation. Rationale:
- Rare use case
- Users can use "View As..." contextual override for this
- Adding a separate field (e.g., `selfPreferredView`) adds complexity for minimal benefit

---

## Testing Checklist

### Kernel Behavior
- [ ] Item without preferences → type-chain lookup (existing behavior preserved)
- [ ] Item with `preferredView` → uses that view
- [ ] Item without `preferredView`, type has `preferredView` → uses type's preference
- [ ] Item with `preferredView`, type has `preferredView` → uses item's preference (item wins)
- [ ] Invalid item `preferredView`, valid type `preferredView` → uses type's preference
- [ ] Invalid item `preferredView`, invalid type `preferredView` → type-chain lookup
- [ ] Explicit `viewId` parameter overrides everything
- [ ] Parent's `child.view.type` overrides preferences

### API
- [ ] `api.setPreferredView(itemId, viewId)` sets the field on any item
- [ ] `api.setPreferredView(itemId, null)` clears the field
- [ ] `api.setPreferredView(typeId, viewId)` on a type definition sets type preference
- [ ] `api.getPreferredView(id)` returns preference or null
- [ ] Setting item preference triggers re-render of that item
- [ ] Setting type preference triggers re-render of affected items (those without item preferences)
- [ ] `api.getEffectiveView(id)` returns correct view through hierarchy
- [ ] `api.getContextualView(itemId, parentId)` returns contextual override or null

### Context Menu - View As...
- [ ] "View As..." submenu appears
- [ ] Shows all applicable views
- [ ] Current contextual override has checkmark
- [ ] Selecting a view sets contextual override
- [ ] "Clear Override" appears only when set
- [ ] Clearing override works

### View Settings Modal
- [ ] "View Settings..." menu item opens modal
- [ ] Modal shows item name in header
- [ ] Modal shows current effective view
- [ ] "In this context" section shows contextual override (read-only with Clear button)
- [ ] "For this item" dropdown shows current preference
- [ ] "For all [Type]s" dropdown shows type preference with correct type name
- [ ] Selecting from item dropdown updates item preference
- [ ] Selecting from type dropdown updates type preference
- [ ] Clear buttons remove preferences at each level
- [ ] Modal refreshes after changes
- [ ] Resolution order note is visible

### Edge Cases
- [ ] Deleted view falls back gracefully at both levels
- [ ] Type-mismatched view still renders (user's choice)
- [ ] Contextual overrides take precedence over both preference levels
- [ ] Nested items respect the full hierarchy
- [ ] Type definition's `preferredView` affects items of that type, not the type definition itself

---

## Rollout Plan

### Step 1: Kernel Changes (Low Risk)
Modify `kernel-rendering` with `resolveView` method. Backward compatible—items without preferences behave exactly as before.

### Step 2: API Additions (Low Risk)
Add new API methods. These are additive and don't change existing behavior.

### Step 3: View As... Submenu (Low Risk)
Ensure "View As..." submenu exists and works for contextual overrides. May already be implemented.

### Step 4: View Settings Modal (Medium Risk)
Add "View Settings..." menu item and implement modal. Includes `rerenderByType` which affects multiple items.

### Step 5: Documentation
Update System_Architecture.md to document:
- The `preferredView` field (used on both items and type definitions)
- The complete view resolution order
- The distinction between contextual override, item preference, and type preference

---

## Summary

| Aspect | Decision |
|--------|----------|
| **Preference storage** | Top-level `preferredView` field (same name on both items and type definitions) |
| **Resolution order** | explicit viewId > parent override > item.preferredView > type.preferredView > type-chain > default |
| **UX** | "View As..." submenu for quick contextual switching; "View Settings..." modal for item/type preferences |
| **Invalid preference** | Graceful fallback through hierarchy |
| **Type mismatch** | Allowed (trust user intent) |
| **Type inheritance** | No inheritance of `preferredView` through type chain (keep it simple) |
| **Edge case** | Type definition's `preferredView` sets type's preference, not how to view the type definition itself |
| **Complexity** | ~80 lines kernel change, ~150 lines modal implementation |

This design provides flexibility at two orthogonal levels while maintaining backward compatibility and aligning with Hobson's philosophy of user control and data-as-configuration. The unified `preferredView` field name keeps the model simple, with meaning determined by context (item vs type definition).
