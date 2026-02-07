// Event Definition View — read-only reference card for event items

export async function render(item, api) {
  const container = api.createElement('div', {
    class: 'event-definition-view',
    style: 'display: flex; flex-direction: column; gap: 16px; padding: 20px; height: 100%; overflow-y: auto;'
  }, []);

  // Resolve category type name for badge
  let categoryName = '';
  let badgeBg = 'var(--color-bg-surface-alt)';
  let badgeColor = 'var(--color-text-secondary)';
  try {
    const typeItem = await api.get(item.type);
    categoryName = typeItem?.name || '';
    if (categoryName.includes('system')) {
      badgeBg = 'var(--color-warning-light)';
      badgeColor = 'var(--color-warning)';
    } else if (categoryName.includes('item')) {
      badgeBg = 'var(--color-primary-light)';
      badgeColor = 'var(--color-primary)';
    } else if (categoryName.includes('viewport')) {
      badgeBg = 'var(--color-success-light)';
      badgeColor = 'var(--color-success)';
    }
  } catch {}

  // Header: event name in monospace + category badge
  const header = api.createElement('div', {
    style: 'display: flex; align-items: center; gap: 12px; flex-wrap: wrap;'
  }, []);

  const nameEl = api.createElement('h2', {
    style: 'margin: 0; font-family: var(--font-mono, monospace); font-size: 20px; color: var(--color-text);'
  }, [item.name || 'Unnamed Event']);
  header.appendChild(nameEl);

  if (categoryName) {
    const badge = api.createElement('span', {
      style: `font-size: 12px; padding: 2px 10px; border-radius: 10px; background: ${badgeBg}; color: ${badgeColor}; white-space: nowrap;`
    }, [categoryName]);
    header.appendChild(badge);
  }

  container.appendChild(header);

  // Description (rendered as markdown)
  if (item.content?.description) {
    const descSection = api.createElement('div', {
      style: 'line-height: 1.5;'
    }, []);
    const hobsonMarkdown = await api.require('hobson-markdown');
    const rendered = await hobsonMarkdown.render(item.content.description, api);
    descSection.appendChild(rendered);
    container.appendChild(descSection);
  }

  // Payload schema
  if (item.content?.payload && Object.keys(item.content.payload).length > 0) {
    const payloadSection = api.createElement('div', {
      style: 'display: flex; flex-direction: column; gap: 8px;'
    }, []);

    const payloadLabel = api.createElement('h3', {
      style: 'margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-secondary);'
    }, ['Payload']);
    payloadSection.appendChild(payloadLabel);

    const schemaEl = renderPayloadSchema(item.content.payload, api);
    payloadSection.appendChild(schemaEl);
    container.appendChild(payloadSection);
  }

  // Usage snippet
  const snippetSection = api.createElement('div', {
    style: 'display: flex; flex-direction: column; gap: 8px;'
  }, []);

  const snippetLabel = api.createElement('h3', {
    style: 'margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-text-secondary);'
  }, ['Usage']);
  snippetSection.appendChild(snippetLabel);

  const snippet = buildUsageSnippet(item);
  const pre = api.createElement('pre', {
    style: 'margin: 0; padding: 12px; background: var(--color-bg-body); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); overflow-x: auto; font-size: 13px; line-height: 1.4; position: relative;'
  }, []);
  const code = api.createElement('code', {}, [snippet]);
  pre.appendChild(code);

  const copyBtn = api.createElement('button', {
    style: 'position: absolute; top: 6px; right: 6px; padding: 2px 8px; font-size: 11px; background: var(--color-bg-surface); border: 1px solid var(--color-border-light); border-radius: var(--border-radius); cursor: pointer; color: var(--color-text-secondary);',
    onclick: () => {
      navigator.clipboard.writeText(snippet);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    }
  }, ['Copy']);
  pre.appendChild(copyBtn);

  snippetSection.appendChild(pre);
  container.appendChild(snippetSection);

  return container;
}

function renderPayloadSchema(payload, api, depth = 0) {
  const wrapper = api.createElement('div', {
    style: depth === 0
      ? 'border: 1px solid var(--color-border-light); border-radius: var(--border-radius); overflow: hidden;'
      : ''
  }, []);

  const entries = Object.entries(payload);
  entries.forEach(([key, value], i) => {
    const isNested = typeof value === 'object' && value !== null;
    const isLast = i === entries.length - 1 && !isNested;
    const borderStyle = isLast ? '' : 'border-bottom: 1px solid var(--color-border-light);';
    const indent = 12 + depth * 20;

    const row = api.createElement('div', {
      style: `display: flex; align-items: baseline; padding: 8px 12px; padding-left: ${indent}px; ${borderStyle}`
    }, []);

    const keyEl = api.createElement('code', {
      style: 'font-size: 13px; color: var(--color-primary); flex-shrink: 0; min-width: 100px;'
    }, [key]);
    row.appendChild(keyEl);

    if (isNested) {
      const hint = api.createElement('span', {
        style: 'font-size: 12px; color: var(--color-text-tertiary); margin-left: 8px;'
      }, ['{...}']);
      row.appendChild(hint);
      wrapper.appendChild(row);

      // Render nested fields inline (flatten into same container)
      const nestedEntries = Object.entries(value);
      nestedEntries.forEach(([nKey, nValue], ni) => {
        const nIsNested = typeof nValue === 'object' && nValue !== null;
        const nIsLast = ni === nestedEntries.length - 1 && !nIsNested;
        const nBorderStyle = (nIsLast && isLast) ? '' : 'border-bottom: 1px solid var(--color-border-light);';
        const nIndent = 12 + (depth + 1) * 20;

        const nRow = api.createElement('div', {
          style: `display: flex; align-items: baseline; padding: 8px 12px; padding-left: ${nIndent}px; ${nBorderStyle}`
        }, []);

        const nKeyEl = api.createElement('code', {
          style: 'font-size: 13px; color: var(--color-primary); flex-shrink: 0; min-width: 100px;'
        }, [nKey]);
        nRow.appendChild(nKeyEl);

        const nValEl = api.createElement('span', {
          style: 'font-size: 13px; color: var(--color-text-secondary); margin-left: 12px;'
        }, [String(nValue)]);
        nRow.appendChild(nValEl);

        wrapper.appendChild(nRow);
      });
    } else {
      const valEl = api.createElement('span', {
        style: 'font-size: 13px; color: var(--color-text-secondary); margin-left: 12px;'
      }, [String(value)]);
      row.appendChild(valEl);
      wrapper.appendChild(row);
    }
  });

  return wrapper;
}

function buildUsageSnippet(item) {
  const eventId = item.id;
  const payload = item.content?.payload;

  // Build destructured params from top-level payload keys
  let params = '';
  if (payload) {
    const keys = Object.keys(payload);
    if (keys.length > 0) {
      params = '{ ' + keys.join(', ') + ' }';
    }
  }

  const lines = [`api.events.on('${eventId}', (event) => {`];
  if (params) {
    lines.push(`  const ${params} = event.content;`);
  }
  lines.push(`  // ...`);
  lines.push(`});`);

  return lines.join('\n');
}
