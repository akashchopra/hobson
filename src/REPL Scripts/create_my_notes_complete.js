// All-in-one script to create "My Notes" workspace
// This creates tag browser, note search, and combines them in a container
// Run this in the Hobson REPL

console.log('Creating "My Notes" workspace...');
console.log('');

// Step 1: Find existing tag_browser and note_search types (or IDs from previous scripts)
const allItems = await api.getAll();
const tagBrowserType = allItems.find(i => i.name === 'tag_browser');
const noteSearchType = allItems.find(i => i.name === 'note_search');

if (!tagBrowserType) {
  console.error('⚠️  Tag browser type not found! Run create_tag_browser.js first.');
  throw new Error('Missing tag_browser type');
}

if (!noteSearchType) {
  console.error('⚠️  Note search type not found! Run create_note_search.js first.');
  throw new Error('Missing note_search type');
}

console.log('✓ Found tag_browser type:', tagBrowserType.id);
console.log('✓ Found note_search type:', noteSearchType.id);
console.log('');

// Step 2: Create new instances for the container
const tagBrowserInstanceId = crypto.randomUUID();
await api.set({
  id: tagBrowserInstanceId,
  name: 'my_notes_tag_browser',
  type: tagBrowserType.id,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    title: 'Tags'
  }
});
console.log('✓ Created tag browser instance:', tagBrowserInstanceId);

const noteSearchInstanceId = crypto.randomUUID();
await api.set({
  id: noteSearchInstanceId,
  name: 'my_notes_search',
  type: noteSearchType.id,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    title: 'Search'
  }
});
console.log('✓ Created note search instance:', noteSearchInstanceId);
console.log('');

// Step 3: Create "My Notes" container with both items
const myNotesId = crypto.randomUUID();
await api.set({
  id: myNotesId,
  name: 'my_notes',
  type: api.IDS.CONTAINER,
  created: Date.now(),
  modified: Date.now(),
  children: [
    // Tag browser on the left
    {
      id: tagBrowserInstanceId,
      x: 20,
      y: 20,
      width: 280,
      height: 700,
      z: 0,
      pinned: true
    },
    // Note search on the right
    {
      id: noteSearchInstanceId,
      x: 320,
      y: 20,
      width: 700,
      height: 700,
      z: 0,
      pinned: true
    }
  ],
  content: {
    title: 'My Notes',
    description: 'Note-taking workspace with tag browser and search'
  }
});

console.log('✓ Created "My Notes" container:', myNotesId);
console.log('');
console.log('========================================');
console.log('SUCCESS! "My Notes" workspace created.');
console.log('========================================');
console.log('');
console.log('The workspace includes:');
console.log('  - Tag browser (left panel, hierarchical tag tree)');
console.log('  - Note search (right panel, full-text search)');
console.log('');
console.log('To view it, navigate to:', myNotesId);
console.log('');
console.log('Or run: api.open("' + myNotesId + '")');
console.log('');
console.log('You can now:');
console.log('  1. Browse tags (click to expand/collapse hierarchy)');
console.log('  2. Click tags to see tagged items');
console.log('  3. Search for items by text');
console.log('  4. Click results to open them as windows');
console.log('  5. Create new notes and tag them');
