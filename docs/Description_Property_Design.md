# Description Property Design

**Date:** 2026-01-14

---

## Core Principle

Every item in Hobson has a `content.description` property containing human-readable prose that explains "what is this item?"

This makes the system self-documenting by design.

---

## The Pattern

**Description = human-readable prose explanation**

How this applies varies by item type:

### Human-Readable Items

For items whose primary purpose is to be read by humans, **description IS the primary content:**

**Notes:**
```javascript
{
  id: "hobson-overview",
  type: "note",
  content: {
    description: "# Hobson\n\nHobson is a personal information system..."
  }
}
```

The note renderer displays `content.description`. There is no separate `text` field.

**Rationale:** A note's purpose is to be read. The description *is* what you read. Having both a summary and full text creates duplication.

### Machine-Executable Items

For items containing code or structured data, **description is separate metadata:**

**Code Items:**
```javascript
{
  id: "note-renderer",
  type: "code",
  content: {
    description: "Renders note items with markdown support and tag editing",
    code: "export function render(item, api) { ... }"
  }
}
```

**Tags:**
```javascript
{
  id: "tag-urgent",
  type: "tag",
  content: {
    description: "Applied to items requiring immediate attention",
    name: "urgent",
    parent: "tag-status"
  }
}
```

**Containers:**
```javascript
{
  id: "my-workspace",
  type: "container",
  content: {
    description: "Development workspace for Hobson project",
    title: "Hobson Dev"
  }
}
```

---

## Properties

- **Optional:** Not required during item creation (don't interrupt flow)
- **Editable:** Users can update descriptions as understanding evolves
- **Location:** Lives in `content.description`, not as top-level metadata
- **Format:** Prose text; markdown is allowed for notes
- **Length:** No restrictions; can be brief or extensive as needed

---

## Benefits

1. **Self-documenting system:** Browse unfamiliar items and understand their purpose
2. **Consistent interface:** Every item answers "what am I?" the same way
3. **Discoverability:** Especially valuable for code items and renderers
4. **No duplication:** For notes, description eliminates need for separate summary field
5. **Evolution support:** Descriptions can be updated as understanding grows

---

## Implementation Impact

### Note Renderer
Must render `content.description` instead of `content.text`.

### Generic Item Editor
Displays `description` field for all item types. For notes, this becomes the primary editing area.

### Backward Compatibility
Existing notes with `content.text` will need migration to `content.description`.

---

## Examples by Item Type

| Item Type | Description Contains |
|-----------|---------------------|
| Note | The note content itself (markdown prose) |
| Code | What the code does, its purpose |
| Renderer | What item types it renders, its capabilities |
| Type | What this type represents in the system |
| Tag | When and how to use this tag |
| Container | The purpose of this workspace |
