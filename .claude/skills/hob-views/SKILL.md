---
description: "Reference for writing Hob views in Hobson: render function, hiccup syntax, atoms, builtins, pitfalls, and skeleton templates. Use when creating or modifying Hob view items."
user-invocable: false
---

# Hob Views — Writing Guide

Hob is the preferred language for new views (~50% of views converted as of April 2026).

## Item Structure

```json
{
  "id": "<guid>",
  "name": "my-view",
  "type": "aaaaaaaa-0000-0000-0000-000000000000",
  "content": {
    "for_type": "<type-guid>",
    "displayName": "My View",
    "description": [":doc", ...],
    "hob": [...]
  },
  "attachments": []
}
```

`content.hob` is a **JSON AST array** — never a string. Alongside the `.json` there is a paired `.code` sidecar containing the readable Hob source.

## .code Workflow (editing)

1. Edit `src/items/<guid>.code` directly (Hob sexp syntax).
2. Convert to JSON AST: `python3 src/tools/sexp2ast.py <guid>.code > /tmp/ast.json`
3. Replace `content.hob` in the `.json` file with the AST array from `/tmp/ast.json`.

## Render Function

Every Hob view exports a single `render` function:

```hob
(defn render [item api]
  ; ... setup, side-effect-free local state ...
  [:div {:class "my-view"}
    ; ... hiccup tree ...
    ])
```

- `item` — the item being rendered (snapshot at render time)
- `api` — the rendering API
- The return value is a hiccup tree (not a DOM element)
- The function runs eagerly; atoms and event handlers provide reactivity

## Core Builtins

| Call | Purpose |
|------|---------|
| `(get-item id)` | Fetch fresh item from storage |
| `(set-item! item)` | Save item and trigger reactive re-renders |
| `(rerender!)` | Re-run this view's render function |
| `(open-item! event id)` | Navigate to item (uses event for context) |
| `(get-parent-id)` | Rendering context parent (use for `:open-in`) |
| `(require "name")` | Load a Hob module by name |
| `(js-require "name")` | Load a JS library item by name |
| `(now)` | Current timestamp in ms |
| `(format-date ts)` | Human-readable date string |

## Atoms (Local State)

```hob
(def my-atom (atom initial-value))
(deref my-atom)          ; read — NOT @my-atom (@ means item-ref)
(reset! my-atom new-val) ; write
```

**CRITICAL**: `@name` in Hob source is an **item reference**, NOT atom deref. Always use `(deref atom-name)`.

## Hiccup Patterns

```hob
; Basic element
[:div {:class "foo" :style "color: red;"} "text"]

; Event handler
[:button {:on-click (fn [e] (rerender!))} "Click"]

; Input with value read via DOM
[:input {:type "text"
         :on-input (fn [e]
                     (reset! my-atom (dom-get (dom-get e :target) :value)))}]

; Conditional render
(when condition [:span "shown"])
(if condition [:span "yes"] [:span "no"])

; List rendering
(for [child (seq attachments)]
  [:div {:data-sort-key (:id child)} ...])
```

## Rendering Child Items

```hob
; Render a child item with view resolution
[:render-child {:item child-id
                :view view-id
                :open-in (get-parent-id)}]
```

- `:item` — GUID of child to render
- `:view` — GUID of view to use (omit for default view resolution)
- `:open-in` — parent context for navigation (almost always `(get-parent-id)`)

## Sortable Lists

```hob
[:div {:sortable {:handle ".drag-handle"
                  :on-reorder (fn [from to]
                                (reorder-attachments!
                                  from
                                  to))}}
  (for [child (seq attachments)]
    [:div {:data-sort-key (:id child)}
      [:div.drag-handle "≡"]
      [:render-child {:item (:id child) :view view-id :open-in (get-parent-id)}]
      [:button {:on-click (fn [e] (detach! (:id child)) (rerender!))} "×"]])]
```

## Using Field Views

```hob
; Load and render a field-view module
(def doc-mod (require "field-view-doc-editable"))
(def doc-el
  (.render doc-mod
    (get-in item [:content :description])
    {:mode "editable"
     :label "Notes"
     :onChange (fn [new-val]
                 (let [fresh (get-item (:id item))]
                   (set-item! (assoc-in fresh [:content :description] new-val))))}
    api))
```

Common field views: `field-view-heading`, `field-view-doc-editable`, `field-view-doc-readonly`, `field-view-hob`, `field-view-code-editable`, `field-view-text`, `field-view-tags`.

## Saving Patterns

**Always fetch fresh before saving** (stale closure prevention):

```hob
; Correct — fetch then merge
(let [fresh (get-item (:id item))]
  (set-item! (assoc-in fresh [:content :field] new-value)))

; Wrong — item is a stale closure snapshot
(set-item! (assoc-in item [:content :field] new-value))
```

## DOM Interop

```hob
(def doc (dom-get (hiccup->dom [:div]) :ownerDocument))
(def win (dom-get doc :defaultView))
(dom-get element :property)      ; read property
(dom-set! element :property val) ; write property
```

## UI State That Survives Re-renders

Hob view modules are **re-evaluated on every `rerender!`** — atoms defined inside `render` reset each call, and top-level `def` forms outside `render` are also re-evaluated. There is no persistent module-level scope.

For pure UI state changes (tab switching, toggling panels) that don't involve data: **do not call `rerender!`**. Use `dom-set!` to manipulate the DOM directly instead.

```hob
; Give panels unique IDs scoped to item
(def date-panel-id (str "my-date-" (:id item)))

; In hiccup — initial visibility set at render time
[:div {:id date-panel-id :style "display: block"} ...]

; On tab click — no rerender!, just toggle DOM
(dom-set! (.getElementById doc date-panel-id) :style "display: none")
```

Reserve `rerender!` for when data changes and the view needs to reflect new storage state.

## Pitfalls

1. **`@` is item-ref, not deref** — use `(deref atom-name)` for atoms.
2. **Hob fns are always async** — never pass as synchronous callbacks to JS APIs (e.g., sort comparators, `Array.sort`). Use JS library items for sync interop.
3. **morphdom keeps old handlers** — do not transfer `__hobEvents` across re-renders; old handlers have correct DOM refs.
4. **Selector pins** — once registered via `get-item :select`, later bare `get-item` calls don't widen the subscription. Re-register with `:select` if the set of watched items changes.
5. **`invoke` converts via `hobToJs`** — never pass browser API objects (File, Blob, Event, etc.) as args to `invoke`; they get serialized destructively.
6. **Hob fns can't replace sync APIs** — if a JS library requires a synchronous callback, write the interop in a JS library item and call it from Hob.
7. **sexp2ast.py doesn't handle `\uXXXX` escapes** — use literal Unicode characters in `.code` files.

## Minimal Skeleton

```hob
(defn render [item api]
  [:div {:style "padding: 16px;"}
    [:h2 {} (:name item)]])
```

## Full Skeleton (with state + save)

```hob
(defn render [item api]
  (def pending (atom nil))

  [:div {:style "max-width: 700px; margin: 0 auto; padding: 20px;"}

    [:input {:type "text"
             :value (or (deref pending) (get-in item [:content :field]) "")
             :on-input (fn [e]
                         (reset! pending
                           (dom-get (dom-get e :target) :value)))}]

    [:button {:on-click (fn [e]
                          (when-let [v (deref pending)]
                            (let [fresh (get-item (:id item))]
                              (set-item!
                                (-> fresh
                                    (assoc-in [:content :field] v)
                                    (assoc :modified (now)))))
                            (reset! pending nil)
                            (rerender!)))}
      "Save"]])
```
