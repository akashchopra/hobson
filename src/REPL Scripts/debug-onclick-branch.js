// Debug which branch the onclick takes
(async function() {
  const vr = await api.helpers.findByName('viewport-renderer');
  let code = vr.content.code;

  // Find and replace the onclick handler to add branch logging
  const oldOnclick = /rendererOption\.onclick = async \(\) => \{\s*console\.log\("ONCLICK FIRED"\);/;
  const newOnclick = `rendererOption.onclick = async () => {
          console.log("ONCLICK FIRED for renderer:", renderer.id);
          console.log("selectedParentId:", selectedParentId);
          console.log("itemId:", itemId);`;

  code = code.replace(oldOnclick, newOnclick);

  vr.content.code = code;
  vr.modified = Date.now();
  await api.set(vr);

  console.log("Updated with branch logging.");
})();
