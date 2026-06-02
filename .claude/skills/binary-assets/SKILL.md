---
description: "Reference for Hobson binary assets: blob store API, binary-asset type structure, creating new subtypes, export/import mechanics, and image view pattern."
user-invocable: false
---

# Binary Assets — Writing Guide

Binary data (images, files) is stored separately from item JSON in an IndexedDB `blobs` object store. Item JSON contains only metadata.

## Key GUIDs

| Item | GUID |
|------|------|
| `binary-asset` type | `602cd3c2-333b-43fd-94f4-9ab08eeb2ca8` |
| `image` type | `d0d0d0d0-0010-0000-0000-000000000000` |
| `image-view` | `d0d0d0d0-0011-0000-0000-000000000000` |

## How It Works

- Binary data lives in the IDB `blobs` store, keyed by the item's GUID.
- The item JSON never contains raw bytes — only metadata fields.
- Access via `api.getBlob(id)` → `Blob` and `api.setBlob(id, blob)`.
- `binary-asset` is a marker type: extend it for any item whose primary content is binary.

## binary-asset Type

```json
{
  "id": "602cd3c2-333b-43fd-94f4-9ab08eeb2ca8",
  "name": "binary-asset",
  "type": "11111111-0000-0000-0000-000000000000",
  "extends": "00000000-0000-0000-0000-000000000000",
  "content": {
    "required_fields": ["mimeType"]
  }
}
```

Every binary-asset subtype must include `mimeType` in `content`.

## image Type (example subtype)

```json
{
  "id": "d0d0d0d0-0010-0000-0000-000000000000",
  "name": "image",
  "type": "11111111-0000-0000-0000-000000000000",
  "extends": "602cd3c2-333b-43fd-94f4-9ab08eeb2ca8",
  "content": {},
  "preferredView": "d0d0d0d0-0011-0000-0000-000000000000"
}
```

Optional content fields: `alt`, `width`, `height`.

## Blob API

```javascript
const blob = await api.getBlob(item.id);  // → Blob | null
await api.setBlob(item.id, blob);          // blob: Blob or ArrayBuffer

// Display an image blob
const url = URL.createObjectURL(blob);
img.src = url;
URL.revokeObjectURL(url); // release when done
```

## Export / Import

During `api.export()` and file-sync mirror mode, blobs are serialized as `_blob` data URL fields in the exported JSON:

```json
{
  "id": "...",
  "name": "photo.jpg",
  "type": "d0d0d0d0-0010-0000-0000-000000000000",
  "content": { "mimeType": "image/jpeg", "width": 1920, "height": 1080 },
  "_blob": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
}
```

On import, the bootloader detects `_blob`, converts the data URL back to a Blob, calls `api.setBlob(item.id, blob)`, then strips `_blob` before storing the item JSON. No special handling needed when importing exported files.

## Writing a Binary Asset View

```javascript
export async function render(item, api) {
  const container = api.createElement('div', { className: 'binary-asset-view' });

  const blob = await api.getBlob(item.id);
  if (!blob) {
    container.textContent = 'No data';
    return container;
  }

  const url = URL.createObjectURL(blob);

  if (item.content?.mimeType?.startsWith('image/')) {
    const img = api.createElement('img');
    img.src = url;
    img.alt = item.content?.alt || item.name || '';
    img.style.cssText = 'max-width: 100%; height: auto; display: block;';
    container.appendChild(img);
  } else {
    const a = api.createElement('a');
    a.href = url;
    a.download = item.name;
    a.textContent = `Download ${item.name}`;
    container.appendChild(a);
  }

  return container;
}
```

## Creating a New Binary Asset Subtype

1. **Create type item** extending `602cd3c2` (binary-asset):
   ```json
   {
     "id": "<new-guid>",
     "name": "my-file-type",
     "type": "11111111-0000-0000-0000-000000000000",
     "extends": "602cd3c2-333b-43fd-94f4-9ab08eeb2ca8",
     "content": { "required_fields": ["mimeType"] },
     "preferredView": "<view-guid>"
   }
   ```

2. **Write a view** that calls `api.getBlob(item.id)` to fetch the binary data.

3. **Import handling** is automatic — the bootloader processes `_blob` for all `binary-asset` subtypes.

4. **Optionally tag** with `c0c0c0c0-0071-0000-0000-000000000000` to appear in the app-page widget picker.

## Skeleton binary-asset Item

```json
{
  "id": "<new-guid>",
  "name": "my-file.pdf",
  "type": "<subtype-guid>",
  "created": 0,
  "modified": 0,
  "content": {
    "mimeType": "application/pdf"
  },
  "attachments": []
}
```

After creating the item JSON, call `api.setBlob(item.id, blob)` to store the binary data.
