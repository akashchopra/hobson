// Hob Atom Tests

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { test, testAsync, getResults } = createSuite('Hob Atoms');
  const hob = await api.require('hob-interpreter');
  const interp = hob.createInterpreter(api);
  await interp.macrosReady;

  // --- atom creation ---

  async function atomCreates() {
    const result = await interp.eval('(type-of (atom 0))');
    assertEquals(result, 'atom');
  }

  // --- deref ---

  async function derefReads() {
    const result = await interp.eval('(do (def a (atom 42)) (deref a))');
    assertEquals(result, 42);
  }

  // --- swap! ---

  async function swapApplies() {
    const result = await interp.eval('(do (def a (atom 0)) (swap! a inc) (deref a))');
    assertEquals(result, 1);
  }

  async function swapExtraArgs() {
    const result = await interp.eval('(do (def a (atom 0)) (swap! a + 5) (deref a))');
    assertEquals(result, 5);
  }

  async function swapReturns() {
    const result = await interp.eval('(do (def a (atom 0)) (swap! a inc))');
    assertEquals(result, 1);
  }

  // --- reset! ---

  async function resetSets() {
    const result = await interp.eval('(do (def a (atom 0)) (reset! a 42) (deref a))');
    assertEquals(result, 42);
  }

  async function resetReturns() {
    const result = await interp.eval('(do (def a (atom 0)) (reset! a 42))');
    assertEquals(result, 42);
  }

  // --- Multiple swaps ---

  async function multipleSwaps() {
    const result = await interp.eval('(do (def a (atom 0)) (swap! a inc) (swap! a inc) (swap! a inc) (deref a))');
    assertEquals(result, 3);
  }

  // --- Complex value ---

  async function atomComplexValue() {
    const result = await interp.eval(`
      (do
        (def a (atom {:count 0}))
        (swap! a (fn [m] (assoc m :count (inc (:count m)))))
        (deref a))
    `);
    assertEquals(result['\u029ecount'], 1);
  }

  // --- Atom in closure ---

  async function atomInClosure() {
    const result = await interp.eval(`
      (do
        (def a (atom 0))
        (def inc-a (fn [] (swap! a inc)))
        (inc-a)
        (inc-a)
        (deref a))
    `);
    assertEquals(result, 2);
  }

  // --- atom? predicate ---

  async function atomPredicate() {
    const r1 = await interp.eval('(atom? (atom 0))');
    assertEquals(r1, true);
    const r2 = await interp.eval('(atom? 42)');
    assertEquals(r2, false);
  }

  // --- Atom with nil ---

  async function atomNil() {
    const r1 = await interp.eval('(do (def a (atom nil)) (deref a))');
    assertEquals(r1, null);
    const r2 = await interp.eval('(do (def a (atom nil)) (nil? (deref a)))');
    assertEquals(r2, true);
  }

  // --- Atom in let ---

  async function atomInLet() {
    const result = await interp.eval('(let [a (atom 0)] (swap! a inc) (deref a))');
    assertEquals(result, 1);
  }

  // --- Atom identity ---

  async function atomIdentity() {
    const result = await interp.eval('(do (def a (atom 0)) (= a a))');
    assertEquals(result, true);
  }

  // --- Run all tests ---

  await testAsync('atom creates', atomCreates);
  await testAsync('deref reads value', derefReads);
  await testAsync('swap! applies function', swapApplies);
  await testAsync('swap! with extra args', swapExtraArgs);
  await testAsync('swap! returns new value', swapReturns);
  await testAsync('reset! sets value', resetSets);
  await testAsync('reset! returns value', resetReturns);
  await testAsync('multiple swaps accumulate', multipleSwaps);
  await testAsync('atom with complex value', atomComplexValue);
  await testAsync('atom in closure', atomInClosure);
  await testAsync('atom? predicate', atomPredicate);
  await testAsync('atom with nil', atomNil);
  await testAsync('atom in let', atomInLet);
  await testAsync('atom identity', atomIdentity);

  return getResults();
}
