// Item: script-view-readonly
// ID: 0c6b89ae-29ac-42e5-af95-838a4df51bc3
// Type: aaaaaaaa-0000-0000-0000-000000000000

export async function render(item, api) {
  const genericView = await api.require('system:generic-view');
  return genericView.render(item, api);
}
