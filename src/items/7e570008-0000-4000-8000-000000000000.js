export async function run(api) {
  const { createSuite, assert, assertEquals } = await api.require('test-lib');
  const { testAsync, getResults } = createSuite('Events');

  const ITEM_UPDATED = 'e0e00000-0001-0002-0000-000000000000';

  async function onReceivesEmitted() {
    let received = null;
    const unsub = api.events.on(ITEM_UPDATED, (event) => {
      if (event.content?._testMarker === 'events-test-1') received = event;
    });
    try {
      api.events.emit({
        type: ITEM_UPDATED,
        content: { _testMarker: 'events-test-1', value: 42 }
      });
      assert(received, 'Handler should have been called');
      assertEquals(received.content.value, 42);
      assert(received.timestamp, 'Event should have a timestamp');
    } finally {
      unsub();
    }
  }

  async function offUnsubscribes() {
    let callCount = 0;
    const handler = () => { callCount++; };
    api.events.on(ITEM_UPDATED, handler);

    api.events.emit({ type: ITEM_UPDATED, content: { _testMarker: 'events-test-2' } });
    assertEquals(callCount, 1, 'Handler should be called once');

    api.events.off(ITEM_UPDATED, handler);
    api.events.emit({ type: ITEM_UPDATED, content: { _testMarker: 'events-test-3' } });
    assertEquals(callCount, 1, 'Handler should not be called after off()');
  }

  async function returnedUnsubscribeWorks() {
    let callCount = 0;
    const unsub = api.events.on(ITEM_UPDATED, () => { callCount++; });

    api.events.emit({ type: ITEM_UPDATED, content: { _testMarker: 'events-test-4' } });
    assertEquals(callCount, 1);

    unsub();
    api.events.emit({ type: ITEM_UPDATED, content: { _testMarker: 'events-test-5' } });
    assertEquals(callCount, 1, 'Handler should not fire after unsubscribe');
  }

  async function typeHierarchyDispatch() {
    const PARENT_TYPE = 'e0e00000-0001-0000-0000-000000000000'; // item-event
    let received = false;
    const unsub = api.events.on(PARENT_TYPE, (event) => {
      if (event.content?._testMarker === 'events-test-hierarchy') received = true;
    });
    try {
      api.events.emit({
        type: ITEM_UPDATED,
        content: { _testMarker: 'events-test-hierarchy' }
      });
      assert(received, 'Parent event listener should receive child event');
    } finally {
      unsub();
    }
  }

  await testAsync('on() receives emitted events', onReceivesEmitted);
  await testAsync('off() unsubscribes handler', offUnsubscribes);
  await testAsync('on() returns unsubscribe function', returnedUnsubscribeWorks);
  await testAsync('event type hierarchy dispatch', typeHierarchyDispatch);

  return getResults();
}
