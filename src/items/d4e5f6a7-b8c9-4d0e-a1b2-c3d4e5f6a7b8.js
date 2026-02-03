// Item: system:compact-card-view
// ID: d4e5f6a7-b8c9-4d0e-a1b2-c3d4e5f6a7b8
// Type: aaaaaaaa-0000-0000-0000-000000000000


export async function render(item, api) {
  // data-item-id is set automatically by api.renderItem()
  const card = api.createElement('div', {
    class: 'compact-card',
    style: 'padding: 12px; margin-bottom: 8px; background: var(--color-bg-surface); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); cursor: pointer; transition: all 0.2s;'
  }, []);

  // Title
  const title = api.createElement('div', {
    style: 'font-weight: 500; color: var(--color-text); margin-bottom: 6px; overflow: hidden;'
  }, [item.name || item.content?.title || item.id.substring(0, 8)]);
  card.appendChild(title);

  // Preview text
  const previewText = item.content?.body || item.content?.description || '';
  if (previewText) {
    const preview = api.createElement('div', {
      style: 'font-size: 13px; color: var(--color-text-secondary); margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;'
    }, [previewText.substring(0, 200)]);
    card.appendChild(preview);
  }

  // Metadata
  const typeItem = await api.get(item.type);
  const meta = api.createElement('div', {
    style: 'font-size: 12px; color: var(--color-border-dark);'
  }, [
    'Type: ' + typeItem.name 
  ]);
  card.appendChild(meta);

  // Hover effects
  card.onmouseover = () => {
    card.style.background = 'var(--color-bg-surface-alt)';
    card.style.borderColor = 'var(--color-primary)';
    card.style.transform = 'translateX(4px)';
  };
  card.onmouseout = () => {
    card.style.background = 'var(--color-bg-surface)';
    card.style.borderColor = 'var(--color-border-light)';
    card.style.transform = 'translateX(0)';
  };

  // Click to open as sibling window
  card.onclick = (e) => {
    e.stopPropagation();
    api.siblingContainer?.addSibling(item.id);
  };

  return card;
}
