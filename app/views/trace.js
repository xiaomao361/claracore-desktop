function createClaraCoreTraceView({ dom, t, getSnapshot, escapeHtml, formatLocalDateTime }) {
  const {
    traceSpanTitle,
    traceSpanDetail,
    traceStatements,
    traceMilestoneList,
    traceParticipantList,
    traceMemoryMetrics,
    traceSharedLineMetrics,
    traceInnerLifeMetrics,
    traceAdvancedMetrics,
    traceMemoryControllerStatus,
    traceMemoryControllerMetrics,
    traceMemoryControllerList
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

  function renderStatements(trace) {
    const values = [
      [trace.semantic?.decisions, "trace.statement.decisions"],
      [trace.semantic?.activeLines, "trace.statement.lines"],
      [trace.semantic?.reusedMemories, "trace.statement.reused"],
      [trace.semantic?.verifiedShares, "trace.statement.shared"]
    ];
    traceStatements.innerHTML = values
      .map(([value, labelKey]) => `
        <article class="trace-statement">
          <strong>${escapeHtml(String(value || 0))}</strong>
          <span>${escapeHtml(t(labelKey))}</span>
        </article>
      `)
      .join("");
  }

  function renderMilestones(trace) {
    const milestones = trace.milestones || [];
    if (!milestones.length) {
      traceMilestoneList.innerHTML = `<p class="trace-empty">${escapeHtml(t("trace.milestones.empty"))}</p>`;
      return;
    }
    traceMilestoneList.innerHTML = milestones
      .map((item) => `
        <article class="trace-milestone">
          <span class="trace-milestone-node" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(item.title || item.id)}</strong>
            <time>${escapeHtml(formatLocalDateTime(item.updatedAt || item.createdAt))}</time>
          </div>
        </article>
      `)
      .join("");
  }

  function participantKinds(participant) {
    const kinds = [];
    if (participant.memoryCount) kinds.push(t("trace.participants.memory", { count: String(participant.memoryCount) }));
    if (participant.sharedLineCount) kinds.push(t("trace.participants.lines", { count: String(participant.sharedLineCount) }));
    if (participant.innerLifeCount) kinds.push(t("trace.participants.innerLife", { count: String(participant.innerLifeCount) }));
    return kinds;
  }

  function renderParticipants(trace) {
    const participants = trace.participants || [];
    if (!participants.length) {
      traceParticipantList.innerHTML = `<p class="trace-empty">${escapeHtml(t("trace.participants.empty"))}</p>`;
      return;
    }
    traceParticipantList.innerHTML = participants
      .map((participant) => `
        <article class="trace-participant">
          <span class="trace-participant-mark" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(participant.displayName || participant.agentId)}</strong>
            <p>${escapeHtml(participantKinds(participant).join(" · "))}</p>
          </div>
        </article>
      `)
      .join("");
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

  function renderMemoryController() {
    const controller = getSnapshot()?.memoryController || {};
    const observe = controller.mode === "observe";
    if (traceMemoryControllerStatus) {
      traceMemoryControllerStatus.textContent = observe ? t("settings.memoryControllerObserve") : t("settings.memoryControllerOff");
      traceMemoryControllerStatus.className = observe ? "badge ok" : "badge warn";
    }
    metricRows(traceMemoryControllerMetrics, [
      ["trace.controller.events", controller.eventCount],
      ["trace.controller.retrievals", controller.stageA?.RETRIEVE],
      ["trace.controller.noops", controller.stageA?.NOOP],
      ["trace.controller.errors", Number(controller.results?.error || 0) + Number(controller.results?.timeout || 0)]
    ]);
    const recent = Array.isArray(controller.recent) ? controller.recent : [];
    if (!traceMemoryControllerList) return;
    if (!recent.length) {
      traceMemoryControllerList.innerHTML = `<p class="trace-empty">${escapeHtml(t("trace.controller.empty"))}</p>`;
      return;
    }
    traceMemoryControllerList.innerHTML = recent.map((event) => {
      const action = event.stageA?.action === "RETRIEVE"
        ? event.stageB?.action || event.stageA.action
        : event.stageA?.action || event.resultStatus || "-";
      return `
        <article class="trace-controller-event">
          <div>
            <strong>${escapeHtml(t("trace.controller.decision", {
              agent: event.agentId || "-",
              action,
              latency: String(event.totalLatencyMs || 0)
            }))}</strong>
            <p>${escapeHtml(event.queryPreview || event.stageA?.reason || "-")}</p>
          </div>
          <time>${escapeHtml(formatLocalDateTime(event.createdAt))}</time>
        </article>
      `;
    }).join("");
  }

  function render() {
    const trace = getSnapshot()?.trace || {};
    const spanDays = Number(trace.spanDays || 0);
    traceSpanTitle.textContent = spanDays
      ? t("trace.spanDays", { count: String(spanDays) })
      : t("trace.emptySpan");
    traceSpanDetail.textContent = trace.firstAt
      ? t("trace.firstAt", { date: formatLocalDateTime(trace.firstAt) })
      : t("trace.firstAtEmpty");
    renderStatements(trace);
    renderMilestones(trace);
    renderParticipants(trace);
    renderDetails(trace);
    renderMemoryController();
  }

  return { render };
}

window.createClaraCoreTraceView = createClaraCoreTraceView;
