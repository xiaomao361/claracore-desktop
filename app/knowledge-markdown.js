(function (scope) {
  const escape = (value) => String(value ?? "").replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  function resolveLink(reference, target) {
    if (/^https?:\/\//iu.test(target)) {
      try {
        const url = new URL(target);
        return url.username || url.password ? null : { external: url.href };
      } catch { return null; }
    }
    if (/^[a-z][a-z0-9+.-]*:|^\/|\\|\0/iu.test(target)) return null;
    let decoded;
    try { decoded = decodeURIComponent(target); } catch { return null; }
    if (/^\/|\\|\0/u.test(decoded)) return null;
    const split = decoded.indexOf("#");
    const file = split < 0 ? decoded : decoded.slice(0, split);
    const anchor = split < 0 ? "" : decoded.slice(split + 1);
    const parts = file ? reference.split("/").slice(0, -1) : [];
    for (const part of (file || reference).split("/")) {
      if (part === "..") { if (!parts.length) return null; parts.pop(); }
      else if (part && part !== ".") parts.push(part);
    }
    if (!parts.join("/").toLowerCase().endsWith(".md")) return null;
    return { reference: parts.join("/") + (anchor ? `#${anchor}` : "") };
  }

  function link(label, target, reference) {
    const resolved = resolveLink(reference, target);
    if (!resolved) return `<span class="knowledge-unavailable-link">${escape(label)} (${escape(target)})</span>`;
    return resolved.external
      ? `<a href="${escape(resolved.external)}" data-knowledge-external="${escape(resolved.external)}" rel="noreferrer">${escape(label)}</a>`
      : `<a href="#knowledge:${encodeURIComponent(resolved.reference)}" data-knowledge-ref="${escape(resolved.reference)}">${escape(label)}</a>`;
  }

  function inline(text, reference, options = {}) {
    // Tokenize before escaping; user content never becomes an HTML attribute or
    // HTML node without escaping. Code tokens cannot create links/emphasis.
    const basePattern = /(`+)([^\n]*?)\1|\[([^\]\n]+)\]\((<[^>]+>|[^)\s]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|https?:\/\/[^\s<>]+/gu;
    const pattern = options.reading ? new RegExp(basePattern.source + "|【[^】\\n]{1,30}】", "gu") : basePattern;
    let html = "";
    let end = 0;
    for (const match of text.matchAll(pattern)) {
      html += escape(text.slice(end, match.index));
      if (match[1]) html += `<code>${escape(match[2])}</code>`;
      else if (match[3]) html += options.linkMode === "text" ? `${escape(match[3])} (${escape(match[4].replace(/^<|>$/gu, ""))})` : link(match[3], match[4].replace(/^<|>$/gu, ""), reference);
      else if (match[5] || match[6]) html += `<strong>${escape(match[5] || match[6])}</strong>`;
      else if (match[7]) html += `<em>${escape(match[7])}</em>`;
      else if (match[0].startsWith("【")) html += options.reading ? `<strong>${escape(match[0])}</strong>` : escape(match[0]);
      else html += options.linkMode === "text" ? escape(match[0]) : link(match[0], match[0], reference);
      end = match.index + match[0].length;
    }
    return html + escape(text.slice(end));
  }

  function render(text, reference, options = {}) {
    const lines = String(text || "").replace(/\r\n?/gu, "\n").split("\n");
    const blocks = [];
    let paragraph = [];
    let list = null;
    let code = null;
    const format = value => inline(value, reference, options);
    function paragraphMarkup() {
      const body = paragraph.join("\n");
      const markers = options.reading && body.startsWith("①") ? [...body.matchAll(/[①-⑳]/gu)] : [];
      // Recognize an explicit ascending list only. Keep circled markers in
      // code, quotations or ambiguous prose as ordinary text.
      const numbered = options.reading && body.startsWith("①") && !body.includes("`") && markers.every((match, index) =>
        match[0].codePointAt(0) === "①".codePointAt(0) + index && (index === 0 || /[。；;.!?\n]\s*$/u.test(body.slice(0, match.index))));
      if (numbered && markers.length) return `<ol class="reading-numbered">${markers.map((match, index) => `<li><span class="reading-number-marker">${match[0]}</span><div>${format(body.slice(match.index + 1, markers[index + 1]?.index ?? body.length).trim())}</div></li>`).join("")}</ol>`;
      return `<p>${paragraph.map(format).join("<br>")}</p>`;
    }
    function flush() {
      if (paragraph.length) blocks.push(paragraphMarkup());
      paragraph = [];
      if (list) blocks.push(`<${list.type}>${list.items.map((line, index) => `<li${options.reading && list.numbers[index] ? ` value="${list.numbers[index]}"` : ""}>${format(line)}</li>`).join("")}</${list.type}>`);
      list = null;
    }
    const cells = (line) => line.trim().replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim());
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const fence = /^\s{0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
      if (code) {
        if (fence && fence[1][0] === code.marker[0] && fence[1].length >= code.marker.length && !fence[2].trim()) {
          blocks.push(`<pre><code>${escape(code.lines.join("\n"))}</code></pre>`); code = null;
        } else code.lines.push(line);
        continue;
      }
      if (fence) { flush(); code = { marker: fence[1], lines: [] }; continue; }
      if (!options.reading && /^<a id="[a-zA-Z0-9_-]+"><\/a>\s*$/u.test(line)) continue;
      if (!line.trim()) { flush(); continue; }
      const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
      if (heading) {
        flush();
        if (options.omitTitle && heading[1].length === 1 && heading[2].trim() === options.omitTitle) { options.omitTitle = ""; continue; }
        const level = Math.max(options.documentBody ? 3 : 1, Math.min(6, heading[1].length + (options.reading ? 3 : 1)));
        blocks.push(`<h${level}>${format(heading[2])}</h${level}>`); continue;
      }
      if (options.reading && /^【[^】\n]{1,30}】\s*$/u.test(line)) { flush(); blocks.push(`<h4>${escape(line.trim())}</h4>`); continue; }
      if (/^\s*(?:---+|\*\*\*+)\s*$/u.test(line)) { flush(); blocks.push("<hr>"); continue; }
      if (line.includes("|") && lines[index + 1] && /^\s*\|?\s*:?-{3,}/u.test(lines[index + 1])
        && cells(lines[index + 1]).every((cell) => /^:?-{3,}:?$/u.test(cell))) {
        flush(); const headings = cells(line); const rows = []; index += 1;
        while (lines[index + 1]?.includes("|")) rows.push(cells(lines[++index]));
        blocks.push(`<div class="knowledge-table"><table><thead><tr>${headings.map((cell) => `<th scope="col">${format(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${format(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        continue;
      }
      const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/u.exec(line);
      if (item) {
        const type = item[1] ? "ul" : "ol";
        if (paragraph.length || (list && list.type !== type)) flush();
        if (!list) list = { type, items: [], numbers: [] };
        list.items.push(item[3]); list.numbers.push(item[2]); continue;
      }
      const quote = /^>\s?(.*)$/u.exec(line);
      if (quote) { flush(); blocks.push(`<blockquote>${format(quote[1])}</blockquote>`); continue; }
      if (list) flush();
      paragraph.push(line);
    }
    if (code) blocks.push(`<pre><code>${escape(code.lines.join("\n"))}</code></pre>`);
    flush();
    return blocks.join("");
  }

  function renderDocument(document, pane = "main") {
    const title = document.title || document.sections[0]?.title || document.path.split('/').pop().replace(/\.md$/i, '');
    let omitted = false;
    return document.sections.map((section, index) => {
      const omitTitle = !omitted && section.text.split(/\r?\n/).some(line => line.trim() === `# ${title}`) ? title : '';
      if (omitTitle) omitted = true;
      return `<section class="knowledge-section" tabindex="-1" data-knowledge-anchor="${escape(section.anchor)}" id="knowledge-${escape(pane)}-section-${index}">${render(section.text, document.path, { documentBody: true, omitTitle })}</section>`;
    }).join('');
  }
  const api = { escape, resolveLink, inline, render, renderDocument };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  scope.ClaraCoreKnowledgeMarkdown = api;
})(typeof window === "undefined" ? globalThis : window);
