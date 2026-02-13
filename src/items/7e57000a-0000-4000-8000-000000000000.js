// Hob Reader Tests

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { test, testAsync, getResults } = createSuite('Hob Reader');
  const hob = await api.require('hob-interpreter');

  // --- Primitives ---

  function readsInteger() {
    const ast = hob.read('42');
    assertEquals(ast.type, 'number');
    assertEquals(ast.value, 42);
  }

  function readsNegativeNumber() {
    const ast = hob.read('-7');
    assertEquals(ast.type, 'number');
    assertEquals(ast.value, -7);
  }

  function readsFloat() {
    const ast = hob.read('3.14');
    assertEquals(ast.type, 'number');
    assertEquals(ast.value, 3.14);
  }

  function readsString() {
    const ast = hob.read('"hello world"');
    assertEquals(ast.type, 'string');
    assertEquals(ast.value, 'hello world');
  }

  function readsStringEscapes() {
    const ast = hob.read('"line1\\nline2\\ttab\\\\back\\"quote"');
    assertEquals(ast.type, 'string');
    assertEquals(ast.value, 'line1\nline2\ttab\\back"quote');
  }

  function readsTrue() {
    const ast = hob.read('true');
    assertEquals(ast.type, 'boolean');
    assertEquals(ast.value, true);
  }

  function readsFalse() {
    const ast = hob.read('false');
    assertEquals(ast.type, 'boolean');
    assertEquals(ast.value, false);
  }

  function readsNil() {
    const ast = hob.read('nil');
    assertEquals(ast.type, 'nil');
    assertEquals(ast.value, null);
  }

  function readsKeyword() {
    const ast = hob.read(':title');
    assertEquals(ast.type, 'keyword');
    assertEquals(ast.value, 'title');
  }

  function readsSymbol() {
    const ast = hob.read('foo-bar');
    assertEquals(ast.type, 'symbol');
    assertEquals(ast.value, 'foo-bar');
  }

  function readsItemRefName() {
    const ast = hob.read('@my-note');
    assertEquals(ast.type, 'item-ref');
    assertEquals(ast.value, 'my-note');
  }

  function readsItemRefUUID() {
    const ast = hob.read('@a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    assertEquals(ast.type, 'item-ref');
    assertEquals(ast.value, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  }

  // --- Collections ---

  function readsList() {
    const ast = hob.read('(+ 1 2)');
    assertEquals(ast.type, 'list');
    assertEquals(ast.elements.length, 3);
    assertEquals(ast.elements[0].value, '+');
    assertEquals(ast.elements[1].value, 1);
    assertEquals(ast.elements[2].value, 2);
  }

  function readsEmptyList() {
    const ast = hob.read('()');
    assertEquals(ast.type, 'list');
    assertEquals(ast.elements.length, 0);
  }

  function readsVector() {
    const ast = hob.read('[1 2 3]');
    assertEquals(ast.type, 'vector');
    assertEquals(ast.elements.length, 3);
    assertEquals(ast.elements[0].value, 1);
  }

  function readsMap() {
    const ast = hob.read('{:a 1 :b 2}');
    assertEquals(ast.type, 'map');
    assertEquals(ast.entries.length, 2);
    assertEquals(ast.entries[0][0].value, 'a'); // keyword value
    assertEquals(ast.entries[0][1].value, 1);
  }

  function readsNestedCollections() {
    const ast = hob.read('(def m {:names ["alice" "bob"]})');
    assertEquals(ast.type, 'list');
    assertEquals(ast.elements.length, 3);
    assertEquals(ast.elements[2].type, 'map');
    assertEquals(ast.elements[2].entries[0][1].type, 'vector');
  }

  // --- Whitespace and comments ---

  function commasAsWhitespace() {
    const ast = hob.read('[1, 2, 3]');
    assertEquals(ast.type, 'vector');
    assertEquals(ast.elements.length, 3);
  }

  function commentsIgnored() {
    const ast = hob.read('(+ 1 ; this is a comment\n2)');
    assertEquals(ast.type, 'list');
    assertEquals(ast.elements.length, 3);
    assertEquals(ast.elements[2].value, 2);
  }

  // --- Quote ---

  function quoteShorthand() {
    const ast = hob.read("'(1 2 3)");
    assertEquals(ast.type, 'list');
    assertEquals(ast.elements.length, 2);
    assertEquals(ast.elements[0].value, 'quote');
    assertEquals(ast.elements[1].type, 'list');
  }

  // --- Source locations ---

  function tracksSourceLocations() {
    const ast = hob.read('(+ 1 2)');
    assertEquals(ast.line, 1);
    assertEquals(ast.col, 0);
  }

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
  test('tracks source locations', tracksSourceLocations);
  test('error on unterminated string', errorOnUnterminatedString);
  test('error on unterminated list', errorOnUnterminatedList);
  test('error on set literal', errorOnSetLiteral);
  test('error on odd map forms', errorOnOddMapForms);
  test('error on empty input', errorOnEmptyInput);

  return getResults();
}
