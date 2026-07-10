function createClaraCoreMemoriaList(context) {
  const {
    t,
    escapeHtml,
    renderMarkdownPreview,
    formatLocalDateTime,
    memoryLabelList
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

  function renderLabelOverview(labels) {
    const visibleLabels = (labels || []).slice(0, 10);
    if (visibleLabels.length === 0) {
      memoryLabelList.innerHTML = `<span class="quiet">${t("memory.labels.empty")}</span>`;
      return;
    }
    const maxCount = Math.max(...visibleLabels.map((item) => Number(item.count || 0)), 1);
    memoryLabelList.innerHTML = `
      <div class="label-overview-list">
        ${visibleLabels
          .map((item) => {
            const count = Number(item.count || 0);
            const strength = Math.max(12, Math.round((count / maxCount) * 100));
            return `
              <button class="label-overview-row" data-memory-label="${escapeHtml(item.label)}" style="--label-strength: ${strength}%">
                <span class="label-overview-name">${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(count)}</strong>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
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

  function memoryItemsHtml(memories, action = "delete", itemClass = "") {
    return memories
      .map((memory) => {
        const labels = renderMemoryLabelsInline(memory.labels || []);
        const embeddingStatus = memory.embedding_status || "pending";
        const embeddingLabel = t(`memory.embedding.${embeddingStatus}`) || embeddingStatus;
        const embeddingDetail = memory.embedding_error
          ? `<span title="${escapeHtml(memory.embedding_error)}">${escapeHtml(memory.embedding_error)}</span>`
          : `<span>${escapeHtml(memory.embedding_model || "")}</span>`;
        const sourceLabel = memory.search_source ? t(`memory.search.source.${memory.search_source}`) || memory.search_source : "";
        const scoreLabel =
          memory.search_source && Number(memory.search_score) > 0
            ? `${t("memory.search.score")} ${Math.round(Number(memory.search_score) * 100)}%`
            : "";
        const searchMeta =
          sourceLabel || scoreLabel
            ? `<div class="memory-search-rank"><span>${escapeHtml(sourceLabel)}</span><span>${escapeHtml(scoreLabel)}</span></div>`
            : "";
        const summary = memoryBodySummary(memory.body);
        const hasFullText = String(memory.body || "").trim().length > summary.length;
        return `
          <article class="memory-item ${itemClass}" data-memory-id="${escapeHtml(memory.id)}">
            <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
            <p class="memory-summary">${escapeHtml(summary || t("memory.empty"))}</p>
            ${
              hasFullText
                ? `<details class="memory-raw-details">
                    <summary>${escapeHtml(t("memory.showFullText"))}</summary>
                    <div class="memory-raw-body">${renderMemoryBody(memory.body)}</div>
                  </details>`
                : ""
            }
            ${searchMeta}
            <div class="memory-meta">
              <span>${escapeHtml(formatLocalDateTime(memory.created_at || memory.updated_at))}</span>
              <div>${labels}</div>
            </div>
            <div class="memory-embedding ${escapeHtml(embeddingStatus)}">
              <b>${escapeHtml(embeddingLabel)}</b>
              ${embeddingDetail}
            </div>
            <div class="memory-actions">
              ${action === "restore" ? `<button class="secondary" data-memory-action="restore" data-memory-id="${escapeHtml(memory.id)}">${t("actions.restore")}</button>` : ""}
              ${action === "restore-archived" ? `<button class="secondary" data-memory-action="restore-archived" data-memory-id="${escapeHtml(memory.id)}">${t("actions.restore")}</button>` : ""}
              ${action === "delete" ? `<button class="secondary danger-button" data-memory-action="delete" data-memory-id="${escapeHtml(memory.id)}">${t("actions.delete")}</button>` : ""}
              ${action === "delete-restricted" ? `<button class="secondary danger-button" data-memory-action="delete-restricted" data-memory-id="${escapeHtml(memory.id)}">${t("actions.delete")}</button>` : ""}
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
    const html = memoryItemsHtml(memories, options.action || "delete", options.itemClass || "");
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
    renderLabelOverview,
    renderMemoryBody,
    renderMemoryLabelsInline,
    renderMemoryResults,
    vectorMaintenanceCount
  };
}

window.createClaraCoreMemoriaList = createClaraCoreMemoriaList;
