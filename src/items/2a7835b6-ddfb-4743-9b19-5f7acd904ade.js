const types = await api.helpers.listTypes();
console.log("Found", types.length, "types:");
types.forEach(t => {
  console.log("-", t.name || t.id, ":", t.content.description);
});
return types.map(t => ({ id: t.id, name: t.name, description: t.content.description }));