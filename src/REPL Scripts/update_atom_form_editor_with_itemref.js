// REPL Script: Update atom_form_editor to use itemref for type field
// This makes it easy to select types without typing GUIDs

console.log("Finding atom_form_editor...");

const editors = await api.query({ name: "atom_form_editor" });
if (editors.length === 0) {
  console.error("atom_form_editor not found! Run create_test_declarative_editor.js first.");
  throw new Error("atom_form_editor not found");
}

const atomFormEditor = editors[0];
console.log("Found atom_form_editor:", atomFormEditor.id);
console.log("");

// Update ui_hints to include type field with itemref editor
const updatedEditor = {
  ...atomFormEditor,
  content: {
    ...atomFormEditor.content,
    ui_hints: {
      name: {
        editor: "text",
        label: "Name",
        placeholder: "Item name"
      },
      type: {
        editor: "itemref",
        label: "Type",
        options: {
          modalTitle: "Select Item Type",
          searchPlaceholder: "Search for types..."
        }
      },
      content: {
        description: {
          editor: "textarea",
          label: "Description"
        }
      }
    }
  }
};

await api.update(updatedEditor);

console.log("✓ Updated atom_form_editor ui_hints");
console.log("");
console.log("New field hints:");
console.log("  - name: text input");
console.log("  - type: itemref with search modal");
console.log("  - content.description: textarea");
console.log("");
console.log("To test:");
console.log("  1. Right-click any item");
console.log("  2. Select 'Edit With...' -> 'atom_form_editor'");
console.log("  3. Click 'Select...' button next to Type field");
console.log("  4. Search for a type and select it");
