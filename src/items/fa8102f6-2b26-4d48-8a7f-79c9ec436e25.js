// Item: note-view-readonly
// ID: fa8102f6-2b26-4d48-8a7f-79c9ec436e25
// Type: aaaaaaaa-0000-0000-0000-000000000000

export async function render(item, api) {
  const genericView = await api.require('system:generic-view');
  return genericView.render(item, api);
}