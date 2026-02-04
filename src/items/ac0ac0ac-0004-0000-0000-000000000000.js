// Symbol indexer - extracts and stores symbol definitions from code items

export async function onItemCreated({ item }, api) {
  await indexSymbols(item, api);
}

export async function onItemUpdated({ item }, api) {
  await indexSymbols(item, api);
}

async function indexSymbols(item, api) {
  const code = item.content?.code;
  if (!code || typeof code !== 'string') return;

  const extractor = await api.require('symbol-extractor-lib');
  const symbols = await extractor.extractSymbols(code, api);

  // Check if symbols changed (avoid unnecessary saves)
  const existingSymbols = item.content._symbols || {};
  if (JSON.stringify(symbols) === JSON.stringify(existingSymbols)) {
    return;
  }

  // Update item with new symbols
  item.content._symbols = symbols;
  await api.set(item);

  console.log(`Indexed ${Object.keys(symbols).length} symbols in ${item.name || item.id}`);
}