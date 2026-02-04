
export function render(value, options, api) {
  const { mode, onChange, label, format = 'full' } = options;
  const wrapper = api.createElement('div', { className: 'field-timestamp' });
  wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

  if (label) {
    const labelEl = api.createElement('label');
    labelEl.textContent = label;
    labelEl.style.cssText = 'font-weight: 500; font-size: 14px; color: var(--color-text);';
    wrapper.appendChild(labelEl);
  }

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    if (format === 'date') return date.toLocaleDateString();
    if (format === 'time') return date.toLocaleTimeString();
    if (format === 'relative') {
      const diff = Date.now() - ts;
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      const days = Math.floor(hrs / 24);
      if (days > 0) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
      if (hrs > 0) return hrs + ' hour' + (hrs > 1 ? 's' : '') + ' ago';
      if (mins > 0) return mins + ' minute' + (mins > 1 ? 's' : '') + ' ago';
      return 'just now';
    }
    return date.toLocaleString();
  };

  if (mode === 'editable' && onChange) {
    const input = api.createElement('input', { type: 'datetime-local', style: 'padding: 8px; border: 1px solid var(--color-border); border-radius: var(--border-radius); font-size: 14px;' });
    if (value) input.value = new Date(value).toISOString().slice(0, 16);
    input.onchange = (e) => onChange(e.target.value ? new Date(e.target.value).getTime() : null);
    wrapper.appendChild(input);
  } else {
    const span = api.createElement('span');
    span.textContent = formatTimestamp(value);
    span.style.cssText = 'padding: 8px; background: var(--color-bg-body); border-radius: var(--border-radius); font-size: 14px; color: var(--color-text-secondary);';
    wrapper.appendChild(span);
  }
  return wrapper;
}
