---
description: "Reference for writing Hobson test suites: test-lib API, all assertion functions, waitFor, naming conventions for symbol tracking, and test skeleton."
user-invocable: false
---

# Test Runner — Writing Guide

Tests in Hobson are items. They run inside nested instances (isolated storage + DOM), exercise real code, and display results as rendered items.

## Key GUIDs

| Item | GUID |
|------|------|
| `test-suite` type | `7e570002-0000-4000-8000-000000000000` |
| `test-lib` | `7e570001-0000-4000-8000-000000000000` |
| Test tag (for discovery) | `c0c0c0c0-0070-0000-0000-000000000000` |
| Testing doc | `c0c0c0c0-0036-0000-0000-000000000000` |

## Test Suite Item Structure

```json
{
  "id": "<guid>",
  "name": "My Feature Tests",
  "type": "7e570002-0000-4000-8000-000000000000",
  "content": {
    "code": "...",
    "tags": ["c0c0c0c0-0070-0000-0000-000000000000"]
  },
  "attachments": []
}
```

The `code` field exports a single `run(api)` function.

## Test Function Contract

```javascript
export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals, waitFor }
    = await api.require('test-lib');

  const { test, testAsync, getResults } = createSuite('My Feature');

  function myFirstTest() {
    assert(1 + 1 === 2, '1+1 should be 2');
  }

  async function myAsyncTest() {
    const item = await api.get('some-id');
    assertEquals(item.name, 'expected name');
  }

  test('arithmetic works', myFirstTest);
  await testAsync('async item fetch', myAsyncTest);

  return getResults();
}
```

`getResults()` returns an array of `{ name, passed, error?, symbol? }` objects. The test runner view renders these as pass/fail rows.

## test-lib API

### `createSuite(name)` → `{ test, testAsync, getResults }`

| Method | Signature | Notes |
|--------|-----------|-------|
| `test` | `(name, fn)` | Sync test — throws on assertion failure |
| `testAsync` | `(name, fn, timeout?)` | Async test — default 5s timeout |
| `getResults` | `()` → array | Results for all tests registered so far |

### Assertions

| Function | Signature | Notes |
|----------|-----------|-------|
| `assert` | `(condition, message?)` | Throw if falsy |
| `assertEquals` | `(actual, expected, message?)` | Strict `===` equality |
| `assertDeepEquals` | `(actual, expected, message?)` | Recursive structural equality |
| `waitFor` | `(fn, opts?)` | Poll `fn()` until truthy; throws on timeout |

`waitFor` options: `{ timeout: 2000, interval: 50 }` (ms). Use for waiting on rendering or async side effects.

## Naming Functions for Symbol Tracking

Name your test functions — the runner uses `fn.name` as the `symbol` field in results, which links result rows to source code in the System Browser:

```javascript
// Good — symbol will be "myTest"
async function myTest() { ... }
await testAsync('my test', myTest);

// Less useful — symbol will be null
await testAsync('my test', async () => { ... });
```

## Testing Patterns

### Testing storage
```javascript
async function itemRoundTrip() {
  const id = crypto.randomUUID();
  await api.set({ id, name: 'Test', type: 'some-type', content: {}, attachments: [], created: Date.now(), modified: Date.now() });
  const fetched = await api.get(id);
  assertEquals(fetched.name, 'Test');
}
await testAsync('item round-trip', itemRoundTrip);
```

### Testing with waitFor
```javascript
async function reRenderTest() {
  await someAction();
  const el = await waitFor(() => document.querySelector('.expected-class'));
  assert(el !== null, 'element should appear after action');
}
await testAsync('re-render after action', reRenderTest);
```

### Always fetch fresh inside tests
Apply the same stale-closure rule as in views — always `api.get(id)` rather than asserting on a local variable from an earlier fetch.

## Running Tests

Tests are discovered via the test tag `c0c0c0c0-0070-0000-0000-000000000000` and run by the test runner view. Each suite runs inside its own nested instance (isolated storage + DOM); the instance is deleted after the run.

## Suite Skeleton

```javascript
export async function run(api) {
  const { createSuite, assert, assertEquals, assertDeepEquals, waitFor }
    = await api.require('test-lib');

  const { test, testAsync, getResults } = createSuite('Suite Name');

  function syncExample() {
    assert(true, 'basic truth');
  }

  async function asyncExample() {
    const item = await api.get('some-guid');
    assertEquals(item?.name, 'expected');
  }

  test('sync example', syncExample);
  await testAsync('async example', asyncExample);

  return getResults();
}
```
