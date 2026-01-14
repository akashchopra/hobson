// Migrate existing notes from content.body to content.description
// This implements backward compatibility for the Description Property Design spec

const NOTE_TYPE_ID = '871ae771-b9b1-4f40-8c7f-d9038bfb69c3';

// Get all note items
const notes = await api.query({ type: NOTE_TYPE_ID });

console.log(`Found ${notes.length} note items`);

let migratedCount = 0;
let skippedCount = 0;

for (const note of notes) {
  // Check if this note has content.body (old format)
  if (note.content.body !== undefined) {
    console.log(`\nMigrating: ${note.name || note.id}`);
    console.log(`  Has body: ${note.content.body ? 'yes' : 'empty'}`);
    console.log(`  Has description: ${note.content.description ? 'yes' : 'no'}`);

    // Migrate: move body to description
    const updated = {
      ...note,
      content: {
        ...note.content,
        description: note.content.body
      }
    };

    // Remove the old body field
    delete updated.content.body;

    await api.set(updated);
    migratedCount++;
    console.log(`  ✓ Migrated`);
  } else if (note.content.description !== undefined) {
    console.log(`\nSkipping: ${note.name || note.id} (already uses description)`);
    skippedCount++;
  } else {
    console.log(`\nWarning: ${note.name || note.id} has neither body nor description`);
    skippedCount++;
  }
}

console.log(`\n=== Migration Complete ===`);
console.log(`Migrated: ${migratedCount} notes`);
console.log(`Skipped: ${skippedCount} notes`);
console.log(`\nAll notes now use content.description!`);
