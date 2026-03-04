// hobson-instance-lifecycle
// Handles cascade delete when a hobson-instance is deleted

export async function onItemDeleted({ id, item }, api) {
  // Batch-delete all nested instance items (one storage sweep + single render)
  const prefix = id + ':';
  const count = await api.deleteByPrefix(prefix);
  if (count > 0) {
    console.log(`Cleaned up ${count} nested items from instance ${item.name || id}.`);
  }
}
