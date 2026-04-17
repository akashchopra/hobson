#!/usr/bin/env python3
"""
Updates sailing-light-lib and all callers for the statesMap API change.
Run from the repo root: python3 src/tools/update_states_api.py
"""
import json
import time
import os

BASE = os.path.join(os.path.dirname(__file__), '..', 'items')

def item_path(guid):
    return os.path.join(BASE, guid + '.json')

def load(guid):
    with open(item_path(guid)) as f:
        return json.load(f)

def save(guid, data):
    data['modified'] = int(time.time() * 1000)
    with open(item_path(guid), 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  updated {guid} ({data['name']})")

# ── 1. Update sailing-light-lib ──────────────────────────────────────────────

LIB_ID = 'c313e1de-36b0-48e1-a359-da28748c48d1'
code_path = os.path.join(BASE, LIB_ID + '.code')

with open(code_path) as f:
    new_code = f.read()

lib = load(LIB_ID)
lib['content']['code'] = new_code
lib['content']['_symbols']['render']['signature'] = '(api, boat, statesMap)'
save(LIB_ID, lib)

# ── 2. Update all callers ────────────────────────────────────────────────────

CALLERS = [
    '38f026e4-3a43-4050-9b28-0db8b4c25e9f',   # Power Vessel over 50m
    '646a0ac4-e5b5-40c0-aa87-2737dabf3b60',   # Pilot Boat
    '569ad717-194a-44f1-9173-f511b34e2c85',   # Vessel Constrained By Draught
    '853eb1fa-9fde-4ce6-9b20-364d48d2b105',   # Vessel Aground
    '55d41767-ecdc-4878-9d76-0d407fbcc2b6',   # Vessel Not Under Command
    '0b355fa7-7204-43e9-9011-a3ffc3949a21',   # Vessel Restricted In Ability To Manoeuvre
    '513800ea-e6c7-4df8-81c6-329869d2e394',   # Towing Vessel
    '96b641b9-dc6a-448c-898f-a03baf7f5e2c',   # Minesweeper
    'e4d101a4-9a79-453e-bff2-9f75aa0f49b1',   # Fishing Vessel
    'c52ce1c2-9fe2-45f0-af8d-7b37510de759',   # Trawling Vessel
    'bbb647fe-08c1-4807-82c2-f6f1f2d88120',   # Power Vessel
    'b4ce061e-ac24-482b-9356-f7612850db8d',   # Sailing Vessel
    'e9f9a12f-cee3-408a-9013-cf9aa9124f6f',   # Vessel At Anchor > 50m
    'bb4b8bf9-3e2b-4693-bbda-e878bba8f73f',   # Vessel At Anchor
    'd47f1c1c-4209-441d-80eb-05530f3a7b85',   # Sailing Vessel > 20m
]

MAKING_WAY_MAP = {"m": [[{"s": "Making Way"}, "lights"]]}

def patch_render_call(node):
    """Recursively find ["lib/render", "api", {...}, "lights"] and wrap last arg in statesMap."""
    if isinstance(node, list):
        if (len(node) == 4
                and node[0] == "lib/render"
                and node[1] == "api"
                and isinstance(node[2], dict)
                and node[3] == "lights"):
            node[3] = MAKING_WAY_MAP
            return True
        for item in node:
            if patch_render_call(item):
                return True
    return False

for guid in CALLERS:
    data = load(guid)
    desc = data['content'].get('description')
    if desc is None:
        print(f"  SKIP {guid} — no description")
        continue
    if patch_render_call(desc):
        save(guid, data)
    else:
        print(f"  WARN {guid} ({data['name']}) — render call not found / already patched")

print("Done.")
