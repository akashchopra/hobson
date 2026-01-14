# Description Property Migration - Quick Start

Run these scripts **in order** from the Hobson REPL by copying and pasting the contents:

## 1. Update Renderer
Copy and paste the contents of `update_note_renderer_for_description.js` into the REPL.

Updates the note renderer to use `content.description`.

## 2. Migrate Note Data
Copy and paste the contents of `migrate_notes_to_description.js` into the REPL.

Migrates all existing notes from `content.body` to `content.description`.

## 3. Add Descriptions to All Items
Copy and paste the contents of `add_descriptions_to_all_items.js` into the REPL.

Adds meaningful descriptions to every item that doesn't have one yet.

## 4. Verify Everything
Copy and paste the contents of `verify_all_items_have_descriptions.js` into the REPL.

Verifies that all items in the system have descriptions.

---

**After migration:**
- All notes will use `content.description`
- The `content.body` property will be removed
- New notes should be created with `content.description`

See `docs/Description_Property_Implementation_Guide.md` for full details.
