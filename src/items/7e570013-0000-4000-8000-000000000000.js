// Hob DOM Tests — parseTag and hiccupToDOM

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { test, testAsync, getResults } = createSuite('Hob DOM');
  const hob = await api.require('hob-interpreter');
  const interp = hob.createInterpreter(api);
  await interp.macrosReady;

  // ============================================================
  // parseTag tests
  // ============================================================

  test('parseTag basic', () => {
    const r = hob.parseTag('div');
    assertEquals(r.tag, 'div');
    assertEquals(r.id, null);
    assertDeepEquals(r.classes, []);
  });

  test('parseTag with class', () => {
    const r = hob.parseTag('div.foo');
    assertEquals(r.tag, 'div');
    assertDeepEquals(r.classes, ['foo']);
  });

  test('parseTag with multiple classes', () => {
    const r = hob.parseTag('div.foo.bar');
    assertEquals(r.tag, 'div');
    assertDeepEquals(r.classes, ['foo', 'bar']);
  });

  test('parseTag with id', () => {
    const r = hob.parseTag('div#main');
    assertEquals(r.tag, 'div');
    assertEquals(r.id, 'main');
  });

  test('parseTag with id and classes', () => {
    const r = hob.parseTag('div#main.foo.bar');
    assertEquals(r.tag, 'div');
    assertEquals(r.id, 'main');
    assertDeepEquals(r.classes, ['foo', 'bar']);
  });

  test('parseTag default tag', () => {
    const r = hob.parseTag('.wrapper');
    assertEquals(r.tag, 'div');
    assertDeepEquals(r.classes, ['wrapper']);
  });

  test('parseTag id only', () => {
    const r = hob.parseTag('#app');
    assertEquals(r.tag, 'div');
    assertEquals(r.id, 'app');
  });

  // ============================================================
  // hiccupToDOM tests
  // ============================================================

  test('hiccup text node', () => {
    const node = hob.hiccupToDOM('hello');
    assert(node.nodeType === 3, 'Should be text node');
    assertEquals(node.textContent, 'hello');
  });

  test('hiccup number node', () => {
    const node = hob.hiccupToDOM(42);
    assert(node.nodeType === 3, 'Should be text node');
    assertEquals(node.textContent, '42');
  });

  test('hiccup null returns null', () => {
    assertEquals(hob.hiccupToDOM(null), null);
    assertEquals(hob.hiccupToDOM(undefined), null);
  });

  test('hiccup simple element', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div')]);
    assert(el.nodeType === 1, 'Should be element');
    assertEquals(el.tagName, 'DIV');
  });

  test('hiccup element with text', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div'), 'hello']);
    assertEquals(el.tagName, 'DIV');
    assertEquals(el.textContent, 'hello');
  });

  test('hiccup element with attrs', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div'), { [kw('id')]: 'foo' }]);
    assertEquals(el.id, 'foo');
  });

  test('hiccup element with class attr', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div'), { [kw('class')]: 'foo bar' }]);
    assert(el.classList.contains('foo'), 'Should have class foo');
    assert(el.classList.contains('bar'), 'Should have class bar');
  });

  test('hiccup element with style object', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div'), { [kw('style')]: { color: 'red', fontSize: '14px' } }]);
    assertEquals(el.style.color, 'red');
    assertEquals(el.style.fontSize, '14px');
  });

  test('hiccup tag classes merge with attr class', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div.a'), { [kw('class')]: 'b' }]);
    assert(el.classList.contains('a'), 'Should have tag class a');
    assert(el.classList.contains('b'), 'Should have attr class b');
  });

  test('hiccup nested elements', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div'), [kw('span'), 'hi']]);
    assertEquals(el.children.length, 1);
    assertEquals(el.children[0].tagName, 'SPAN');
    assertEquals(el.children[0].textContent, 'hi');
  });

  test('hiccup multiple children', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div'), 'a', 'b', 'c']);
    assertEquals(el.childNodes.length, 3);
    assertEquals(el.textContent, 'abc');
  });

  test('hiccup boolean true attr', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('input'), { [kw('disabled')]: true }]);
    assert(el.hasAttribute('disabled'), 'Should have disabled attr');
  });

  test('hiccup boolean false attr skipped', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('input'), { [kw('disabled')]: false }]);
    assert(!el.hasAttribute('disabled'), 'Should not have disabled attr');
  });

  test('hiccup event handler', () => {
    const kw = hob.keyword;
    let clicked = false;
    const handler = () => { clicked = true; };
    const el = hob.hiccupToDOM([kw('button'), { [kw('on-click')]: handler }, 'Click']);
    el.click();
    assert(clicked, 'Click handler should have fired');
  });

  test('hiccup mixed children', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div'), 'text', [kw('span'), 'child'], 42]);
    assertEquals(el.childNodes.length, 3);
    assertEquals(el.childNodes[0].textContent, 'text');
    assertEquals(el.childNodes[1].tagName, 'SPAN');
    assertEquals(el.childNodes[2].textContent, '42');
  });

  test('hiccup deeply nested', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM(
      [kw('div'), [kw('section'), [kw('p'), [kw('strong'), 'deep']]]]
    );
    assertEquals(el.querySelector('strong').textContent, 'deep');
  });

  test('hiccup DOM passthrough', () => {
    const kw = hob.keyword;
    const existing = document.createElement('span');
    existing.textContent = 'existing';
    const el = hob.hiccupToDOM([kw('div'), existing]);
    assert(el.contains(existing), 'Should contain existing DOM node');
  });

  test('hiccup empty attrs object', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div'), {}, 'text']);
    assertEquals(el.textContent, 'text');
  });

  test('hiccup keyword to tag name', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('h1'), 'Title']);
    assertEquals(el.tagName, 'H1');
  });

  test('hiccup tag with id and class', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div#app.container.main')]);
    assertEquals(el.id, 'app');
    assert(el.classList.contains('container'), 'Should have class container');
    assert(el.classList.contains('main'), 'Should have class main');
  });

  test('hiccup style with keyword keys', () => {
    const kw = hob.keyword;
    const el = hob.hiccupToDOM([kw('div'), { [kw('style')]: { [kw('color')]: 'blue' } }]);
    assertEquals(el.style.color, 'blue');
  });

  test('hiccup flattens nested arrays from map', () => {
    const kw = hob.keyword;
    // Simulate what (map ...) produces: an array of hiccup elements
    const children = [[kw('li'), 'a'], [kw('li'), 'b'], [kw('li'), 'c']];
    const el = hob.hiccupToDOM([kw('ul'), children]);
    assertEquals(el.children.length, 3);
    assertEquals(el.children[0].tagName, 'LI');
    assertEquals(el.children[2].textContent, 'c');
  });

  // ============================================================
  // hiccupToDOM via Hob eval
  // ============================================================

  await testAsync('hiccup from Hob eval', async () => {
    const result = await interp.eval('(hiccup->dom [:div "hello"])');
    assert(result.nodeType === 1, 'Should be element');
    assertEquals(result.tagName, 'DIV');
    assertEquals(result.textContent, 'hello');
  });

  await testAsync('hiccup with Hob-computed attrs', async () => {
    const result = await interp.eval('(hiccup->dom [:div {:class (str "a" "-" "b")} "x"])');
    assert(result.classList.contains('a-b'), 'Should have computed class');
  });

  await testAsync('hiccup with Hob-generated children', async () => {
    const result = await interp.eval('(hiccup->dom [:ul (map (fn [x] [:li x]) ["a" "b" "c"])])');
    assertEquals(result.children.length, 3);
    assertEquals(result.children[0].textContent, 'a');
    assertEquals(result.children[2].textContent, 'c');
  });

  await testAsync('prStr DOM node', async () => {
    const result = await interp.eval('(str (hiccup->dom [:div "hi"]))');
    assertEquals(result, '#<dom div>');
  });

  return getResults();
}
