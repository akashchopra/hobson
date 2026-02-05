# Code Snapshot Safety System

*Design Date: 2026-02-05*

---

## Problem Statement

Editing code items in Hobson — especially kernel modules — is inherently risky. A syntax error in `kernel-core` or `kernel-rendering` can prevent the system from booting, and the current recovery path (Safe Mode) depends on those very kernel modules loading successfully. If they can't parse, Safe Mode is also broken, leaving only browser dev tools or a full data wipe.

This violates the Humane Dozen's **Robust** principle: "Every gesture of the artisan that changes the working material is reversible and will not break the system."

The goal is to make every code edit reversible, with recovery possible even when the kernel won't boot — while pushing as much of the mechanism as possible into userland.

---

## Design Principles

1. **Userland first**: The snapshot mechanism should be a regular code item using declarative watches, not kernel machinery.
2. **Snapshots are items**: Previous versions are stored as ordinary items — inspectable, queryable, deletable. No shadow databases or hidden state.
3. **Bootloader as last resort**: The bootloader gets a minimal addition to read snapshot items directly from IndexedDB when boot fails. This is the only kernel/bootloader change.
4. **Uniform coverage**: The system applies to all code items equally — kernel modules, views, libraries, field views. No special-casing.
5. **Non-intrusive**: Snapshot creation is automatic and silent. The user doesn't need to think about it until they need to recover.

---

## Architecture Overview

### Two Layers

**Layer 1 — Userland (handles 95% of cases):**
A library item with a declarative watch on `item:updated` events for code items. On each save, it captures the previous version as a `code-snapshot` item. A companion view lets users browse version history and restore any previous version. This is all regular Hobson items and code — fully inspectable, modifiable, deletable.

**Layer 2 — Bootloader recovery (handles the remaining 5%):**
When `boot()` catches an error, instead of just showing the error message, it queries IndexedDB directly for `code-snapshot` items related to the broken module and offers one-click restore. This is ~50-60 lines of plain JavaScript in `bootstrap.html`, with zero dependency on kernel modules.

---

## Layer 1: Userland Snapshot System

### New Type: `code-snapshot`

A type definition item establishing snapshots as a first-class concept.

```javascript
{
  id: "dddddddd-0000-0000-0000-000000000000",
  name: "code-snapshot",
  type: "11111111-0000-0000-0000-000000000000",  // type_definition
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: "A point-in-time snapshot of a code item's previous state, created automatically before each save.",
    extends: "00000000-0000-0000-0000-000000000000"  // extends atom
  }
}
```

### Snapshot Item Structure

Each snapshot captures the complete previous state of a code item:

```javascript
{
  id: "<generated-uuid>",
  name: null,                                        // snapshots don't need names
  type: "dddddddd-0000-0000-0000-000000000000",     // code-snapshot
  created: <timestamp of snapshot creation>,
  modified: <timestamp of snapshot creation>,
  children: [],
  content: {
    source_id: "<id of the code item that was changed>",
    source_name: "<name of the code item at time of snapshot>",
    source_type: "<type of the code item>",
    previous_code: "<the full content.code string before the edit>",
    previous_content: { ... },                       // full content object (not just code)
    snapshot_reason: "pre-save"                       // or "manual" for user-triggered snapshots
  }
}
```

**Why store `previous_content` in full, not just `previous_code`?** Code items sometimes have meaningful non-code content — `watches`, `for_type`, `capabilities`, `description`. Capturing the complete content object makes restore truly lossless. The `previous_code` field is redundant but useful for quick display in the snapshot view without parsing the full content.

### Snapshot Library: `code-snapshot-manager`

A library item with a declarative watch that fires on every code item update.

```javascript
{
  id: "<generated-uuid>",
  name: "code-snapshot-manager",
  type: "66666666-0000-0000-0000-000000000000",      // library
  created: Date.now(),
  modified: Date.now(),
  children: [],
  content: {
    description: "Automatically creates snapshots before code item saves. Provides restore and history APIs.",
    watches: [
      {
        event: "item:updated",
        typeExtends: "22222222-0000-0000-0000-000000000000"  // CODE type
      }
    ],
    code: "..."  // see below
  }
}
```

**Handler implementation:**

