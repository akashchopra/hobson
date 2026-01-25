// Add dividerAfter support to generic_view and update note_view_readonly
(async function() {
  console.log("Adding dividerAfter support...\n");

  // 1. Update generic_view to support dividerAfter
  const genericView = await api.helpers.findByName('generic_view');
  if (!genericView) {
    console.error("generic_view not found!");
    return;
  }

  let code = genericView.content.code;

  if (code.includes('dividerAfter')) {
    console.log("generic_view already has dividerAfter support");
  } else {
    // Find where field is appended and add divider check after
    code = code.replace(
      'form.appendChild(fieldElement);',
      `form.appendChild(fieldElement);

    // Add divider after field if requested
    if (hint.dividerAfter) {
      const divider = api.createElement('hr');
      divider.style.cssText = 'border: none; border-top: 1px solid #e0e0e0; margin: 8px 0;';
      form.appendChild(divider);
    }`
    );

    genericView.content.code = code;
    genericView.modified = Date.now();
    await api.set(genericView);
    console.log("Updated generic_view with dividerAfter support");
  }

  // 2. Update note_view_readonly to use dividerAfter on tags
  const noteViewReadonly = await api.helpers.findByName('note_view_readonly');
  if (noteViewReadonly) {
    if (noteViewReadonly.content.ui_hints.tags.dividerAfter) {
      console.log("note_view_readonly already has dividerAfter on tags");
    } else {
      noteViewReadonly.content.ui_hints.tags.dividerAfter = true;
      noteViewReadonly.modified = Date.now();
      await api.set(noteViewReadonly);
      console.log("Updated note_view_readonly: tags now has dividerAfter");
    }
  }

  // 3. Also update note_view_editable for consistency
  const noteViewEditable = await api.helpers.findByName('note_view_editable');
  if (noteViewEditable) {
    if (noteViewEditable.content.ui_hints.tags.dividerAfter) {
      console.log("note_view_editable already has dividerAfter on tags");
    } else {
      noteViewEditable.content.ui_hints.tags.dividerAfter = true;
      noteViewEditable.modified = Date.now();
      await api.set(noteViewEditable);
      console.log("Updated note_view_editable: tags now has dividerAfter");
    }
  }

  console.log("\nDone! Reload kernel to see changes.");
})();
