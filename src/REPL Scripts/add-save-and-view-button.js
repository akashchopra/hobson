// Add "Save & View" button to generic_view
(async function() {
  console.log("Adding Save & View button to generic_view...\n");

  const genericView = await api.helpers.findByName('generic_view');
  if (!genericView) {
    console.error("generic_view not found!");
    return;
  }

  let code = genericView.content.code;

  if (code.includes('Save & View')) {
    console.log("generic_view already has Save & View button");
    return;
  }

  // Find the Save button and add Save & View after it
  const oldSaveBtn = `const saveBtn = api.createElement('button', {
      style: 'padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;'
    });
    saveBtn.textContent = 'Save';
    saveBtn.onclick = async () => {
      try {
        await api.update(editedItem);
        console.log('Saved successfully');
      } catch (e) {
        alert('Save failed: ' + e.message);
      }
    };
    actions.appendChild(saveBtn);`;

  const newSaveButtons = `const saveBtn = api.createElement('button', {
      style: 'padding: 8px 16px; cursor: pointer; background: #6c757d; color: white; border: none; border-radius: 4px;'
    });
    saveBtn.textContent = 'Save';
    saveBtn.onclick = async () => {
      try {
        await api.update(editedItem);
        console.log('Saved successfully');
      } catch (e) {
        alert('Save failed: ' + e.message);
      }
    };
    actions.appendChild(saveBtn);

    const saveAndViewBtn = api.createElement('button', {
      style: 'padding: 8px 16px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;'
    });
    saveAndViewBtn.textContent = 'Save & View';
    saveAndViewBtn.onclick = async () => {
      try {
        await api.update(editedItem);
        // Return to previous view (readonly)
        const restored = await api.restorePreviousView(item.id);
        if (!restored) {
          api.navigate(api.viewport.getRoot());
        }
      } catch (e) {
        alert('Save failed: ' + e.message);
      }
    };
    actions.appendChild(saveAndViewBtn);`;

  code = code.replace(oldSaveBtn, newSaveButtons);

  genericView.content.code = code;
  genericView.modified = Date.now();
  await api.set(genericView);

  console.log("Added Save & View button to generic_view");
  console.log("Reload kernel to see changes.");
})();
