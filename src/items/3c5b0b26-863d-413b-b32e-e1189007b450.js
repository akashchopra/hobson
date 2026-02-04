export async function render(item, api) {
  const genericView = await api.require('system:generic-view');
  return genericView.render(item, api);
}