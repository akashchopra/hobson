// Related Items View — minimal JS handler (rendering is in content.hob)

const WIDGET_TYPE_ID = '1e9ffc8d-0e0d-4020-9865-b4ca6a05cbae';

export async function onViewportSelectionChanged(payload, api) {
  const selectedId = payload?.current?.itemId;
  if (selectedId) {
    let item;
    try { item = await api.get(selectedId); } catch (e) { item = null; }
    if (item && item.type === WIDGET_TYPE_ID) return;
  }
  await api.rerenderByType(WIDGET_TYPE_ID);
}
