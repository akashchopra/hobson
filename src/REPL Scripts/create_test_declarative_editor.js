// REPL Script: Create a test declarative editor
// This creates a simple editor for atom type using the custom_editor system

// First, find the custom_editor type
const types = await api.query({ type: api.IDS.EDITOR });
const customEditorType = types.find(t => t.name === "custom_editor");

if (!customEditorType) {
  console.error("custom_editor type not found! Run create_custom_editor_type.js first.");
  throw new Error("custom_editor type not found");
}

const testEditor = {
  id: crypto.randomUUID(),
  name: "atom_form_editor",
  type: customEditorType.id,  // This is a custom_editor
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    for_type: api.IDS.ATOM,  // Works for any item
    ui_hints: {
      name: { editor: "text", label: "Name", placeholder: "Item name" },
      content: {
        description: { editor: "textarea", label: "Description" }
      }
    }
  }
};

await kernel.storage.set(testEditor, kernel);
console.log("Created atom_form_editor:", testEditor.id);
console.log("  type:", customEditorType.id, "(custom_editor)");
console.log("");
console.log("This editor uses ui_hints to render a form with:");
console.log("  - Name field (text input)");
console.log("  - Description field (textarea)");
console.log("  - Plus any other fields in the item (shown at bottom)");
console.log("");
console.log("To test:");
console.log("  1. Right-click any item");
console.log("  2. Select 'Edit With...' -> 'atom_form_editor'");
