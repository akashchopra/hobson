// diagram-lib — Auto-generated SVG diagrams from item metadata
// See: item://c0c0c0c0-005a-0000-0000-000000000000

// [BEGIN:eventFlow]
/** Render declarative event flow as an interactive SVG diagram.
 * Usage in markdown: ![](item://diagram-lib?call=eventFlow)
 * @param {Object} api - Hobson API
 * @param {Object} params - URL query params (unused)
 * @returns {Element} SVG element
 */
export async function eventFlow(api, params) {
  const allItems = await api.getAll();

  // Name lookup for resolving GUIDs to human names
  const nameOf = new Map();
  for (const it of allItems) nameOf.set(it.id, it.name || '');

  // Collect declarative watches → edges
  const edges = [];
  const eventSet = new Set();
  const subs = new Map(); // subscriber id → name

  for (const it of allItems) {
    const watches = it.watches || it.content?.watches;
    if (!watches?.length) continue;
    for (const w of watches) {
      if (!w.event) continue;
      eventSet.add(w.event);
      subs.set(it.id, it.name || it.id.slice(0, 12));
      const filters = [];
      if (w.type) filters.push('type=' + shortName(nameOf, w.type));
      if (w.typeExtends) filters.push('ext=' + shortName(nameOf, w.typeExtends));
      if (w.id) filters.push('id=' + shortName(nameOf, w.id));
      // Derive handler name: "item:deleted" → "onItemDeleted"
      const handlerName = eventToHandlerName(nameOf.get(w.event) || '');
      edges.push({ event: w.event, sub: it.id, filters, handlerName });
    }
  }

  if (!edges.length) return textEl('No declarative watches found.');

  // Sort events by GUID (encodes category-then-specificity)
  const events = [...eventSet].sort();

  // Sort subscribers: group by primary event, then alphabetically
  const primary = new Map();       // sub id → primary event id
  const primaryHandler = new Map(); // sub id → primary handler name
  for (const e of edges) {
    if (!primary.has(e.sub)) {
      primary.set(e.sub, e.event);
      primaryHandler.set(e.sub, e.handlerName);
    }
  }
  const subList = [...subs.keys()].sort((a, b) => {
    const d = events.indexOf(primary.get(a)) - events.indexOf(primary.get(b));
    return d || (subs.get(a) || '').localeCompare(subs.get(b) || '');
  });

  // --- Layout ---
  const P = 24;       // padding
  const BH = 28;      // box height
  const BR = 5;       // border radius
  const VG = 8;       // vertical gap
  const EW = 210;     // event box width
  const SW = 210;     // subscriber box width
  const MID = 200;    // gap between columns (for curves + filter labels)
  const HEADER = 20;  // space for column labels
  const RX = P + EW + MID;  // right column x
  const W = RX + SW + P;    // total width

  const nE = events.length;
  const nS = subList.length;
  const span = Math.max(nE, nS) * (BH + VG) - VG;
  const eStep = nE > 1 ? (span - BH) / (nE - 1) : 0;
  const sStep = nS > 1 ? (span - BH) / (nS - 1) : 0;
  const topY = P + HEADER;
  const ey = i => topY + i * eStep;
  const sy = i => topY + i * sStep;
  const H = topY + span + P;

  const evtY = new Map();
  events.forEach((id, i) => evtY.set(id, ey(i)));
  const subY = new Map();
  subList.forEach((id, i) => subY.set(id, sy(i)));

  // --- Colors: solid boxes with white text (works on any background) ---
  const cat = id => {
    if (id.startsWith('e0e00000-0001')) return { bg: '#3b82f6', ln: '#60a5fa' }; // item events – blue
    if (id.startsWith('e0e00000-0002')) return { bg: '#d97706', ln: '#fbbf24' }; // system events – amber
    if (id.startsWith('e0e00000-0003')) return { bg: '#059669', ln: '#34d399' }; // viewport events – green
    return { bg: '#6b7280', ln: '#9ca3af' };
  };

  // --- Build SVG ---
  const o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="font-family:system-ui,sans-serif;font-size:11px;max-width:100%">`);
  o.push(`<style>g[data-id]:hover rect{filter:brightness(1.3)}g[data-id]{cursor:pointer}path[data-sub]{cursor:pointer}path[data-sub]:hover+path{opacity:0.9;stroke-width:2.5}</style>`);

  // Column labels
  o.push(`<text x="${P + EW / 2}" y="${P + 10}" text-anchor="middle" fill="#64748b" font-size="10" font-weight="600" letter-spacing="0.05em">EVENTS</text>`);
  o.push(`<text x="${RX + SW / 2}" y="${P + 10}" text-anchor="middle" fill="#64748b" font-size="10" font-weight="600" letter-spacing="0.05em">WATCHERS</text>`);

  // Edges (drawn first so boxes render on top)
  // Each edge is clickable: opens the subscriber scrolled to its handler
  for (const e of edges) {
    const y1 = evtY.get(e.event) + BH / 2;
    const y2 = subY.get(e.sub) + BH / 2;
    const x1 = P + EW;
    const x2 = RX;
    const c = cat(e.event);
    // Invisible wider hit area for the path
    o.push(`<path data-sub="${e.sub}" data-handler="${e.handlerName}" d="M${x1} ${y1} C${x1 + MID * 0.4} ${y1} ${x2 - MID * 0.4} ${y2} ${x2} ${y2}" fill="none" stroke="transparent" stroke-width="12" style="cursor:pointer"/>`);
    // Visible path
    o.push(`<path d="M${x1} ${y1} C${x1 + MID * 0.4} ${y1} ${x2 - MID * 0.4} ${y2} ${x2} ${y2}" fill="none" stroke="${c.ln}" stroke-width="1.5" opacity="0.4" pointer-events="none"/>`);

    // Filter annotation along the curve
    if (e.filters.length) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      o.push(`<text x="${mx}" y="${my - 4}" text-anchor="middle" font-size="9" fill="#94a3b8" pointer-events="none">${esc(e.filters.join(', '))}</text>`);
    }
  }

  // Event boxes (left column)
  events.forEach(id => {
    const y = evtY.get(id);
    const c = cat(id);
    const name = nameOf.get(id) || id.slice(0, 12);
    o.push(`<g data-id="${id}">`);
    o.push(`<rect x="${P}" y="${y}" width="${EW}" height="${BH}" rx="${BR}" fill="${c.bg}"/>`);
    o.push(`<text x="${P + EW / 2}" y="${y + BH / 2 + 4}" text-anchor="middle" fill="#fff" font-weight="600">${esc(name)}</text>`);
    o.push(`</g>`);
  });

  // Subscriber boxes (right column)
  subList.forEach(id => {
    const y = subY.get(id);
    const handler = primaryHandler.get(id) || '';
    o.push(`<g data-id="${id}" data-handler="${handler}">`);
    o.push(`<rect x="${RX}" y="${y}" width="${SW}" height="${BH}" rx="${BR}" fill="#475569"/>`);
    o.push(`<text x="${RX + SW / 2}" y="${y + BH / 2 + 4}" text-anchor="middle" fill="#fff">${esc(subs.get(id))}</text>`);
    o.push(`</g>`);
  });

  o.push('</svg>');

  // Parse to DOM and add interactivity
  const div = document.createElement('div');
  div.innerHTML = o.join('\n');
  const svgEl = div.firstElementChild;

  // Click boxes: open item scrolled to handler symbol
  for (const g of svgEl.querySelectorAll('g[data-id]')) {
    g.addEventListener('click', (e) => {
      const handler = g.dataset.handler;
      if (handler) {
        api.openItem(e, { id: g.dataset.id, view: { navigateTo: { symbol: handler } } });
      } else {
        api.openItem(e, g.dataset.id);
      }
    });
  }

  // Click edges: open subscriber scrolled to that specific handler
  for (const path of svgEl.querySelectorAll('path[data-sub]')) {
    path.addEventListener('click', (e) => {
      const handler = path.dataset.handler;
      if (handler) {
        api.openItem(e, { id: path.dataset.sub, view: { navigateTo: { symbol: handler } } });
      } else {
        api.openItem(e, path.dataset.sub);
      }
    });
  }

  return svgEl;
}
// [END:eventFlow]

// "item:deleted" → "onItemDeleted", "kernel:boot-complete" → "onKernelBootComplete"
function eventToHandlerName(eventName) {
  if (!eventName) return '';
  const parts = eventName.split(/[:-]/);
  return 'on' + parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
}

function shortName(nameOf, id) {
  return nameOf.get(id) || id.slice(0, 8);
}

function textEl(msg) {
  const p = document.createElement('p');
  p.textContent = msg;
  p.style.color = '#94a3b8';
  return p;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
