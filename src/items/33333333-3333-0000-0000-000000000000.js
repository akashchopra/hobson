// DEPRECATED: This module is no longer used.
// Viewport state is now managed by userland:
// - viewport-manager: handles navigation, URL sync, view preferences
// - selection-manager: handles selection state
// - system:viewport-view: reads viewport item and URL to determine root
//
// This stub remains for backwards compatibility but exports nothing.

export class Viewport {
  constructor() {
    console.warn('kernel:viewport is deprecated. Use viewport-manager instead.');
  }
}
