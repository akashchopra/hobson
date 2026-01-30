# Plan: Link Navigation with Line and Region Support

## Overview

Extend hobson-markdown links to support navigation to specific lines or regions within target items. When a user clicks a link like `[see code](item://guid#code?region=init)`, the target item opens and scrolls to the specified location.

## URL Syntax

```
item://guid#field?lines=N
item://guid#field?region=name
```

Examples:
- `item://abc123#code?lines=42` - scroll to line 42 of the code field
- `item://abc123#code?region=init` - scroll to the "init" region in code
- `item://abc123#description?region=usage` - scroll to "usage" region in description

**Note:** The `#field` fragment is required when using `?lines` or `?region` - we need to know which field to navigate within.

## Why Prefer Regions Over Lines

1. **Works for all views** - Including rendered markdown where line numbers don't exist
2. **Robust to edits** - Region markers move with the content; line numbers break when code changes
3. **Semantic** - Names convey meaning (`region=error-handling` vs `lines=142`)

## Region Marker Syntax

Region markers can appear in comments (hidden from rendered output):

**In code (JavaScript/CSS/etc):**
```javascript
// [BEGIN:init]
function initialize() { ... }
// [END:init]
```

**In markdown:**
```markdown
<!-- [BEGIN:usage] -->
## Usage
Call `init()` first, then...
<!-- [END:usage] -->
```

## Architecture

### Navigation Flow

1. **User clicks link** in hobson-markdown rendered content
2. **hobson-markdown** parses URL, extracts `{ field, line, region }`
3. **Context-dependent routing:**
   - If `siblingContainer` exists → `addSibling(itemId, navigateTo)`
   - Otherwise → `api.navigate(itemId, navigateTo)` (root navigation)
4. **container_view** (for siblings) passes `navigateTo` through render context
5. **generic_view** reads `navigateTo`, determines target field, passes `scrollToLine`/`scrollToRegion` to field view
6. **Field view** scrolls to the specified location

### Data Flow

```
Link Click
    ↓
hobson-markdown: parseItemUrl() → { itemId, field, line, region }
    ↓
┌─────────────────────────────────────────────────┐
│ Root context (no siblingContainer):             │
│   api.navigate(itemId, { field, line, region }) │
│   → URL params → generic_view reads from URL    │
├─────────────────────────────────────────────────┤
│ Sibling context (has siblingContainer):         │
│   siblingContainer.addSibling(itemId, params)   │
│   → context.navigateTo → api.getNavigateTo()    │
└─────────────────────────────────────────────────┘
    ↓
generic_view: checks each field path against navigateTo.field
    ↓
Target field view receives: { scrollToLine, scrollToRegion }
    ↓
Field view scrolls to location
```

## Files to Modify

### 1. hobson-markdown (`a1b2c3d4-5e6f-7a8b-9c0d-e1f2a3b4c5d6`)

**Changes:**
- Update link click handler to extract and pass navigation params
- Handle root vs sibling context (currently broken - does nothing if no siblingContainer)
- Emit invisible region anchor spans when rendering region markers

**Link handler update:**
```javascript
link.onclick = (e) => {
  e.preventDefault();
  const navigateTo = {
    field: parsed.fragment,
    line: parsed.queryParams.lines ? parseInt(parsed.queryParams.lines) : null,
    region: parsed.queryParams.region || null
  };

  if (api.siblingContainer) {
    api.siblingContainer.addSibling(parsed.itemId, navigateTo);
  } else {
    api.navigate(parsed.itemId, navigateTo);
  }
};
```

**Region anchor emission:**
During markdown rendering, detect region markers and emit anchors:
- Input: `<!-- [BEGIN:foo] -->`
- Output: `<span data-region-start="foo"></span>`

### 2. container_view (`ef793c27-2d4b-4c99-b05a-2769db5bc5a9`)

**Changes:**
- Update `addSibling` signature: `addSibling(childId, navigateTo = null)`
- Pass `navigateTo` through to `api.renderItem()` in options/context

```javascript
siblingContainer = {
  addSibling: async (childId, navigateTo = null) => {
    // ... existing logic ...

    // When creating window, pass navigateTo through context
    const wrapper = await createWindowForChild(childId, {
      ...viewConfig,
    }, { navigateTo });
  }
};
```

### 3. kernel-rendering (`33333333-5555-0000-0000-000000000000`)

