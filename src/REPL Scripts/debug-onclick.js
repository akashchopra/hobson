// Debug onclick handler
(async function() {
  const vr = await api.helpers.findByName('viewport-renderer');
  let code = vr.content.code;

  // Add logging when onclick fires
  const oldOnclick = 'rendererOption.onclick = async () => {';
  const newOnclick = 'console.log("Creating onclick for:", renderer.name); rendererOption.onclick = async () => { console.log("ONCLICK FIRED");';

  code = code.replace(oldOnclick, newOnclick);

  vr.content.code = code;
  vr.modified = Date.now();
  await api.set(vr);

  console.log("Updated. Now run:");
  console.log('kernel.moduleSystem.moduleCache.delete("bd74da77-a459-454a-b001-48685d4b536d");');
  console.log("await kernel.renderRoot(kernel.currentRoot);");
})();
