// Script to create hierarchical sample tags
// Run this in the Hobson REPL

const TAG_TYPE_ID = api.IDS.TAG;

// Create parent tag: work
const workId = crypto.randomUUID();
await api.set({
  id: workId,
  name: 'work',
  type: TAG_TYPE_ID,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    name: 'work',
    color: '#3b82f6',
    description: 'Work-related items',
    parent: null
  }
});
console.log('✓ Created parent tag: work (' + workId + ')');

// Create child tags under work
const projectsId = crypto.randomUUID();
await api.set({
  id: projectsId,
  name: 'projects',
  type: TAG_TYPE_ID,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    name: 'projects',
    color: '#8b5cf6',
    description: 'Active projects',
    parent: workId
  }
});
console.log('✓ Created child tag: projects (' + projectsId + ')');

const meetingsId = crypto.randomUUID();
await api.set({
  id: meetingsId,
  name: 'meetings',
  type: TAG_TYPE_ID,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    name: 'meetings',
    color: '#06b6d4',
    description: 'Meeting notes',
    parent: workId
  }
});
console.log('✓ Created child tag: meetings (' + meetingsId + ')');

// Create grandchild tag under projects
const hobsonId = crypto.randomUUID();
await api.set({
  id: hobsonId,
  name: 'hobson',
  type: TAG_TYPE_ID,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    name: 'hobson',
    color: '#a855f7',
    description: 'Hobson project',
    parent: projectsId
  }
});
console.log('✓ Created grandchild tag: hobson (' + hobsonId + ')');

// Create another parent tag: personal
const personalId = crypto.randomUUID();
await api.set({
  id: personalId,
  name: 'personal',
  type: TAG_TYPE_ID,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    name: 'personal',
    color: '#10b981',
    description: 'Personal items',
    parent: null
  }
});
console.log('✓ Created parent tag: personal (' + personalId + ')');

// Create child tags under personal
const journalId = crypto.randomUUID();
await api.set({
  id: journalId,
  name: 'journal',
  type: TAG_TYPE_ID,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    name: 'journal',
    color: '#14b8a6',
    description: 'Journal entries',
    parent: personalId
  }
});
console.log('✓ Created child tag: journal (' + journalId + ')');

const healthId = crypto.randomUUID();
await api.set({
  id: healthId,
  name: 'health',
  type: TAG_TYPE_ID,
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    name: 'health',
    color: '#22c55e',
    description: 'Health and fitness',
    parent: personalId
  }
});
console.log('✓ Created child tag: health (' + healthId + ')');

console.log('');
console.log('✓ Hierarchical tag structure created!');
console.log('');
console.log('Structure:');
console.log('▼ work');
console.log('  ▼ projects');
console.log('    • hobson');
console.log('  • meetings');
console.log('▼ personal');
console.log('  • journal');
console.log('  • health');
console.log('');
console.log('Tag IDs:');
console.log('  work:', workId);
console.log('  projects:', projectsId);
console.log('  hobson:', hobsonId);
console.log('  meetings:', meetingsId);
console.log('  personal:', personalId);
console.log('  journal:', journalId);
console.log('  health:', healthId);
