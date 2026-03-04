// Hob Reader Tests

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { test, testAsync, getResults } = createSuite('Hob Reader');
  const hob = await api.require('hob-interpreter');

  // --- Primitives ---

  function readsInteger() {
    const ast = hob.read('42');
    assertEquals(typeof ast, 'number');
    assertEquals(ast, 42);
  }

  function readsNegativeNumber() {
    const ast = hob.read('-7');
    assertEquals(typeof ast, 'number');
    assertEquals(ast, -7);
  }

  function readsFloat() {
    const ast = hob.read('3.14');
    assertEquals(typeof ast, 'number');
    assertEquals(ast, 3.14);
  }

  function readsString() {
    const ast = hob.read('"hello world"');
    assertEquals(typeof ast, 'object');
    assertEquals(ast.s, 'hello world');
  }

  function readsStringEscapes() {
    const ast = hob.read('"line1\\nline2\\ttab\\\\back\\"quote"');
    assertEquals(ast.s, 'line1\nline2\ttab\\back"quote');
  }

  function readsTrue() {
    const ast = hob.read('true');
    assertEquals(ast, true);
  }

  function readsFalse() {
    const ast = hob.read('false');
    assertEquals(ast, false);
  }

  function readsNil() {
    const ast = hob.read('nil');
    assertEquals(ast, null);
  }

  function readsKeyword() {
    const ast = hob.read(':title');
    assertEquals(typeof ast, 'string');
    assertEquals(ast, ':title');
  }

  function readsSymbol() {
    const ast = hob.read('foo-bar');
    assertEquals(typeof ast, 'string');
    assertEquals(ast, 'foo-bar');
  }

  function readsItemRefName() {
    const ast = hob.read('@my-note');
    assertEquals(typeof ast, 'string');
    assertEquals(ast, '@my-note');
  }

  function readsItemRefUUID() {
    const ast = hob.read('@a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    assertEquals(ast, '@a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  }

  // --- Collections ---

  function readsList() {
    const ast = hob.read('(+ 1 2)');
    assert(Array.isArray(ast), 'Should be an array (list)');
    assertEquals(ast.length, 3);
    assertEquals(ast[0], '+');
    assertEquals(ast[1], 1);
    assertEquals(ast[2], 2);
  }

  function readsEmptyList() {
    const ast = hob.read('()');
    assert(Array.isArray(ast), 'Should be an array');
    assertEquals(ast.length, 0);
  }

  function readsVector() {
    const ast = hob.read('[1 2 3]');
    assert(ast.v !== undefined, 'Should have .v property (vector)');
    assertEquals(ast.v.length, 3);
    assertEquals(ast.v[0], 1);
  }

  function readsMap() {
    const ast = hob.read('{:a 1 :b 2}');
    assert(ast.m !== undefined, 'Should have .m property (map)');
    assertEquals(ast.m.length, 2);
    assertEquals(ast.m[0][0], ':a');
    assertEquals(ast.m[0][1], 1);
  }

  function readsNestedCollections() {
    const ast = hob.read('(def m {:names ["alice" "bob"]})');
    assert(Array.isArray(ast), 'Should be an array (list)');
    assertEquals(ast.length, 3);
    assert(ast[2].m !== undefined, 'Third element should be a map');
    assert(ast[2].m[0][1].v !== undefined, 'Map value should be a vector');
  }

  // --- Whitespace and comments ---

  function commasAsWhitespace() {
    const ast = hob.read('[1, 2, 3]');
    assert(ast.v !== undefined, 'Should be a vector');
    assertEquals(ast.v.length, 3);
  }

  function commentsIgnored() {
    const ast = hob.read('(+ 1 ; this is a comment\n2)');
    assert(Array.isArray(ast), 'Should be a list');
    assertEquals(ast.length, 3);
    assertEquals(ast[2], 2);
  }

  // --- Quote ---

  function quoteShorthand() {
    const ast = hob.read("'(1 2 3)");
    assert(Array.isArray(ast), 'Should be a list');
    assertEquals(ast.length, 2);
    assertEquals(ast[0], 'quote');
    assert(Array.isArray(ast[1]), 'Second element should be a list');
  }

  // --- Source locations ---
  // Compact JSON format does not carry source locations — test removed

  // --- Error cases ---

  function errorOnUnterminatedString() {
    let caught = false;
    try { hob.read('"unterminated'); } catch (e) { caught = true; assert(e.message.includes('Unterminated'), 'Should mention unterminated'); }
    assert(caught, 'Should throw on unterminated string');
  }

  function errorOnUnterminatedList() {
    let caught = false;
    try { hob.read('(+ 1 2'); } catch (e) { caught = true; assert(e.message.includes('Unterminated'), 'Should mention unterminated'); }
    assert(caught, 'Should throw on unterminated list');
  }

  function errorOnSetLiteral() {
    let caught = false;
    try { hob.read('#{1 2 3}'); } catch (e) { caught = true; assert(e.message.includes('not yet supported'), 'Should mention sets not supported'); }
    assert(caught, 'Should throw on set literal');
  }

  function errorOnOddMapForms() {
    let caught = false;
    try { hob.read('{:a 1 :b}'); } catch (e) { caught = true; assert(e.message.includes('even number'), 'Should mention even number'); }
    assert(caught, 'Should throw on odd map forms');
  }

  function errorOnEmptyInput() {
    let caught = false;
    try { hob.read(''); } catch (e) { caught = true; }
    assert(caught, 'Should throw on empty input');
  }

  // --- Run all tests ---

  test('reads integer', readsInteger);
  test('reads negative number', readsNegativeNumber);
  test('reads float', readsFloat);
  test('reads string', readsString);
  test('reads string escapes', readsStringEscapes);
  test('reads true', readsTrue);
  test('reads false', readsFalse);
  test('reads nil', readsNil);
  test('reads keyword', readsKeyword);
  test('reads symbol', readsSymbol);
  test('reads item ref (name)', readsItemRefName);
  test('reads item ref (UUID)', readsItemRefUUID);
  test('reads list', readsList);
  test('reads empty list', readsEmptyList);
  test('reads vector', readsVector);
  test('reads map', readsMap);
  test('reads nested collections', readsNestedCollections);
  test('commas as whitespace', commasAsWhitespace);
  test('comments ignored', commentsIgnored);
  test('quote shorthand', quoteShorthand);
  test('error on unterminated string', errorOnUnterminatedString);
  test('error on unterminated list', errorOnUnterminatedList);
  test('error on set literal', errorOnSetLiteral);
  test('error on odd map forms', errorOnOddMapForms);
  test('error on empty input', errorOnEmptyInput);

  return getResults();
}