```javascript
export async function onItemUpdated({ id, item, previous }, api) {
  // Only snapshot if code actually changed
  if (!previous || !previous.content?.code) return;
  if (previous.content.code === item.content.code) return;

  // Don't snapshot snapshots (prevent infinite recursion)
  // The type check in the watch filter handles this already
  // (code-snapshot extends atom, not code) but belt-and-suspenders:
  if (item.type === api.IDS?.CODE_SNAPSHOT) return;

  // Create snapshot item
  const snapshot = {
    id: crypto.randomUUID(),
    type: "dddddddd-0000-0000-0000-000000000000",   // code-snapshot type
    created: Date.now(),
    modified: Date.now(),
    children: [],
    content: {
      source_id: id,
      source_name: previous.name || item.name,
      source_type: previous.type,
      previous_code: previous.content.code,
      previous_content: { ...previous.content },
      snapshot_reason: "pre-save"
    }
  };

  // Save silently — don't trigger further events for snapshot creation
  await api.save(snapshot, { silent: true });
}

// API for manual use from REPL or other code
export async function getHistory(sourceId, api) {
  const all = await api.query({ type: "dddddddd-0000-0000-0000-000000000000" });
  return all
    .filter(s => s.content.source_id === sourceId)
    .sort((a, b) => b.created - a.created);
}

export async function restore(snapshotId, api) {
  const snapshot = await api.get(snapshotId);
  if (!snapshot || snapshot.type !== "dddddddd-0000-0000-0000-000000000000") {
    throw new Error("Not a snapshot item");
  }

  const target = await api.get(snapshot.content.source_id);
  if (!target) {
    throw new Error(`Source item ${snapshot.content.source_id} no longer exists`);
  }

  // Restore the full content (this will itself trigger a new snapshot — good!)
  target.content = { ...snapshot.content.previous_content };
  await api.save(target);

  return target;
}

export async function pruneHistory(sourceId, keepCount, api) {
  const history = await getHistory(sourceId, api);
  const toDelete = history.slice(keepCount);
  for (const snapshot of toDelete) {
    await api.delete(snapshot.id);
  }
  return toDelete.length;
}
```

### Snapshot History View

A view for browsing a code item's version history and restoring previous versions. This would be registered for the `code-snapshot` type, but more usefully accessed contextually from within a code item's view (e.g. a "History" button that queries snapshots where `content.source_id` matches).

The view should show:

- Timestamp of each snapshot
- A diff or at minimum a line-count delta indicator
- The first few lines of the previous code for identification
- A "Restore" button per snapshot
- A "Prune old snapshots" action

This is a standard view item — nothing unusual about its implementation.

### Snapshot Retention

Default strategy: keep all snapshots. The user can prune manually or create a scheduled cleanup watch. Possible future enhancement: a configurable retention policy (e.g. keep last N per item, or keep all from last 7 days).

Snapshots are small (just text), so storage pressure is unlikely to be an issue for a personal system. A code item with 500 characters of code, edited 10 times a day for a year, produces ~1.8MB of snapshots. Trivial.

---

## Layer 2: Bootloader Recovery

### The Problem Layer 2 Solves

If a kernel module edit breaks boot, the kernel can't run, which means:

- Safe Mode can't render (it depends on kernel modules)
- The snapshot view can't render (it's userland code)
- The snapshot items exist in IndexedDB but are inaccessible through the UI

The bootloader is the only code that runs before the kernel. It already has a `try/catch` around `boot()` and shows an error message on failure. We extend this to also offer snapshot-based recovery.

### Bootloader Changes

The existing `showError(error)` function is extended to also query IndexedDB for recent snapshots of kernel modules, and offer restore buttons. This code is entirely self-contained in `bootstrap.html` — no kernel modules involved.

