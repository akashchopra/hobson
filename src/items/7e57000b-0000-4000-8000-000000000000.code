// Hob Evaluator Tests

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { testAsync, getResults } = createSuite('Hob Evaluator');
  const hob = await api.require('hob-interpreter');

  // Helper: create interpreter without item API for pure eval tests
  const interp = hob.createInterpreter(null);

  async function evalHob(source) {
    return await interp.eval(source);
  }

  // --- Self-evaluating ---

  async function evalsNumber() {
    assertEquals(await evalHob('42'), 42);
  }

  async function evalsString() {
    assertEquals(await evalHob('"hello"'), 'hello');
  }

  async function evalsBoolean() {
    assertEquals(await evalHob('true'), true);
    assertEquals(await evalHob('false'), false);
  }

  async function evalsNil() {
    assertEquals(await evalHob('nil'), null);
  }

  async function evalsKeyword() {
    assert(hob.isKeyword(await evalHob(':foo')), 'Should return a keyword');
  }

  async function evalsVector() {
    assertDeepEquals(await evalHob('[1 2 3]'), [1, 2, 3]);
  }

  async function evalsEmptyList() {
    assertDeepEquals(await evalHob('()'), []);
  }

  async function evalsMap() {
    const result = await evalHob('{:a 1}');
    assert(typeof result === 'object', 'Should return an object');
    // Key is keyword string \u029ea
    assert(Object.keys(result).length === 1, 'Should have one key');
  }

  // --- def ---

  async function evalsDef() {
    assertEquals(await evalHob('(def x 10) x'), 10);
  }

  async function evalsDefFnNaming() {
    await evalHob('(def my-fn (fn [x] x))');
    // We just verify it doesn't error
    assertEquals(await evalHob('(my-fn 42)'), 42);
  }

  // --- fn ---

  async function evalsFn() {
    assertEquals(await evalHob('((fn [x] (+ x 1)) 5)'), 6);
  }

  async function evalsFnMultiBody() {
    assertEquals(await evalHob('((fn [x] (def _ nil) (+ x 1)) 5)'), 6);
  }

  async function evalsFnRestParams() {
    assertDeepEquals(await evalHob('((fn [& xs] xs) 1 2 3)'), [1, 2, 3]);
  }

  async function evalsClosure() {
    assertEquals(await evalHob('(def make-adder (fn [x] (fn [y] (+ x y)))) ((make-adder 10) 5)'), 15);
  }

  // --- let ---

  async function evalsLet() {
    assertEquals(await evalHob('(let [a 1 b 2] (+ a b))'), 3);
  }

  async function evalsLetSequential() {
    assertEquals(await evalHob('(let [a 1 b (+ a 1)] b)'), 2);
  }

  // --- if ---

  async function evalsIfTrue() {
    assertEquals(await evalHob('(if true "yes" "no")'), 'yes');
  }

  async function evalsIfFalse() {
    assertEquals(await evalHob('(if false "yes" "no")'), 'no');
  }

  async function evalsIfNilIsFalsy() {
    assertEquals(await evalHob('(if nil "yes" "no")'), 'no');
  }

  async function evalsIfZeroIsTruthy() {
    assertEquals(await evalHob('(if 0 "yes" "no")'), 'yes');
  }

  async function evalsIfEmptyStringIsTruthy() {
    assertEquals(await evalHob('(if "" "yes" "no")'), 'yes');
  }

  async function evalsIfTwoArgs() {
    assertEquals(await evalHob('(if false "yes")'), null);
  }

  // --- do ---

  async function evalsDo() {
    assertEquals(await evalHob('(do 1 2 3)'), 3);
  }

  // --- quote ---

  async function evalsQuote() {
    assertDeepEquals(await evalHob("'(1 2 3)"), [1, 2, 3]);
  }

  async function evalsQuoteSymbol() {
    const result = await evalHob("'foo");
    assert(result._hobType === 'symbol', 'Quoted symbol should return symbol marker');
    assertEquals(result.value, 'foo');
  }

  // --- and/or ---

  async function evalsAnd() {
    assertEquals(await evalHob('(and 1 2 3)'), 3);
    assertEquals(await evalHob('(and 1 false 3)'), false);
    assertEquals(await evalHob('(and 1 nil 3)'), null);
    assertEquals(await evalHob('(and)'), true);
  }

  async function evalsOr() {
    assertEquals(await evalHob('(or false nil 3)'), 3);
    assertEquals(await evalHob('(or 1 2)'), 1);
    assertEquals(await evalHob('(or false nil)'), null);
    assertEquals(await evalHob('(or)'), null);
  }

  // --- loop/recur ---

  async function evalsLoopRecur() {
    assertEquals(await evalHob('(loop [n 5 acc 1] (if (<= n 1) acc (recur (dec n) (* acc n))))'), 120);
  }

  // --- Keyword as function ---

  async function evalsKeywordAsFunction() {
    const kw = hob.keyword('a');
    assertEquals(await evalHob('(def m {:a 42}) (:a m)'), 42);
  }

  async function evalsKeywordAsFunctionDefault() {
    assertEquals(await evalHob('(def m {:a 42}) (:b m "default")'), 'default');
  }

  // --- Error handling ---

  async function errorsOnUndefinedSymbol() {
    let caught = false;
    try { await evalHob('undefined-var'); }
    catch (e) { caught = true; assert(e.message.includes('Undefined symbol'), 'Should mention undefined symbol'); }
    assert(caught, 'Should throw on undefined symbol');
  }

  async function errorsOnNonFunctionCall() {
    let caught = false;
    try { await evalHob('(42 1 2)'); }
    catch (e) { caught = true; assert(e.message.includes('not a function'), 'Should mention not a function'); }
    assert(caught, 'Should throw on calling non-function');
  }

  // --- Run all tests ---

  await testAsync('evaluates number', evalsNumber);
  await testAsync('evaluates string', evalsString);
  await testAsync('evaluates boolean', evalsBoolean);
  await testAsync('evaluates nil', evalsNil);
  await testAsync('evaluates keyword', evalsKeyword);
  await testAsync('evaluates vector', evalsVector);
  await testAsync('evaluates empty list', evalsEmptyList);
  await testAsync('evaluates map', evalsMap);
  await testAsync('def binds value', evalsDef);
  await testAsync('def names function', evalsDefFnNaming);
  await testAsync('fn creates function', evalsFn);
  await testAsync('fn multi-body returns last', evalsFnMultiBody);
  await testAsync('fn rest params', evalsFnRestParams);
  await testAsync('fn captures closure', evalsClosure);
  await testAsync('let binds sequentially', evalsLet);
  await testAsync('let sequential bindings', evalsLetSequential);
  await testAsync('if true branch', evalsIfTrue);
  await testAsync('if false branch', evalsIfFalse);
  await testAsync('if nil is falsy', evalsIfNilIsFalsy);
  await testAsync('if zero is truthy', evalsIfZeroIsTruthy);
  await testAsync('if empty string is truthy', evalsIfEmptyStringIsTruthy);
  await testAsync('if two args returns nil', evalsIfTwoArgs);
  await testAsync('do returns last', evalsDo);
  await testAsync('quote returns value', evalsQuote);
  await testAsync('quote symbol', evalsQuoteSymbol);
  await testAsync('and short-circuits', evalsAnd);
  await testAsync('or short-circuits', evalsOr);
  await testAsync('loop/recur computes factorial', evalsLoopRecur);
  await testAsync('keyword as function', evalsKeywordAsFunction);
  await testAsync('keyword as function with default', evalsKeywordAsFunctionDefault);
  await testAsync('error on undefined symbol', errorsOnUndefinedSymbol);
  await testAsync('error on non-function call', errorsOnNonFunctionCall);

  return getResults();
}
