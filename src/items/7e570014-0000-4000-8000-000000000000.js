// Hob View Tests — def-view macro, view ops, and integration

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { test, testAsync, getResults } = createSuite('Hob Views');
  const hob = await api.require('hob-interpreter');

  // ============================================================
  // def-view macro tests
  // ============================================================

  await testAsync('def-view produces map', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    const result = await interp.eval(`
      (def-view my-view "some-type-id" [item api]
        [:div (:name item)])
    `);
    assert(result != null, 'Should return a map');
    assertEquals(result[hob.keyword('for-type')], 'some-type-id');
    assert(typeof result[hob.keyword('render')] === 'function', ':render should be a function');
  });

  await testAsync('def-view render is callable', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval(`
      (def-view test-view "type-id" [item api]
        [:div "rendered"])
    `);
    const result = await interp.eval('((:render test-view) {:name "Test"} nil)');
    assert(Array.isArray(result), 'render should return hiccup vector');
    assertEquals(result[1], 'rendered');
  });

  await testAsync('def-view render accesses item', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval(`
      (def-view name-view "type-id" [item api]
        [:h2 (:name item)])
    `);
    const result = await interp.eval('((:render name-view) {:name "Hello World"} nil)');
    assert(Array.isArray(result), 'Should be vector');
    assertEquals(result[1], 'Hello World');
  });

  // ============================================================
  // View ops tests (using registerViewOps directly)
  // ============================================================

  await testAsync('hiccup->dom in view context', async () => {
    const mockViewApi = {
      renderItem: async () => document.createElement('div'),
      navigate: () => {},
      rerenderItem: () => {},
    };
    const interp = hob.createInterpreter(api, mockViewApi);
    await interp.macrosReady;
    const result = await interp.eval('(hiccup->dom [:div "view"])');
    assert(result.nodeType === 1, 'Should be element');
    assertEquals(result.tagName, 'DIV');
    assertEquals(result.textContent, 'view');
  });

  await testAsync('navigate! is callable', async () => {
    let navigatedTo = null;
    const mockViewApi = {
      renderItem: async () => null,
      navigate: (id) => { navigatedTo = id; },
      rerenderItem: () => {},
    };
    const interp = hob.createInterpreter(api, mockViewApi);
    await interp.macrosReady;
    const result = await interp.eval('(navigate! "some-item-id")');
    assertEquals(result, null);
    assertEquals(navigatedTo, 'some-item-id');
  });

  await testAsync('rerender! is callable', async () => {
    let rerendered = false;
    const mockViewApi = {
      renderItem: async () => null,
      navigate: () => {},
      rerenderItem: () => { rerendered = true; },
    };
    const interp = hob.createInterpreter(api, mockViewApi);
    await interp.macrosReady;
    const result = await interp.eval('(rerender!)');
    assertEquals(result, null);
    assert(rerendered, 'rerenderItem should have been called');
  });

  await testAsync('render-item returns DOM', async () => {
    const mockDiv = document.createElement('div');
    mockDiv.textContent = 'rendered';
    const mockViewApi = {
      renderItem: async () => mockDiv,
      navigate: () => {},
      rerenderItem: () => {},
    };
    const interp = hob.createInterpreter(api, mockViewApi);
    await interp.macrosReady;
    const result = await interp.eval('(render-item "test-id")');
    assert(result.nodeType === 1, 'Should be DOM element');
    assertEquals(result.textContent, 'rendered');
  });

  // ============================================================
  // View rendering integration tests
  // ============================================================

  await testAsync('view renders item name', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval(`
      (def-view nv "type" [item api]
        [:div (:name item)])
    `);
    const hiccup = await interp.eval('((:render nv) {:name "My Item"} nil)');
    const dom = hob.hiccupToDOM(hiccup);
    assertEquals(dom.textContent, 'My Item');
  });

  await testAsync('view renders item content', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval(`
      (def-view cv "type" [item api]
        [:p (:description (:content item))])
    `);
    const hiccup = await interp.eval(`
      ((:render cv) {:name "Test" :content {:description "Hello desc"}} nil)
    `);
    const dom = hob.hiccupToDOM(hiccup);
    assertEquals(dom.tagName, 'P');
    assertEquals(dom.textContent, 'Hello desc');
  });

  await testAsync('view with conditional rendering', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval(`
      (def-view cond-view "type" [item api]
        (if (:active item) [:div "active"] [:div "inactive"]))
    `);
    const active = await interp.eval('((:render cond-view) {:active true} nil)');
    const inactive = await interp.eval('((:render cond-view) {:active false} nil)');
    assertEquals(hob.hiccupToDOM(active).textContent, 'active');
    assertEquals(hob.hiccupToDOM(inactive).textContent, 'inactive');
  });

  await testAsync('view with list rendering', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval(`
      (def-view list-view "type" [item api]
        [:ul (for [t (:tags item)] [:li t])])
    `);
    const hiccup = await interp.eval('((:render list-view) {:tags ["x" "y" "z"]} nil)');
    const dom = hob.hiccupToDOM(hiccup);
    assertEquals(dom.tagName, 'UL');
    assertEquals(dom.children.length, 3);
    assertEquals(dom.children[0].textContent, 'x');
    assertEquals(dom.children[2].textContent, 'z');
  });

  await testAsync('view event handler fires', async () => {
    const mockViewApi = {
      renderItem: async () => null,
      navigate: () => {},
      rerenderItem: () => {},
    };
    const interp = hob.createInterpreter(api, mockViewApi);
    await interp.macrosReady;
    const dom = await interp.eval(`
      (do
        (def clicks (atom 0))
        (hiccup->dom [:button {:on-click (fn [] (swap! clicks inc))} "Click"]))
    `);
    assertEquals(dom.tagName, 'BUTTON');
    dom.click();
    dom.click();
    // swap! is async — yield to microtask queue so both swaps complete
    await new Promise(r => setTimeout(r, 0));
    const count = await interp.eval('(deref clicks)');
    assertEquals(count, 2);
  });

  return getResults();
}
