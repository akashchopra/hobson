// REPL Script: Export Initial Kernel
// Recreates initial-kernel.json from items in the database
//
// Usage in REPL:
//   await (await fetch('/src/REPL Scripts/export-initial-kernel.js').then(r => r.text())).split('\n').slice(11).join('\n') |> eval
//
// Or copy and paste the code below into the REPL

// Define the kernel item IDs in exact order for initial-kernel.json
const KERNEL_IDS = [
  "00000000-0000-0000-0000-000000000000", // atom
  "11111111-0000-0000-0000-000000000000", // type-definition
  "22222222-0000-0000-0000-000000000000", // code
  "33333333-0000-0000-0000-000000000000", // kernel-module
  "33333333-1111-0000-0000-000000000000", // kernel-core
  "33333333-2222-0000-0000-000000000000", // kernel-storage
  "33333333-3333-0000-0000-000000000000", // kernel-viewport
  "33333333-4444-0000-0000-000000000000", // kernel-module-system
  "33333333-5555-0000-0000-000000000000", // kernel-rendering
  "33333333-6666-0000-0000-000000000000", // kernel-repl
  "33333333-7777-0000-0000-000000000000", // kernel-safe-mode
  "33333333-8888-0000-0000-000000000000", // kernel-styles
  "44444444-0000-0000-0000-000000000000", // renderer
  "44444444-1111-0000-0000-000000000000", // default-renderer
  "55555555-0000-0000-0000-000000000000", // editor
  "55555555-1111-0000-0000-000000000000", // default-editor
  "66666666-0000-0000-0000-000000000000", // library
  "77777777-0000-0000-0000-000000000000", // viewport_type
  "88888888-0000-0000-0000-000000000000"  // system-viewport
];

// Fetch all items in order
const items = [];
for (const id of KERNEL_IDS) {
  try {
    const item = await api.get(id);
    items.push(item);
    console.log(`✓ Exported: ${item.name || id}`);
  } catch (error) {
    console.error(`✗ Failed to export ${id}: ${error.message}`);
  }
}

// Convert to JSON
const json = JSON.stringify(items, null, 2);

// Download as file
const blob = new Blob([json], { type: "application/json" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "initial-kernel.json";
a.click();
URL.revokeObjectURL(url);

console.log(`\n✓ Exported ${items.length} items to initial-kernel.json`);
console.log(`File size: ${(json.length / 1024).toFixed(2)} KB`);
