export async function render(item, api) {
  const name = item.name || item.id.substring(0, 8);
  const pill = api.createElement('div', {
    class: 'inline-card',
    title: name,
    style: 'display: flex; align-items: center; padding: 4px 12px; background: var(--color-bg-surface); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); cursor: pointer; transition: background 0.15s;'
  }, []);

  pill.appendChild(api.createElement('span', {
    style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--color-text);'
  }, [name]));

  pill.onmouseover = () => { pill.style.background = 'var(--color-bg-surface-alt)'; };
  pill.onmouseout = () => { pill.style.background = 'var(--color-bg-surface)'; };

  pill.onclick = (e) => { e.stopPropagation(); api.siblingContainer?.addSibling(item.id); };

  return pill;
}
