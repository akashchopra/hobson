// Clean ʞ-prefixed keyword keys from all items in IndexedDB.
// These were written by Hob's set-item! before it gained hobToJs conversion.
// Run once, then discard.

const KW_PREFIX = '\u029e';

function cleanObj(obj) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanObj);
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith(KW_PREFIX)) continue; // drop keyword-keyed duplicates
    result[k] = cleanObj(v);
  }
  return result;
}

const all = await api.getAll();
let cleaned = 0;

for (const item of all) {
  const hasKw = Object.keys(item).some(k => k.startsWith(KW_PREFIX))
    || (item.content && Object.keys(item.content).some(k => k.startsWith(KW_PREFIX)))
    || (item.attachments && item.attachments.some(att =>
        typeof att === 'object' && att && Object.keys(att).some(k => k.startsWith(KW_PREFIX))));

  if (hasKw) {
    const fixed = cleanObj(item);
    await api.set(fixed);
    cleaned++;
    console.log(`Cleaned: ${item.name || item.id}`);
  }
}

`Done. Cleaned ${cleaned} of ${all.length} items.`;
