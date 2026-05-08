// Patches market-data-lib (6073171a) to emit market-data:prices-updated after fetchAllPrices.
// Run this if the JSON import fails due to a naming conflict.

const MARKET_DATA_ID = '6073171a-05a6-4467-979e-6442db58c39c';
const PRICES_UPDATED_EVENT_ID = '7c41cb53-3ad5-4235-97f1-a3d6f3bf9b86';

const item = await api.get(MARKET_DATA_ID);
const oldCode = item.content.code;

const constLine = `const PRICES_UPDATED_EVENT_ID = '${PRICES_UPDATED_EVENT_ID}';\n`;
const emitLine = `  api.events.emit({ type: PRICES_UPDATED_EVENT_ID, content: { results } });\n`;

if (oldCode.includes(PRICES_UPDATED_EVENT_ID)) {
  'already patched — no changes made';
} else {
  const patched = oldCode
    .replace(
      "const INSTRUMENT_TYPE_ID = '60ccdb32-566d-480b-8dae-ef1e4a5cdecc';",
      "const INSTRUMENT_TYPE_ID = '60ccdb32-566d-480b-8dae-ef1e4a5cdecc';\n" + constLine
    )
    .replace(
      '  return results;\n}',
      emitLine + '  return results;\n}'
    );

  item.content.code = patched;
  await api.set(item);
  'market-data patched successfully';
}