```javascript
async function showRecovery(error, db, storageBackend) {
  // Identify which kernel modules exist
  const KERNEL_MODULE_TYPE = '33333333-0000-0000-0000-000000000000';
  const CODE_SNAPSHOT_TYPE = 'dddddddd-0000-0000-0000-000000000000';

  // Query all snapshots of kernel modules
  const allItems = await storageBackend.getAll();

  const kernelModules = allItems.filter(i => i.type === KERNEL_MODULE_TYPE);
  const snapshots = allItems.filter(i => i.type === CODE_SNAPSHOT_TYPE);

  // Group snapshots by source, most recent first
  const snapshotsBySource = {};
  for (const snap of snapshots) {
    const srcId = snap.content?.source_id;
    if (!srcId) continue;
    // Only include snapshots of kernel modules
    if (!kernelModules.some(m => m.id === srcId)) continue;
    if (!snapshotsBySource[srcId]) snapshotsBySource[srcId] = [];
    snapshotsBySource[srcId].push(snap);
  }
  for (const arr of Object.values(snapshotsBySource)) {
    arr.sort((a, b) => b.created - a.created);
  }

  // Build recovery UI
  const ui = document.createElement('div');
  ui.className = 'bootstrap-ui';
  ui.innerHTML = `
    <div class="bootstrap-error">
      <h3>Boot Failed</h3>
      <pre>${error.message}\n${error.stack}</pre>
    </div>
    <h3>Recovery Options</h3>
    <div id="recovery-options"></div>
    <div style="margin-top: 20px;">
      <button onclick="exportAllData()">Export All Data</button>
      <button onclick="window.location.href='?safe=1'">Try Safe Mode</button>
    </div>
  `;
  document.body.appendChild(ui);

  const optionsDiv = ui.querySelector('#recovery-options');

  if (Object.keys(snapshotsBySource).length === 0) {
    optionsDiv.innerHTML = '<p>No kernel module snapshots found.</p>';
    return;
  }

  for (const [moduleId, moduleSnapshots] of Object.entries(snapshotsBySource)) {
    const module = kernelModules.find(m => m.id === moduleId);
    const moduleName = module?.name || moduleId;
    const latest = moduleSnapshots[0];
    const timestamp = new Date(latest.created).toLocaleString();

    const div = document.createElement('div');
    div.style.cssText = 'margin: 8px 0; padding: 8px; background: #f0f0f0; border-radius: 4px;';
    div.innerHTML = `
      <strong>${moduleName}</strong>
      — snapshot from ${timestamp}
      (${moduleSnapshots.length} version${moduleSnapshots.length > 1 ? 's' : ''} available)
    `;

    const btn = document.createElement('button');
    btn.textContent = 'Restore';
    btn.style.marginLeft = '12px';
    btn.onclick = async () => {
      try {
        const target = await storageBackend.get(moduleId);
        target.content = { ...latest.content.previous_content };
        target.modified = Date.now();
        await storageBackend.set(target);
        btn.textContent = 'Restored! Reloading...';
        setTimeout(() => location.reload(), 500);
      } catch (e) {
        btn.textContent = 'Failed: ' + e.message;
      }
    };
    div.appendChild(btn);
    optionsDiv.appendChild(div);
  }
}
```

**Integration point:** Replace the current `showError(error)` call in the boot catch block with `showRecovery(error, db, storageBackend)`, which shows the error AND the recovery options.

Additionally, the `exportAllData()` function should be defined in the bootloader scope so that even in a failed-boot state, the user can export everything as a JSON backup.

### What This Doesn't Change

- The `?safe=1` Safe Mode path remains unchanged and is still offered as a button
- The bootloader's normal boot path is untouched
- No new IndexedDB stores or keys — everything uses the existing `items` object store
- The bootloader still never imports or depends on kernel modules for recovery

---

## Implementation Plan

### Phase 1: Snapshot Type and Library (Userland, Non-Breaking)

**Items to create:**

1. `code-snapshot` type definition item
2. `code-snapshot-manager` library item (with watch + handler)

**Where they live:** Added to `item-backup.json` (not `initial-kernel.json` — these are userland items, not kernel).

**Testing:**

- Edit any code item → verify a `code-snapshot` item is created
- Edit a code item without changing code (e.g. change description) → verify no snapshot is created
- Edit the same item 5 times → verify 5 snapshots exist with correct `source_id`
- Call `restore()` from REPL → verify the code item reverts and a new snapshot is created of the pre-restore state
- Call `pruneHistory()` from REPL → verify old snapshots are deleted

**Prerequisite check:** The `item:updated` event must include the `previous` field with the item's state before the save. Looking at the current `saveItem` code in `kernel-core`, this is already the case:

```javascript
const previous = exists ? await this.storage.get(item.id) : null;
// ...
this.events.emit('item:updated', { id: item.id, item, previous });
```

Good — no kernel change needed.

**Silent save requirement:** The `api.save()` call for creating snapshots must not trigger further events (otherwise the snapshot creation would itself trigger watches, potentially causing issues). The kernel already supports `silent` saves:

```javascript
await api.save(snapshot, { silent: true });
```

This needs verification — check that the `silent` parameter is threaded through to `saveItem` and suppresses event emission. If not, this is a small kernel addition.

### Phase 2: Snapshot View (Userland, Non-Breaking)

**Items to create:**

1. A `code-snapshot` view (for viewing individual snapshots)
2. Optionally, a "history panel" component that can be embedded in code item views

**The snapshot view should display:**

