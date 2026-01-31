# Theming System Design

## Problem Statement

Hobson currently uses a hardcoded grey color palette throughout the system:
- Global CSS in `kernel-styles` (~500 lines) with colors like `#f5f5f5`, `#ccc`, `#333`
- ~28 inline style locations in views and field views with hardcoded colors
- No simple way for users to customize the visual appearance
- Changing colors requires manually editing styles throughout the codebase

This conflicts with Hobson's philosophy of being inspectable, modifiable, and self-revealing.

## Current State Analysis

### Global CSS (`kernel-styles`)
Single item containing all system CSS with hardcoded colors:
```css
body {
  background: #f5f5f5;
  color: #333;
}

#main-view {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.render-error {
  background: #fff0f0;
  border: 1px solid #ffcccc;
}
```

**Applied once at boot** via `kernel-core.applyStyles()`:
```javascript
async applyStyles() {
  const stylesItem = await this.storage.get(IDS.KERNEL_STYLES);
  const style = document.createElement('style');
  style.textContent = stylesItem.content.code;
  document.head.appendChild(style);
}
```

### Inline Styles (Views/Field Views)
Approximately 28 locations using `style.cssText`:
```javascript
wrapper.style.cssText = 'padding: 8px; background: white; border: 1px solid #ccc;';
labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';
```

**Applied at render time** when views execute.

### Color Categories

Analysis shows colors fall into semantic categories:
- **Backgrounds**: `#f5f5f5` (body), `white` (surfaces), `#f8f8f8` (code blocks)
- **Borders**: `#ccc`, `#ddd`, `#999`
- **Text**: `#333` (primary), `#666` (secondary), `#999` (tertiary)
- **Interactive**: `#007bff` (primary blue), `#0056b3` (hover)
- **Status**: `#28a745` (success), `#dc3545` (danger), `#ffc107` (warning)

## Design Options Considered

### Option 1: CSS Custom Properties (Chosen)
**Mechanism**: Define CSS variables in `:root`, reference them throughout.

**Pros**:
- Standard web technology
- Works with both global CSS and inline styles
- Self-revealing: theme is an editable item
- Inspectable via browser DevTools
- Progressive enhancement: update incrementally
- No runtime overhead

**Cons**:
- Requires updating inline styles to use `var(--name)`
- Variable syntax in JS strings slightly verbose
- Still requires touching ~28 locations

**Example**:
```css
:root {
  --color-bg-body: #f5f5f5;
  --color-text: #333;
}

/* In CSS */
body { background: var(--color-bg-body); }

/* In JS */
el.style.cssText = 'color: var(--color-text);';
```

### Option 2: Theme Object + Dynamic Injection
**Mechanism**: Store theme as JSON, inject CSS variables on boot.

**Pros**:
- Theme as structured data
- Supports theme inheritance/variants
- Could switch themes without reload

**Cons**:
- Less transparent than pure CSS
- Adds complexity to boot process
- Still requires updating inline styles
- Two sources of truth (JSON + CSS)

### Option 3: Utility CSS Classes
**Mechanism**: Define classes like `.bg-surface`, `.text-primary`, refactor views to use classes.

**Pros**:
- Clean separation of concerns
- Standard pattern (Tailwind-style)
- Easy to understand

**Cons**:
- Requires major refactoring of all views
- Moves away from current inline style pattern
- Most invasive change
- Breaks existing mental model

## Chosen Solution: CSS Variables + Hot-Reload

### Core Design

**1. Define Color System in `kernel-styles`**
```css
:root {
  /* Backgrounds */
  --color-bg-body: #f5f5f5;
  --color-bg-surface: white;
  --color-bg-surface-alt: #f8f8f8;
  --color-bg-error: #fff0f0;
  --color-bg-warning: #fff3cd;
  
  /* Borders */
  --color-border: #ccc;
  --color-border-light: #ddd;
  --color-border-dark: #999;
  
  /* Text */
  --color-text: #333;
  --color-text-secondary: #666;
  --color-text-tertiary: #999;
  
  /* Interactive */
  --color-primary: #007bff;
  --color-primary-hover: #0056b3;
  --color-success: #28a745;
  --color-danger: #dc3545;
  --color-warning: #ffc107;
  
  /* UI Elements */
  --border-radius: 4px;
  --border-radius-lg: 8px;
  --shadow-sm: 0 2px 4px rgba(0,0,0,0.1);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.15);
}
```

