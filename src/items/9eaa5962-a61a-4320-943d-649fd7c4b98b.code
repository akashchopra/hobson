// Extract code from items and save to .code sidecar files
// Handles content.code (JS), content.hob (Hob), or both

(async function extractCodeFiles() {
  const items = await api.getAllRaw();
  const hob = await api.require('40b00001-0000-4000-8000-000000000000');

  const codeItems = items.filter(item => item.content?.code || Array.isArray(item.content?.hob));
  console.log(`Found ${codeItems.length} items with code`);

  for (const item of codeItems) {
    const hasJS = !!item.content.code;
    const hasHob = Array.isArray(item.content.hob);
    const parts = [];

    if (hasJS && hasHob) {
      parts.push(';;; --- JavaScript ---');
      parts.push(item.content.code);
      parts.push('');
      parts.push(';;; --- Hob ---');
      parts.push(hob.prettyPrintAll(item.content.hob));
    } else if (hasJS) {
      parts.push(item.content.code);
    } else {
      parts.push(hob.prettyPrintAll(item.content.hob));
    }

    const blob = new Blob([parts.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.id}.code`;
    a.click();
    URL.revokeObjectURL(url);

    await new Promise(r => setTimeout(r, 100));
    const lang = hasJS && hasHob ? 'JS+Hob' : hasJS ? 'JS' : 'Hob';
    console.log(`Saved: ${item.id}.code (${item.name || item.id}) [${lang}]`);
  }

  console.log(`Done! Extracted ${codeItems.length} .code files.`);
})();
