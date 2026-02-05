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