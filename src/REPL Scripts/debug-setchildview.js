// Debug setChildView
(async function() {
  const vr = await api.helpers.findByName('viewport-renderer');
  let code = vr.content.code;

  // Replace the setChildView helper with a logging version
  const oldHelper = /const setChildView = async \(parentId, childId, viewId\) => \{[\s\S]*?\};/;
  const newHelper = `const setChildView = async (parentId, childId, viewId) => {
    console.log("setChildView called:", {parentId, childId, viewId});
    console.log("api.setChildView:", typeof api.setChildView);
    console.log("api.setChildRenderer:", typeof api.setChildRenderer);

    if (api.setChildView) {
      console.log("Calling api.setChildView");
      await api.setChildView(parentId, childId, viewId);
    } else if (api.setChildRenderer) {
      console.log("Calling api.setChildRenderer");
      await api.setChildRenderer(parentId, childId, viewId);
    } else {
      console.log("ERROR: No method available!");
    }

    // Check what was saved
    const parent = await api.get(parentId);
    const childSpec = parent.children.find(c => c.id === childId);
    console.log("After save, child spec:", JSON.stringify(childSpec));
  };`;

  code = code.replace(oldHelper, newHelper);

  vr.content.code = code;
  vr.modified = Date.now();
  await api.set(vr);

  console.log("Updated with setChildView logging.");
})();
