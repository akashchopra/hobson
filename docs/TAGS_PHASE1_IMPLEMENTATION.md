# Tags Phase 1 Implementation

## Overview

Phase 1 of the Tags and Classification system has been implemented. This includes:

1. **Tag type seed item** - A new type for classification tags
2. **Tags property at top level** - Items can now have a `tags` array property
3. **Note renderer with tag support** - Notes can display and edit tags
4. **Tag browser** - A new item type for browsing and filtering items by tags
5. **Sample tags** - Helper script to create example tags

## What Changed

### 1. Core System Changes (hobson.html)

**Added Tag Type Seed Item:**
- New seed item with ID `00000000-0000-0000-0000-000000000009`
- Name: `tag`
- Type: `type_definition`
- Added `api.IDS.TAG` constant for easy reference

**Item Structure:**
- Items now support a `tags` property at the top level (sibling to `children`)
- Structure: `tags: ["tag-id-1", "tag-id-2"]`
- No validation changes needed - the system already allows arbitrary top-level properties

### 2. Note Renderer Update

The note renderer (`625850e6-d7ae-49ac-a1e0-452137523a3a`) now includes:
- A tags input field in the header section
- Displays current tags as comma-separated IDs
- Allows editing tags through a text input
- Updates the `item.tags` array (not `item.content.tags`)

### 3. Tag Browser

New item type and renderer for browsing tags:
- Displays all tag items as a flat list (sorted by name)
- Each tag shows its name, color indicator, and ID
- Clicking a tag:
  - Finds all items with that tag
  - Displays results in a list below
  - Clicking a result opens it as a sibling window
  - Also logs matching items to console
- Color-coded tags for visual distinction

## Setup Instructions

Since Hobson is already bootstrapped, follow these steps to activate the new features:

### Step 1: Reload Hobson

1. Close your browser tab with Hobson
2. Open `src/hobson.html` in your browser fresh
3. This will load the new tag type seed item (00000000-0000-0000-0000-000000000009)

### Step 2: Update Note Renderer

In the Hobson REPL, run:

```javascript
// Copy and paste the contents of /tmp/update_note_renderer.js
// Or run it directly if you have file access
```

This will update your existing note renderer to support tags.

### Step 3: Create Tag Browser

In the Hobson REPL, run:

```javascript
// Copy and paste the contents of /tmp/create_tag_browser.js
```

This will create:
- `tag_browser` type definition
- `tag_browser_renderer`
- A sample tag browser instance named `my_tag_browser`

The script will output the IDs. Save the tag browser instance ID to navigate to it later.

### Step 4: Create Sample Tags

In the Hobson REPL, run:

```javascript
// Copy and paste the contents of /tmp/create_sample_tags.js
```

This will create 5 sample tags:
- **work** (blue) - Work-related items
- **personal** (green) - Personal items
- **urgent** (red) - Urgent items needing attention
- **project** (purple) - Project-related items
- **idea** (orange) - Ideas and brainstorming

The script will output the tag IDs for your reference.

### Step 5: Tag Some Notes

1. Navigate to an existing note (e.g., "my_first_note")
2. You'll see a new "Tags" field in the header
3. Paste in one or more tag IDs (comma-separated)
4. Example: `abc-123-def, xyz-789-ghi`
5. The tags will be saved to `item.tags` array

### Step 6: Test the Tag Browser

1. Navigate to the tag browser instance ID from Step 3
2. You should see your 5 sample tags displayed
3. Click on a tag (e.g., "urgent")
4. You'll see a list of items with that tag
5. Click on an item to open it as a window
6. Check the console for logged matching items

## Usage Examples

### Creating a New Tag Manually

```javascript
const tagId = crypto.randomUUID();
await api.set({
  id: tagId,
  name: 'important',
  type: api.IDS.TAG,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    name: 'important',
    color: '#dc2626',
    description: 'Important items',
    parent: null
  }
});
console.log('Tag ID:', tagId);
```

### Tagging a Note

```javascript
const noteId = 'your-note-id';
const note = await api.get(noteId);
const updated = {
  ...note,
  tags: ['tag-id-1', 'tag-id-2']
};
await api.set(updated);
```

### Finding Items by Tag

```javascript
const tagId = 'your-tag-id';
const allItems = await api.getAll();
const tagged = allItems.filter(item =>
  item.tags && item.tags.includes(tagId)
);
console.log('Tagged items:', tagged);
```

## Item Structure Reference

