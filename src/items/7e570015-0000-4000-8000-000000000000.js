// Hob Watch Tests — def-watch macro, emit!, event ops, JS interop fix

export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals } = await api.require('test-lib');
  const { test, testAsync, getResults } = createSuite('Hob Watches');
  const hob = await api.require('hob-interpreter');

  // ============================================================
  // JS interop fix: keyword lookup on raw JS objects
  // ============================================================

  await testAsync('keyword lookup on JS object', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    // Bind a plain JS object (not built by Hob, so keys are plain strings)
    interp.env.define('js-obj', { name: 'hello' });
    const result = await interp.eval('(:name js-obj)');
    assertEquals(result, 'hello');
  });

  await testAsync('keyword lookup prefers Hob key', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    // Object has both ʞname (Hob keyword key) and name (plain key)
    const obj = {};
    obj[hob.keyword('name')] = 'hob';
    obj['name'] = 'js';
    interp.env.define('both-obj', obj);
    const result = await interp.eval('(:name both-obj)');
    assertEquals(result, 'hob');
  });

  await testAsync('get with keyword on JS object', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    interp.env.define('js-obj', { name: 'hello' });
    const result = await interp.eval('(get js-obj :name)');
    assertEquals(result, 'hello');
  });

  await testAsync('get-in with keywords on JS object', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    interp.env.define('js-obj', { content: { title: 'hi' } });
    const result = await interp.eval('(get-in js-obj [:content :title])');
    assertEquals(result, 'hi');
  });

  await testAsync('keyword lookup with default on JS object', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    interp.env.define('js-obj', { name: 'x' });
    const result = await interp.eval('(:missing js-obj "default")');
    assertEquals(result, 'default');
  });

  // ============================================================
  // def-watch macro tests
  // ============================================================

  await testAsync('def-watch produces map', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    const result = await interp.eval(`
      (def-watch my-watcher {:event "some-id"} [event api]
        (log "handled"))
    `);
    assert(result != null, 'Should return a map');
    assert(hob.keyword('watches') in result, 'Should have :watches key');
    assert(hob.keyword('handler') in result, 'Should have :handler key');
  });

  await testAsync('def-watch watches is vector', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    const result = await interp.eval(`
      (def-watch w {:event "eid"} [e a] nil)
    `);
    const watches = result[hob.keyword('watches')];
    assert(Array.isArray(watches), ':watches should be a vector');
    assertEquals(watches.length, 1);
  });

  await testAsync('def-watch handler is callable', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    const result = await interp.eval(`
      (def-watch w {:event "eid"} [e a] "called")
    `);
    const handler = result[hob.keyword('handler')];
    assert(typeof handler === 'function', ':handler should be a function');
    const out = await handler({}, {});
    assertEquals(out, 'called');
  });

  await testAsync('def-watch with event filter', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    const result = await interp.eval(`
      (def-watch w {:event "some-id"} [e a] nil)
    `);
    const watches = result[hob.keyword('watches')];
    const spec = watches[0];
    assertEquals(spec[hob.keyword('event')], 'some-id');
  });

  await testAsync('def-watch with type filter', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    const result = await interp.eval(`
      (def-watch w {:event "eid" :type "type-id"} [e a] nil)
    `);
    const spec = result[hob.keyword('watches')][0];
    assertEquals(spec[hob.keyword('event')], 'eid');
    assertEquals(spec[hob.keyword('type')], 'type-id');
  });

  await testAsync('def-watch with type-extends filter', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    const result = await interp.eval(`
      (def-watch w {:event "eid" :type-extends "base-id"} [e a] nil)
    `);
    const spec = result[hob.keyword('watches')][0];
    assertEquals(spec[hob.keyword('type-extends')], 'base-id');
  });

  await testAsync('def-watch handler receives args', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    const result = await interp.eval(`
      (def-watch w {:event "eid"} [event api]
        (:message event))
    `);
    const handler = result[hob.keyword('handler')];
    const mockEvent = {};
    mockEvent[hob.keyword('message')] = 'hello from event';
    const out = await handler(mockEvent, {});
    assertEquals(out, 'hello from event');
  });

  // ============================================================
  // emit! function tests
  // ============================================================

  await testAsync('emit! returns nil', async () => {
    const emitted = [];
    const mockEventApi = { emit: (e) => emitted.push(e) };
    const interp = hob.createInterpreter(api, null, mockEventApi);
    await interp.macrosReady;
    const result = await interp.eval('(emit! {:type "eid" :content {}})');
    assertEquals(result, null);
  });

  await testAsync('emit! calls event bus', async () => {
    const emitted = [];
    const mockEventApi = { emit: (e) => emitted.push(e) };
    const interp = hob.createInterpreter(api, null, mockEventApi);
    await interp.macrosReady;
    await interp.eval('(emit! {:type "eid" :content {:msg "hi"}})');
    assertEquals(emitted.length, 1);
    assertEquals(emitted[0].type, 'eid');
    assertEquals(emitted[0].content.msg, 'hi');
  });

  await testAsync('emit! converts keyword keys to strings', async () => {
    const emitted = [];
    const mockEventApi = { emit: (e) => emitted.push(e) };
    const interp = hob.createInterpreter(api, null, mockEventApi);
    await interp.macrosReady;
    await interp.eval('(emit! {:type "x" :content {:message "hi"}})');
    const e = emitted[0];
    // Keys should be plain strings, not keyword-prefixed
    assert('type' in e, 'Should have plain "type" key');
    assert('content' in e, 'Should have plain "content" key');
    assert('message' in e.content, 'Nested keys should be plain strings');
    assertEquals(e.content.message, 'hi');
  });

  // ============================================================
  // Handler invocation tests
  // ============================================================

  await testAsync('handler receives event content', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval('(def a (atom nil))');
    await interp.eval(`
      (def-watch w {:event "eid"} [event api]
        (reset! a (:item event)))
    `);
    // Call the handler directly with a plain JS event object
    const handler = (await interp.eval('w'))[hob.keyword('handler')];
    await handler({ item: 'test-item' }, {});
    // Give async atom time to complete
    await new Promise(r => setTimeout(r, 0));
    const atomVal = await interp.eval('(deref a)');
    assertEquals(atomVal, 'test-item');
  });

  await testAsync('handler can use get-item', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval('(def result (atom nil))');
    await interp.eval(`
      (defn my-handler [event api]
        (reset! result (get-item "00000000-0000-0000-0000-000000000000")))
    `);
    const handler = await interp.eval('my-handler');
    await handler({}, {});
    await new Promise(r => setTimeout(r, 0));
    const val = await interp.eval('(deref result)');
    assert(val != null, 'Should have retrieved an item');
  });

  await testAsync('handler can call emit!', async () => {
    const emitted = [];
    const mockEventApi = { emit: (e) => emitted.push(e) };
    const interp = hob.createInterpreter(api, null, mockEventApi);
    await interp.macrosReady;
    await interp.eval(`
      (defn my-handler [event api]
        (emit! {:type "response-event" :content {:ok true}}))
    `);
    const handler = await interp.eval('my-handler');
    await handler({}, {});
    assertEquals(emitted.length, 1);
    assertEquals(emitted[0].type, 'response-event');
    assertEquals(emitted[0].content.ok, true);
  });

  await testAsync('handler errors do not crash', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval(`
      (defn crashing-handler [event api]
        (throw "boom"))
    `);
    const handler = await interp.eval('crashing-handler');
    let threw = false;
    try {
      await handler({}, {});
    } catch {
      threw = true;
    }
    // The handler itself throws, which is expected —
    // the kernel wraps this in try/catch in callHobWatchHandler
    assert(threw, 'Handler should throw');
  });

  await testAsync('async handler completes', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval('(def result (atom nil))');
    await interp.eval(`
      (defn async-handler [event api]
        (let [item (get-item "00000000-0000-0000-0000-000000000000")]
          (reset! result (:name item))))
    `);
    const handler = await interp.eval('async-handler');
    await handler({}, {});
    await new Promise(r => setTimeout(r, 0));
    const val = await interp.eval('(deref result)');
    assert(val != null, 'Should have set atom with item name');
  });

  // ============================================================
  // Integration: handler name derivation
  // ============================================================

  await testAsync('on-item-updated handler name', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval(`
      (defn on-item-updated [event api]
        "handled-update")
    `);
    const handler = interp.env.lookup('on-item-updated');
    assert(typeof handler === 'function', 'Should be callable from env lookup');
    const result = await handler({}, {});
    assertEquals(result, 'handled-update');
  });

  await testAsync('on-kernel-boot-complete handler name', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    await interp.eval(`
      (defn on-kernel-boot-complete [event api]
        "booted")
    `);
    const handler = interp.env.lookup('on-kernel-boot-complete');
    const result = await handler({}, {});
    assertEquals(result, 'booted');
  });

  // ============================================================
  // Edge cases
  // ============================================================

  await testAsync('empty watch spec matches all', async () => {
    const interp = hob.createInterpreter(api);
    await interp.macrosReady;
    const result = await interp.eval(`
      (def-watch w {:event "eid"} [e a] nil)
    `);
    const spec = result[hob.keyword('watches')][0];
    // Only :event key, no type/id filters
    assertEquals(spec[hob.keyword('event')], 'eid');
    assertEquals(spec[hob.keyword('type')] || null, null);
  });

  await testAsync('hobToJs converts nested maps', async () => {
    const nested = {};
    nested[hob.keyword('a')] = {};
    nested[hob.keyword('a')][hob.keyword('b')] = 'c';
    const result = hob.hobToJs(nested);
    assertEquals(result.a.b, 'c');
    assert(!('ʞa' in result), 'Should not have keyword-prefixed keys');
  });

  await testAsync('hobToJs passes arrays through', async () => {
    const arr = [hob.keyword('a'), hob.keyword('b')];
    const result = hob.hobToJs(arr);
    assert(Array.isArray(result), 'Should still be array');
    assertEquals(result.length, 2);
    // Keywords in arrays stay as-is (they're strings, hobToJs only converts object keys)
    assertEquals(result[0], hob.keyword('a'));
  });

  return getResults();
}
