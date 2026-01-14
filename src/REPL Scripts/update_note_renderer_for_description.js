// Update note_renderer to use content.description instead of content.body
// This implements the Description Property Design spec

const RENDERER_ID = '625850e6-d7ae-49ac-a1e0-452137523a3a';

// Get the current renderer
const renderer = await api.get(RENDERER_ID);

console.log('Current renderer:', renderer.name);
console.log('Old code length:', renderer.content.code.length);

// Update the code to use content.description instead of content.body
const updatedCode = renderer.content.code
  .replace(/item\.content\.body/g, 'item.content.description')
  .replace(/content\.body/g, 'content.description')
  .replace(/body: textarea\.value/g, 'description: textarea.value');

// Create updated renderer
const updated = {
  ...renderer,
  content: {
    ...renderer.content,
    code: updatedCode,
    description: 'Renders note items with markdown support and tag editing. Uses content.description for note body.'
  }
};

// Save it
await api.set(updated);

console.log('✓ Renderer updated successfully');
console.log('New code length:', updatedCode.length);
console.log('\nNext step: Run migration script to update existing notes');
