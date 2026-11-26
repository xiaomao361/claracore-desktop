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

  function link(labelHtml, labelText, target, reference) {
    const resolved = resolveLink(reference, target);
    if (!resolved) return `<span class="knowledge-unavailable-link">${escape(labelText)} (${escape(target)})</span>`;
    return resolved.external
      ? `<a href="${escape(resolved.external)}" data-knowledge-external="${escape(resolved.external)}" rel="noreferrer">${labelHtml}</a>`
      : `<a href="#knowledge:${encodeURIComponent(resolved.reference)}" data-knowledge-ref="${escape(resolved.reference)}">${labelHtml}</a>`;
  }

  function inline(text, reference, options = {}) {
    // Tokenize before escaping; user content never becomes an HTML attribute or
    // HTML node without escaping. Code tokens cannot create links/emphasis.
    const depth = options.depth || 0;
    const nested = (value, extra = {}) => depth < 3 ? inline(value, reference, { ...options, ...extra, depth: depth + 1 }) : escape(value);
    const linkPattern = options.noLinks ? "" : "|\\[([^\\]\\n]+)\\]\\((<[^>]+>|[^)\\s]+)\\)|https?:\\/\\/[^\\s<>]+";
    const readingPattern = options.reading ? "|【[^】\\n]{1,30}】" : "";
    const pattern = new RegExp(
      "(`+)([^\\n]*?)\\1|\\*\\*([^*\\n]+)\\*\\*|__([^_\\n]+)__|~~([^~\\n]+)~~|\\*([^*\\n]+)\\*" + linkPattern + readingPattern,
      "gu"
    );
    let html = "";
    let end = 0;
    for (const match of text.matchAll(pattern)) {
      html += escape(text.slice(end, match.index));
      if (match[1]) html += `<code>${escape(match[2])}</code>`;
      else if (match[3] || match[4]) html += `<strong>${nested(match[3] || match[4])}</strong>`;
      else if (match[5]) html += `<del>${nested(match[5])}</del>`;
      else if (match[6]) html += `<em>${nested(match[6])}</em>`;
      else if (!options.noLinks && match[7]) {
        const href = match[8].replace(/^<|>$/gu, "");
        html += options.linkMode === "text"
          ? `${nested(match[7], { noLinks: true })} (${escape(href)})`
          : link(nested(match[7], { noLinks: true }), match[7], href, reference);
      } else if (match[0].startsWith("【")) html += options.reading ? `<strong>${escape(match[0])}</strong>` : escape(match[0]);
      else html += options.linkMode === "text" ? escape(match[0]) : link(escape(match[0]), match[0], match[0], reference);
      end = match.index + match[0].length;
    }
    return html + escape(text.slice(end));
  }

  function render(text, reference, options = {}) {
    const lines = String(text || "").replace(/\r\n?/gu, "\n").split("\n");
    const blocks = [];
    let paragraph = [];
    let listEntries = [];
    let quoteLines = [];
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
    function renderListNodes(nodes, type) {
      return `<${type}>${nodes.map((node) => {
        const task = node.task;
        const attrs = [
          options.reading && node.number ? ` value="${node.number}"` : "",
          task ? ` class="knowledge-task-item${task.checked ? " is-checked" : ""}"` : ""
        ].join("");
        const text = format(node.text);
        const content = task
          ? `<label><input type="checkbox" class="knowledge-task-box" disabled${task.checked ? " checked" : ""}>${text}</label>`
          : text;
        const children = node.children.map((group) => renderListNodes(group.nodes, group.type)).join("");
        return `<li${attrs}>${content}${children}</li>`;
      }).join("")}</${type}>`;
    }
    function flushList() {
      if (!listEntries.length) return;
      const roots = [];
      const stack = [];
      for (const entry of listEntries) {
        while (stack.length > 1 && entry.indent < stack[stack.length - 1].indent) stack.pop();
        let container = stack[stack.length - 1];
        if (!container || entry.indent > container.indent) {
          const group = { type: entry.type, indent: entry.indent, nodes: [] };
          if (container && container.nodes.length) container.nodes[container.nodes.length - 1].children.push(group);
          else roots.push(group);
          stack.push(group);
          container = group;
        } else if (container.type !== entry.type) {
          stack.pop();
          const parent = stack[stack.length - 1];
          const group = { type: entry.type, indent: entry.indent, nodes: [] };
          if (parent && parent.nodes.length) parent.nodes[parent.nodes.length - 1].children.push(group);
          else roots.push(group);
          stack.push(group);
          container = group;
        }
        container.nodes.push({ text: entry.text, number: entry.number, task: entry.task, children: [] });
      }
      for (const group of roots) blocks.push(renderListNodes(group.nodes, group.type));
      listEntries = [];
    }
    function flushQuote() {
      if (!quoteLines.length) return;
      const chunks = [];
      let current = [];
      for (const line of quoteLines) {
        if (!line.trim()) { if (current.length) { chunks.push(current); current = []; } }
        else current.push(line);
      }
      if (current.length) chunks.push(current);
      const body = chunks.length
        ? chunks.map((chunk) => `<p>${chunk.map(format).join("<br>")}</p>`).join("")
        : "";
      blocks.push(`<blockquote>${body}</blockquote>`);
      quoteLines = [];
    }
    function flush() {
      if (paragraph.length) blocks.push(paragraphMarkup());
      paragraph = [];
      flushList();
      flushQuote();
    }
    function renderCodeBlock(block) {
      const langAttr = block.lang ? ` data-lang="${escape(block.lang)}"` : "";
      return `<pre${langAttr}><code>${escape(block.lines.join("\n"))}</code></pre>`;
    }
    const cells = (line) => line.trim().replace(/^\||\|$/gu, "").split("|").map((cell) => cell.trim());
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const fence = /^\s{0,3}(`{3,}|~{3,})(.*)$/u.exec(line);
      if (code) {
        if (fence && fence[1][0] === code.marker[0] && fence[1].length >= code.marker.length && !fence[2].trim()) {
          blocks.push(renderCodeBlock(code)); code = null;
        } else code.lines.push(line);
        continue;
      }
      if (fence) {
        flush();
        const rawLang = fence[2].trim().split(/\s+/u)[0]?.toLowerCase() || "";
        code = { marker: fence[1], lang: /^[a-z0-9_+-]{1,24}$/u.test(rawLang) ? rawLang : "", lines: [] };
        continue;
      }
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
      const item = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.+)$/u.exec(line);
      if (item) {
        const type = item[2] ? "ul" : "ol";
        if (paragraph.length || quoteLines.length) {
          if (paragraph.length) { blocks.push(paragraphMarkup()); paragraph = []; }
          flushQuote();
        }
        const indent = item[1].replace(/\t/gu, "  ").length;
        const taskMatch = type === "ul" ? /^\[([ xX])\]\s+(.+)$/u.exec(item[4]) : null;
        listEntries.push({
          type,
          indent,
          number: item[3],
          task: taskMatch ? { checked: taskMatch[1].toLowerCase() === "x" } : null,
          text: taskMatch ? taskMatch[2] : item[4]
        });
        continue;
      }
      const quote = /^>\s?(.*)$/u.exec(line);
      if (quote) {
        if (paragraph.length) { blocks.push(paragraphMarkup()); paragraph = []; }
        flushList();
        quoteLines.push(quote[1]);
        continue;
      }
      if (listEntries.length) flushList();
      if (quoteLines.length) flushQuote();
      paragraph.push(line);
    }
    if (code) blocks.push(renderCodeBlock(code));
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
