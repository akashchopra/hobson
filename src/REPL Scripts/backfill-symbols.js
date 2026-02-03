// Backfill symbols for all existing code items
// Run this once after importing the symbol indexing items

const extractor = await api.require('symbol-extractor-lib');
const allItems = await api.getAll();
let indexed = 0;
let skipped = 0;

for (const item of allItems) {
  const isCode = await api.typeChainIncludes(item.type, api.IDS.CODE);
  if (!isCode) continue;

  const code = item.content?.code;
  if (!code || typeof code !== 'string') continue;

  const symbols = await extractor.extractSymbols(code, api);

  // Skip if no symbols found
  if (Object.keys(symbols).length === 0) {
    skipped++;
    continue;
  }

  // Skip if symbols unchanged
  if (JSON.stringify(symbols) === JSON.stringify(item.content._symbols || {})) {
    skipped++;
    continue;
  }

  item.content._symbols = symbols;
  await api.set(item);
  indexed++;
  console.log(`Indexed ${Object.keys(symbols).length} symbols in ${item.name || item.id}`);
}

return `Indexed ${indexed} items, skipped ${skipped}`;
