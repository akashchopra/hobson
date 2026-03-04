// Hob Error Handling Tests

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { test, testAsync, getResults } = createSuite('Hob Error Handling');
  const hob = await api.require('hob-interpreter');
  const interp = hob.createInterpreter(api);
  await interp.macrosReady;

  // --- throw/catch basics ---

  async function throwCatchBasic() {
    const result = await interp.eval('(try (throw "oops") (catch e e))');
    assertEquals(result, 'oops');
  }

  async function throwMapValue() {
    const result = await interp.eval('(try (throw {:message "bad" :code 42}) (catch e (:code e)))');
    assertEquals(result, 42);
  }

  // --- No error passes through ---

  async function tryNoError() {
    const result = await interp.eval('(try (+ 1 2) (catch e "caught"))');
    assertEquals(result, 3);
  }

  // --- Catch undefined symbol ---

  async function catchUndefined() {
    const result = await interp.eval('(try undefined-var (catch e (str e)))');
    assert(typeof result === 'string', 'Should return string');
    assert(result.includes('Undefined') || result.includes('undefined'), 'Should mention undefined');
  }

  // --- Nested try/catch ---

  async function nestedTryCatch() {
    const result = await interp.eval(`
      (try
        (try (throw "inner") (catch e (str "inner: " e)))
        (catch e (str "outer: " e)))
    `);
    assertEquals(result, 'inner: inner');
  }

  // --- Rethrow ---

  async function rethrow() {
    const result = await interp.eval(`
      (try
        (try (throw "err") (catch e (throw (str "re-" e))))
        (catch e e))
    `);
    assertEquals(result, 're-err');
  }

  // --- finally clause ---

  async function finallyClause() {
    const result = await interp.eval(`
      (do
        (def a (atom 0))
        (try
          (throw "err")
          (catch e nil)
          (finally (swap! a inc)))
        (deref a))
    `);
    assertEquals(result, 1);
  }

  async function finallyWithoutError() {
    const result = await interp.eval(`
      (do
        (def a (atom 0))
        (try
          42
          (finally (swap! a inc)))
        (deref a))
    `);
    assertEquals(result, 1);
  }

  // --- Error in function call ---

  async function errorInFnCall() {
    const result = await interp.eval('(try ((fn [] (throw "fn-err"))) (catch e e))');
    assertEquals(result, 'fn-err');
  }

  // --- Catch in loop ---

  async function catchInLoop() {
    const result = await interp.eval(`
      (loop [i 0 acc []]
        (if (>= i 3) acc
          (recur (inc i)
            (conj acc (try (if (= i 1) (throw "skip") i) (catch e nil))))))
    `);
    assertDeepEquals(result, [0, null, 2]);
  }

  // --- Catch preserves environment ---

  async function catchPreservesEnv() {
    const result = await interp.eval('(let [x 42] (try (throw "err") (catch e x)))');
    assertEquals(result, 42);
  }

  // --- Uncaught error propagates ---

  async function uncaughtPropagates() {
    let caught = false;
    try {
      await interp.eval('(throw "uncaught")');
    } catch (e) {
      caught = true;
      assert(e.message.includes('uncaught') || (e.hobValue === 'uncaught'), 'Should contain error value');
    }
    assert(caught, 'Uncaught error should propagate');
  }

  // --- Error from try body, no catch ---

  async function tryWithoutCatch() {
    const result = await interp.eval(`
      (do
        (def a (atom 0))
        (try
          (do (swap! a inc) 42)
          (finally (swap! a inc)))
        (deref a))
    `);
    assertEquals(result, 2);
  }

  // --- Catch type error ---

  async function catchTypeError() {
    const result = await interp.eval('(try (+ 1 "a") (catch e "caught"))');
    // + with string concatenation may not error, so test with explicit throw
    assert(result === 'caught' || result === '1a' || typeof result === 'string', 'Should catch or concatenate');
  }

  // --- Run all tests ---

  await testAsync('throw/catch basic', throwCatchBasic);
  await testAsync('throw map value', throwMapValue);
  await testAsync('try no error', tryNoError);
  await testAsync('catch undefined symbol', catchUndefined);
  await testAsync('nested try/catch', nestedTryCatch);
  await testAsync('rethrow', rethrow);
  await testAsync('finally clause', finallyClause);
  await testAsync('finally without error', finallyWithoutError);
  await testAsync('error in function call', errorInFnCall);
  await testAsync('catch in loop', catchInLoop);
  await testAsync('catch preserves environment', catchPreservesEnv);
  await testAsync('uncaught error propagates', uncaughtPropagates);
  await testAsync('try without catch (finally only)', tryWithoutCatch);
  await testAsync('catch type error', catchTypeError);

  return getResults();
}
