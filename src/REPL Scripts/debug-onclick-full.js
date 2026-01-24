// Debug full onclick flow
(async function() {
  const vr = await api.helpers.findByName('viewport-renderer');
  let code = vr.content.code;

  // Replace the entire setRootView helper with a logging version
  const oldHelper = /const setRootView = async \(viewId\) => \{[\s\S]*?\};/;
  const newHelper = `const setRootView = async (viewId) => {
    console.log("setRootView called with:", viewId);
    console.log("api.viewport.setRootView:", typeof api.viewport.setRootView);
    console.log("api.viewport.setRootRenderer:", typeof api.viewport.setRootRenderer);

    if (api.viewport.setRootView) {
      console.log("Calling api.viewport.setRootView");
      await api.viewport.setRootView(viewId);
    } else if (api.viewport.setRootRenderer) {
      console.log("Calling api.viewport.setRootRenderer");
      await api.viewport.setRootRenderer(viewId);
    } else {
      console.log("ERROR: No method available!");
    }

    // Check what was saved
    const vp = await api.get("88888888-0000-0000-0000-000000000000");
    console.log("After save, viewport children:", JSON.stringify(vp.children));
  };`;

  code = code.replace(oldHelper, newHelper);

  vr.content.code = code;
  vr.modified = Date.now();
  await api.set(vr);

  console.log("Updated with full logging.");
})();
