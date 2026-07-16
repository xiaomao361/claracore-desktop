function createClaraCoreMemoriaList(context) {
  const {
    t,
    escapeHtml,
    renderMarkdownPreview,
    formatLocalDateTime
  } = context;

  function memoryAgentId(memory) {
    const labels = Array.isArray(memory?.labels) ? memory.labels : [];
    const agentIdLabel = labels.find((label) => String(label || "").startsWith("agent-id:"));
    if (agentIdLabel) return String(agentIdLabel).slice("agent-id:".length);
    const agentLabel = labels.find((label) => String(label || "").startsWith("agent:"));
    return agentLabel ? String(agentLabel).slice("agent:".length) : "";
  }

  function itemAgentId(item) {
    return item?.agentId || item?.agent_id || item?.metadata?.agentId || "";
  }

  function filterByAgent(items, agentId, getter = itemAgentId) {
    if (!agentId) return items || [];
    return (items || []).filter((item) => getter(item) === agentId);
  }

  function renderAgentFilter(select, agentIds, activeValue) {
    if (!select) return "";
    const options = [...new Set((agentIds || []).filter(Boolean))].sort();
    const nextValue = activeValue && options.includes(activeValue) ? activeValue : "";
    select.innerHTML = [
      `<option value="">${escapeHtml(t("sharedLine.filter.allAgents"))}</option>`,
      ...options.map((agentId) => `<option value="${escapeHtml(agentId)}">${escapeHtml(agentId)}</option>`)
    ].join("");
    select.value = nextValue;
    return nextValue;
  }

  function renderMemoryBody(body) {
    return renderMarkdownPreview ? renderMarkdownPreview(body) : `<p>${escapeHtml(body)}</p>`;
  }

  function memoryBodySummary(body, maxLength = 220) {
    const text = String(body || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");
    if (!text) return "";
    return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
  }

  function renderMemoryLabelsInline(labels) {
    return (labels || [])
      .slice(0, 8)
      .map((label) => `<span>${escapeHtml(label)}</span>`)
      .join("");
  }

  function vectorMaintenanceCount(input = {}) {
    const stats = input.stats || {};
    const maintenance = input.maintenance || {};
    const counts = maintenance.counts || {};
    return (
      Number(stats.pendingEmbeddingCount || 0) +
      Number(stats.failedEmbeddingCount || 0) +
      Number(counts.missingEmbeddings || 0) +
      Number(counts.failedEmbeddings || 0) +
      Number(counts.staleEmbeddings || 0)
    );
  }

  function visibleMemoryLabels(labels) {
    return (labels || []).filter((label) => {
      const value = String(label || "");
      return !value.startsWith("agent-id:") && !value.startsWith("agent:") && !value.startsWith("tool:");
    });
  }

  function memoryItemsHtml(memories, options = {}) {
    return memories
      .map((memory) => {
        const agentId = memoryAgentId(memory);
        const labels = renderMemoryLabelsInline(visibleMemoryLabels(memory.labels).slice(0, 2));
        const summary = memoryBodySummary(memory.body);
        const isSelected = memory.id === options.selectedId;
        return `
          <article class="memory-item ${isSelected ? "selected" : ""}" data-memory-id="${escapeHtml(memory.id)}" role="option" aria-selected="${isSelected ? "true" : "false"}" tabindex="${isSelected ? "0" : "-1"}">
            <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
            <p class="memory-summary">${escapeHtml(summary || t("memory.empty"))}</p>
            <div class="memory-meta">
              <span>${escapeHtml(agentId || t("memory.detail.unknownAgent"))} · ${escapeHtml(formatLocalDateTime(memory.created_at || memory.updated_at))}</span>
              <div>${labels}</div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderMemoryResults(memories, target, options = {}) {
    if (memories.length === 0) {
      target.innerHTML = `<div class="endpoint-empty">${t("memory.empty")}</div>`;
      return;
    }
    const html = memoryItemsHtml(memories, options);
    if (options.append) {
      target.insertAdjacentHTML("beforeend", html);
    } else {
      target.innerHTML = html;
    }
  }

  return {
    filterByAgent,
    memoryAgentId,
    renderAgentFilter,
    renderMemoryBody,
    renderMemoryLabelsInline,
    renderMemoryResults,
    vectorMaintenanceCount
  };
}

window.createClaraCoreMemoriaList = createClaraCoreMemoriaList;
