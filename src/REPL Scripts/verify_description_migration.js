// Verify that the description property migration was successful
// This checks that all notes use content.description and the renderer is updated

const NOTE_TYPE_ID = '871ae771-b9b1-4f40-8c7f-d9038bfb69c3';
const RENDERER_ID = '625850e6-d7ae-49ac-a1e0-452137523a3a';

console.log('=== Description Property Migration Verification ===\n');

// Check renderer
console.log('1. Checking note_renderer...');
const renderer = await api.get(RENDERER_ID);
const usesDescription = renderer.content.code.includes('content.description');
const usesBody = renderer.content.code.includes('content.body');

console.log(`   Uses content.description: ${usesDescription ? '✓' : '✗'}`);
console.log(`   Still uses content.body: ${usesBody ? '✗ FAIL' : '✓'}`);

if (!usesDescription || usesBody) {
  console.log('   ⚠ Renderer not properly updated!');
  console.log('   Run: update_note_renderer_for_description.js');
}

// Check all notes
console.log('\n2. Checking all note items...');
const notes = await api.query({ type: NOTE_TYPE_ID });
console.log(`   Found ${notes.length} notes`);

let properCount = 0;
let needsMigration = 0;
let emptyCount = 0;

for (const note of notes) {
  const hasDescription = note.content.description !== undefined;
  const hasBody = note.content.body !== undefined;

  if (hasBody) {
    console.log(`   ✗ ${note.name || note.id}: Still has content.body`);
    needsMigration++;
  } else if (hasDescription) {
    properCount++;
  } else {
    console.log(`   ⚠ ${note.name || note.id}: Has neither (empty note)`);
    emptyCount++;
  }
}

console.log(`\n   Properly migrated: ${properCount}`);
console.log(`   Needs migration: ${needsMigration}`);
console.log(`   Empty notes: ${emptyCount}`);

if (needsMigration > 0) {
  console.log('\n   ⚠ Some notes need migration!');
  console.log('   Run: migrate_notes_to_description.js');
}

// Summary
console.log('\n=== Summary ===');
if (usesDescription && !usesBody && needsMigration === 0) {
  console.log('✓ All checks passed!');
  console.log('✓ Renderer updated');
  console.log('✓ All notes migrated');
  console.log('\nThe Description Property Design is fully implemented.');
} else {
  console.log('✗ Migration incomplete. Please run the scripts in order:');
  if (!usesDescription || usesBody) {
    console.log('   1. update_note_renderer_for_description.js');
  }
  if (needsMigration > 0) {
    console.log('   2. migrate_notes_to_description.js');
  }
}