### Tag Item
```javascript
{
  id: "uuid",
  name: "work",
  type: "00000000-0000-0000-0000-000000000009",  // TAG type
  created: timestamp,
  modified: timestamp,
  children: [],
  content: {
    name: "work",
    color: "#3b82f6",
    description: "Work-related items",
    parent: null  // For future hierarchy support
  }
}
```

### Note with Tags
```javascript
{
  id: "uuid",
  name: "my_note",
  type: "871ae771-b9b1-4f40-8c7f-d9038bfb69c3",  // note type
  created: timestamp,
  modified: timestamp,
  children: [],
  tags: ["tag-id-1", "tag-id-2"],  // ← Tags at top level, not in content!
  content: {
    title: "My Note",
    body: "# Note content..."
  }
}
```

### Tag Browser
```javascript
{
  id: "uuid",
  name: "my_tag_browser",
  type: "tag-browser-type-id",
  created: timestamp,
  modified: timestamp,
  children: [],
  content: {
    title: "Browse by Tag",
    target_container: null  // Future: filter to specific container
  }
}
```

## What's NOT Included (Phase 2+)

Phase 1 is intentionally minimal. The following are planned for later phases:

- **Hierarchy**: Tag parent/child relationships (foundation exists, not implemented)
- **Better tag editing UI**: Pills, auto-complete, visual selector (currently just text input)
- **Tag metadata rendering**: Colors and descriptions in note renderer (currently only in browser)
- **Note search**: Full-text search complementing tag browsing
- **Implicit tag creation**: Auto-creating tags when typing unknown names
- **Advanced queries**: AND/OR filtering, descendant queries
- **"My Notes" container**: Integrated workspace with browser + search + notes

## Testing Checklist

- [ ] Reload Hobson and verify tag type seed item exists (check `api.IDS.TAG`)
- [ ] Update note renderer (run script)
- [ ] Create tag browser (run script, save instance ID)
- [ ] Create sample tags (run script, save tag IDs)
- [ ] Navigate to an existing note and add tags via text field
- [ ] Navigate to tag browser and see your sample tags
- [ ] Click a tag with no items (should show "No items found")
- [ ] Tag a note with one of the sample tags
- [ ] Click that tag in browser (should show the note)
- [ ] Click the note in results (should open as sibling window)
- [ ] Check console for logged matching items
- [ ] Verify tags persist after reload

## Troubleshooting

**Q: I don't see the tags field in my note**
- Make sure you ran the update_note_renderer.js script
- Reload the page after updating the renderer
- Check that you're viewing a note item (type: `871ae771-b9b1-4f40-8c7f-d9038bfb69c3`)

**Q: Tag browser shows "No tags found"**
- Make sure you ran create_sample_tags.js
- Verify tag type exists: `await api.get(api.IDS.TAG)`
- Check created tags: `await api.query({ type: api.IDS.TAG })`

**Q: Clicking tag shows no items**
- This is expected if you haven't tagged any items yet
- Tag some notes first using the tags input field

**Q: Tags aren't persisting**
- Check console for errors
- Verify tags are saved: `await api.get('your-note-id')`
- Make sure tags are at top level, not in `content`

**Q: Can't find tag IDs to paste into notes**
- Run: `await api.query({ type: api.IDS.TAG })` to see all tags
- Or check the console output from create_sample_tags.js

## Next Steps

Once Phase 1 is working, consider:

1. **Create more tags** based on your needs
2. **Tag existing notes** to build up your classification system
3. **Add tag browser to workspace** for easy access
4. **Experiment with tag colors** to visually distinguish categories
5. **Plan Phase 2** - hierarchy and better UI

## Files Created

All implementation files are in `/tmp/`:
- `/tmp/update_note_renderer.js` - Updates existing note renderer with tags
- `/tmp/create_tag_browser.js` - Creates tag browser type, renderer, and instance
- `/tmp/create_sample_tags.js` - Creates 5 sample tags
- `/tmp/TAGS_PHASE1_IMPLEMENTATION.md` - This document

## Architecture Notes

**Why tags at top level?**
- User specified this location (not in `content`)
- Makes tags universal across all item types
- Consistent with other top-level properties like `children`
- No nesting means simpler queries

**Why comma-separated IDs in UI?**
- Phase 1 MVP approach
- Proves the concept works
- Easy to implement
- Can be enhanced with better UI in Phase 2+

**Why flat list in browser?**
- Phase 1 MVP approach
- Hierarchy foundation exists but not implemented yet
- Tree view comes in Phase 2

**Why both console log and results display?**
- Console logging was specified in Phase 1 plan
- Results display was specified in Phase 4 enhancement
- Both included for better UX
