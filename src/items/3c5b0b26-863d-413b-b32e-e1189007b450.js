// Item: code-view-editable
// ID: 3c5b0b26-863d-413b-b32e-e1189007b450
// Type: aaaaaaaa-0000-0000-0000-000000000000

export async function render(item, api) {
  const genericView = await api.require('system:generic-view');
  return genericView.render(item, api);
}
