// Hobson Item Import Script
// Paste this into the REPL to import items from JSON backups

// Option 1: Import from file picker
async function importFromFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const text = await file.text();
        const result = await api.import(text);
        console.log(`Import complete: ${result.created} created, ${result.skipped} skipped`);
        resolve(result);
      } catch (err) {
        console.error('Import failed:', err);
        reject(err);
      }
    };

    input.click();
  });
}

// Option 2: Import from JSON string (paste JSON in prompt)
async function importFromPrompt() {
  const json = prompt('Paste your JSON backup:');
  if (!json) {
    console.log('Import cancelled');
    return;
  }

  try {
    const result = await api.import(json);
    console.log(`Import complete: ${result.created} created, ${result.skipped} skipped`);
    return result;
  } catch (err) {
    console.error('Import failed:', err);
    throw err;
  }
}

// Option 3: Import with overwrite option
async function importWithOverwrite(json, overwrite = false) {
  const items = JSON.parse(json);
  let created = 0, updated = 0, skipped = 0;

  for (const item of items) {
    const exists = await api.exists(item.id);

    if (!exists) {
      await api.set(item);
      created++;
      console.log(`Created: ${item.name || item.id}`);
    } else if (overwrite) {
      await api.set(item);
      updated++;
      console.log(`Updated: ${item.name || item.id}`);
    } else {
      skipped++;
      console.log(`Skipped (exists): ${item.name || item.id}`);
    }
  }

  const result = { created, updated, skipped };
  console.log(`\nImport complete:`, result);
  return result;
}

// Option 4: Selective import (with filtering)
async function importSelective(json, filterFn) {
  const items = JSON.parse(json);
  const filtered = items.filter(filterFn);

  console.log(`Selected ${filtered.length} of ${items.length} items for import`);

  let created = 0, skipped = 0;

  for (const item of filtered) {
    const exists = await api.exists(item.id);
    if (!exists) {
      await api.set(item);
      created++;
      console.log(`Created: ${item.name || item.id}`);
    } else {
      skipped++;
    }
  }

  const result = { created, skipped, total: filtered.length };
  console.log(`\nImport complete:`, result);
  return result;
}

// Option 5: Import and remap IDs (for duplicating items)
async function importWithNewIds(json) {
  const items = JSON.parse(json);
  const idMap = new Map();

  // Generate new IDs
  for (const item of items) {
    idMap.set(item.id, crypto.randomUUID());
  }

  let created = 0;

  // Import with remapped IDs
  for (const item of items) {
    const newItem = {
      ...item,
      id: idMap.get(item.id),
      created: Date.now(),
      modified: Date.now()
    };

    // Remap type if it's in the imported set
    if (idMap.has(newItem.type)) {
      newItem.type = idMap.get(newItem.type);
    }

    // Remap attachments
    if (newItem.attachments) {
      newItem.attachments = newItem.attachments.map(attachment => {
        if (typeof attachment === 'string') {
          return idMap.get(attachment) || attachment;
        } else {
          // Positioned attachment
          return {
            ...attachment,
            id: idMap.get(attachment.id) || attachment.id
          };
        }
      });
    }

    await api.set(newItem);
    created++;
    console.log(`Created: ${newItem.name || newItem.id} (was ${item.id})`);
  }

  console.log(`\nImport complete: ${created} items created with new IDs`);
  return { created, idMap };
}

// Option 6: Preview import (dry run)
async function previewImport(json) {
  const items = JSON.parse(json);
  const toCreate = [];
  const toSkip = [];

  for (const item of items) {
    const exists = await api.exists(item.id);
    if (!exists) {
      toCreate.push(item);
    } else {
      toSkip.push(item);
    }
  }

  console.log('=== Import Preview ===');
  console.log(`Total items: ${items.length}`);
  console.log(`Will create: ${toCreate.length}`);
  console.log(`Will skip (already exist): ${toSkip.length}`);

  if (toCreate.length > 0) {
    console.log('\nItems to create:');
    toCreate.forEach(item => {
      console.log(`  - ${item.name || item.id} (type: ${item.type})`);
    });
  }

  if (toSkip.length > 0) {
    console.log('\nItems to skip:');
    toSkip.forEach(item => {
      console.log(`  - ${item.name || item.id} (type: ${item.type})`);
    });
  }

  return { toCreate, toSkip };
}

// Usage examples:
console.log('=== Hobson Import Functions Loaded ===');
console.log('');
console.log('Available functions:');
console.log('1. importFromFile()           - Select a JSON file to import');
console.log('2. importFromPrompt()         - Paste JSON in a prompt dialog');
console.log('3. importWithOverwrite(json, true) - Import and overwrite existing items');
console.log('4. importSelective(json, fn)  - Import only items matching filter');
console.log('5. importWithNewIds(json)     - Import with new IDs (for duplicating)');
console.log('6. previewImport(json)        - Preview what will be imported');
console.log('');
console.log('Quick examples:');
console.log('  await importFromFile()');
console.log('  await importFromPrompt()');
console.log('  await previewImport(jsonString)');
console.log('  await importWithOverwrite(jsonString, true)');
console.log('');
console.log('Filter example (import only libraries):');
console.log('  await importSelective(json, item => item.type === api.IDS.LIBRARY)');