**2. Update Global CSS**
```css
body {
  background: var(--color-bg-body);
  color: var(--color-text);
}

#main-view {
  background: var(--color-bg-surface);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
}

.render-error {
  background: var(--color-bg-error);
  border: 1px solid var(--color-danger);
}
```

**3. Create Hot-Reload Library**

This is the key innovation: a **user-space library** that watches `kernel-styles` and re-applies CSS on changes.

```javascript
{
  id: "theme-hot-reload-lib",
  name: "theme-hot-reload",
  type: "66666666-0000-0000-0000-000000000000", // library
  content: {
    description: "Automatically reloads CSS when kernel-styles is edited",
    watches: [
      {
        event: "item:updated",
        id: "33333333-8888-0000-0000-000000000000"  // kernel-styles
      }
    ],
    code: `
// Hot-reload handler for kernel-styles
export function onItemUpdated({ item, previous }, api) {
  // Find existing kernel styles element
  const existing = document.querySelector('style[data-kernel-styles]');
  if (existing) {
    existing.remove();
  }
  
  // Re-inject CSS with updated content
  const style = document.createElement('style');
  style.setAttribute('data-kernel-styles', 'true');
  style.textContent = item.content.code;
  document.head.appendChild(style);
  
  console.log('✨ Theme hot-reloaded!');
}
    `
  }
}
```

**4. Mark Style Element on Boot** (minimal kernel change)

In `kernel-core.applyStyles()`:
```javascript
async applyStyles() {
  const stylesItem = await this.storage.get(IDS.KERNEL_STYLES);
  const style = document.createElement('style');
  style.setAttribute('data-kernel-styles', 'true');  // Add this attribute
  style.textContent = stylesItem.content.code;
  document.head.appendChild(style);
}
```

**5. Activate Hot-Reload**

Import once (via REPL or startup script):
```javascript
await api.require('theme-hot-reload');
```

Once imported, the watch is registered and will respond to all future `kernel-styles` edits.

### Usage Flow

1. User edits `kernel-styles` → changes `--color-primary: #007bff` to `--color-primary: #2ecc71`
2. User saves (Cmd+S or Save button)
3. Kernel emits `item:updated` event (automatic)
4. `theme-hot-reload` handler catches event (declarative watch)
5. Old `<style data-kernel-styles>` removed
6. New `<style data-kernel-styles>` injected with updated CSS
7. **Colors update instantly across entire UI** — no reload needed!

## Why This Design Wins

### 1. Aligns with Hobson's Philosophy

**Inspectable**: Theme is an item, variables visible in DevTools, hot-reload is an item
**Modifiable**: Edit `kernel-styles` from within Hobson, changes apply instantly
**Self-revealing**: CSS variables show their purpose (`--color-primary` not `#007bff`)
**Unified**: Uses existing event/watch infrastructure, no special theming API

### 2. Leverages Existing Infrastructure

- **Declarative watches**: Already implemented, proven pattern
- **Event system**: `item:updated` emitted automatically
- **Module system**: Hot-reload is just a library, no kernel changes (except one attribute)
- **No new concepts**: Uses standard CSS + standard Hobson patterns

### 3. Progressive Enhancement

**Phase 1**: Update `kernel-styles` with variables
- Global CSS uses variables immediately
- Inline styles still work with hardcoded colors
- Users can customize via editing CSS variables

**Phase 2**: Gradually update views
- Migrate one view at a time to use `var(--color-name)`
- No breaking changes
- Each update increases theme coverage

**Phase 3**: Advanced features (future)
- Theme preset items (light, dark, high-contrast)
- Theme editor UI with color pickers
- Per-container theme overrides
- Theme inheritance/composition

### 4. Minimal Kernel Impact

**Single kernel change**: Add `data-kernel-styles` attribute
- One line in `applyStyles()`
- Non-breaking (old code continues working)
- Clear separation: kernel applies once, library handles updates

**Everything else is user-space**:
- Variable definitions (in `kernel-styles`)
- Hot-reload library (regular item)
- Theme presets (future items)
- Editor UI (future view)

### 5. Demonstrates System Capabilities

This design **teaches** users about Hobson:
- Events: Saving an item triggers events
- Watches: Code can react to specific events
- Inspectability: Can examine hot-reload code
- Modifiability: Can customize hot-reload behavior
- Composition: Theme + hot-reload work independently

