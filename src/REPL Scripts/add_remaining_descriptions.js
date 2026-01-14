// Add descriptions to the remaining items that were missed
// Targeted script for specific items

console.log('=== Adding Remaining Descriptions ===\n');

// Map of item names to their descriptions
const descriptions = {
  'default_renderer': 'Default fallback renderer for all item types',
  'container_renderer': 'Renders container/workspace items with spatial layout',
  'tag_browser_renderer': 'Renders the tag browser interface for filtering items',
  'code_renderer': 'Renders code items with syntax highlighting and execution controls',
  'note_renderer': 'Renders note items with markdown support and tag editing',
  'note_search_renderer': 'Renders the note search interface',
  'script_renderer': 'Renders REPL script items with execution controls',
  'marked': 'Markdown parsing library (marked.js)',
  'my_note_search': 'Note search interface instance',
  'my_notes_search': 'Note search interface instance',
  'my_tag_browser': 'Tag browser interface instance',
  'my_notes_tag_browser': 'Tag browser interface instance for notes'
};

let updated = 0;
let notFound = 0;

for (const [itemName, description] of Object.entries(descriptions)) {
  try {
    // Try to find the item by name
    const items = await api.query({});
    const item = items.find(i => i.name === itemName);

    if (!item) {
      console.log(`✗ Not found: ${itemName}`);
      notFound++;
      continue;
    }

    // Check if it already has a description
    if (item.content && item.content.description) {
      console.log(`⊘ Already has description: ${itemName}`);
      continue;
    }

    // Add the description
    const updatedItem = {
      ...item,
      content: {
        ...item.content,
        description: description
      }
    };

    await api.set(updatedItem);
    console.log(`✓ ${itemName}: "${description}"`);
    updated++;

  } catch (error) {
    console.log(`✗ Error updating ${itemName}: ${error.message}`);
  }
}

console.log(`\n=== Complete ===`);
console.log(`Updated: ${updated} items`);
console.log(`Not found: ${notFound} items`);

if (updated > 0) {
  console.log('\nRun verify_all_items_have_descriptions.js to check!');
}
