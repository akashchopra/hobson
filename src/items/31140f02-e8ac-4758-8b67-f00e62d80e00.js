// Item: duplicate-item
// ID: 31140f02-e8ac-4758-8b67-f00e62d80e00
// Type: 4f4b7331-874c-4814-90b7-c344e199d711

// Get current item ID from URL
const currentId = new URLSearchParams(window.location.search).get('root');

if (!currentId) {
  throw new Error("No current item to duplicate");
}

const newId = await api.helpers.duplicateItem(currentId);
console.log("Duplicated", currentId, "to", newId);

// Navigate to the duplicate
await api.navigate(newId);

return newId;