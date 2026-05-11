---
description: "Reference for Hobson reminder items: architecture, scheduling expressions, reminder-scheduler exports, every macro patterns, and how to attach reminders to items."
user-invocable: false
---

# Reminders — Architecture & Patterns

Time-based reminders on items, with OS notifications via Tauri (Android + desktop).

## Key GUIDs

| Item | GUID |
|------|------|
| `reminder` type | `521cb06c-2146-47f1-9375-1207bb6b5b27` |
| `reminder-view` | `105c7327-cea1-460a-a5ad-48ea96e35a37` |
| `reminder-scheduler` | `c4d26a7c-1643-40cf-9917-f264c8e3377f` |
| Reminders doc | `c0c0c0c0-004b-0000-0000-000000000000` |

## Architecture

A reminder is a **dedicated item** attached to its target. The target item itself needs no modification — the relationship is via Hobson's standard attachment mechanism.

```
[Target Item]
  └── attachment: [Reminder Item]  ← type: 521cb06c
```

Multiple reminders per target are naturally supported (multiple attachments). The kernel has no knowledge of reminders or notifications. All scheduling logic is userland Hob, wrapped around Tauri notification plugin calls.

## reminder Item Fields

```json
{
  "id": "<guid>",
  "name": "Call John",
  "type": "521cb06c-2146-47f1-9375-1207bb6b5b27",
  "content": {
    "hob": [],
    "description": [":doc", ...]
  },
  "attachments": ["<target-item-id>"]
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `name` | string | Notification title |
| `content.hob` | JSON AST array | Scheduling expression — answers "when next?" |
| `content.description` | Active Text | Optional notes |
| `attachments[0]` | GUID | The target item this reminder is for |

## Scheduling Expression

`content.hob` is a Hob expression that must return either:
- **A timestamp** (ms since epoch) — schedule the next alarm at that time
- **`nil`** — do not schedule

One-shot vs recurring is not a system flag — it is a property of what the expression returns.

**Evaluation loop**: evaluate → timestamp? → schedule via Tauri → alarm fires → OS wakes WebView → re-evaluate → repeat. Nil breaks the loop.

### Common Expression Patterns

**One-shot** (fires once):
```hob
(js/Date.parse "2026-05-01T09:00:00")
```
After dismissal the scheduler clears `content.hob` to `[]`, which evaluates to nil.

**Daily at a specific time**:
```hob
(every :day 9 0)       ; every day at 09:00
(every :weekday 9 0)   ; every weekday at 09:00
(every :weekend 10 30) ; every weekend at 10:30
```

**Specific days**:
```hob
(every :monday 9 0)
(every [:monday :wednesday :friday] 9 0)
```

**Monthly** (day hour minute):
```hob
(every :month 15 9 0)  ; every month on the 15th at 09:00
```

**Yearly** (month day hour minute — month is 1-indexed):
```hob
(every :year 5 15 9 0) ; every year on May 15th at 09:00
```

`every` computes the next occurrence of the given day/time from the current moment. It always returns a future timestamp.

Note: months with fewer days than the requested day-of-month will overflow to the next month (e.g. day 31 in June → July 1). This is accepted JS Date behaviour.

## reminder-scheduler Exports

Load via `(js-require "reminder-scheduler")` in Hob, or `await api.require('reminder-scheduler')` in JS.

| Function | Signature | Description |
|----------|-----------|-------------|
| `evalSchedule` | `(item, baseTime?)` | Evaluate `content.hob`; returns timestamp or null |
| `getScheduledAt` | `(itemId)` | Currently scheduled OS alarm timestamp for this item |
| `scheduleOneFrom` | `(item, baseTime)` | Schedule next occurrence using baseTime as reference |
| `onItemUpdated` | `({ item }, api)` | Watch handler — re-schedules when reminder item changes |
| `onKernelBootComplete` | `({ safeMode }, api)` | Boot-time scan — re-registers all alarms after reboot |

## Dismissing / Resetting

- **Dismiss** (one-shot): set `content.hob` to `[]` (evaluates to nil → no re-schedule)
- **Done** (recurring): call `scheduleOneFrom(item, scheduledAt)` — schedules next occurrence relative to when it was *supposed* to fire, not when the user tapped Done
- **Clear entirely**: set `content.hob` to `[]`

## Platform Notes

- Requires Tauri — not available in browser-only mode
- Android: needs POST_NOTIFICATIONS (Android 13+), SCHEDULE_EXACT_ALARM (Android 12+)
- Android OEM battery optimization may prevent exact alarms on some devices
- Notification tap deep-links to the reminder item, not the target

## Attaching a Reminder Programmatically

```javascript
const reminderId = crypto.randomUUID();
await api.set({
  id: reminderId,
  name: 'Review this',
  type: '521cb06c-2146-47f1-9375-1207bb6b5b27',
  created: Date.now(),
  modified: Date.now(),
  content: { hob: [] },
  attachments: [targetItemId]
});

const target = await api.get(targetItemId);
await api.set({
  ...target,
  attachments: [...(target.attachments || []), { id: reminderId }],
  modified: Date.now()
});
```
