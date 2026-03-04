const stylesItem = await api.get('33333333-8888-0000-0000-000000000000');
const hue = pageContext.getState('hue');
const tint = pageContext.getState('tintStrength');
const fontSize = pageContext.getState('baseFontSize');
if (hue !== undefined) stylesItem.content.hue = hue;
if (tint !== undefined) stylesItem.content.tintStrength = tint;
if (fontSize !== undefined) stylesItem.content.baseFontSize = fontSize;
stylesItem.modified = Date.now();
await api.set(stylesItem);