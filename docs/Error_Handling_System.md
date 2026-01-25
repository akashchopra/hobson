# Error Handling System Design

*Decision Date: 2026-01-25*

---

## Problem Statement

Hobson needs robust error handling that respects its core design principles while ensuring errors never disappear silently. The current state is inconsistent:

- Bootstrap errors → Displayed with `showError()` ✓
- Renderer errors → Caught and shown with `createErrorView()` ✓
- Module evaluation errors → Thrown but inconsistently caught
- API errors → May appear in console or nowhere
- Uncaught exceptions → Lost to console

The fundamental tension:

- **Robustness principle**: Errors must be visible (can't silently fail)
- **User control principle**: User decides what data to capture and how to structure it
- **Uniformity principle**: Everything should be data (items), not special-cased

---

## Design Principles

1. **Minimal Kernel Responsibility**: Kernel ensures errors are visible, doesn't dictate structure
2. **User-Controlled Structure**: Error data format is user-defined, not kernel-imposed
3. **Leverages Existing Infrastructure**: Uses declarative watch system for event handling
4. **Inspectable**: Error handling logic is queryable data, not hidden subscriptions
5. **Extensible**: Users can customize parsing, enrichment, storage, presentation
6. **Robust Fallback**: System survives even when error handlers fail

---

## Architecture Overview

### Three-Tier System

**Tier 1: Kernel Event Emission**
- Kernel catches errors and emits `system:error` events
- Does NOT create error items
- Does NOT dictate error structure

**Tier 2: User-Controlled Handlers**
- User code watches `system:error` events via declarative watches
- User decides whether to create items, what structure to use
- Ships with default handler (but user can replace/delete)

**Tier 3: Fallback UI**
- If no handlers respond, kernel shows emergency banner
- Not an item, just DOM element for robustness
- Intentionally basic to encourage proper handling

---

## Kernel Responsibilities (Minimal)

### Error Capture Method

```javascript
// In kernel-core
async captureError(error, context = {}) {
  try {
    // Emit event - user handlers will process
    await this.events.emit('system:error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context: {
        operation: context.operation,      // 'render', 'require', 'api-call', etc.
        itemId: context.itemId,            // Item where error occurred
        itemName: context.itemName,        // Human-readable name
        rendererId: context.rendererId,    // If rendering
        ...context                         // Additional context
      },
      timestamp: Date.now()
    });
    
    return; // Event handlers will deal with it
    
  } catch (eventError) {
    // Ultimate fallback if event system fails
    this.showFallbackErrorUI(error, context);
    console.error('Error handler failed:', eventError);
    console.error('Original error:', error);
  }
}

showFallbackErrorUI(error, context) {
  // Create persistent error banner at top of viewport
  // This is NOT an item, just emergency UI
  const banner = document.createElement('div');
  banner.className = 'kernel-error-fallback';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #ffebee;
    border-bottom: 2px solid #c62828;
    padding: 12px 20px;
    z-index: 10000;
    font-family: system-ui;
  `;
  
  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 20px;">⚠️</span>
      <div style="flex: 1;">
        <strong>System Error</strong>
        ${context.itemName ? ` in ${context.itemName}` : ''}
        : ${error.message}
      </div>
      <button onclick="this.closest('.kernel-error-fallback').remove()" 
              style="padding: 4px 12px; cursor: pointer;">
        Dismiss
      </button>
    </div>
  `;
  
  document.body.insertBefore(banner, document.body.firstChild);
}
```

### Wrap Critical Operations

```javascript
// In kernel-rendering
async renderItem(itemId, rendererId = null) {
  try {
    // ... existing rendering logic
  } catch (error) {
    await this.kernel.captureError(error, {
      operation: 'render',
      itemId,
      itemName: item?.name,
      rendererId
    });
    
    // Show error message in place of content
    return this.createErrorPlaceholder(error);
  }
}

createErrorPlaceholder(error) {
  // Simple DOM element shown in place of failed renderer
  const div = document.createElement('div');
  div.className = 'render-error-placeholder';
  div.style.cssText = 'padding: 20px; background: #fff8f0; border: 1px solid #ff9800;';
  div.innerHTML = `
    <strong>⚠️ Rendering Failed</strong>
    <p>${error.message}</p>
    <small>Check error log for details</small>
  `;
  return div;
}

// In kernel-module-system
async require(nameOrId, callStack = new Set()) {
  try {
    // ... existing module loading
  } catch (error) {
    await this.kernel.captureError(error, {
      operation: 'require',
      itemId: resolvedId,
      itemName: nameOrId
    });
    throw error; // Re-throw for caller to handle
  }
}
```

### Event Type

```javascript
// system:error event structure
{
  type: 'system:error',
  data: {
    error: {
      name: 'TypeError',
      message: 'Cannot read property foo of undefined',
      stack: 'TypeError: Cannot read property...\n    at blob:...'
    },
    context: {
      operation: 'render',           // What was happening
      itemId: 'uuid-of-item',        // Where it happened
      itemName: 'my-renderer',       // Human-readable
      rendererId: 'uuid-of-renderer', // If applicable
      // ... additional context
    },
    timestamp: 1706198400000
  }
}
```

---

## User-Space Error Handling

### Default Error Handler (Ships with System)

Located in `item_backup.json` (NOT seed items - user can delete/replace):

```javascript
{
  id: "default-error-handler",
  name: "default-error-handler",
  type: "library",
  content: {
    description: "Default system error handler. Creates error items with parsed stack traces.",
    watches: [
      { event: 'system:error' }
    ],
    code: `
export async function onSystemError({ error, context, timestamp }, api) {
  // Parse stack trace into structured data
  const frames = parseStackTrace(error.stack, api);
  
  // Create error item with user-controlled structure
  const errorId = await api.items.create({
    type: 'error',
    name: \`Error: \${error.message.substring(0, 40)}\`,
    content: {
      message: error.message,
      errorType: error.name,
      frames: frames,           // Parsed, not raw stack
      context: context,
      timestamp: timestamp,
      resolved: false
    }
  });
  
  // Show toast notification
  showErrorToast(error.message, errorId, api);
}

function parseStackTrace(stack, api) {
  if (!stack) return [];
  
  const lines = stack.split('\\n').slice(1); // Skip "Error: message" line
  
  return lines.map(line => {
    // Try to extract blob URL (kernel module evaluation)
    const blobMatch = line.match(/blob:[^/]+\\/([a-f0-9-]+)/);
    
    if (blobMatch) {
      const itemId = blobMatch[1];
      // Look up item name for better display
      return {
        raw: line,
        itemId: itemId,
        navigable: true
      };
    }
    
    // Regular stack frame
    return {
      raw: line,
      navigable: false
    };
  });
}

function showErrorToast(message, errorId, api) {
  const toast = document.createElement('div');
  toast.className = 'error-toast';
  toast.style.cssText = \`
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #d32f2f;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    max-width: 400px;
    z-index: 9999;
    cursor: pointer;
  \`;
  
  toast.innerHTML = \`
    <div style="display: flex; gap: 12px; align-items: start;">
      <span style="font-size: 24px;">⚠️</span>
      <div style="flex: 1;">
        <strong>Error Occurred</strong>
        <p style="margin: 4px 0 0 0; font-size: 14px;">\${message}</p>
      </div>
    </div>
  \`;
  
  toast.onclick = () => {
    api.viewport.select(errorId);
    toast.remove();
  };
  
  document.body.appendChild(toast);
  
  // Auto-dismiss after 8 seconds
  setTimeout(() => toast.remove(), 8000);
}
    `
  }
}
```

### Error Renderer (Ships with System)

```javascript
{
  id: "error-renderer",
  name: "error-renderer",
  type: "renderer",
  content: {
    for_type: "error",
    code: `
export function render(item, api) {
  const content = item.content;
  const frames = content.frames || [];
  
  return api.createElement('div', { class: 'error-item-view' }, [
    // Header
    ['div', { 
      style: 'background: #ffebee; border-left: 4px solid #d32f2f; padding: 16px; margin-bottom: 16px;' 
    }, [
      ['div', { style: 'display: flex; align-items: start; gap: 12px;' }, [
        ['span', { style: 'font-size: 32px;' }, ['⚠️']],
        ['div', { style: 'flex: 1;' }, [
          ['div', { style: 'font-size: 12px; color: #666; margin-bottom: 4px;' }, [
            content.errorType || 'Error'
          ]],
          ['div', { style: 'font-size: 18px; font-weight: 600; margin-bottom: 8px;' }, [
            content.message
          ]],
          ['div', { style: 'font-size: 12px; color: #666;' }, [
            new Date(content.timestamp).toLocaleString()
          ]]
        ]]
      ]]
    ]],
    
    // Context
    content.context ? ['div', { style: 'margin-bottom: 16px;' }, [
      ['h4', { style: 'margin: 0 0 8px 0;' }, ['Context']],
      ['div', { style: 'font-family: monospace; font-size: 12px; background: #f5f5f5; padding: 12px; border-radius: 4px;' }, [
        ['div', {}, [\`Operation: \${content.context.operation || 'unknown'}\`]],
        content.context.itemName ? 
          ['div', {}, [\`Item: \${content.context.itemName}\`]] : null,
        content.context.itemId ?
          ['div', {}, [
            'Item ID: ',
            ['a', { 
              href: '#',
              onclick: (e) => {
                e.preventDefault();
                api.viewport.select(content.context.itemId);
              }
            }, [content.context.itemId]]
          ]] : null
      ]]
    ]] : null,
    
    // Stack Trace (clickable!)
    frames.length > 0 ? ['div', {}, [
      ['h4', { style: 'margin: 0 0 8px 0;' }, ['Stack Trace']],
      ['div', { style: 'font-family: monospace; font-size: 12px; background: #f5f5f5; padding: 12px; border-radius: 4px;' },
        frames.map(frame => 
          frame.navigable ? 
            // Clickable frame - navigates to item
            ['div', { 
              style: 'padding: 2px 0; cursor: pointer; color: #1976d2;',
              onclick: () => api.viewport.select(frame.itemId)
            }, [
              '→ ',
              frame.raw
            ]] :
            // Non-navigable frame
            ['div', { style: 'padding: 2px 0; color: #666;' }, [
              frame.raw
            ]]
        )
      ]
    ]] : null,
    
    // Actions
    ['div', { style: 'margin-top: 16px; display: flex; gap: 8px;' }, [
      ['button', {
        onclick: async () => {
          content.resolved = true;
          await api.items.update(item);
        }
      }, ['Mark Resolved']],
      ['button', {
        onclick: async () => {
          if (confirm('Delete this error?')) {
            await api.items.delete(item.id);
            api.viewport.clearSelection();
          }
        }
      }, ['Delete']]
    ]]
  ]);
}
    `
  }
}
```

---

## User Customization Examples

### Example 1: Enhanced Stack Trace Parsing

```javascript
{
  name: "enhanced-error-handler",
  type: "library",
  content: {
    watches: [{ event: 'system:error' }],
    code: `
export async function onSystemError({ error, context, timestamp }, api) {
  // Load source code for each frame
  const enrichedFrames = await enrichStackFrames(error.stack, api);
  
  await api.items.create({
    type: 'enhanced-error',
    content: {
      message: error.message,
      frames: enrichedFrames,  // Includes source code excerpts
      context: context,
      timestamp: timestamp,
      userAgent: navigator.userAgent,
      url: window.location.href
    }
  });
}

async function enrichStackFrames(stack, api) {
  const frames = parseStack(stack);
  
  for (const frame of frames) {
    if (frame.itemId) {
      try {
        const item = await api.items.get(frame.itemId);
        frame.itemName = item.name;
        frame.sourceExcerpt = extractExcerpt(item.content.code, frame);
      } catch (e) {
        // Item might have been deleted
        frame.itemName = '[deleted]';
      }
    }
  }
  
  return frames;
}
    `
  }
}
```

### Example 2: Error Filtering

```javascript
{
  name: "filtered-error-handler",
  type: "library",
  content: {
    watches: [{ event: 'system:error' }],
    code: `
export async function onSystemError({ error, context }, api) {
  // Only log certain types of errors
  if (shouldLog(error, context)) {
    await api.items.create({
      type: 'error',
      content: { /* ... */ }
    });
  } else {
    // Just console.log less important errors
    console.warn('Minor error (not logged):', error.message);
  }
}

function shouldLog(error, context) {
  // Don't log errors from test items
  if (context.itemName?.includes('test')) return false;
  
  // Always log rendering errors
  if (context.operation === 'render') return true;
  
  // Log module loading errors
  if (context.operation === 'require') return true;
  
  return false;
}
    `
  }
}
```

### Example 3: External Error Tracking

```javascript
{
  name: "external-error-tracker",
  type: "library",
  content: {
    watches: [{ event: 'system:error' }],
    code: `
export async function onSystemError({ error, context }, api) {
  // Send to external service (Sentry, etc.)
  await fetch('https://my-error-tracker.com/api/errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: Date.now(),
      userId: await getUserId()
    })
  });
  
  // Still create local item for reference
  await api.items.create({
    type: 'error',
    content: {
      message: error.message,
      sentToTracker: true
    }
  });
}
    `
  }
}
```

### Example 4: Error Dashboard with Auto-Update

```javascript
{
  name: "error-dashboard-renderer",
  type: "renderer",
  content: {
    for_type: "error-dashboard",
    watches: [
      { event: 'item:created', type: 'error' },
      { event: 'item:deleted', type: 'error' },
      { event: 'item:updated', type: 'error' }
    ],
    code: `
export async function render(item, api) {
  const errors = await api.items.listByType('error');
  const unresolved = errors.filter(e => !e.content.resolved);
  const recent = errors.slice(0, 10);
  
  return api.createElement('div', {}, [
    ['h2', {}, [\`Error Dashboard (\${unresolved.length} unresolved)\`]],
    ['div', {},
      recent.map(err => 
        ['div', {
          style: 'padding: 8px; border-bottom: 1px solid #eee; cursor: pointer;',
          onclick: () => api.viewport.select(err.id)
        }, [
          ['strong', {}, [err.content.message]],
          ['span', { style: 'color: #666; margin-left: 8px;' }, [
            new Date(err.content.timestamp).toLocaleString()
          ]]
        ]]
      )
    ]
  ]);
}

// Automatically re-renders when errors change!
export function onItemCreated({ item }, api) {
  // Framework triggers re-render after this returns
}

export function onItemDeleted({ item }, api) {
  // Framework triggers re-render after this returns
}

export function onItemUpdated({ item }, api) {
  // Framework triggers re-render after this returns
}
    `
  }
}
```

---

## Benefits of This Design

### 1. Kernel Stays Minimal

- Kernel: ~50 lines of error capture code
- No error type in seed items (user-defined)
- No imposed data structure
- Just event emission + fallback UI

### 2. Full User Control

Users decide:
- Whether to create error items at all
- What structure error items should have
- How to parse/enrich stack traces
- What to do with errors (log, alert, ignore)
- How to present errors visually

### 3. Clickable Stack Traces

Because users control parsing, they can:
- Extract item IDs from blob URLs
- Load item names for better display
- Make frames clickable (navigate to source)
- Show source code excerpts
- Filter out irrelevant frames

### 4. Leverages Existing Infrastructure

- Uses declarative watch system
- No new kernel event mechanism needed
- Consistent with reactive rendering patterns
- Queryable: "What handles errors?" is a data query

### 5. Multiple Handlers Can Coexist

```javascript
// Handler 1: Create error items
default-error-handler watches system:error

// Handler 2: Send to external tracker
external-error-tracker watches system:error

// Handler 3: Show desktop notification
desktop-notifier watches system:error

// All run independently
```

### 6. Progressive Enhancement

Start simple:
- Default handler creates basic error items ✓

Add features over time:
- Enhanced stack parsing (source excerpts, variable inspection)
- Error clustering (group similar errors)
- Error analytics (frequency, patterns)
- Custom error types by category
- Integration with external tools

---

## Implementation Considerations

### 1. Handler Error Isolation

If an error handler itself throws:

```javascript
// In event dispatcher
async function dispatchToWatcher(watcher, event, api) {
  try {
    const module = await kernel.moduleSystem.require(watcher.id);
    const handler = module.onSystemError;
    
    if (handler) {
      await handler(event.data, api);
    }
  } catch (handlerError) {
    // DON'T call captureError (would cause infinite loop)
    // Just log and continue
    console.error(\`Error in handler \${watcher.name}:\`, handlerError);
    
    // Show fallback UI if this was the only handler
    if (isOnlyHandler(watcher)) {
      kernel.showFallbackErrorUI(event.data.error, event.data.context);
    }
  }
}
```

### 2. Bootstrap Errors

Bootstrap errors (before kernel loads) use existing bootstrap error UI:

```javascript
// In bootstrap.html showError()
function showError(error) {
  const ui = document.createElement('div');
  ui.className = 'bootstrap-ui';
  ui.innerHTML = \`
    <div class="bootstrap-error">
      <h3>Boot Failed</h3>
      <pre>\${error.message}\\n\${error.stack}</pre>
    </div>
  \`;
  document.body.appendChild(ui);
}
```

This is unavoidable - can't emit events before kernel loads.

### 3. Safe Mode

Safe Mode bypasses user code, so error handlers don't run. Safe Mode uses its own error display for recovery.

### 4. Performance

Event emission and dispatching is fast enough for Hobson's scope:
- Personal system (single user)
- Errors are exceptional (not frequent)
- Handler execution is async (non-blocking)

### 5. Default Handler Lifecycle

The default handler should be:
- Included in initial exports
- Clearly marked as replaceable
- Not a seed item (can be deleted)
- Well-documented for customization

---

## Comparison with Alternatives

### Alternative 1: Kernel Creates Error Items

**Rejected** because:
- Kernel imposes structure (violates uniformity)
- Users can't customize error format
- Stack traces are opaque strings
- No way to make clickable/navigable

### Alternative 2: Error Items with No Events

**Rejected** because:
- No way to notify user of errors
- Error items exist but user doesn't know
- Need to poll for new errors
- Can't trigger side effects (toasts, external logging)

### Alternative 3: Kernel Event Bus

**Rejected** because:
- Already have declarative watches
- Would duplicate existing infrastructure
- More kernel complexity
- Less inspectable (subscriptions hidden in code)

### Chosen Approach: System Events + User Handlers

**Accepted** because:
- Minimal kernel code
- Full user control
- Leverages existing watch system
- Robust fallback for safety
- Supports clickable stack traces
- Progressive enhancement path

---

## Migration Path

### Phase 1: Add Error Capture (Non-Breaking)

- Add `captureError()` to kernel
- Add `system:error` event emission
- Wrap rendering/require with try/catch → captureError
- Add fallback UI
- **System still works, just no error items yet**

### Phase 2: Add Default Handler (Enhancement)

- Create default-error-handler library item
- Create error renderer
- Ship in item_backup.json
- **Errors now create items automatically**

### Phase 3: Documentation & Examples (Adoption)

- Document error event structure
- Provide handler examples
- Show stack trace parsing techniques
- **Users can customize error handling**

---

## Open Questions for Future

1. **Should warnings use the same system?** 
   - Different event type: `system:warning`?
   - Or just `severity` field in error context?

2. **Error deduplication?**
   - Same error from same location firing repeatedly
   - Should handlers detect and group?
   - Kernel responsibility or user code?

3. **Source maps?**
   - If we ever add transpilation (TypeScript, etc.)
   - How to map stack traces back to original source?

4. **Performance monitoring?**
   - Errors for performance issues (slow renders)?
   - Separate event type or same system?

---

## Summary

**Kernel Responsibility:**
- Emit `system:error` events when errors occur
- Show fallback UI if no handlers respond
- ~50 lines of code

**User Responsibility:**
- Watch `system:error` events (declarative)
- Parse/enrich error data (stack traces, context)
- Create error items (or not)
- Define error structure
- Handle presentation

**Benefits:**
- Minimal kernel
- Maximum user control
- Clickable stack traces
- Leverages existing infrastructure
- Progressive enhancement

**Result:** 
A robust, extensible, user-controlled error handling system that feels native to Hobson's philosophy while ensuring errors never disappear.
