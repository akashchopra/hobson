// Migrate all reminder items to task type.
//
// Changes per item:
//   - type: reminder -> task
//   - content.schedule: set from content.hob (the schedule expression)
//   - content.hob: removed
//   - content.scheduledAt: removed (will be recomputed by reminder-scheduler on next boot)
//   - attachments: cleared (Option B — attachment relationship dropped pending design decision)
//
// Run AFTER importing the updated reminder-scheduler and task views.
// The scheduler's boot-scan will re-register alarms for migrated tasks on next reload.

const REMINDER_TYPE = '521cb06c-2146-47f1-9375-1207bb6b5b27';
const TASK_TYPE = '0a41387e-78a9-4722-ab18-92aa14799385';

const items = await api.getAll();
const reminders = items.filter(it => it.type === REMINDER_TYPE);

let count = 0;
for (const item of reminders) {
  const { hob, scheduledAt, ...restContent } = item.content ?? {};
  const updated = {
    ...item,
    type: TASK_TYPE,
    modified: Date.now(),
    attachments: [],
    content: {
      ...restContent,
      ...(hob && hob.length > 0 ? { schedule: hob } : {}),
    },
  };
  await api.set(updated);
  count++;
}

console.log(`Migrated ${count} reminder(s) to task type. Reload to re-register alarms.`);
