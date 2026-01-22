/**
 * REPL Script: Import third-party JavaScript library
 *
 * Downloads a JS library from a URL and creates a library item.
 *
 * Usage:
 *   await importLibrary('https://cdn.example.com/lib.min.js', 'LibraryName')
 *
 * Example:
 *   await importLibrary('https://cdn.jsdelivr.net/npm/markdown-it@14.0.0/dist/markdown-it.min.js', 'markdown-it')
 */

async function importLibrary(url, name) {
  console.log(`Fetching library from: ${url}`);

  // Fetch the library code
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch library: ${response.status} ${response.statusText}`);
  }

  const code = await response.text();
  console.log(`Downloaded ${code.length} bytes`);

  // Create the library item
  const libraryItem = {
    id: crypto.randomUUID(),
    name: name,
    type: "66666666-0000-0000-0000-000000000000", // LIBRARY
    children: [],
    content: {
      code: code,
      source_url: url,
      imported_at: new Date().toISOString()
    }
  };

  // Save the item
  const itemId = await api.set(libraryItem);

  console.log(`Created library item: ${itemId}`);
  console.log(`Name: ${name}`);
  console.log(`To use: await api.require('${name}')`);

  return itemId;
}

// Auto-execute if script is run directly (uncomment and modify as needed)
// await importLibrary('https://cdn.jsdelivr.net/npm/markdown-it@14.0.0/dist/markdown-it.min.js', 'markdown-it');
