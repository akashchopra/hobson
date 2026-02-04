// Item: marked
// ID: d484eea8-06b5-4d8d-ba10-0077fc8f637a
// Type: 66666666-0000-0000-0000-000000000000


// Minimal marked.js implementation - just what we need
// Full library: https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js

const marked = (() => {
  const block = {
    newline: /^\n+/,
    code: /^( {4}[^\n]+\n*)+/,
    heading: /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,
    hr: /^ {0,3}((?:- *){3,}|(?:_ *){3,}|(?:\* *){3,})(?:\n+|$)/,
    blockquote: /^( {0,3}> ?(>| )?(.*(?:\n(?! {0,3}\[)[^\n]+)*)(?:\n+|$))+/,
    list: /^( {0,3})(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
    paragraph: /^([^\n]+(?:\n(?!hr|heading|blockquote)[^\n]+)*)/,
    text: /^[^\n]+/
  };

  const inline = {
    escape: /^\\([!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~])/,
    link: /^!?\[((?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*)\]\(\s*<?(.*?)>?(?:\s+['"](.*?)['"])?\s*\)/,
    strong: /^__(.*?)__(?!_)|^\*\*(.*?)\*\*(?!\*)/,
    em: /^\b_((?:__|[^_])+?)_\b|^\*((?:\*\*|[^\*])+?)\*(?!\*)/,
    code: /^`([^`]|[^`][\s\S]*?[^`])`/,
    br: /^ {2,}\n(?!\s*$)/,
    text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/
  };

  function escape(html) {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseInline(src) {
    let out = '';
    let cap;

    while (src) {
      // escape
      if (cap = inline.escape.exec(src)) {
        src = src.substring(cap[0].length);
        out += escape(cap[1]);
        continue;
      }

      // link
      if (cap = inline.link.exec(src)) {
        src = src.substring(cap[0].length);
        const text = cap[1];
        const href = cap[2];
        out += '<a href="' + escape(href) + '">' + parseInline(text) + '</a>';
        continue;
      }

      // strong
      if (cap = inline.strong.exec(src)) {
        src = src.substring(cap[0].length);
        out += '<strong>' + parseInline(cap[2] || cap[1]) + '</strong>';
        continue;
      }

      // em
      if (cap = inline.em.exec(src)) {
        src = src.substring(cap[0].length);
        out += '<em>' + parseInline(cap[2] || cap[1]) + '</em>';
        continue;
      }

      // code
      if (cap = inline.code.exec(src)) {
        src = src.substring(cap[0].length);
        out += '<code>' + escape(cap[1].trim()) + '</code>';
        continue;
      }

      // br
      if (cap = inline.br.exec(src)) {
        src = src.substring(cap[0].length);
        out += '<br>';
        continue;
      }

      // text
      if (cap = inline.text.exec(src)) {
        src = src.substring(cap[0].length);
        out += escape(cap[0]);
        continue;
      }

      if (src) {
        throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
      }
    }

    return out;
  }

  function parse(src) {
    let out = '';
    let cap;

    src = src.replace(/\r\n|\r/g, '\n').replace(/\t/g, '    ');

    while (src) {
      // newline
      if (cap = block.newline.exec(src)) {
        src = src.substring(cap[0].length);
        continue;
      }

      // code block
      if (cap = block.code.exec(src)) {
        src = src.substring(cap[0].length);
        const code = cap[0].replace(/^ {4}/gm, '');
        out += '<pre><code>' + escape(code.trim()) + '</code></pre>\n';
        continue;
      }

      // heading
      if (cap = block.heading.exec(src)) {
        src = src.substring(cap[0].length);
        const level = cap[1].length;
        const text = cap[2].trim();
        out += '<h' + level + '>' + parseInline(text) + '</h' + level + '>\n';
        continue;
      }

      // hr
      if (cap = block.hr.exec(src)) {
        src = src.substring(cap[0].length);
        out += '<hr>\n';
        continue;
      }

      // blockquote
      if (cap = block.blockquote.exec(src)) {
        src = src.substring(cap[0].length);
        const quote = cap[0].replace(/^ *> ?/gm, '');
        out += '<blockquote>\n' + parse(quote) + '</blockquote>\n';
        continue;
      }

      // paragraph
      if (cap = block.paragraph.exec(src)) {
        src = src.substring(cap[0].length);
        const text = cap[1].trim();
        out += '<p>' + parseInline(text) + '</p>\n';
        continue;
      }

      // text (fallback)
      if (cap = block.text.exec(src)) {
        src = src.substring(cap[0].length);
        out += '<p>' + parseInline(cap[0]) + '</p>\n';
        continue;
      }

      if (src) {
        throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
      }
    }

    return out;
  }

  return { parse };
})();

export default marked;
  