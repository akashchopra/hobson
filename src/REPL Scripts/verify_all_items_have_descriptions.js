// Verify that ALL items have content.description
// Comprehensive check for Description Property Design compliance

console.log('=== Comprehensive Description Property Verification ===\n');

// Get all items
const allItems = await api.query({});
console.log(`Checking ${allItems.length} items...\n`);

let compliantCount = 0;
let missingCount = 0;
let emptyCount = 0;
const missingItems = [];

for (const item of allItems) {
  const hasDescription = item.content && item.content.description !== undefined;
  const isEmpty = hasDescription && item.content.description.trim() === '';

  if (!hasDescription) {
    missingCount++;
    missingItems.push({
      id: item.id,
      name: item.name || '(unnamed)',
      type: item.type
    });
  } else if (isEmpty) {
    emptyCount++;
    console.log(`⚠ Empty description: ${item.name || item.id.substring(0, 8)}`);
  } else {
    compliantCount++;
  }
}

// Report results
console.log('\n=== Results ===');
console.log(`✓ Items with descriptions: ${compliantCount}`);
console.log(`✗ Missing descriptions: ${missingCount}`);
console.log(`⚠ Empty descriptions: ${emptyCount}`);

if (missingItems.length > 0) {
  console.log('\n=== Items Missing Descriptions ===');
  for (const item of missingItems.slice(0, 20)) {
    console.log(`  - ${item.name} (${item.id.substring(0, 8)}...) [type: ${item.type.substring(0, 8)}...]`);
  }
  if (missingItems.length > 20) {
    console.log(`  ... and ${missingItems.length - 20} more`);
  }
}

// Summary
console.log('\n=== Summary ===');
if (missingCount === 0 && emptyCount === 0) {
  console.log('✓✓✓ PERFECT! All items have non-empty descriptions!');
  console.log('✓ The Description Property Design is fully implemented.');
} else if (missingCount === 0) {
  console.log('✓ All items have descriptions (some are empty)');
  console.log('Consider adding more meaningful descriptions to empty ones.');
} else {
  console.log(`✗ ${missingCount} items need descriptions`);
  console.log('\nRun: add_descriptions_to_all_items.js');
}
