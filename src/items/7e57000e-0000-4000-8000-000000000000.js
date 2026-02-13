// Hob Macro Tests

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { test, testAsync, getResults } = createSuite('Hob Macros');
  const hob = await api.require('hob-interpreter');
  const interp = hob.createInterpreter(api);
  await interp.macrosReady;

  // --- Reader: quasiquote, unquote, unquote-splicing ---

  function readsQuasiquote() {
    const ast = hob.read('`(a b c)');
    assertEquals(ast.type, 'list');
    assertEquals(ast.elements[0].value, 'quasiquote');
    assertEquals(ast.elements[1].type, 'list');
  }

  function readsUnquote() {
    const ast = hob.read('`(a ~b c)');
    const inner = ast.elements[1]; // (a ~b c)
    assertEquals(inner.elements[1].type, 'list');
    assertEquals(inner.elements[1].elements[0].value, 'unquote');
    assertEquals(inner.elements[1].elements[1].value, 'b');
  }

  function readsUnquoteSplicing() {
    const ast = hob.read('`(a ~@xs c)');
    const inner = ast.elements[1];
    assertEquals(inner.elements[1].type, 'list');
    assertEquals(inner.elements[1].elements[0].value, 'unquote-splicing');
    assertEquals(inner.elements[1].elements[1].value, 'xs');
  }

  // --- Quasiquote evaluation ---

  async function quasiquoteEval() {
    const result = await interp.eval('(let [x 1] `(a ~x c))');
    // Returns a list (array) with symbol a, number 1, symbol c
    assert(Array.isArray(result), 'Should be an array');
    assertEquals(result.length, 3);
    assertEquals(result[0]._hobType, 'symbol');
    assertEquals(result[0].value, 'a');
    assertEquals(result[1], 1);
    assertEquals(result[2]._hobType, 'symbol');
    assertEquals(result[2].value, 'c');
  }

  async function quasiquoteSpliceEval() {
    const result = await interp.eval('(let [xs [1 2]] `(a ~@xs c))');
    assert(Array.isArray(result), 'Should be an array');
    assertEquals(result.length, 4);
    assertEquals(result[1], 1);
    assertEquals(result[2], 2);
  }

  // --- defmacro ---

  async function defmacroBasic() {
    const result = await interp.eval('(do (defmacro my-nil [] nil) (my-nil))');
    assertEquals(result, null);
  }

  async function defmacroReceivesUnevaluated() {
    const result = await interp.eval(`
      (do
        (defmacro quote-first [x & rest] \`'~x)
        (quote-first hello world))
    `);
    assertEquals(result._hobType, 'symbol');
    assertEquals(result.value, 'hello');
  }

  // --- Standard macros: when ---

  async function whenTrue() {
    const result = await interp.eval('(when true 1 2 3)');
    assertEquals(result, 3);
  }

  async function whenFalse() {
    const result = await interp.eval('(when false 1 2 3)');
    assertEquals(result, null);
  }

  // --- when-let ---

  async function whenLetTruthy() {
    const result = await interp.eval('(when-let [x 42] (inc x))');
    assertEquals(result, 43);
  }

  async function whenLetNil() {
    const result = await interp.eval('(when-let [x nil] (inc x))');
    assertEquals(result, null);
  }

  // --- cond ---

  async function condMatches() {
    const result = await interp.eval('(cond (= 1 2) "a" (= 1 1) "b" :else "c")');
    assertEquals(result, 'b');
  }

  async function condNoMatch() {
    const result = await interp.eval('(cond (= 1 2) "a" (= 1 3) "b")');
    assertEquals(result, null);
  }

  async function condElse() {
    const result = await interp.eval('(cond (= 1 2) "a" :else "fallback")');
    assertEquals(result, 'fallback');
  }

  // --- defn ---

  async function defnBasic() {
    const result = await interp.eval('(do (defn f [x] (+ x 1)) (f 5))');
    assertEquals(result, 6);
  }

  async function defnMultiArity() {
    const result = await interp.eval(`
      (do
        (defn f
          ([x] (f x 10))
          ([x y] (+ x y)))
        [(f 5) (f 5 20)])
    `);
    assertDeepEquals(result, [15, 25]);
  }

  // --- Threading macros ---

  async function threadFirst() {
    const result = await interp.eval('(-> 1 inc inc)');
    assertEquals(result, 3);
  }

  async function threadFirstWithArgs() {
    const result = await interp.eval('(-> "hello" str/upper-case (subs 0 3))');
    assertEquals(result, 'HEL');
  }

  async function threadLast() {
    const result = await interp.eval('(->> [1 2 3] (map inc) (filter (fn [x] (> x 2))))');
    assertDeepEquals(result, [3, 4]);
  }

  // --- for ---

  async function forBasic() {
    const result = await interp.eval('(for [x [1 2 3]] (* x x))');
    assertDeepEquals(result, [1, 4, 9]);
  }

  // --- and/or as macros ---

  async function andMacro() {
    const r1 = await interp.eval('(and 1 2 3)');
    assertEquals(r1, 3);
    const r2 = await interp.eval('(and 1 nil 3)');
    assertEquals(r2, null);
    const r3 = await interp.eval('(and)');
    assertEquals(r3, true);
  }

  async function orMacro() {
    const r1 = await interp.eval('(or nil false 3)');
    assertEquals(r1, 3);
    const r2 = await interp.eval('(or nil false)');
    assertEquals(r2, false);
    const r3 = await interp.eval('(or)');
    assertEquals(r3, null);
  }

  // --- Macro expansion is recursive ---

  async function macroRecursiveExpansion() {
    const result = await interp.eval(`
      (do
        (defmacro double-when [test & body]
          \`(when ~test (when ~test ~@body)))
        (double-when true 42))
    `);
    assertEquals(result, 42);
  }

  // --- gensym ---

  async function gensymProducesUnique() {
    const result = await interp.eval('(let [a (gensym "x") b (gensym "x")] (not= a b))');
    assertEquals(result, true);
  }

  // --- Anonymous fn shorthand ---

  function readsAnonFn() {
    const ast = hob.read('#(+ %1 %2)');
    assertEquals(ast.type, 'list');
    assertEquals(ast.elements[0].value, 'fn');
    assertEquals(ast.elements[1].type, 'vector');
    assertEquals(ast.elements[1].elements.length, 2);
    assertEquals(ast.elements[1].elements[0].value, '%1');
    assertEquals(ast.elements[1].elements[1].value, '%2');
  }

  async function anonFnEval() {
    const result = await interp.eval('(map #(+ % 10) [1 2 3])');
    assertDeepEquals(result, [11, 12, 13]);
  }

  async function anonFnMultiArg() {
    const result = await interp.eval('(#(+ %1 %2 %3) 1 2 3)');
    assertEquals(result, 6);
  }

  // --- unless (user-defined macro) ---

  async function unlessMacro() {
    const result = await interp.eval(`
      (do
        (defmacro unless [test & body]
          \`(if ~test nil (do ~@body)))
        (unless false 42))
    `);
    assertEquals(result, 42);
  }

  // --- Run all tests ---

  test('reads quasiquote', readsQuasiquote);
  test('reads unquote', readsUnquote);
  test('reads unquote-splicing', readsUnquoteSplicing);
  await testAsync('quasiquote eval', quasiquoteEval);
  await testAsync('quasiquote splice eval', quasiquoteSpliceEval);
  await testAsync('defmacro basic', defmacroBasic);
  await testAsync('defmacro receives unevaluated forms', defmacroReceivesUnevaluated);
  await testAsync('when true', whenTrue);
  await testAsync('when false', whenFalse);
  await testAsync('when-let truthy', whenLetTruthy);
  await testAsync('when-let nil', whenLetNil);
  await testAsync('cond matches', condMatches);
  await testAsync('cond no match', condNoMatch);
  await testAsync('cond else', condElse);
  await testAsync('defn basic', defnBasic);
  await testAsync('defn multi-arity', defnMultiArity);
  await testAsync('-> thread-first', threadFirst);
  await testAsync('-> thread-first with args', threadFirstWithArgs);
  await testAsync('->> thread-last', threadLast);
  await testAsync('for', forBasic);
  await testAsync('and macro', andMacro);
  await testAsync('or macro', orMacro);
  await testAsync('macro recursive expansion', macroRecursiveExpansion);
  await testAsync('gensym produces unique', gensymProducesUnique);
  test('reads anonymous fn', readsAnonFn);
  await testAsync('anonymous fn eval', anonFnEval);
  await testAsync('anonymous fn multi-arg', anonFnMultiArg);
  await testAsync('unless user-defined macro', unlessMacro);

  return getResults();
}
