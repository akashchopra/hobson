// Hob Destructuring Tests

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { test, testAsync, getResults } = createSuite('Hob Destructuring');
  const hob = await api.require('hob-interpreter');
  const interp = hob.createInterpreter(api);
  await interp.macrosReady;

  // --- Vector destructuring in let ---

  async function vecDestrBasic() {
    const result = await interp.eval('(let [[a b c] [1 2 3]] (+ a b c))');
    assertEquals(result, 6);
  }

  async function vecDestrFewer() {
    const result = await interp.eval('(let [[a b] [1 2 3]] b)');
    assertEquals(result, 2);
  }

  async function vecDestrMore() {
    const result = await interp.eval('(let [[a b c] [1 2]] c)');
    assertEquals(result, null);
  }

  async function vecDestrRest() {
    const result = await interp.eval('(let [[a & rest] [1 2 3 4]] rest)');
    assertDeepEquals(result, [2, 3, 4]);
  }

  async function vecDestrUnderscore() {
    const result = await interp.eval('(let [[_ b _] [1 2 3]] b)');
    assertEquals(result, 2);
  }

  async function vecDestrNested() {
    const result = await interp.eval('(let [[[a b] c] [[1 2] 3]] (+ a b c))');
    assertEquals(result, 6);
  }

  // --- Map destructuring in let ---

  async function mapDestrDirect() {
    const result = await interp.eval('(let [{a :a b :b} {:a 1 :b 2}] (+ a b))');
    assertEquals(result, 3);
  }

  async function mapDestrKeys() {
    const result = await interp.eval('(let [{:keys [a b]} {:a 1 :b 2}] (+ a b))');
    assertEquals(result, 3);
  }

  async function mapDestrKeysMissing() {
    const result = await interp.eval('(let [{:keys [a b c]} {:a 1 :b 2}] c)');
    assertEquals(result, null);
  }

  async function mapDestrOr() {
    const result = await interp.eval('(let [{:keys [a b] :or {b 10}} {:a 1}] (+ a b))');
    assertEquals(result, 11);
  }

  async function mapDestrAs() {
    const result = await interp.eval('(let [{:keys [a] :as m} {:a 1 :b 2}] (count m))');
    assertEquals(result, 2);
  }

  async function mapDestrStrs() {
    const result = await interp.eval('(let [{:strs [name]} {"name" "Alice"}] name)');
    assertEquals(result, 'Alice');
  }

  // --- Destructuring in fn params ---

  async function fnVecDestr() {
    const result = await interp.eval('((fn [[a b]] (+ a b)) [1 2])');
    assertEquals(result, 3);
  }

  async function fnMapDestr() {
    const result = await interp.eval('((fn [{:keys [x y]}] (+ x y)) {:x 3 :y 4})');
    assertEquals(result, 7);
  }

  // --- Destructuring in loop ---

  async function loopVecDestr() {
    const result = await interp.eval(`
      (loop [[x & xs] [1 2 3] acc 0]
        (if (nil? x) acc (recur xs (+ acc x))))
    `);
    assertEquals(result, 6);
  }

  async function loopMapDestr() {
    const result = await interp.eval(`
      (loop [{:keys [n acc]} {:n 5 :acc 1}]
        (if (<= n 1) acc (recur {:n (dec n) :acc (* acc n)})))
    `);
    assertEquals(result, 120);
  }

  // --- Edge cases ---

  async function emptyVecDestr() {
    const result = await interp.eval('(let [[] []] nil)');
    assertEquals(result, null);
  }

  async function emptyMapDestr() {
    const result = await interp.eval('(let [{} {}] nil)');
    assertEquals(result, null);
  }

  async function nilVecDestr() {
    const result = await interp.eval('(let [[a b] nil] [a b])');
    assertDeepEquals(result, [null, null]);
  }

  async function nilMapDestr() {
    const result = await interp.eval('(let [{:keys [a]} nil] a)');
    assertEquals(result, null);
  }

  // --- defn with destructured params ---

  async function defnDestr() {
    const result = await interp.eval(`
      (do
        (defn point-str [{:keys [x y]}] (str x "," y))
        (point-str {:x 1 :y 2}))
    `);
    assertEquals(result, '1,2');
  }

  // --- Error on bad vector destructuring ---

  async function errorVecDestrNonSeq() {
    let caught = false;
    try {
      await interp.eval('(let [[a] 42] a)');
    } catch (e) {
      caught = true;
      assert(e.message.includes('destructure') || e.message.includes('non-sequential') || e.message.includes('vector'), 'Should mention destructuring error');
    }
    assert(caught, 'Should throw on destructuring non-sequential');
  }

  // --- Deeply nested ---

  async function deeplyNested() {
    const result = await interp.eval(`
      (let [{:keys [a] [{:keys [x]}] :items} {:a 1 :items [{:x 42}]}]
        [a x])
    `);
    assertDeepEquals(result, [1, 42]);
  }

  // --- Run all tests ---

  await testAsync('vector destructuring basic', vecDestrBasic);
  await testAsync('vector destructuring fewer elements', vecDestrFewer);
  await testAsync('vector destructuring more elements', vecDestrMore);
  await testAsync('vector destructuring rest', vecDestrRest);
  await testAsync('vector destructuring underscore', vecDestrUnderscore);
  await testAsync('nested vector destructuring', vecDestrNested);
  await testAsync('map destructuring direct', mapDestrDirect);
  await testAsync('map :keys shorthand', mapDestrKeys);
  await testAsync('map :keys missing key', mapDestrKeysMissing);
  await testAsync('map :or defaults', mapDestrOr);
  await testAsync('map :as whole', mapDestrAs);
  await testAsync('map :strs shorthand', mapDestrStrs);
  await testAsync('fn vector destructuring', fnVecDestr);
  await testAsync('fn map destructuring', fnMapDestr);
  await testAsync('loop vector destructuring', loopVecDestr);
  await testAsync('loop map destructuring', loopMapDestr);
  await testAsync('empty vector destructuring', emptyVecDestr);
  await testAsync('empty map destructuring', emptyMapDestr);
  await testAsync('nil vector destructuring', nilVecDestr);
  await testAsync('nil map destructuring', nilMapDestr);
  await testAsync('defn with destructured params', defnDestr);
  await testAsync('error on non-sequential vector destructuring', errorVecDestrNonSeq);
  await testAsync('deeply nested destructuring', deeplyNested);

  return getResults();
}
