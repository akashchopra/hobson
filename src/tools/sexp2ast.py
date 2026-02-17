#!/usr/bin/env python3
"""Convert Hob s-expression text to compact JSON AST.

Usage: python3 sexp2ast.py input.sexp > output.json

Compact JSON AST format:
  null          → nil
  number        → number
  true/false    → boolean
  "symbol"      → symbol (plain JSON string)
  ":keyword"    → keyword (JSON string starting with :)
  "@item-ref"   → item reference (JSON string starting with @)
  {"s": "..."}  → string literal
  {"v": [...]}  → vector
  {"m": [[k,v],...]} → map
  [...]         → list (function call)
"""

import json, sys, re

class Reader:
    def __init__(self, text):
        self.text = text
        self.pos = 0

    def peek(self):
        self._skip_ws()
        if self.pos >= len(self.text):
            return None
        return self.text[self.pos]

    def _skip_ws(self):
        while self.pos < len(self.text):
            c = self.text[self.pos]
            if c == ';':
                # Line comment
                while self.pos < len(self.text) and self.text[self.pos] != '\n':
                    self.pos += 1
            elif c in ' \t\n\r,':
                self.pos += 1
            else:
                break

    def read_one(self):
        self._skip_ws()
        if self.pos >= len(self.text):
            return None
        c = self.text[self.pos]

        if c == '(':
            return self._read_list()
        elif c == '[':
            return self._read_vector()
        elif c == '{':
            return self._read_map()
        elif c == '"':
            return self._read_string()
        elif c == '@':
            return self._read_item_ref()
        else:
            return self._read_atom()

    def _read_list(self):
        self.pos += 1  # skip (
        items = []
        while True:
            self._skip_ws()
            if self.pos >= len(self.text):
                raise ValueError("Unterminated list")
            if self.text[self.pos] == ')':
                self.pos += 1
                return items
            items.append(self.read_one())

    def _read_vector(self):
        self.pos += 1  # skip [
        items = []
        while True:
            self._skip_ws()
            if self.pos >= len(self.text):
                raise ValueError("Unterminated vector")
            if self.text[self.pos] == ']':
                self.pos += 1
                return {"v": items}
            items.append(self.read_one())

    def _read_map(self):
        self.pos += 1  # skip {
        pairs = []
        while True:
            self._skip_ws()
            if self.pos >= len(self.text):
                raise ValueError("Unterminated map")
            if self.text[self.pos] == '}':
                self.pos += 1
                return {"m": pairs}
            k = self.read_one()
            v = self.read_one()
            pairs.append([k, v])

    def _read_string(self):
        self.pos += 1  # skip opening "
        result = []
        while self.pos < len(self.text):
            c = self.text[self.pos]
            if c == '\\':
                self.pos += 1
                if self.pos >= len(self.text):
                    raise ValueError("Unterminated string escape")
                esc = self.text[self.pos]
                if esc == 'n': result.append('\n')
                elif esc == 't': result.append('\t')
                elif esc == '"': result.append('"')
                elif esc == '\\': result.append('\\')
                else: result.append('\\'); result.append(esc)
                self.pos += 1
            elif c == '"':
                self.pos += 1
                return {"s": ''.join(result)}
            else:
                result.append(c)
                self.pos += 1
        raise ValueError("Unterminated string")

    def _read_item_ref(self):
        self.pos += 1  # skip @
        start = self.pos
        while self.pos < len(self.text) and self.text[self.pos] not in ' \t\n\r,()[]{};"':
            self.pos += 1
        return "@" + self.text[start:self.pos]

    def _read_atom(self):
        start = self.pos
        while self.pos < len(self.text) and self.text[self.pos] not in ' \t\n\r,()[]{};"':
            self.pos += 1
        token = self.text[start:self.pos]

        if token == 'nil': return None
        if token == 'true': return True
        if token == 'false': return False

        # Try number
        try:
            if '.' in token:
                return float(token)
            return int(token)
        except ValueError:
            pass

        # Symbol or keyword (keywords start with :)
        return token

    def read_all(self):
        results = []
        while True:
            self._skip_ws()
            if self.pos >= len(self.text):
                break
            results.append(self.read_one())
        return results


def main():
    if len(sys.argv) < 2:
        text = sys.stdin.read()
    else:
        with open(sys.argv[1], 'r') as f:
            text = f.read()

    reader = Reader(text)
    ast = reader.read_all()
    print(json.dumps(ast, ensure_ascii=False))


if __name__ == '__main__':
    main()
