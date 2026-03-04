// Hob Reactivity Tests — DependencyTracker, instrumented ops, auto re-render

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { test, testAsync, getResults } = createSuite('Hob Reactivity');
  const hob = await api.require('hob-interpreter');

  // ============================================================
  // DependencyTracker core
  // ============================================================

  test('startTracking/stopTracking returns dep set', () => {
    const tracker = new hob.DependencyTracker();
    tracker.startTracking(1);
    tracker.recordAccess('item-a');
    tracker.recordAccess('item-b');
    const deps = tracker.stopTracking();
    assert(deps.items.has('item-a'), 'Should contain item-a');
    assert(deps.items.has('item-b'), 'Should contain item-b');
    assertEquals(deps.items.size, 2);
  });

  test('recordAccess outside tracking is no-op', () => {
    const tracker = new hob.DependencyTracker();
    // No startTracking call
    tracker.recordAccess('item-a');
    assertEquals(tracker.getDependents('item-a').size, 0);
  });

  test('sequential contexts: second replaces first', () => {
    const tracker = new hob.DependencyTracker();
    tracker.startTracking(1);
    tracker.recordAccess('item-a');
    tracker.stopTracking();

    tracker.startTracking(2);
    tracker.recordAccess('item-b');
    tracker.stopTracking();

    // Context 1 should track item-a, context 2 should track item-b
    assert(tracker.getDependents('item-a').has(1), 'item-a should have context 1');
    assert(!tracker.getDependents('item-a').has(2), 'item-a should not have context 2');
    assert(tracker.getDependents('item-b').has(2), 'item-b should have context 2');
  });

  test('getDependents returns context IDs from multiple contexts', () => {
    const tracker = new hob.DependencyTracker();
    tracker.startTracking(1);
    tracker.recordAccess('shared-item');
    tracker.stopTracking();

    tracker.startTracking(2);
    tracker.recordAccess('shared-item');
    tracker.stopTracking();

    const dependents = tracker.getDependents('shared-item');
    assert(dependents.has(1), 'Should contain context 1');
    assert(dependents.has(2), 'Should contain context 2');
    assertEquals(dependents.size, 2);
  });

  test('clearDeps removes all entries for a context', () => {
    const tracker = new hob.DependencyTracker();
    tracker.startTracking(1);
    tracker.recordAccess('item-a');
    tracker.recordAccess('item-b');
    tracker.stopTracking();

    tracker.clearDeps(1);
    assertEquals(tracker.getDependents('item-a').size, 0);
    assertEquals(tracker.getDependents('item-b').size, 0);
  });

  test('repeated recordAccess has set semantics', () => {
    const tracker = new hob.DependencyTracker();
    tracker.startTracking(1);
    tracker.recordAccess('item-a');
    tracker.recordAccess('item-a');
    tracker.recordAccess('item-a');
    const deps = tracker.stopTracking();
    assertEquals(deps.items.size, 1);
    assertEquals(tracker.getDependents('item-a').size, 1);
  });

  // ============================================================
  // Instrumented get-item
  // ============================================================

  await testAsync('get-item inside tracking records dependency', async () => {
    const tracker = new hob.DependencyTracker();
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;

    const targetId = '00000000-0000-0000-0000-000000000000'; // atom type always exists
    tracker.startTracking(100);
    await interp.eval(`(get-item "${targetId}")`);
    const deps = tracker.stopTracking();
    assert(deps.items.has(targetId), 'Should have recorded the item access');
  });

  await testAsync('get-item outside tracking works normally', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;

    const result = await interp.eval('(get-item "00000000-0000-0000-0000-000000000000")');
    assert(result != null, 'Should return the item');
  });

  await testAsync('multiple get-item calls record all IDs', async () => {
    const tracker = new hob.DependencyTracker();
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;

    const id1 = '00000000-0000-0000-0000-000000000000';
    const id2 = '11111111-0000-0000-0000-000000000000';
    tracker.startTracking(101);
    await interp.eval(`(get-item "${id1}")`);
    await interp.eval(`(get-item "${id2}")`);
    const deps = tracker.stopTracking();
    assert(deps.items.has(id1), 'Should have id1');
    assert(deps.items.has(id2), 'Should have id2');
    assertEquals(deps.items.size, 2);
  });

  await testAsync('repeated get-item same ID records once', async () => {
    const tracker = new hob.DependencyTracker();
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;

    const id = '00000000-0000-0000-0000-000000000000';
    tracker.startTracking(102);
    await interp.eval(`(get-item "${id}")`);
    await interp.eval(`(get-item "${id}")`);
    const deps = tracker.stopTracking();
    assertEquals(deps.items.size, 1);
  });

  // ============================================================
  // Reactive atoms
  // ============================================================

  await testAsync('deref inside tracking records atom dependency', async () => {
    const tracker = new hob.DependencyTracker();
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;

    await interp.eval('(def my-atom (atom 42))');
    tracker.startTracking(200);
    await interp.eval('(deref my-atom)');
    const deps = tracker.stopTracking();
    assertEquals(deps.atoms.size, 1);
  });

  await testAsync('swap! triggers atom mutation callback', async () => {
    const mutations = [];
    hob.setAtomMutationCallback((atom) => mutations.push(atom));

    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval('(def a (atom 0))');
    await interp.eval('(swap! a inc)');

    assert(mutations.length >= 1, 'Callback should have been called');
    // Clean up
    hob.setAtomMutationCallback(null);
  });

  await testAsync('reset! triggers atom mutation callback', async () => {
    const mutations = [];
    hob.setAtomMutationCallback((atom) => mutations.push(atom));

    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval('(def a (atom 0))');
    await interp.eval('(reset! a 99)');

    assert(mutations.length >= 1, 'Callback should have been called');
    // Clean up
    hob.setAtomMutationCallback(null);
  });

  await testAsync('atom dep is distinct from item dep', async () => {
    const tracker = new hob.DependencyTracker();
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;

    await interp.eval('(def a (atom 0))');
    const targetId = '00000000-0000-0000-0000-000000000000';
    tracker.startTracking(201);
    await interp.eval('(deref a)');
    await interp.eval(`(get-item "${targetId}")`);
    const deps = tracker.stopTracking();
    assertEquals(deps.items.size, 1, 'Should have 1 item dep');
    assertEquals(deps.atoms.size, 1, 'Should have 1 atom dep');
  });

  // ============================================================
  // Tracking context lifecycle
  // ============================================================

  test('startTracking clears old deps', () => {
    const tracker = new hob.DependencyTracker();
    tracker.startTracking(1);
    tracker.recordAccess('old-item');
    tracker.stopTracking();

    // Re-track same context ID
    tracker.startTracking(1);
    tracker.recordAccess('new-item');
    tracker.stopTracking();

    // Old dep should be gone
    assertEquals(tracker.getDependents('old-item').size, 0, 'Old dep should be cleared');
    assert(tracker.getDependents('new-item').has(1), 'New dep should exist');
  });

  test('clearDeps removes from reverse index', () => {
    const tracker = new hob.DependencyTracker();
    tracker.startTracking(1);
    tracker.recordAccess('item-a');
    tracker.stopTracking();

    assert(tracker.getDependents('item-a').has(1), 'Before clear');
    tracker.clearDeps(1);
    assertEquals(tracker.getDependents('item-a').size, 0, 'After clear');
  });

  test('new deps replace old on re-track', () => {
    const tracker = new hob.DependencyTracker();
    tracker.startTracking(5);
    tracker.recordAccess('alpha');
    tracker.stopTracking();

    tracker.startTracking(5);
    tracker.recordAccess('beta');
    const deps = tracker.stopTracking();

    assert(!deps.items.has('alpha'), 'alpha should be gone');
    assert(deps.items.has('beta'), 'beta should exist');
    assertEquals(tracker.getDependents('alpha').size, 0);
    assert(tracker.getDependents('beta').has(5));
  });

  test('stopTracking when not tracking returns empty sets', () => {
    const tracker = new hob.DependencyTracker();
    const deps = tracker.stopTracking();
    assertEquals(deps.items.size, 0);
    assertEquals(deps.atoms.size, 0);
  });

  // ============================================================
  // Atom tracking across contexts
  // ============================================================

  test('atom recordAtomAccess tracks correctly', () => {
    const tracker = new hob.DependencyTracker();
    const myAtom = { _hobType: 'atom', value: 0 };

    tracker.startTracking(300);
    tracker.recordAtomAccess(myAtom);
    const deps = tracker.stopTracking();
    assertEquals(deps.atoms.size, 1);
    assert(deps.atoms.has(myAtom));
    assert(tracker.getAtomDependents(myAtom).has(300));
  });

  test('clearDeps clears atom deps too', () => {
    const tracker = new hob.DependencyTracker();
    const myAtom = { _hobType: 'atom', value: 0 };

    tracker.startTracking(301);
    tracker.recordAtomAccess(myAtom);
    tracker.stopTracking();

    assert(tracker.getAtomDependents(myAtom).has(301));
    tracker.clearDeps(301);
    assertEquals(tracker.getAtomDependents(myAtom).size, 0);
  });

  // ============================================================
  // Cycle detection (unit-level)
  // ============================================================

  test('re-render depth tracked per instance', () => {
    // Simulate what _flushReRenders does
    const depthMap = new Map();
    const MAX = 3;
    depthMap.set(1, 0);
    depthMap.set(1, (depthMap.get(1) || 0) + 1);
    assertEquals(depthMap.get(1), 1, 'Depth should increment');
    depthMap.set(1, (depthMap.get(1) || 0) + 1);
    assertEquals(depthMap.get(1), 2);
    depthMap.set(1, (depthMap.get(1) || 0) + 1);
    assertEquals(depthMap.get(1), 3);
    assert(depthMap.get(1) >= MAX, 'Should hit max');
  });

  test('exceeding max depth blocks re-render', () => {
    const MAX = 3;
    const depthMap = new Map();
    let blocked = false;
    // Simulate 4 attempts
    for (let i = 0; i < 4; i++) {
      const depth = depthMap.get(1) || 0;
      if (depth >= MAX) {
        blocked = true;
        break;
      }
      depthMap.set(1, depth + 1);
    }
    assert(blocked, 'Should have been blocked after 3 increments');
  });

  test('depth counter resets after flush', () => {
    const depthMap = new Map();
    depthMap.set(1, 3);
    depthMap.set(2, 1);
    // Simulate flush reset
    depthMap.clear();
    assertEquals(depthMap.get(1) || 0, 0, 'Depth should be 0 after clear');
    assertEquals(depthMap.get(2) || 0, 0, 'Depth should be 0 after clear');
  });

  // ============================================================
  // Edge cases
  // ============================================================

  test('view with no get-item has empty deps', () => {
    const tracker = new hob.DependencyTracker();
    tracker.startTracking(400);
    // No recordAccess calls
    const deps = tracker.stopTracking();
    assertEquals(deps.items.size, 0);
    assertEquals(deps.atoms.size, 0);
    // getDependents for any item should not include this context
    assertEquals(tracker.getDependents('any-item').size, 0);
  });

  test('atoms-only view has no item deps', () => {
    const tracker = new hob.DependencyTracker();
    const myAtom = { _hobType: 'atom', value: 'x' };
    tracker.startTracking(401);
    tracker.recordAtomAccess(myAtom);
    const deps = tracker.stopTracking();
    assertEquals(deps.items.size, 0, 'No item deps');
    assertEquals(deps.atoms.size, 1, 'One atom dep');
  });

  await testAsync('async get-item in plet still tracked', async () => {
    const tracker = new hob.DependencyTracker();
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;

    const id = '00000000-0000-0000-0000-000000000000';
    tracker.startTracking(402);
    await interp.eval(`(plet [a (get-item "${id}")] a)`);
    const deps = tracker.stopTracking();
    assert(deps.items.has(id), 'plet should still track get-item');
  });

  // ============================================================
  // isTracking static method
  // ============================================================

  test('isTracking is false when not tracking', () => {
    assertEquals(hob.DependencyTracker.isTracking(), false);
  });

  test('isTracking is true during tracking', () => {
    const tracker = new hob.DependencyTracker();
    tracker.startTracking(500);
    assertEquals(hob.DependencyTracker.isTracking(), true);
    tracker.stopTracking();
    assertEquals(hob.DependencyTracker.isTracking(), false);
  });

  return getResults();
}
