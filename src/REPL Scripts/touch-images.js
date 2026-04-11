// touch-images.js
// Bumps `modified` on all image items so they pass the LWW check on the next sync.
// Run on desktop after deploying the defensive storeBlob fix to both sides.

const IMAGE_TYPE = 'd0d0d0d0-0010-0000-0000-000000000000';
const images = await api.query({ type: IMAGE_TYPE });
for (const item of images) {
  await api.update(item); // sets modified = Date.now()
}
console.log(`Touched ${images.length} image(s)`);
