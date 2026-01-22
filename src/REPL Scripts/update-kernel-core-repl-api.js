// Update kernel-core to expose getAllRaw and queryRaw in the REPL API
// This adds the raw query methods to the api object

const item = await kernel.storage.get('33333333-1111-0000-0000-000000000000');

// Find the createREPLAPI method and add the new methods
// Look for the line with "getAll: () => kernel.storage.getAll(),"
const oldCode = item.content.code;

// Add getAllRaw after getAll
let newCode = oldCode.replace(
  'getAll: () => kernel.storage.getAll(),',
  `getAll: () => kernel.storage.getAll(),
        getAllRaw: () => kernel.storage.getAllRaw(),`
);

// Add queryRaw after query
newCode = newCode.replace(
  'query: (filter) => kernel.storage.query(filter),',
  `query: (filter) => kernel.storage.query(filter),
        queryRaw: (filter) => kernel.storage.queryRaw(filter),`
);

if (newCode === oldCode) {
  console.log('Warning: No changes made. The patterns may not have matched.');
} else {
  item.content.code = newCode;
  item.modified = Date.now();
  await kernel.storage.set(item, kernel);
  console.log('Updated kernel-core REPL API with getAllRaw and queryRaw');
}
