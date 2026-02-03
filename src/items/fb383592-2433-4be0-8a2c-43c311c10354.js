// Item: script-view-editable
// ID: fb383592-2433-4be0-8a2c-43c311c10354
// Type: aaaaaaaa-0000-0000-0000-000000000000

export async function render(item, api) {
  const genericView = await api.require('system:generic-view');
  return genericView.render(item, api);
}