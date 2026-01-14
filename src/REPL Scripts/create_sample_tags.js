// Script to create sample tags
// Run this in the Hobson REPL

const TAG_TYPE_ID = api.IDS.TAG;

// Sample tags with colors
const sampleTags = [
  { name: 'work', color: '#3b82f6', description: 'Work-related items' },
  { name: 'personal', color: '#10b981', description: 'Personal items' },
  { name: 'urgent', color: '#ef4444', description: 'Urgent items needing attention' },
  { name: 'project', color: '#8b5cf6', description: 'Project-related items' },
  { name: 'idea', color: '#f59e0b', description: 'Ideas and brainstorming' }
];

const createdTags = [];

for (const tagData of sampleTags) {
  const tagId = crypto.randomUUID();
  await api.set({
    id: tagId,
    name: tagData.name,
    type: TAG_TYPE_ID,
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      name: tagData.name,
      color: tagData.color,
      description: tagData.description,
      parent: null
    }
  });

  createdTags.push({ id: tagId, name: tagData.name });
  console.log('✓ Created tag:', tagData.name, '(' + tagId + ')');
}

console.log('');
console.log('✓ All sample tags created!');
console.log('');
console.log('Tag IDs for reference:');
createdTags.forEach(tag => {
  console.log('  ' + tag.name + ':', tag.id);
});
console.log('');
console.log('Now you can add these tag IDs to your notes!');
