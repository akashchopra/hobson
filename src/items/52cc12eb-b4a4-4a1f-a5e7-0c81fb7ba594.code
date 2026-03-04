const mode = pageContext.getState('instanceMode') || 'everything';
const lib = await api.require('hobson-instance-lib');
if (mode === 'kernel') {
  const seedIds = Object.values(api.IDS);
  const items = await Promise.all(seedIds.map(id => api.get(id)));
  await lib.create(api, { items, name: 'Nested Instance (Kernel)' });
} else {
  await lib.create(api, { name: 'Nested Instance' });
}