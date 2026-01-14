// Script to create "My Notes" container
// Run this AFTER creating tag_browser and note_search instances
// You'll need the IDs of your tag browser and note search instances

// If you don't have them yet, you can look them up:
// const tagBrowsers = await api.query({ type: 'your-tag-browser-type-id' });
// const searches = await api.query({ type: 'your-note-search-type-id' });

// === CONFIGURATION ===
// Replace these with your actual instance IDs:
const TAG_BROWSER_INSTANCE_ID = 'YOUR_TAG_BROWSER_ID_HERE';
const NOTE_SEARCH_INSTANCE_ID = 'YOUR_NOTE_SEARCH_ID_HERE';

if (TAG_BROWSER_INSTANCE_ID === 'YOUR_TAG_BROWSER_ID_HERE' ||
    NOTE_SEARCH_INSTANCE_ID === 'YOUR_NOTE_SEARCH_ID_HERE') {
  console.error('⚠️  Please edit this script and set the correct instance IDs!');
  console.log('');
  console.log('To find your tag browser ID, run:');
  console.log('  const tagBrowserType = (await api.getAll()).find(i => i.name === "tag_browser");');
  console.log('  const tagBrowsers = await api.query({ type: tagBrowserType.id });');
  console.log('  console.log(tagBrowsers);');
  console.log('');
  console.log('To find your note search ID, run:');
  console.log('  const noteSearchType = (await api.getAll()).find(i => i.name === "note_search");');
  console.log('  const searches = await api.query({ type: noteSearchType.id });');
  console.log('  console.log(searches);');
  throw new Error('Configuration required');
}

// Create "My Notes" container
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
      id: TAG_BROWSER_INSTANCE_ID,
      x: 20,
      y: 20,
      width: 280,
      height: 700,
      z: 0,
      pinned: true
    },
    // Note search on the right
    {
      id: NOTE_SEARCH_INSTANCE_ID,
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
console.log('The container includes:');
console.log('  - Tag browser (left side, 280px wide)');
console.log('  - Note search (right side, 700px wide)');
console.log('');
console.log('To view it, navigate to:', myNotesId);
console.log('');
console.log('You can now:');
console.log('  1. Browse tags in the left panel');
console.log('  2. Search for items in the right panel');
console.log('  3. Create new notes and tag them');
console.log('  4. Click tags or search results to open items');
