// Symbol indexer - extracts and stores symbol definitions from code items

export async function onItemCreated({ item }, api) {
  await indexSymbols(item, api);
}

export async function onItemUpdated({ item }, api) {
  await indexSymbols(item, api);
}

async function indexSymbols(item, api) {
  const hasCode = item.content?.code && typeof item.content.code === 'string';
  const hasHob = Array.isArray(item.content?.hob);
  if (!hasCode && !hasHob) return;

  const extractor = await api.require('symbol-extractor-lib');
  const symbols = hasHob
    ? extractor.extractHobSymbols(item.content.hob)
    : await extractor.extractSymbols(item.content.code, api);

  // Check if symbols changed (avoid unnecessary saves)
  const existingSymbols = item.content._symbols || {};
  if (JSON.stringify(symbols) === JSON.stringify(existingSymbols)) {
    return;
  }

  // Update item with new symbols (silent to avoid re-triggering watchers)
  item.content._symbols = symbols;
  await api.set(item, { silent: true });

  console.log(`Indexed ${Object.keys(symbols).length} symbols in ${item.name || item.id}`);
}