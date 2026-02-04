// Item: list-all-types
// ID: 2a7835b6-ddfb-4743-9b19-5f7acd904ade
// Type: 4f4b7331-874c-4814-90b7-c344e199d711

const types = await api.helpers.listTypes();
console.log("Found", types.length, "types:");
types.forEach(t => {
  console.log("-", t.name || t.id, ":", t.content.description);
});
return types.map(t => ({ id: t.id, name: t.name, description: t.content.description }));