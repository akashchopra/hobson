// Hob Concurrency Tests

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { test, testAsync, getResults } = createSuite('Hob Concurrency');
  const hob = await api.require('hob-interpreter');
  const interp = hob.createInterpreter(api);
  await interp.macrosReady;

  // --- Auto-parallel let: correctness ---

  async function autoParallelBasic() {
    const result = await interp.eval('(let [a 1 b 2] (+ a b))');
    assertEquals(result, 3);
  }

  async function autoParallelDependent() {
    const result = await interp.eval('(let [a 1 b (+ a 1)] b)');
    assertEquals(result, 2);
  }

  async function autoParallelMixed() {
    const result = await interp.eval('(let [a 1 b 2 c (+ a b)] c)');
    assertEquals(result, 3);
  }

  async function autoParallelThreeIndependent() {
    const result = await interp.eval(`
      (let [a (do 1) b (do 2) c (do 3)]
        (+ a b c))
    `);
    assertEquals(result, 6);
  }

  async function autoParallelOuterScope() {
    // a and b reference outer x, not each other — they're independent
    const result = await interp.eval('(do (def x 1) (let [a x b x] (+ a b)))');
    assertEquals(result, 2);
  }

  async function autoParallelTransitiveDep() {
    const result = await interp.eval('(let [a 1 b (+ a 1) c (+ b 1)] c)');
    assertEquals(result, 3);
  }

  // --- plet ---

  async function pletBasic() {
    const result = await interp.eval('(plet [a 1 b 2 c 3] (+ a b c))');
    assertEquals(result, 6);
  }

  async function pletError() {
    let caught = false;
    try {
      await interp.eval('(plet [a (throw "fail")] a)');
    } catch (e) {
      caught = true;
    }
    assert(caught, 'plet should propagate errors');
  }

  // --- pmap ---

  async function pmapBasic() {
    const result = await interp.eval('(pmap inc [1 2 3])');
    assertDeepEquals(result, [2, 3, 4]);
  }

  async function pmapEmpty() {
    const result = await interp.eval('(pmap inc [])');
    assertDeepEquals(result, []);
  }

  async function pmapPreservesOrder() {
    const result = await interp.eval('(pmap identity [3 1 2])');
    assertDeepEquals(result, [3, 1, 2]);
  }

  async function pmapError() {
    let caught = false;
    try {
      await interp.eval('(pmap (fn [x] (if (= x 2) (throw "bad") x)) [1 2 3])');
    } catch (e) {
      caught = true;
    }
    assert(caught, 'pmap should propagate errors');
  }

  // --- Parallel let with closures ---

  async function parallelLetClosures() {
    const result = await interp.eval('(let [f (fn [x] x) a (f 1) b (f 2)] [a b])');
    assertDeepEquals(result, [1, 2]);
  }

  // --- Sequential correctness under parallel ---

  async function sequentialSideEffects() {
    const result = await interp.eval(`
      (let [a (atom 0)
            b (do (swap! a inc) 1)
            c (do (swap! a inc) 2)]
        (deref a))
    `);
    assertEquals(result, 2);
  }

  // --- Auto-parallel with destructuring ---

  async function autoParallelDestructuring() {
    const result = await interp.eval(`
      (let [[a b] [1 2]
            [c d] [3 4]]
        (+ a b c d))
    `);
    assertEquals(result, 10);
  }

  // --- plet with destructuring ---

  async function pletDestructuring() {
    const result = await interp.eval(`
      (plet [[a b] [1 2] {:keys [x]} {:x 3}]
        (+ a b x))
    `);
    assertEquals(result, 6);
  }

  // --- freeSymbols handles quote correctly ---

  async function freeSymbolsQuote() {
    // Bindings that reference only quoted symbols should be independent
    const result = await interp.eval(`
      (let [a (quote hello)
            b (quote world)]
        [a b])
    `);
    assert(Array.isArray(result), 'Should return array');
    assertEquals(result.length, 2);
  }

  // --- Run all tests ---

  await testAsync('auto-parallel let basic', autoParallelBasic);
  await testAsync('auto-parallel dependent bindings', autoParallelDependent);
  await testAsync('auto-parallel mixed', autoParallelMixed);
  await testAsync('auto-parallel three independent', autoParallelThreeIndependent);
  await testAsync('auto-parallel outer scope', autoParallelOuterScope);
  await testAsync('auto-parallel transitive dependency', autoParallelTransitiveDep);
  await testAsync('plet basic', pletBasic);
  await testAsync('plet error propagation', pletError);
  await testAsync('pmap basic', pmapBasic);
  await testAsync('pmap empty', pmapEmpty);
  await testAsync('pmap preserves order', pmapPreservesOrder);
  await testAsync('pmap error propagation', pmapError);
  await testAsync('parallel let with closures', parallelLetClosures);
  await testAsync('sequential side effects', sequentialSideEffects);
  await testAsync('auto-parallel with destructuring', autoParallelDestructuring);
  await testAsync('plet with destructuring', pletDestructuring);
  await testAsync('freeSymbols handles quote', freeSymbolsQuote);

  return getResults();
}
