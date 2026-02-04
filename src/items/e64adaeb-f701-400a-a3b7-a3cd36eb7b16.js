// Theme Hot-Reload Library
// Applies kernel styles at boot and hot-reloads when kernel:styles is edited

const KERNEL_STYLES_ID = '33333333-8888-0000-0000-000000000000';

async function applyStyles(api) {
  // Remove existing kernel styles if present
  const existing = document.querySelector('style[data-kernel-styles]');
  if (existing) existing.remove();

  try {
    const stylesItem = await api.get(KERNEL_STYLES_ID);
    const style = document.createElement('style');
    style.setAttribute('data-kernel-styles', 'true');
    style.textContent = stylesItem.content.code;
    document.head.appendChild(style);
  } catch (e) {
    console.error('Failed to apply kernel styles:', e);
    // Fallback handled by bootloader inline styles
  }
}

// Called at boot (or when library is created/edited post-boot)
export async function onSystemBootComplete({ lateActivation }, api) {
  await applyStyles(api);
  if (lateActivation) {
    console.log('[theme-hot-reload] Library activated post-boot');
  } else {
    console.log('[theme-hot-reload] Styles applied at boot');
  }
}

// Called when kernel:styles is edited
export async function onItemUpdated({ item }, api) {
  await applyStyles(api);
  console.log('[theme-hot-reload] Styles hot-reloaded');
}
