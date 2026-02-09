const CODE_TYPE = '22222222-0000-0000-0000-000000000000';
const LIBRARY_TYPE = '66666666-0000-0000-0000-000000000000';
const ITEM_TYPE = '00000000-0000-0000-0000-000000000000';
const NOTE_TYPE = '871ae771-b9b1-4f40-8c7f-d9038bfb69c3';

export async function run(api) {
  const { createSuite, assert, assertEquals } = await api.require('test-lib');
  const { testAsync, getResults } = createSuite('Module System');

  async function requiresByName() {
    const mod = await api.require('test-lib');
    assert(mod, 'require should return a module');
    assert(typeof mod.createSuite === 'function', 'Module should export createSuite');
    assert(typeof mod.assert === 'function', 'Module should export assert');
    assert(typeof mod.waitFor === 'function', 'Module should export waitFor');
  }

  async function requiresById() {
    const mod = await api.require('7e570001-0000-4000-8000-000000000000');
    assert(mod, 'require by ID should return a module');
    assert(typeof mod.createSuite === 'function', 'Module should export createSuite');
  }

  async function returnsCachedModule() {
    const mod1 = await api.require('test-lib');
    const mod2 = await api.require('test-lib');
    assert(mod1 === mod2, 'Repeated require should return cached module');
  }

  async function throwsOnMissing() {
    let threw = false;
    try {
      await api.require('definitely-does-not-exist-' + Date.now());
    } catch (e) {
      threw = true;
      assert(e.message.includes('not found'), 'Error should mention "not found"');
    }
    assert(threw, 'require of non-existent module should throw');
  }

  async function libraryExtendsCode() {
    const result = await api.typeChainIncludes(LIBRARY_TYPE, CODE_TYPE);
    assert(result, 'Library type chain should include code type');
  }

  async function codeExtendsItem() {
    const result = await api.typeChainIncludes(CODE_TYPE, ITEM_TYPE);
    assert(result, 'Code type chain should include item type');
  }

  async function noteDoesNotExtendCode() {
    const result = await api.typeChainIncludes(NOTE_TYPE, CODE_TYPE);
    assert(!result, 'Note type chain should not include code type');
  }

  await testAsync('requires a library by name', requiresByName);
  await testAsync('requires a library by ID', requiresById);
  await testAsync('returns same module on repeated require', returnsCachedModule);
  await testAsync('throws on non-existent module', throwsOnMissing);
  await testAsync('typeChainIncludes: library extends code', libraryExtendsCode);
  await testAsync('typeChainIncludes: code extends item', codeExtendsItem);
  await testAsync('typeChainIncludes: note does not extend code', noteDoesNotExtendCode);

  return getResults();
}
