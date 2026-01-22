// Update kernel-rendering to add getAllRaw and queryRaw to the renderer API
const item = await kernel.storage.get('33333333-5555-0000-0000-000000000000');

let code = item.content.code;

// Add getAllRaw after getAll
const getAllMarker = "// Get all items\n      getAll: () => kernel.storage.getAll(),";
if (!code.includes(getAllMarker)) {
  throw new Error('Could not find getAll in renderer API');
}

code = code.replace(
  getAllMarker,
  `// Get all items
      getAll: () => kernel.storage.getAll(),

      // Get all items including nested instances (raw)
      getAllRaw: () => kernel.storage.getAllRaw(),

      // Query with raw access (includes nested)
      queryRaw: (filter) => kernel.storage.queryRaw(filter),`
);

item.content.code = code;
item.modified = Date.now();
await kernel.storage.set(item, kernel);

console.log('Updated kernel-rendering with getAllRaw and queryRaw in renderer API');
