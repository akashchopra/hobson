// Quick Import Script - Paste into REPL
// For basic import needs (uses built-in api.import)

// Quick file import
(async function quickImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const json = await file.text();
      const result = await api.import(json);
      console.log(`✓ Imported: ${result.created} created, ${result.skipped} skipped`);
    } catch (err) {
      console.error('✗ Import failed:', err);
    }
  };

  input.click();
})();
