function createClaraCoreSharedInnerLifeView(context) {
  const {
    dom,
    t,
    getSnapshot,
    escapeHtml,
    formatSharedLineMetaValue,
    renderReadableText,
    itemAgentId,
    filterByAgent,
    renderAgentFilter,
    state,
    renderMemoryResults,
    memoryAgentId
  } = context;
  const {
    memoryAgentFilter, memoryList, sharedLineSummary, sharedLineUpdated, sharedLineList, sharedLineAgentFilter,
    sharedLineLineCount, sharedLineHistoryCount, sharedLineSnapshotCount, sharedLineHandoffCount, sharedLineTitleInput,
    sharedLineInput, sharedLineStatusInput, sharedLineFactsInput, sharedLineDetailStatus, sharedLineMetadataPanel, sharedLineResume,
    sharedLineHistoryList, sharedLineSnapshotList, sharedLineHandoffList, innerLifeAgentFilter, innerLifeSessionList,
    innerLifeDigestList, innerLifeInboxList, innerLifeShareCheckList, innerLifeShareList, innerLifeDaemonStatus,
    innerLifeNextRun, innerLifeLastResult, innerLifeRecovery, innerLifeDoctorStatus, innerLifeDoctorList, innerLifePendingCount,
    innerLifeEventCount, innerLifeThoughtCount
  } = dom;

function renderTraceValue(value) {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return "";
  return items
    .slice()
    .reverse()
    .slice(0, 8)
    .map((item) => {
      if (item && typeof item === "object") {
        const title = item.position || item.tone || item.valence || item.note || JSON.stringify(item);
        const meta = [item.time || item.archived_at || "", item.stability || "", item.needs_review ? "review" : ""]
          .filter(Boolean)
          .join(" · ");
        return `
          <span class="trace-line">
            <i>${item.valence === "negative" ? "!" : item.valence === "mixed" ? "~" : "•"}</i>
            <b>${escapeHtml(title)}</b>
            ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
          </span>
        `;
      }
      return `<span class="trace-line"><i>•</i><span>${renderReadableText(item, "·") || escapeHtml(item)}</span></span>`;
    })
    .join("");
}

function renderSharedLineMetadata(metadata = {}) {
  const groups = [
    {
      title: "sharedLine.group.basic",
      rows: [
        ["sharedLine.meta.agent", metadata.agentId],
        ["sharedLine.meta.visibility", metadata.visibility],
        ["sharedLine.meta.mode", metadata.mode]
      ]
    },
    {
      title: "sharedLine.group.progress",
      rows: [
        ["sharedLine.meta.nextStep", metadata.nextStep],
        ["sharedLine.meta.stateSummary", metadata.stateSummary],
        ["sharedLine.meta.currentInterpretation", metadata.currentInterpretation],
        ["sharedLine.meta.realityLine", metadata.realityLine]
      ]
    },
    {
      title: "sharedLine.group.boundary",
      rows: [
        ["sharedLine.meta.entryPosture", metadata.entryPosture],
        ["sharedLine.meta.confirmedGround", metadata.confirmedGround],
        ["sharedLine.meta.provisionalRead", metadata.provisionalRead],
        ["sharedLine.meta.boundaryNotes", metadata.boundaryNotes],
        ["sharedLine.meta.misreadRisks", metadata.misreadRisks]
      ]
    },
    {
      title: "sharedLine.group.trace",
      rows: [
        ["sharedLine.meta.positionHistory", metadata.positionHistory],
        ["sharedLine.meta.affectiveTrace", metadata.affectiveTrace]
      ]
    }
  ]
    .map((group) => ({
      ...group,
      rows: group.rows.map(([labelKey, value]) => [labelKey, formatSharedLineMetaValue(value)]).filter(([, value]) => value)
    }))
    .filter((group) => group.rows.length);

  if (groups.length === 0) {
    sharedLineMetadataPanel.innerHTML = "";
    return;
  }
  sharedLineMetadataPanel.innerHTML = groups
    .map(
      (group) => `
        <section class="shared-line-detail-group">
          <h3>${escapeHtml(t(group.title))}</h3>
          ${group.rows
            .map(
              ([labelKey, value]) => {
                const rawKey = labelKey.endsWith("positionHistory")
                  ? "positionHistory"
                  : labelKey.endsWith("affectiveTrace")
                    ? "affectiveTrace"
                    : "";
                const htmlValue = rawKey ? renderTraceValue(metadata[rawKey]) || escapeHtml(value) : renderReadableText(value, "·") || escapeHtml(value);
                return `
                <div class="shared-line-detail-row">
                  <span>${escapeHtml(t(labelKey))}</span>
                  <p>${htmlValue}</p>
                </div>
              `;
              }
            )
            .join("")}
        </section>
      `
    )
    .join("");
}

function renderMemoryList() {
  const snapshot = getSnapshot();
  const memories = snapshot?.memories || [];
  state.activeMemoryAgentFilter = renderAgentFilter(memoryAgentFilter, memories.map(memoryAgentId), state.activeMemoryAgentFilter);
  renderMemoryResults(filterByAgent(memories, state.activeMemoryAgentFilter, memoryAgentId));
}

function renderSharedLine() {
  const snapshot = getSnapshot();
  const sharedLine = snapshot?.sharedLine;
  const current = sharedLine?.currentPosition || {};
  const summary = current.summary || "";
  const lines = sharedLine?.lines || [];
  const history = sharedLine?.history || [];
  const snapshots = sharedLine?.snapshots || [];
  const handoffs = sharedLine?.handoffs || [];
  const activeLine = lines.find((line) => line.active) || {};
  state.selectedSharedLineId = sharedLine?.lineId || state.selectedSharedLineId || activeLine.id || "";
  sharedLineDetailStatus.textContent = current.interpretationStatus || activeLine.status || "active";
  sharedLineDetailStatus.className = `badge ${current.interpretationStatus === "confirmed" ? "ok" : "planned"}`;
  sharedLineLineCount.textContent = lines.filter((line) => line.status !== "archived").length;
  sharedLineHistoryCount.textContent = history.length;
  sharedLineSnapshotCount.textContent = snapshots.length;
  sharedLineHandoffCount.textContent = handoffs.length;
  const agentOptions = [...new Set(lines.map((line) => line.metadata?.agentId || "").filter(Boolean))].sort();
  if (state.activeSharedLineAgentFilter && !agentOptions.includes(state.activeSharedLineAgentFilter)) {
    state.activeSharedLineAgentFilter = "";
  }
  sharedLineAgentFilter.innerHTML = [
    `<option value="">${escapeHtml(t("sharedLine.filter.allAgents"))}</option>`,
    ...agentOptions.map((agentId) => `<option value="${escapeHtml(agentId)}">${escapeHtml(agentId)}</option>`)
  ].join("");
  sharedLineAgentFilter.value = state.activeSharedLineAgentFilter;
  const visibleLines = state.activeSharedLineAgentFilter
    ? lines.filter((line) => (line.metadata?.agentId || "") === state.activeSharedLineAgentFilter)
    : lines;
  if (state.renamingSharedLineId && !lines.some((line) => line.id === state.renamingSharedLineId && line.status !== "archived")) {
    state.renamingSharedLineId = null;
    sharedLineTitleInput.value = "";
  }
  dom.createSharedLine.textContent = state.renamingSharedLineId ? t("sharedLine.renameLine") : t("sharedLine.createLine");
  if (visibleLines.length === 0) {
    sharedLineList.innerHTML = `<div class="endpoint-empty">${t("sharedLine.linesEmpty")}</div>`;
  } else {
    sharedLineList.innerHTML = visibleLines
      .map(
        (line) => {
          const isArchived = line.status === "archived";
          const metadata = line.metadata || {};
          const metaChips = [
            metadata.agentId ? [t("sharedLine.meta.agent"), metadata.agentId] : null,
            metadata.mode ? [t("sharedLine.meta.mode"), metadata.mode] : null,
            metadata.visibility ? [t("sharedLine.meta.visibility"), metadata.visibility] : null,
            line.interpretationStatus ? [t("sharedLine.form.status"), line.interpretationStatus] : null,
            metadata.userConfirmed ? ["", t("sharedLine.status.confirmed")] : null
          ].filter(Boolean);
          const selected = line.id === state.selectedSharedLineId;
          const actionButtons = isArchived
            ? `<button class="secondary" data-shared-line-action="restore" data-shared-line-id="${escapeHtml(line.id)}">${escapeHtml(t("actions.restore"))}</button>`
            : [
                selected ? "" : `<button class="secondary" data-shared-line-action="activate" data-shared-line-id="${escapeHtml(line.id)}">${escapeHtml(t("actions.open"))}</button>`,
                `<button class="secondary" data-shared-line-action="rename" data-shared-line-id="${escapeHtml(line.id)}" data-shared-line-title="${escapeHtml(line.title || "")}">${escapeHtml(t("sharedLine.renameLine"))}</button>`,
                line.id === "line_default" ? "" : `<button class="secondary danger-button" data-shared-line-action="archive" data-shared-line-id="${escapeHtml(line.id)}">${escapeHtml(t("actions.archive"))}</button>`
              ].filter(Boolean).join("");
          return `
          <article class="shared-line-card ${selected ? "active-line" : ""}" data-shared-line-action="select" data-shared-line-id="${escapeHtml(line.id)}" tabindex="0" role="button">
            <div class="shared-line-card-head">
              <strong>${escapeHtml(line.title || line.id)}</strong>
              <span class="status-chip ${selected ? "status-active" : ""}">${selected ? "selected" : escapeHtml(line.status || "")}</span>
            </div>
            ${
              metaChips.length
                ? `<div class="shared-line-chip-row">${metaChips
                    .map(([label, value]) => `<span>${escapeHtml(label ? `${label}: ${value}` : value)}</span>`)
                    .join("")}</div>`
                : ""
            }
            <p><b>${escapeHtml(t("sharedLine.current"))}</b>${renderReadableText(line.summary || t("sharedLine.currentEmpty"), "•")}</p>
            ${metadata.nextStep ? `<p><b>${escapeHtml(t("sharedLine.meta.nextStep"))}</b>${renderReadableText(metadata.nextStep, "→")}</p>` : ""}
            <div class="shared-line-card-actions">${actionButtons || `<span>${selected ? escapeHtml(t("common.ready")) : escapeHtml(t("actions.open"))}</span>`}</div>
          </article>
        `;
        }
      )
      .join("");
  }
  sharedLineSummary.innerHTML = renderReadableText(summary || t("sharedLine.currentEmpty"), "•");
  sharedLineUpdated.textContent = current.updatedAt || "";
  sharedLineInput.value = summary;
  sharedLineStatusInput.value = current.interpretationStatus === "confirmed" ? "confirmed" : "draft";
  sharedLineFactsInput.value = Array.isArray(current.factsUsed) ? current.factsUsed.join(", ") : "";
  renderSharedLineMetadata(current.metadata || {});
  sharedLineResume.textContent = sharedLine?.text || "";
  if (history.length === 0) {
    sharedLineHistoryList.innerHTML = `<div class="endpoint-empty">${t("sharedLine.historyEmpty")}</div>`;
  } else {
    sharedLineHistoryList.innerHTML = history
      .map(
        (item) => `
          <article class="shared-line-history-item">
            <div>
              <strong>${escapeHtml(item.interpretationStatus || "draft")}</strong>
              <span>${escapeHtml(item.createdAt || "")}</span>
            </div>
            <p>${renderReadableText(item.summary || "", "•") || escapeHtml(item.summary || "")}</p>
            ${
              Array.isArray(item.factsUsed) && item.factsUsed.length
                ? `<small>${escapeHtml(item.factsUsed.join(", "))}</small>`
                : ""
            }
          </article>
        `
      )
      .join("");
  }
  if (snapshots.length === 0) {
    sharedLineSnapshotList.innerHTML = `<div class="endpoint-empty">${t("sharedLine.snapshotsEmpty")}</div>`;
  } else {
    sharedLineSnapshotList.innerHTML = snapshots
      .map(
        (item) => `
          <article class="shared-line-history-item">
            <div>
              <strong>${escapeHtml(item.reason || "save")}</strong>
              <span>${escapeHtml(item.createdAt || "")}</span>
            </div>
            <p>${renderReadableText(item.summary || "", "•") || escapeHtml(item.summary || "")}</p>
            <small>${escapeHtml(item.interpretationStatus || "draft")}</small>
          </article>
        `
      )
      .join("");
  }
  if (handoffs.length === 0) {
    sharedLineHandoffList.innerHTML = `<div class="endpoint-empty">${t("sharedLine.handoffsEmpty")}</div>`;
  } else {
    sharedLineHandoffList.innerHTML = handoffs
      .map(
        (item) => `
          <article class="shared-line-history-item">
            <div>
              <strong>${escapeHtml(item.objective || "")}</strong>
              <span>${escapeHtml(item.createdAt || "")}</span>
            </div>
            ${item.nextStep ? `<p>${renderReadableText(item.nextStep, "→") || escapeHtml(item.nextStep)}</p>` : ""}
            ${Array.isArray(item.openItems) && item.openItems.length ? `<small>${escapeHtml(item.openItems.join(", "))}</small>` : ""}
          </article>
        `
      )
      .join("");
  }
}

function renderInnerLife() {
  const snapshot = getSnapshot();
  const innerLife = snapshot?.innerLife || {};
  const counts = innerLife.counts || {};
  const daemon = innerLife.daemon || {};
  const innerLifeAgentIds = [
    ...(innerLife.sessions || []).map(itemAgentId),
    ...(innerLife.digestRuns || []).map(itemAgentId),
    ...(innerLife.inbox || []).map(itemAgentId),
    ...(innerLife.pendingShares || []).map(itemAgentId),
    ...(innerLife.recentShares || []).map(itemAgentId)
  ];
  state.activeInnerLifeAgentFilter = renderAgentFilter(innerLifeAgentFilter, innerLifeAgentIds, state.activeInnerLifeAgentFilter);
  innerLifeDaemonStatus.textContent = daemon.status || "paused";
  innerLifeNextRun.textContent = daemon.nextRunAt || "-";
  innerLifeLastResult.textContent = daemon.lastResult || daemon.lastError || "-";
  const retrySeconds = Number.parseInt(String(daemon.metadata?.retrySeconds || 0), 10) || 0;
  const failureCount = Number.parseInt(String(daemon.metadata?.failureCount || 0), 10) || 0;
  innerLifeRecovery.textContent =
    failureCount > 0 ? `${failureCount} ${t("innerLife.recoveryRetry")} ${retrySeconds}s` : daemon.lastError || "-";
  const doctor = innerLife.doctor || {};
  innerLifeDoctorStatus.textContent = doctor.status || "-";
  const doctorItems = Array.isArray(doctor.issues) && doctor.issues.length
    ? doctor.issues
    : [{ level: "ok", code: "healthy", message: doctor.summary || t("innerLife.doctorEmpty"), action: (doctor.nextActions || [t("innerLife.doctorEmpty")])[0] }];
  innerLifeDoctorList.innerHTML = doctorItems
    .slice(0, 5)
    .map(
      (issue) => `
        <article class="shared-line-history-item">
          <div>
            <strong>${escapeHtml(issue.level || "ok")}</strong>
            <span>${escapeHtml(issue.code || "")}</span>
          </div>
          <p>${escapeHtml(issue.message || "")}</p>
          ${issue.action ? `<small>${escapeHtml(issue.action)}</small>` : ""}
        </article>
      `
    )
    .join("");
  if (enableInnerLifeDaemon && pauseInnerLifeDaemon) {
    enableInnerLifeDaemon.disabled = Boolean(daemon.enabled) && daemon.status !== "paused";
    pauseInnerLifeDaemon.disabled = !daemon.enabled || daemon.status === "paused";
  }
  innerLifePendingCount.textContent = counts.pending_shares_count ?? 0;
  innerLifeEventCount.textContent = counts.events_count ?? 0;
  innerLifeThoughtCount.textContent = counts.thoughts_count ?? 0;
  const sessions = filterByAgent(innerLife.sessions || [], state.activeInnerLifeAgentFilter);
  const activeSession = sessions.find((session) => session.status === "active");
  endInnerLifeSession.disabled = !activeSession;
  if (sessions.length === 0) {
    innerLifeSessionList.innerHTML = `<div class="endpoint-empty">${t("innerLife.sessionsEmpty")}</div>`;
  } else {
    innerLifeSessionList.innerHTML = sessions
      .slice(0, 5)
      .map(
        (session) => `
          <article class="shared-line-history-item" data-innerlife-session-id="${escapeHtml(session.id)}">
            <div>
              <strong>${escapeHtml(session.status || "")}</strong>
              <span>${escapeHtml(session.startedAt || "")}</span>
            </div>
            <p>${escapeHtml(session.summary && session.summary !== "{}" ? session.summary : session.externalSessionId || session.id || "")}</p>
            ${session.endedAt ? `<small>${escapeHtml(session.endedAt)}</small>` : ""}
          </article>
        `
      )
      .join("");
  }
  const inboxItems = filterByAgent(innerLife.inbox || [], state.activeInnerLifeAgentFilter);
  if (innerLifeInboxList) {
    if (inboxItems.length === 0) {
      innerLifeInboxList.innerHTML = `<div class="endpoint-empty">${t("innerLife.inboxEmpty")}</div>`;
    } else {
      innerLifeInboxList.innerHTML = inboxItems
        .slice(0, 6)
        .map(
          (item) => `
            <article class="shared-line-history-item">
              <div>
                <strong>${escapeHtml(item.source || "desktop")}</strong>
                <span>${escapeHtml(item.createdAt || "")}</span>
              </div>
              <p>${escapeHtml(item.body || "")}</p>
              <small>${escapeHtml(item.status || "")}${item.processedAt ? ` · ${escapeHtml(item.processedAt)}` : ""}</small>
            </article>
          `
        )
        .join("");
    }
  }
  const digestRuns = filterByAgent(innerLife.digestRuns || [], state.activeInnerLifeAgentFilter);
  if (digestRuns.length === 0) {
    innerLifeDigestList.innerHTML = `<div class="endpoint-empty">${t("innerLife.digestEmpty")}</div>`;
  } else {
    innerLifeDigestList.innerHTML = digestRuns
      .slice(0, 5)
      .map(
        (run) => `
          <article class="shared-line-history-item">
            <div>
              <strong>${escapeHtml(run.mode || "manual")}</strong>
              <span>${escapeHtml(run.completedAt || run.createdAt || "")}</span>
            </div>
            <p>${escapeHtml((run.summary || "").split("\n").filter((line) => line.trim()).slice(0, 4).join("\n") || run.status || "")}</p>
            <small>${escapeHtml(run.status || "")}</small>
          </article>
        `
      )
      .join("");
  }
  const shareChecks = filterByAgent(innerLife.shareChecks || [], state.activeInnerLifeAgentFilter);
  if (shareChecks.length === 0) {
    innerLifeShareCheckList.innerHTML = `<div class="endpoint-empty">${t("innerLife.timingEmpty")}</div>`;
  } else {
    innerLifeShareCheckList.innerHTML = shareChecks
      .slice(0, 5)
      .map(
        (check) => `
          <article class="shared-line-history-item">
            <div>
              <strong>${escapeHtml(check.decision || "")}</strong>
              <span>${escapeHtml(check.createdAt || "")}</span>
            </div>
            <p>${escapeHtml(check.reason || "")}</p>
            ${check.context ? `<small>${escapeHtml(check.context)}</small>` : ""}
          </article>
        `
      )
      .join("");
  }
  const pendingShares = filterByAgent(innerLife.pendingShares || [], state.activeInnerLifeAgentFilter);
  const approvedShares = filterByAgent(innerLife.recentShares || [], state.activeInnerLifeAgentFilter).filter((share) => share.status === "approved").slice(0, 5);
  innerLifePendingCount.textContent = pendingShares.length;
  if (pendingShares.length === 0 && approvedShares.length === 0) {
    innerLifeShareList.innerHTML = `<div class="endpoint-empty">${t("innerLife.empty")}</div>`;
    return;
  }
  const pendingHtml = pendingShares
    .map(
      (share) => `
        <article class="innerlife-share" data-innerlife-share-id="${escapeHtml(share.id)}">
          <div>
            <strong>${escapeHtml(share.created_at || "")}</strong>
            <span>${escapeHtml(itemAgentId(share) || "")} · ${escapeHtml(share.status || "")}</span>
          </div>
          <pre>${escapeHtml(share.body || "")}</pre>
          <div class="innerlife-share-actions">
            <button class="secondary" data-innerlife-action="approve" data-innerlife-share-id="${escapeHtml(share.id)}">${escapeHtml(t("actions.approve") || "Approve")}</button>
            <button class="secondary danger-button" data-innerlife-action="reject" data-innerlife-share-id="${escapeHtml(share.id)}">${escapeHtml(t("actions.reject") || "Reject")}</button>
          </div>
        </article>
      `
    )
    .join("");
  const approvedHtml = approvedShares
    .map(
      (share) => `
        <article class="innerlife-share approved" data-innerlife-share-id="${escapeHtml(share.id)}">
          <div>
            <strong>${t("innerLife.approvedOutput")}</strong>
            <span>${escapeHtml(itemAgentId(share) || "")} · ${escapeHtml(share.updated_at || share.created_at || "")}</span>
          </div>
          <pre>${escapeHtml(share.body || "")}</pre>
          <div class="innerlife-share-actions">
            <button class="secondary" data-innerlife-action="used" data-innerlife-share-id="${escapeHtml(share.id)}">${escapeHtml(t("innerLife.markUsed") || "Used")}</button>
            <button class="secondary" data-innerlife-action="deferred" data-innerlife-share-id="${escapeHtml(share.id)}">${escapeHtml(t("innerLife.markDeferred") || "Deferred")}</button>
            <button class="secondary" data-innerlife-action="apply-memory" data-innerlife-share-id="${escapeHtml(share.id)}">${escapeHtml(t("innerLife.applyMemory") || "Apply to Memory")}</button>
            <button class="secondary" data-innerlife-action="apply-shared-line" data-innerlife-share-id="${escapeHtml(share.id)}">${escapeHtml(t("innerLife.applySharedLine") || "Apply to Shared Line")}</button>
            <button class="secondary danger-button" data-innerlife-action="discarded" data-innerlife-share-id="${escapeHtml(share.id)}">${escapeHtml(t("innerLife.markDiscarded") || "Discard")}</button>
          </div>
        </article>
      `
    )
    .join("");
  innerLifeShareList.innerHTML = `${pendingHtml}${approvedHtml}`;
}

  return {
    renderMemoryList,
    renderSharedLine,
    renderInnerLife
  };
}

window.createClaraCoreSharedInnerLifeView = createClaraCoreSharedInnerLifeView;
