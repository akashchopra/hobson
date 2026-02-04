// Item: code-view-readonly
// ID: 426f16cc-2049-421a-ae44-a091ce4ae06e
// Type: aaaaaaaa-0000-0000-0000-000000000000

export async function render(item, api) {
  const genericView = await api.require('system:generic-view');
  return genericView.render(item, api);
}