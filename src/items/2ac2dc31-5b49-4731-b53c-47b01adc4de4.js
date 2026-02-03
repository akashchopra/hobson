// Item: item-generic-view
// ID: 2ac2dc31-5b49-4731-b53c-47b01adc4de4
// Type: aaaaaaaa-0000-0000-0000-000000000000

export async function render(item, api) {
  const genericView = await api.require('system:generic-view');
  return genericView.render(item, api);
}