// Hob Standard Library Tests

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { testAsync, getResults } = createSuite('Hob Stdlib');
  const hob = await api.require('hob-interpreter');
  const interp = hob.createInterpreter(null);

  async function e(source) { return await interp.eval(source); }

  // --- Arithmetic ---

  async function addition() {
    assertEquals(await e('(+ 1 2 3)'), 6);
    assertEquals(await e('(+)'), 0);
  }

  async function subtraction() {
    assertEquals(await e('(- 10 3)'), 7);
    assertEquals(await e('(- 5)'), -5);
  }

  async function multiplication() {
    assertEquals(await e('(* 2 3 4)'), 24);
    assertEquals(await e('(*)'), 1);
  }

  async function division() {
    assertEquals(await e('(/ 10 2)'), 5);
    assertEquals(await e('(/ 4)'), 0.25);
  }

  async function modulo() {
    assertEquals(await e('(mod 10 3)'), 1);
  }

  async function incDec() {
    assertEquals(await e('(inc 5)'), 6);
    assertEquals(await e('(dec 5)'), 4);
  }

  // --- Comparison ---

  async function comparison() {
    assertEquals(await e('(< 1 2)'), true);
    assertEquals(await e('(> 2 1)'), true);
    assertEquals(await e('(<= 2 2)'), true);
    assertEquals(await e('(>= 1 2)'), false);
  }

  async function equality() {
    assertEquals(await e('(= 1 1)'), true);
    assertEquals(await e('(= 1 2)'), false);
    assertEquals(await e('(= [1 2] [1 2])'), true);
    assertEquals(await e('(not= 1 2)'), true);
  }

  async function notFn() {
    assertEquals(await e('(not false)'), true);
    assertEquals(await e('(not nil)'), true);
    assertEquals(await e('(not 0)'), false);
    assertEquals(await e('(not "")'), false);
  }

  // --- Strings ---

  async function strConcatenation() {
    assertEquals(await e('(str "hello" " " "world")'), 'hello world');
    assertEquals(await e('(str "n=" 42)'), 'n=42');
    assertEquals(await e('(str nil)'), '');
  }

  async function strOperations() {
    assertEquals(await e('(str/upper-case "hello")'), 'HELLO');
    assertEquals(await e('(str/lower-case "HELLO")'), 'hello');
    assertEquals(await e('(str/trim "  hi  ")'), 'hi');
  }

  async function strSplitJoin() {
    assertDeepEquals(await e('(str/split "a,b,c" ",")'), ['a', 'b', 'c']);
    assertEquals(await e('(str/join ", " ["a" "b" "c"])'), 'a, b, c');
  }

  async function strIncludes() {
    assertEquals(await e('(str/includes? "hello world" "world")'), true);
    assertEquals(await e('(str/includes? "hello" "xyz")'), false);
  }

  async function strReplace() {
    assertEquals(await e('(str/replace "hello world" "world" "there")'), 'hello there');
  }

  async function subs() {
    assertEquals(await e('(subs "hello" 1 3)'), 'el');
    assertEquals(await e('(subs "hello" 2)'), 'llo');
  }

  async function prStrFn() {
    assertEquals(await e('(pr-str "hello")'), '"hello"');
    assertEquals(await e('(pr-str 42)'), '42');
  }

  // --- Collections: first/rest/cons/conj ---

  async function firstRest() {
    assertEquals(await e('(first [1 2 3])'), 1);
    assertDeepEquals(await e('(rest [1 2 3])'), [2, 3]);
    assertEquals(await e('(first [])'), null);
    assertDeepEquals(await e('(rest [])'), []);
    assertEquals(await e('(first nil)'), null);
  }

  async function consConj() {
    assertDeepEquals(await e('(cons 0 [1 2])'), [0, 1, 2]);
    assertDeepEquals(await e('(conj [1 2] 3 4)'), [1, 2, 3, 4]);
  }

  async function concat() {
    assertDeepEquals(await e('(concat [1 2] [3 4] [5])'), [1, 2, 3, 4, 5]);
  }

  // --- Collections: get/assoc/dissoc ---

  async function getNth() {
    assertEquals(await e('(get [10 20 30] 1)'), 20);
    assertEquals(await e('(nth [10 20 30] 0)'), 10);
    assertEquals(await e('(get {:a 1} :a)'), 1); // :a evaluates to keyword, matching the map key
  }

  async function getWithKeyword() {
    const kw = hob.keyword('a');
    // Using eval that processes keywords properly
    assertEquals(await e('(def m {:a 1}) (get m :a)'), 1);
  }

  async function getDefault() {
    assertEquals(await e('(get {:a 1} :b "default")'), 'default');
  }

  async function assocMap() {
    const result = await e('(assoc {:a 1} :b 2)');
    assert(typeof result === 'object', 'Should return map');
    // Verify both keys exist
    assertEquals(Object.keys(result).length, 2);
  }

  async function dissocMap() {
    const result = await e('(def m {:a 1 :b 2}) (dissoc m :a)');
    assertEquals(Object.keys(result).length, 1);
  }

  // --- Collections: nested access ---

  async function getIn() {
    assertEquals(await e('(get-in {:a {:b 42}} [:a :b])'), 42);
    assertEquals(await e('(get-in {:a 1} [:b :c])'), null);
  }

  async function assocIn() {
    const result = await e('(assoc-in {:a {:b 1}} [:a :b] 42)');
    assert(typeof result === 'object');
  }

  // --- Collections: keys/vals/merge ---

  async function keysVals() {
    const keys = await e('(keys {:a 1 :b 2})');
    assertEquals(keys.length, 2);
    const vals = await e('(vals {:a 1 :b 2})');
    assertEquals(vals.length, 2);
  }

  async function merge() {
    const result = await e('(merge {:a 1} {:b 2} {:a 3})');
    assert(typeof result === 'object');
    assertEquals(Object.keys(result).length, 2);
  }

  // --- Collections: count/empty ---

  async function countFn() {
    assertEquals(await e('(count [1 2 3])'), 3);
    assertEquals(await e('(count "hello")'), 5);
    assertEquals(await e('(count {:a 1 :b 2})'), 2);
    assertEquals(await e('(count nil)'), 0);
  }

  async function emptyFn() {
    assertEquals(await e('(empty? [])'), true);
    assertEquals(await e('(empty? [1])'), false);
    assertEquals(await e('(empty? nil)'), true);
    assertEquals(await e('(empty? "")'), true);
  }

  // --- Higher-order functions ---

  async function mapFn() {
    assertDeepEquals(await e('(map inc [1 2 3])'), [2, 3, 4]);
  }

  async function filterFn() {
    assertDeepEquals(await e('(filter (fn [x] (> x 2)) [1 2 3 4 5])'), [3, 4, 5]);
  }

  async function reduceFn() {
    assertEquals(await e('(reduce + 0 [1 2 3 4])'), 10);
    assertEquals(await e('(reduce + [1 2 3])'), 6);
  }

  async function someFn() {
    assertEquals(await e('(some (fn [x] (if (> x 3) x nil)) [1 2 3 4 5])'), 4);
    assertEquals(await e('(some (fn [x] (if (> x 10) x nil)) [1 2 3])'), null);
  }

  async function everyFn() {
    assertEquals(await e('(every? (fn [x] (> x 0)) [1 2 3])'), true);
    assertEquals(await e('(every? (fn [x] (> x 2)) [1 2 3])'), false);
  }

  async function sortFn() {
    assertDeepEquals(await e('(sort [3 1 2])'), [1, 2, 3]);
  }

  async function reverseFn() {
    assertDeepEquals(await e('(reverse [1 2 3])'), [3, 2, 1]);
  }

  // --- Predicates ---

  async function predicates() {
    assertEquals(await e('(nil? nil)'), true);
    assertEquals(await e('(nil? 0)'), false);
    assertEquals(await e('(number? 42)'), true);
    assertEquals(await e('(string? "hi")'), true);
    assertEquals(await e('(keyword? :foo)'), true);
    assertEquals(await e('(boolean? true)'), true);
    assertEquals(await e('(fn? inc)'), true);
    assertEquals(await e('(vector? [1 2])'), true);
    assertEquals(await e('(map? {:a 1})'), true);
    assertEquals(await e('(map? [1 2])'), false);
  }

  // --- Utility ---

  async function typeOf() {
    assertEquals(await e('(type-of 42)'), 'number');
    assertEquals(await e('(type-of "hi")'), 'string');
    assertEquals(await e('(type-of nil)'), 'nil');
    assertEquals(await e('(type-of :foo)'), 'keyword');
    assertEquals(await e('(type-of [1 2])'), 'vector');
    assertEquals(await e('(type-of {:a 1})'), 'map');
    assertEquals(await e('(type-of inc)'), 'fn');
  }

  async function applyFn() {
    assertEquals(await e('(apply + [1 2 3])'), 6);
    assertEquals(await e('(apply + 1 [2 3])'), 6);
  }

  async function identityFn() {
    assertEquals(await e('(identity 42)'), 42);
  }

  async function partialFn() {
    assertEquals(await e('(def add5 (partial + 5)) (add5 3)'), 8);
  }

  async function containsFn() {
    assertEquals(await e('(contains? {:a 1} :a)'), true);
    assertEquals(await e('(contains? {:a 1} :b)'), false);
    assertEquals(await e('(contains? [10 20 30] 1)'), true);
    assertEquals(await e('(contains? [10 20 30] 5)'), false);
  }

  async function seqFn() {
    assertEquals(await e('(seq [])'), null);
    assertDeepEquals(await e('(seq [1 2])'), [1, 2]);
    assertEquals(await e('(seq nil)'), null);
  }

  async function vecFn() {
    assertDeepEquals(await e('(vec nil)'), []);
    assertDeepEquals(await e('(vec "abc")'), ['a', 'b', 'c']);
  }

  async function intoFn() {
    assertDeepEquals(await e('(into [1 2] [3 4])'), [1, 2, 3, 4]);
    const result = await e('(into {} [[:a 1] [:b 2]])');
    assert(typeof result === 'object');
  }

  // --- Run all tests ---

  await testAsync('addition', addition);
  await testAsync('subtraction', subtraction);
  await testAsync('multiplication', multiplication);
  await testAsync('division', division);
  await testAsync('modulo', modulo);
  await testAsync('inc/dec', incDec);
  await testAsync('comparison operators', comparison);
  await testAsync('equality', equality);
  await testAsync('not', notFn);
  await testAsync('str concatenation', strConcatenation);
  await testAsync('str operations', strOperations);
  await testAsync('str split/join', strSplitJoin);
  await testAsync('str includes?', strIncludes);
  await testAsync('str replace', strReplace);
  await testAsync('subs', subs);
  await testAsync('pr-str', prStrFn);
  await testAsync('first/rest', firstRest);
  await testAsync('cons/conj', consConj);
  await testAsync('concat', concat);
  await testAsync('get/nth', getNth);
  await testAsync('get with keyword', getWithKeyword);
  await testAsync('get with default', getDefault);
  await testAsync('assoc map', assocMap);
  await testAsync('dissoc map', dissocMap);
  await testAsync('get-in', getIn);
  await testAsync('assoc-in', assocIn);
  await testAsync('keys/vals', keysVals);
  await testAsync('merge', merge);
  await testAsync('count', countFn);
  await testAsync('empty?', emptyFn);
  await testAsync('map', mapFn);
  await testAsync('filter', filterFn);
  await testAsync('reduce', reduceFn);
  await testAsync('some', someFn);
  await testAsync('every?', everyFn);
  await testAsync('sort', sortFn);
  await testAsync('reverse', reverseFn);
  await testAsync('predicates', predicates);
  await testAsync('type-of', typeOf);
  await testAsync('apply', applyFn);
  await testAsync('identity', identityFn);
  await testAsync('partial', partialFn);
  await testAsync('contains?', containsFn);
  await testAsync('seq', seqFn);
  await testAsync('vec', vecFn);
  await testAsync('into', intoFn);

  return getResults();
}
