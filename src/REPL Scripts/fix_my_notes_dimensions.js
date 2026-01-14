// Script to fix "My Notes" container dimensions
// Run this in the Hobson REPL

// Find the My Notes container
const allItems = await api.getAll();
const myNotes = allItems.find(i => i.name === 'my_notes');

if (!myNotes) {
  console.error('⚠️  My Notes container not found!');
  throw new Error('Container not found');
}

console.log('Found My Notes container:', myNotes.id);

// Update with better dimensions that fit in viewport
const updated = {
  ...myNotes,
  children: myNotes.children.map(child => {
    return {
      ...child,
      height: 500  // Reduced from 700 to 500
    };
  })
};

await api.set(updated);

console.log('✓ Updated My Notes dimensions!');
console.log('  - Tag browser: 280px × 500px');
console.log('  - Search: 700px × 500px');
console.log('');
console.log('Reload the page to see the changes.');
console.log('Items should now fit within the container without overflow.');
