// Fix CodeMirror gutter width in field_view_markdown_editable
(async function() {
  const fv = await api.get("56f77a00-baf5-43cc-9dc4-8ad0c66f1e8f");
  let code = fv.content.code;

  if (code.includes('cm.refresh()')) {
    console.log("Already has refresh fix");
    return;
  }

  code = code.replace(
    "cm.setSize('100%', '300px');",
    "cm.setSize('100%', '300px');\n\n  // Refresh after layout completes to fix gutter width calculation\n  requestAnimationFrame(() => cm.refresh());"
  );

  fv.content.code = code;
  fv.modified = Date.now();
  await api.set(fv);
  console.log("Updated field_view_markdown_editable with refresh fix");
})();
