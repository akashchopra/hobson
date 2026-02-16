// Extract content.code from items and save to separate .js files
// Run this in the Hobson REPL

(async function extractCodeToFiles() {
  const items = await api.getAllRaw();

  // Filter items that have content.code
  const codeItems = items.filter(item => item.content?.code);

  console.log(`Found ${codeItems.length} items with code`);

  for (const item of codeItems) {
    const code = item.content.code;
    const filename = `${item.id}.js`;

    // Create and download the file
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // Small delay to avoid overwhelming the browser
    await new Promise(r => setTimeout(r, 100));

    console.log(`Saved: ${filename} (${item.name || item.id})`);
  }

  console.log(`Done! Extracted ${codeItems.length} code files.`);
  
  // Filter items that have content.hob
  const hobItems = items.filter(item => item.content?.hob);

  console.log(`Found ${hobItems.length} items with hob`);

  for (const item of hobItems) {
    const code = JSON.stringify(item.content.hob, null, "\t");
    const filename = `${item.id}.hob`;

    // Create and download the file
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // Small delay to avoid overwhelming the browser
    await new Promise(r => setTimeout(r, 100));

    console.log(`Saved: ${filename} (${item.name || item.id})`);
  }

  console.log(`Done! Extracted ${codeItems.length} hob files.`);
})();
