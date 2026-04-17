// Manually imports a list of JSON files from disk into Hobson IDB.
// Run this in the REPL when file-sync watch mode missed file changes.

const ITEMS_PATH = '/home/akash/Documents/Code/Hobson/src/items';

const IDS = [
  'c313e1de-36b0-48e1-a359-da28748c48d1',  // sailing-light-lib
  '38f026e4-3a43-4050-9b28-0db8b4c25e9f',  // Power Vessel over 50m
  '646a0ac4-e5b5-40c0-aa87-2737dabf3b60',  // Pilot Boat
  '569ad717-194a-44f1-9173-f511b34e2c85',  // Vessel Constrained By Draught
  '853eb1fa-9fde-4ce6-9b20-364d48d2b105',  // Vessel Aground
  '55d41767-ecdc-4878-9d76-0d407fbcc2b6',  // Vessel Not Under Command
  '0b355fa7-7204-43e9-9011-a3ffc3949a21',  // Vessel Restricted In Ability To Manoeuvre
  '513800ea-e6c7-4df8-81c6-329869d2e394',  // Towing Vessel
  '96b641b9-dc6a-448c-898f-a03baf7f5e2c',  // Minesweeper
  'e4d101a4-9a79-453e-bff2-9f75aa0f49b1',  // Fishing Vessel
  'c52ce1c2-9fe2-45f0-af8d-7b37510de759',  // Trawling Vessel
  'bbb647fe-08c1-4807-82c2-f6f1f2d88120',  // Power Vessel
  'b4ce061e-ac24-482b-9356-f7612850db8d',  // Sailing Vessel
  'e9f9a12f-cee3-408a-9013-cf9aa9124f6f',  // Vessel At Anchor > 50m
  'bb4b8bf9-3e2b-4693-bbda-e878bba8f73f',  // Vessel At Anchor
  'd47f1c1c-4209-441d-80eb-05530f3a7b85',  // Sailing Vessel > 20m
];

const tauri = window.__TAURI__;
let imported = 0, skipped = 0, errors = 0;

for (const id of IDS) {
  try {
    const text = await tauri.fs.readTextFile(`${ITEMS_PATH}/${id}.json`);
    const item = JSON.parse(text);
    if (!item.id || item.id !== id) { console.warn(`ID mismatch: ${id}`); errors++; continue; }
    const { _blob, modified, ...rest } = item;
    const existing = await api.get(id).catch(() => null);
    if (existing) {
      const { modified: _m, ...existingRest } = existing;
      if (JSON.stringify(existingRest) === JSON.stringify(rest)) { skipped++; continue; }
    }
    await api.set(item);
    console.log(`imported: ${item.name || id}`);
    imported++;
  } catch (e) {
    console.error(`error importing ${id}:`, e);
    errors++;
  }
}

console.log(`Done. imported=${imported} skipped=${skipped} errors=${errors}`);
