// Diagnostic script to trace view selection issue
// Run in REPL, then try Display As... and run again to compare

(async function() {
  console.log("=== VIEW SELECTION DIAGNOSTIC ===\n");

  // 1. Check viewport item storage
  console.log("1. VIEWPORT ITEM (88888888-...):");
  const viewportItem = await api.get("88888888-0000-0000-0000-000000000000");
  console.log("   children: " + JSON.stringify(viewportItem.children, null, 2));

  // 2. Check kernel viewport runtime state
  console.log("\n2. KERNEL VIEWPORT RUNTIME STATE:");
  const vp = api.viewport;
  console.log("   rootId: " + vp.getRoot());

  // Try both method names
  let rootView = null;
  if (typeof vp.getRootView === 'function') {
    rootView = vp.getRootView();
    console.log("   getRootView(): " + rootView);
  } else {
    console.log("   getRootView(): (method not found)");
  }

  if (typeof vp.getRootRenderer === 'function') {
    const rootRenderer = vp.getRootRenderer();
    console.log("   getRootRenderer(): " + rootRenderer);
  } else {
    console.log("   getRootRenderer(): (method not found)");
  }

  // 3. Check what methods exist on viewport API
  console.log("\n3. VIEWPORT API METHODS:");
  console.log("   setRootView exists: " + (typeof vp.setRootView === 'function'));
  console.log("   setRootRenderer exists: " + (typeof vp.setRootRenderer === 'function'));
  console.log("   getRootView exists: " + (typeof vp.getRootView === 'function'));
  console.log("   getRootRenderer exists: " + (typeof vp.getRootRenderer === 'function'));

  // 4. Try manually setting a view and check persistence
  console.log("\n4. TESTING VIEW PERSISTENCE:");
  const testViewId = "test-view-id-12345";

  console.log("   Setting view to: " + testViewId);
  if (typeof vp.setRootView === 'function') {
    await vp.setRootView(testViewId);
    console.log("   Used setRootView()");
  } else if (typeof vp.setRootRenderer === 'function') {
    await vp.setRootRenderer(testViewId);
    console.log("   Used setRootRenderer()");
  } else {
    console.log("   ERROR: No set method found!");
  }

  // Check if it was stored
  const afterSet = await api.get("88888888-0000-0000-0000-000000000000");
  console.log("   After set, children: " + JSON.stringify(afterSet.children, null, 2));

  // Check runtime state
  let currentView = null;
  if (typeof vp.getRootView === 'function') {
    currentView = vp.getRootView();
  } else if (typeof vp.getRootRenderer === 'function') {
    currentView = vp.getRootRenderer();
  }
  console.log("   Runtime view value: " + currentView);

  // 5. Reset to null
  console.log("\n5. RESETTING VIEW TO NULL:");
  if (typeof vp.setRootView === 'function') {
    await vp.setRootView(null);
  } else if (typeof vp.setRootRenderer === 'function') {
    await vp.setRootRenderer(null);
  }
  const afterReset = await api.get("88888888-0000-0000-0000-000000000000");
  console.log("   After reset, children: " + JSON.stringify(afterReset.children, null, 2));

  // 6. Check kernel-core navigateToItem behavior
  console.log("\n6. CHECKING KERNEL CORE:");
  const kernelCore = await api.get(api.IDS.KERNEL_CORE);
  const coreCode = kernelCore.content.code;

  // Look for what navigateToItem does with renderer
  const navMatch = coreCode.match(/navigateToItem[\s\S]{0,500}/);
  if (navMatch) {
    console.log("   navigateToItem snippet:");
    console.log("   " + navMatch[0].slice(0, 300) + "...");
  }

  // Check if it clears renderer
  if (coreCode.includes('setRootRenderer(null)') || coreCode.includes('setRootView(null)')) {
    console.log("\n   WARNING: navigateToItem may be clearing the view!");
  }

  console.log("\n=== END DIAGNOSTIC ===");
  console.log("\nNext steps:");
  console.log("1. Try 'Display As...' on a note");
  console.log("2. IMMEDIATELY run this diagnostic again");
  console.log("3. Check if children[0].view or children[0].renderer has the selected view ID");

  return { viewportItem, afterSet, afterReset };
})();