**Changes:**
- Add `getNavigateTo()` to renderer API (one line)
- Pass `navigateTo` through context

```javascript
// In createRendererAPI:
getNavigateTo: () => context.navigateTo || null
```

### 4. generic_view (`b429b19d-ef0d-4f4f-b2a2-b9e6f80451f2`)

**Changes:**
- Read navigation params from `api.getNavigateTo()` (sibling) or URL (root)
- Match target field and pass scroll options to field view

```javascript
// Get navigation target
const navigateTo = api.getNavigateTo() || getNavigateToFromURL();

for (const [path, hint] of Object.entries(uiHints)) {
  const isTarget = navigateTo?.field === path;

  fieldElement = await fieldView.render(value, {
    ...hint,
    scrollToLine: isTarget ? navigateTo.line : null,
    scrollToRegion: isTarget ? navigateTo.region : null
  }, api);
}

function getNavigateToFromURL() {
  const params = new URLSearchParams(window.location.search);
  const field = params.get('field');
  if (!field) return null;
  return {
    field,
    line: params.get('line') ? parseInt(params.get('line')) : null,
    region: params.get('region')
  };
}
```

### 5. Field Views

All field views gain optional `scrollToLine` and `scrollToRegion` support.

#### field_view_code_editable (`e7b73a8e-2191-4ce5-ae9c-f721b5e30731`)
- Has CodeMirror
- Support both `scrollToLine` and `scrollToRegion`
- For region: find `[BEGIN:name]` marker, calculate line, scroll

#### field_view_code_readonly (`8e2f3e95-cc2d-44a3-beeb-0569f400da7c`)
- Has CodeMirror
- Support both `scrollToLine` and `scrollToRegion`
- Remove existing URL-based navigation (now handled by generic_view)

#### field_view_markdown_editable (`56f77a00-baf5-43cc-9dc4-8ad0c66f1e8f`)
- Has CodeMirror
- Support both `scrollToLine` and `scrollToRegion`

#### field_view_markdown_readonly (`8fd956ff-01f4-48f5-8afb-42fc2718005b`)
- Renders to HTML via hobson-markdown
- Support `scrollToRegion` only (find `[data-region-start]` anchor, scrollIntoView)
- `scrollToLine` ignored (lines don't map to rendered output)

**Scroll implementation for CodeMirror views:**
```javascript
const { scrollToLine, scrollToRegion } = options;

let targetLine = scrollToLine;
if (scrollToRegion && !targetLine) {
  targetLine = findRegionStartLine(code, scrollToRegion);
}

if (targetLine) {
  const cmLine = targetLine - 1; // CodeMirror is 0-indexed
  cm.scrollIntoView({ line: cmLine, ch: 0 }, 100);
  cm.addLineClass(cmLine, 'background', 'line-highlight');
}

function findRegionStartLine(text, regionName) {
  const lines = text.split('\n');
  const marker = '[BEGIN:' + regionName + ']';
  for (let i = 0; i < lines.length; i++) {
    const cleaned = lines[i].trim()
      .replace(/^\/\/\s*/, '')
      .replace(/^#\s*/, '')
      .replace(/^<!--\s*/, '')
      .replace(/\s*-->$/, '')
      .trim();
    if (cleaned === marker) return i + 2; // Line after marker (1-indexed)
  }
  return null;
}
```

**Scroll implementation for markdown readonly:**
```javascript
const { scrollToRegion } = options;

// After hobson-markdown renders content...
if (scrollToRegion) {
  const anchor = wrapper.querySelector(`[data-region-start="${scrollToRegion}"]`);
  if (anchor) {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}
```

## Testing Checklist

- [ ] Link with `#code?lines=42` scrolls to line in code view
- [ ] Link with `#code?region=init` scrolls to region in code view
- [ ] Link with `#description?region=usage` scrolls to region in markdown (editable)
- [ ] Link with `#description?region=usage` scrolls to region in markdown (readonly)
- [ ] Root navigation (click link in root item) works via URL params
- [ ] Sibling navigation (click link in nested item) works via context
- [ ] Missing region fails gracefully (item opens, no scroll)
- [ ] Invalid line number fails gracefully

## Future Considerations

- Could support `?lines=10-20` to highlight a range (not just scroll)
- Could add visual indicator showing which region was navigated to
- Insert Link/Transclusion UI could offer region selection
