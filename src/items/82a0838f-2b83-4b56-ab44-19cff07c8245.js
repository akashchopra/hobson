// Item: note-view-editable
// ID: 82a0838f-2b83-4b56-ab44-19cff07c8245
// Type: aaaaaaaa-0000-0000-0000-000000000000

export async function render(item, api) {
  const genericView = await api.require('system:generic-view');
  return genericView.render(item, api);
}