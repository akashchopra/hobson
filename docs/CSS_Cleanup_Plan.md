# CSS Cleanup Plan

## Overview

Several CSS classes currently defined in the kernel HTML (`hobson.html`) are only used by specific renderers. These should be moved to inline styles within those renderers to maintain cleaner separation between kernel and user-space code.

## CSS to Move from Kernel to Renderers

### 1. `.container-view` → container_renderer
Currently defined in kernel at hobson.html:46-52.
Used exclusively by the container_renderer for its root element.

### 2. `.json-view` → default_renderer
Currently defined in kernel at hobson.html:54-62.
Used exclusively by the default_renderer for displaying JSON item data.

### 3. Context Menu Classes → Injected by viewport_renderer
Currently defined in kernel at hobson.html:98-174.
Includes: `.context-menu`, `.context-menu-item`, `.context-menu-item:hover`, `.context-menu-item.disabled`, `.context-menu-item.selected`, `.context-menu-separator`, `.context-menu-submenu`, `.context-menu-submenu::after`, `.context-menu-submenu-items`

Used by the viewport_renderer for the right-click context menu, but should be available as a standard UI component for any renderer that needs context menus.

## Rationale

**Architectural Consistency**: Renderer-specific styling should live with the renderers, not in the kernel. This maintains the principle that the kernel provides minimal bootstrap functionality while everything else (including styling) is built within the system as items.

**Kernel Minimalism**: The kernel should only contain CSS for its own UI elements (error rendering, REPL, safe mode, selection indicators, navigation chrome).

**Standard UI Library**: The viewport_renderer can inject global styles for common UI patterns (context menus, tooltips, etc.) that any renderer may use. This provides a standard library of UI components without requiring inline styles for everything.

**Pseudo-Selectors**: Some CSS features like `:hover`, `:focus`, `:before`, `:after` require CSS rules and cannot be done with inline styles. Injected global styles solve this limitation.

## CSS That Correctly Remains in Kernel

- `.render-error` - Kernel error handling
- REPL styles - Kernel UI
- Safe mode styles - Kernel recovery UI
- Raw editor styles - Kernel editing UI
- Navigation styles - Kernel chrome
- Selection indicators - Kernel interaction model
- Base layout (`#app`, `#main-view`, `body`, `html`) - Application structure
