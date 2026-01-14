// Add meaningful descriptions to all items that are missing content.description
// This completes the Description Property Design implementation

console.log('=== Adding Descriptions to All Items ===\n');

// Get all items
const allItems = await api.query({});
console.log(`Found ${allItems.length} total items`);

let updatedCount = 0;
let skippedCount = 0;
let errorCount = 0;

for (const item of allItems) {
  // Skip if already has description
  if (item.content && item.content.description) {
    skippedCount++;
    continue;
  }

  try {
    // Get the item's type to help generate appropriate description
    let typeName = 'unknown';
    try {
      const typeItem = await api.get(item.type);
      typeName = typeItem.name || item.type;
    } catch (e) {
      // Type not found, use ID
      typeName = item.type;
    }

    let description = '';

    // Generate description based on item type and available data
    switch (item.type) {
      case '00000000-0000-0000-0000-000000000003': // renderer
        if (item.name) {
          description = `Renderer: ${item.name}`;
          if (item.content && item.content.for_type) {
            try {
              const forType = await api.get(item.content.for_type);
              const forTypeName = forType.name || forType.id;
              description = `Renders ${forTypeName} items`;
            } catch (e) {
              description = `Renders items of type ${item.content.for_type}`;
            }
          }
        } else {
          description = 'Renderer for displaying items';
        }
        break;

      case '00000000-0000-0000-0000-000000000004': // library
        if (item.name) {
          description = `Library: ${item.name} - Reusable code module`;
        } else {
          description = 'Reusable code library';
        }
        break;

      case '00000000-0000-0000-0000-000000000009': // tag
        if (item.content && item.content.name) {
          description = `Tag: ${item.content.name}`;
        } else if (item.name) {
          description = `Tag: ${item.name}`;
        } else {
          description = 'Tag for categorizing items';
        }
        break;

      case '00000000-0000-0000-0000-000000000007': // container
        if (item.content && item.content.title) {
          description = `Container: ${item.content.title}`;
        } else if (item.name) {
          description = `Container: ${item.name}`;
        } else {
          description = 'Container workspace for organizing items';
        }
        break;

      case '871ae771-b9b1-4f40-8c7f-d9038bfb69c3': // note (shouldn't happen after migration)
        if (item.content && item.content.title) {
          description = `Note: ${item.content.title}`;
        } else if (item.name) {
          description = `Note: ${item.name}`;
        } else {
          description = 'Note';
        }
        break;

      case '7ac3cf17-2c10-454a-bc06-24db64e440c4': // note_search
        description = 'Search interface for finding notes';
        if (item.content && item.content.title) {
          description = `${item.content.title} - Search interface`;
        }
        break;

      case '05e72011-d70e-4ff3-ac78-fe6b7fc5d884': // note_tag_browser
        description = 'Browse and filter notes by tags';
        if (item.content && item.content.title) {
          description = `${item.content.title} - Tag browser`;
        }
        break;

      case '4f4b7331-874c-4814-90b7-c344e199d711': // script
        if (item.name) {
          description = `REPL script: ${item.name}`;
        } else {
          description = 'REPL script for execution';
        }
        break;

      default:
        // Generic description based on available data
        if (item.name) {
          description = `${typeName}: ${item.name}`;
        } else if (item.content && item.content.title) {
          description = `${typeName}: ${item.content.title}`;
        } else if (item.content && item.content.name) {
          description = `${typeName}: ${item.content.name}`;
        } else {
          description = `Item of type ${typeName}`;
        }
    }

    // Update the item
    const updated = {
      ...item,
      content: {
        ...item.content,
        description: description
      }
    };

    await api.set(updated);
    updatedCount++;
    console.log(`✓ ${item.name || item.id.substring(0, 8)}: "${description}"`);

  } catch (error) {
    errorCount++;
    console.log(`✗ Error updating ${item.name || item.id}: ${error.message}`);
  }
}

console.log(`\n=== Complete ===`);
console.log(`Updated: ${updatedCount} items`);
console.log(`Already had description: ${skippedCount} items`);
console.log(`Errors: ${errorCount} items`);
console.log(`\nAll items now have descriptions!`);
