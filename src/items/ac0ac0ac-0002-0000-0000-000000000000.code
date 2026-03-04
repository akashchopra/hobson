if (!window.acorn) {
  throw new Error('acorn-wrapper: window.acorn not found. Load the acorn library first: await api.require("acorn")');
}

const acorn = window.acorn;
delete window.acorn;

export default acorn;
export const parse = acorn.parse;
export const tokenizer = acorn.tokenizer;
export const Parser = acorn.Parser;