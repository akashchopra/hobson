// Item: bootloader-source-view
// ID: 8b4f925a-214a-407d-ae7b-de0d23a37737
// Type: aaaaaaaa-0000-0000-0000-000000000000

export async function render(item, api) {
  const genericView = await api.require('system:generic-view');
  return genericView.render(item, api);
}