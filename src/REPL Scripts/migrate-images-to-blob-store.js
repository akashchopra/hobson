// migrate-images-to-blob-store.js
// One-time migration: converts image items from base64 content.data to the blob store.
// Run via the REPL after importing updated kernel:storage and kernel:core.

const IMAGE_TYPE = 'd0d0d0d0-0010-0000-0000-000000000000';
const images = await api.query({ type: IMAGE_TYPE });
let migrated = 0;
let skipped = 0;

for (const item of images) {
  if (!item.content?.data) {
    skipped++;
    continue;
  }

  const dataUrl = item.content.data;
  const mimeType = item.content.mimeType || dataUrl.match(/^data:([^;]+);/)?.[1] || 'image/png';

  // Convert data URL to Blob
  const base64 = dataUrl.split(',')[1];
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });

  // Store blob keyed by item ID
  await api.setBlob(item.id, blob);

  // Clean up item: remove content.data, ensure mimeType is set
  item.content.mimeType = mimeType;
  delete item.content.data;
  await api.update(item);

  migrated++;
  console.log(`Migrated: ${item.name} (${item.id})`);
}

console.log(`Done. Migrated ${migrated} image(s), skipped ${skipped} (already migrated).`);
