const DEFAULT_TIMEOUT = 5000;

export function createSuite(name) {
  const results = [];

  function test(testName, fn) {
    const fullName = name ? `${name} > ${testName}` : testName;
    try {
      fn();
      results.push({ name: fullName, passed: true });
    } catch (e) {
      results.push({ name: fullName, passed: false, error: e.message });
    }
  }

  async function testAsync(testName, fn, timeout = DEFAULT_TIMEOUT) {
    const fullName = name ? `${name} > ${testName}` : testName;
    try {
      await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timed out after ${timeout}ms`)), timeout)
        )
      ]);
      results.push({ name: fullName, passed: true });
    } catch (e) {
      results.push({ name: fullName, passed: false, error: e.message });
    }
  }

  function getResults() {
    return [...results];
  }

  return { test, testAsync, getResults };
}

export function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

export function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

export function assertDeepEquals(actual, expected, message) {
  if (!deepEqual(actual, expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  const isArrayA = Array.isArray(a), isArrayB = Array.isArray(b);
  if (isArrayA !== isArrayB) return false;
  if (isArrayA) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  const keysA = Object.keys(a), keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}

/** Poll for a condition. Useful for waiting on rendering. */
export async function waitFor(fn, { timeout = 2000, interval = 50 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = fn();
    if (result) return result;
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`waitFor timed out after ${timeout}ms`);
}