- Source item name (with link to navigate)
- Timestamp
- The snapshotted code (read-only, syntax-highlighted if available)
- Restore button
- Delete button

**The history panel (if built) should:**

- Accept a `source_id` and query all snapshots for it
- Display a chronological list with timestamps and short previews
- Allow restore and delete per entry
- Allow bulk prune

### Phase 3: Bootloader Recovery (Small Bootloader Change)

**Changes to `bootstrap.html`:**

1. Replace `showError(error)` in the boot catch block with `showRecovery(error, db, storageBackend)`
2. Add the `showRecovery` function (~50-60 lines)
3. Add an `exportAllData` function (~15 lines) for emergency data export

**Testing:**

- Intentionally corrupt a kernel module's code (e.g. add a syntax error to `kernel-rendering`)
- Reload → boot fails → verify recovery UI appears
- Verify the most recent snapshot of the corrupted module is listed
- Click "Restore" → verify module is restored and system boots
- Test with no snapshots available → verify graceful "no snapshots found" message
- Test "Export All Data" button → verify all items are exported as JSON

**Risk assessment:** This modifies `bootstrap.html`, which is meant to be stable. However:

- The change is additive (extends error handling, doesn't modify the boot path)
- The recovery code is self-contained and only executes on boot failure
- It uses the same `storageBackend` API that already exists
- It can be tested by deliberately breaking a kernel module

---

## Design Decisions

### Why not store snapshots in a separate IndexedDB store?

Snapshots as items means they're inspectable, queryable, and deletable through the normal UI. They participate in export/import. They can have views. They're consistent with the "everything is an item" philosophy. A separate store would be invisible to the system.

### Why not diff-based storage?

Full copies are simpler, more robust, and directly restorable without a diff-apply step. Code items are small (typically 1-50KB). The storage cost of full copies is negligible for a personal system. Diffs add complexity and failure modes for minimal benefit.

### Why `typeExtends: CODE` rather than listing specific types?

Using `typeExtends` on the CODE base type means the snapshot system automatically covers any new code types the user creates — kernel modules, views, libraries, field views, and any future types that extend CODE. No maintenance needed when new code types are added.

### Why not make this a kernel feature?

The kernel should be minimal. Versioning is a policy decision — how many to keep, what to snapshot, when to prune. These decisions belong in userland where they're inspectable and modifiable. The only kernel-adjacent change is the bootloader recovery, which is justified because it's the safety net for when userland can't run.

### Why silent saves for snapshots?

Without silent saves, creating a snapshot would emit an `item:created` event, which could trigger other watches. More importantly, if any watch handler on `item:created` happened to save a code item, it would trigger another snapshot, potentially causing cascading saves. Silent saves are the clean solution.

### What about the `saveItem` API supporting `silent`?

The current kernel code emits events unless `silent` is true. The renderer API's `save` function needs to pass through the `silent` option. This should be verified and if necessary is a one-line kernel change to thread the option through `api.save()` to `kernel.saveItem()`.

---

## Future Enhancements

### Snapshot Diffing View

A view that shows a side-by-side or inline diff between any two snapshots, or between a snapshot and the current version. Could use a userland diff library.

### Manual Snapshots

Allow users to create named snapshots explicitly ("before big refactor"). Same mechanism, just `snapshot_reason: "manual"` and an optional `content.label` field.

### Nested Instance Sandbox

A separate but complementary feature: clone the current system state into a nested Hobson instance, make experimental changes there, verify they work, then promote specific items back. This is a powerful experimentation tool but is architecturally independent from the snapshot safety system and significantly more complex to build. The snapshot system provides the safety net; nested instances provide the sandbox.

### Automatic Retention Policy

A watch that periodically prunes old snapshots based on configurable rules (e.g. keep last 20 per item, keep all from last 7 days, keep at least one per day for older history).

---

## Summary

| Layer | What | Where | Scope | Kernel change? |
|-------|------|-------|-------|----------------|
| 1 | Snapshot watch + library | `item-backup.json` | All code items | No (uses existing events + watches) |
| 1 | Snapshot type definition | `item-backup.json` | Type system | No |
| 1 | Snapshot + history views | `item-backup.json` | UI | No |
| 2 | Boot failure recovery UI | `bootstrap.html` | Bootloader | Yes (~60 lines, additive only) |

The result: every code edit in Hobson is automatically reversible. In normal operation, users browse history and restore through the UI. In the rare case where a kernel edit breaks boot, the bootloader itself offers snapshot-based recovery — no dev tools, no data loss, no panic.