A user learning Hobson can:
1. See that editing `kernel-styles` updates the UI
2. Wonder "how does that work?"
3. Search for "kernel-styles"
4. Find `theme-hot-reload` watching it
5. Read the ~20 lines of code
6. Understand the watch system
7. Create their own watches for other purposes

### 6. Performance Characteristics

**Boot time**: No change (one style element, same as before)
**Edit time**: ~1ms to swap style elements (imperceptible)
**Runtime**: Zero overhead (CSS variables resolve at paint time, same as hardcoded)
**Memory**: ~1KB for hot-reload code (trivial)

## Migration Path

### Immediate (v1.0)
1. Update `kernel-styles` with CSS variable definitions
2. Update global CSS rules to use variables
3. Add `data-kernel-styles` attribute in `applyStyles()`
4. Create `theme-hot-reload` library
5. Import hot-reload library

**Result**: Global styles are themeable, inline styles still work

### Incremental (v1.1-v2.0)
Update views one-by-one to use variables:

**Priority order**:
1. Field views (most visible, ~12 files)
2. Core views (generic, container, etc.)
3. Specialized views (tag browser, search, etc.)

**Per-view effort**: ~10 minutes
- Find all `style.cssText` assignments
- Replace hardcoded colors with `var(--color-name)`
- Test with different themes

**Example migration**:
```javascript
// Before
labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: #333;';

// After
labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: var(--color-text);';
```

### Future Enhancements (v2.0+)

**Theme Presets**
```javascript
{
  type: "theme-preset",
  content: {
    name: "Dark Mode",
    variables: {
      "--color-bg-body": "#1a1a1a",
      "--color-bg-surface": "#2d2d2d",
      "--color-text": "#e0e0e0",
      // ...
    }
  }
}
```

**Theme Editor View**
- Color pickers for each variable
- Live preview
- Save as preset
- Import/export themes

**Per-Container Themes**
- Scope CSS variables to container elements
- Different themes for different sections
- Theme inheritance

**Theme API**
```javascript
// In views/code
api.theme.get('--color-primary')        // Get current value
api.theme.set('--color-primary', '#f00') // Set programmatically
api.theme.apply(presetItem)              // Apply preset
```

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Define color variable system in `kernel-styles`
- [ ] Update global CSS to use variables
- [ ] Add `data-kernel-styles` attribute in `applyStyles()`
- [ ] Create `theme-hot-reload` library
- [ ] Test: edit colors in `kernel-styles`, verify instant update
- [ ] Document: add to user guide

### Phase 2: View Migration (Optional, Incremental)
- [ ] Field view: text
- [ ] Field view: heading
- [ ] Field view: tags
- [ ] Field view: code_editable
- [ ] Field view: markdown_editable
- [ ] Container view
- [ ] Generic view spec
- [ ] (Continue for remaining views as time permits)

### Phase 3: Advanced Features (Future)
- [ ] Theme preset type definition
- [ ] Light theme preset
- [ ] Dark theme preset
- [ ] High contrast theme preset
- [ ] Theme editor view
- [ ] Theme API in renderer API

## Alternatives Considered and Rejected

### Runtime CSS Generation
**Idea**: Generate CSS dynamically from theme object on every change

**Rejected because**:
- Adds complexity to kernel
- Harder to inspect/debug
- Loses benefits of static CSS
- Doesn't leverage CSS variables

### React-style Theme Context
**Idea**: Pass theme object through render tree as context

**Rejected because**:
- Requires refactoring all views
- Adds framework dependency
- Breaks current inline style pattern
- More complex than CSS solution

### Separate Theme Files
**Idea**: Multiple `kernel-styles-light`, `kernel-styles-dark` items

**Rejected because**:
- Duplication of non-color CSS
- Hard to maintain consistency
- Doesn't enable live editing
- More items to manage

## Conclusion

This design achieves the goal of making Hobson themeable while:
- Staying true to Hobson's philosophy (inspectable, modifiable, self-revealing)
- Leveraging existing infrastructure (events, watches, items)
- Requiring minimal kernel changes (one attribute)
- Enabling progressive enhancement (update views incrementally)
- Demonstrating system capabilities (teaches users about watches)
- Using standard web technology (CSS custom properties)

The hot-reload library is particularly elegant: it's a ~20 line item that makes the entire system instantly responsive to theme changes, demonstrating the power of declarative watches in a way users can inspect and understand.

**Net result**: Users can customize Hobson's appearance by editing a single item, and changes apply instantly without reload. The system is transparent, modifiable, and teaches users about Hobson's event system in the process.
