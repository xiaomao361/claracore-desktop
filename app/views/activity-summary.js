function createClaraCoreActivitySummary({ dom, t, getSnapshot, escapeHtml, formatLocalDateTime }) {
  const {
    homeMilestones, homeMilestoneList, homeMilestoneNotice,
    traceMemoryMetrics,
    traceSharedLineMetrics,
    traceInnerLifeMetrics,
    traceAdvancedMetrics,
    traceOpenDetail,
    traceDetailDialog,
    traceDetailClose
  } = dom;

  function metricRows(target, rows) {
    if (!target) return;
    target.innerHTML = rows
      .map(([labelKey, value]) => `
        <div class="trace-metric-row">
          <span>${escapeHtml(t(labelKey))}</span>
          <strong>${escapeHtml(String(value ?? 0))}</strong>
        </div>
      `)
      .join("");
  }

  function renderMilestones(snapshot) {
    const items = snapshot.homeMilestones;
    const loading = !Array.isArray(items);
    homeMilestones.hidden = !snapshot.homeMilestonesError && !loading && items.length === 0;
    homeMilestoneNotice.textContent = snapshot.homeMilestonesError ? t("home.milestones.failed") : loading ? t("home.milestones.loading") : "";
    homeMilestoneList.innerHTML = (items || []).slice(0, 5).map(item => `
      <article class="home-milestone"><strong>${escapeHtml(item.title || item.id)}</strong><time>${escapeHtml(formatLocalDateTime(item.updatedAt || item.createdAt))}</time></article>
    `).join("");
  }

  function renderDetails(trace) {
    const memory = trace.memory || {};
    const sharedLine = trace.sharedLine || {};
    const innerLife = trace.innerLife || {};
    metricRows(traceMemoryMetrics, [
      ["trace.memory.kept", memory.activeCount],
      ["trace.memory.archived", memory.archivedCount],
      ["trace.memory.restricted", memory.restrictedCount],
      ["trace.memory.deleted", memory.deletedCount]
    ]);
    metricRows(traceSharedLineMetrics, [
      ["trace.sharedLine.active", sharedLine.activeCount],
      ["trace.sharedLine.archived", sharedLine.archivedCount],
      ["trace.sharedLine.updates", sharedLine.historyCount],
      ["trace.sharedLine.snapshots", sharedLine.snapshotCount]
    ]);
    metricRows(traceInnerLifeMetrics, [
      ["trace.innerLife.thoughts", innerLife.thoughtsCount],
      ["trace.innerLife.unshared", innerLife.pendingSharesCount],
      ["trace.innerLife.shared", innerLife.verifiedSharesCount],
      ["trace.innerLife.discarded", innerLife.discardedSharesCount]
    ]);
    metricRows(traceAdvancedMetrics, [
      ["trace.advanced.embedded", memory.embeddedCount],
      ["trace.advanced.pendingEmbedding", memory.pendingEmbeddingCount],
      ["trace.advanced.failedEmbedding", memory.failedEmbeddingCount],
      ["trace.advanced.superseded", memory.supersededCount],
      ["trace.advanced.structured", memory.structuredRecordCount],
      ["trace.advanced.handoffs", sharedLine.handoffCount],
      ["trace.advanced.profiles", innerLife.profilesCount],
      ["trace.advanced.sessions", innerLife.sessionsCount],
      ["trace.advanced.digests", innerLife.digestRunsCount],
      ["trace.advanced.inbox", innerLife.inboxCount],
      ["trace.advanced.deferred", innerLife.deferredSharesCount],
      ["trace.advanced.usedAll", innerLife.usedSharesCount]
    ]);
  }

  function openDetail() {
    if (!traceDetailDialog?.open) traceDetailDialog?.showModal();
  }

  function closeDetail() {
    if (traceDetailDialog?.open) traceDetailDialog.close();
  }

  function render() {
    const snapshot = getSnapshot() || {};
    renderMilestones(snapshot);
    traceOpenDetail.disabled = !snapshot.trace?.memory;
    renderDetails(snapshot.trace || {});
  }

  traceOpenDetail?.addEventListener("click", openDetail);
  traceDetailClose?.addEventListener("click", closeDetail);
  traceDetailDialog?.addEventListener("click", (event) => {
    if (event.target === traceDetailDialog) closeDetail();
  });

  return { render };
}

window.createClaraCoreActivitySummary = createClaraCoreActivitySummary;
