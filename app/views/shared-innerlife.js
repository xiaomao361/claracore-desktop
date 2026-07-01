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
    sharedLineLineCount, sharedLineHistoryCount, sharedLineSnapshotCount, sharedLineArchivedCount,
    sharedLineDetailStatus, sharedLineAgentStatePanel, sharedLineMetadataPanel, sharedLineResume,
    sharedLineHistoryList, sharedLineSnapshotList, sharedLineArchiveList, innerLifeAgentFilter, innerLifeSessionList,
    loadMoreInnerLifeSessions, innerLifeDigestList, loadMoreInnerLifeDigestRuns, innerLifeInboxList, loadMoreInnerLifeInbox,
    innerLifeShareCheckList, innerLifeShareList, innerLifeDaemonStatus,
    innerLifeHistoryList, innerLifeExperienceList, innerLifeSummaryList,
    innerLifeDaemonToggle, innerLifeDaemonToggleLabel, innerLifeNextRun, innerLifeLastResult, innerLifeRecovery,
    innerLifeDoctorStatus, innerLifeDoctorList, innerLifePendingCount, innerLifeEventCount, innerLifeThoughtCount,
    innerLifeProfileDisplayName, innerLifeProfileRecentFocus, innerLifeProfileInterests,
    innerLifeProfileShareAfterHours, innerLifeProfileShareCooldownHours, innerLifeProfileShareMaxDaily,
    innerLifeProfileJson, innerLifeStateJson, saveInnerLifeProfile, innerLifeProfileNotice
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

function previewInnerLifeText(value, maxLength = 180) {
  const text = String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  return text.length > maxLength ? `${text.slice(0, maxLength).trim()}...` : text;
}

function previewInnerLifeDigest(value) {
  const lines = String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^Agent profile:/i.test(line))
    .filter((line) => !/^Profile JSON:/i.test(line))
    .filter((line) => !/^Current inner state:/i.test(line));
  return previewInnerLifeText(lines.slice(0, 8).join("\n"), 360);
}

function innerLifeKindLabel(kind) {
  const normalized = String(kind || "").toLowerCase();
  if (normalized.includes("autonomous_experience")) return t("innerLife.kind.experience");
  if (normalized.includes("explore")) return t("innerLife.kind.explore");
  if (normalized.includes("converge") || normalized.includes("convergence")) return t("innerLife.kind.converge");
  if (normalized.includes("summary")) return t("innerLife.kind.summary");
  if (normalized.includes("digest") || normalized === "light" || normalized === "deep") return t("innerLife.kind.digest");
  if (normalized.includes("session")) return t("innerLife.kind.session");
  if (normalized.includes("share")) return t("innerLife.kind.share");
  if (normalized.includes("source")) return t("innerLife.kind.source");
  if (normalized.includes("question")) return t("innerLife.kind.question");
  if (normalized.includes("insight")) return t("innerLife.kind.insight");
  return kind || t("innerLife.kind.change");
}

function innerLifeStateLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pending") return t("innerLife.state.pending");
  if (normalized === "processed") return t("innerLife.state.processed");
  if (normalized === "used") return t("innerLife.state.used");
  if (normalized === "unreviewed") return t("innerLife.state.unreviewed");
  if (normalized === "completed") return t("innerLife.state.completed");
  if (normalized === "active") return t("innerLife.state.active");
  if (normalized === "ok") return t("innerLife.state.ok");
  if (normalized === "healthy") return t("innerLife.state.healthy");
  if (normalized === "warn") return t("innerLife.state.warn");
  if (normalized === "error") return t("innerLife.state.error");
  if (normalized === "info") return t("innerLife.state.info");
  return status || "";
}

function innerLifeDoctorMessage(issue, doctor) {
  const code = String(issue?.code || "").toLowerCase();
  if (code === "healthy") return t("innerLife.doctor.healthyMessage");
  if (code === "model_disabled") return t("innerLife.doctor.modelDisabledMessage");
  if (code === "pending_inbox_paused") {
    return t("innerLife.doctor.pendingInboxPausedMessage", { count: String(doctor?.counts?.pendingInbox || 0) });
  }
  return issue?.message || doctor?.summary || "";
}

function innerLifeDoctorAction(issue) {
  const code = String(issue?.code || "").toLowerCase();
  if (code === "healthy") return t("innerLife.doctor.healthyAction");
  if (code === "model_disabled") return t("innerLife.doctor.modelDisabledAction");
  if (code === "pending_inbox_paused") return t("innerLife.doctor.pendingInboxPausedAction");
  if (code === "daemon_retrying") return t("innerLife.doctor.daemonRetryingAction");
  return issue?.action || "";
}

function selectedInnerLifeProfile(innerLife) {
  const profiles = Array.isArray(innerLife.profiles) ? innerLife.profiles : [];
  const selectedAgentId = String(state.activeInnerLifeAgentFilter || "").trim();
  if (!selectedAgentId || selectedAgentId === "all") return null;
  return profiles.find((profile) => profile.agentId === selectedAgentId)
    || {
      agentId: selectedAgentId,
      displayName: selectedAgentId,
      profile: innerLife.profile?.profile || {},
      state: innerLife.profile?.state || {}
    };
}

function prettyJson(value) {
  return JSON.stringify(value || {}, null, 2);
}

function renderInnerLifeProfile(innerLife) {
  if (!innerLifeProfileJson || !innerLifeStateJson) return;
  const selectedProfile = selectedInnerLifeProfile(innerLife);
  const fields = [
    innerLifeProfileDisplayName,
    innerLifeProfileRecentFocus,
    innerLifeProfileInterests,
    innerLifeProfileShareAfterHours,
    innerLifeProfileShareCooldownHours,
    innerLifeProfileShareMaxDaily,
    innerLifeProfileJson,
    innerLifeStateJson
  ].filter(Boolean);
  const hasSelectedAgent = Boolean(selectedProfile);
  for (const field of fields) {
    field.disabled = !hasSelectedAgent;
  }
  if (!selectedProfile) {
    innerLifeProfileDisplayName.value = "";
    innerLifeProfileRecentFocus.value = "";
    innerLifeProfileInterests.value = "";
    innerLifeProfileShareAfterHours.value = "";
    innerLifeProfileShareCooldownHours.value = "";
    innerLifeProfileShareMaxDaily.value = "";
    innerLifeProfileJson.value = "";
    innerLifeStateJson.value = "";
    if (saveInnerLifeProfile) {
      saveInnerLifeProfile.disabled = true;
      saveInnerLifeProfile.title = t("innerLife.profileSelectAgent");
    }
    if (innerLifeProfileNotice && !innerLifeProfileNotice.dataset.locked) {
      innerLifeProfileNotice.textContent = t("innerLife.profileSelectAgent");
    }
    return;
  }
  const profileJson = selectedProfile.profile || {};
  const stateJson = selectedProfile.state || {};
  const policy = profileJson.share_policy || profileJson.sharePolicy || {};
  innerLifeProfileDisplayName.value = selectedProfile.displayName || selectedProfile.agentId || "";
  innerLifeProfileRecentFocus.value = stateJson.recent_focus || "";
  innerLifeProfileInterests.value = Array.isArray(stateJson.current_interests) ? stateJson.current_interests.join(", ") : "";
  innerLifeProfileShareAfterHours.value = policy.proactive_after_hours ?? 2;
  innerLifeProfileShareCooldownHours.value = policy.repeat_cooldown_hours ?? 4;
  innerLifeProfileShareMaxDaily.value = policy.max_proactive_per_day ?? 3;
  innerLifeProfileJson.value = prettyJson({
    ...profileJson,
    share_policy: {
      default_mode: "when_relevant",
      max_proactive_per_day: 3,
      proactive_after_hours: 2,
      repeat_cooldown_hours: 4,
      max_defer_count: 3,
      stale_after_days: 7,
      ...policy
    }
  });
  innerLifeStateJson.value = prettyJson({
    current_interests: [],
    open_loops: [],
    recent_mood: null,
    recent_focus: null,
    ...stateJson
  });
  if (saveInnerLifeProfile) {
    saveInnerLifeProfile.disabled = false;
    saveInnerLifeProfile.title = "";
  }
  if (innerLifeProfileNotice && !innerLifeProfileNotice.dataset.locked) {
    innerLifeProfileNotice.textContent = "";
  }
}

function renderDetailGroups(target, groups, traceSource = {}) {
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      rows: group.rows.map(([labelKey, value]) => [labelKey, formatSharedLineMetaValue(value)]).filter(([, value]) => value)
    }))
    .filter((group) => group.rows.length);

  if (visibleGroups.length === 0) {
    target.innerHTML = "";
    return;
  }
  target.innerHTML = visibleGroups
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
                const htmlValue = rawKey ? renderTraceValue(traceSource[rawKey]) || escapeHtml(value) : renderReadableText(value, "·") || escapeHtml(value);
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
  ];
  renderDetailGroups(sharedLineMetadataPanel, groups, metadata);
}

function renderSharedLineAgentState(sharedLine = {}, current = {}, agentIdOverride = "") {
  const fallbackAgentId = current.agentId || sharedLine.agentId || current.metadata?.agentId || "";
  const agentId = agentIdOverride || fallbackAgentId;
  const agentState = (sharedLine.agentStates || []).find((item) => item.agentId === agentId) || (!agentIdOverride ? sharedLine.agentState : null) || {};
  const modelAdjustment = sharedLine.modelAdjustment || null;
  if (agentIdOverride && !agentState.agentId) {
    sharedLineAgentStatePanel.innerHTML = "";
    return;
  }
  const groups = [
    {
      title: "sharedLine.group.agentState",
      rows: [
        ["sharedLine.meta.agent", agentId],
        ["sharedLine.meta.communicationStyle", agentState.communicationStyle],
        ["sharedLine.meta.relationshipPosition", agentState.relationshipPosition],
        ["sharedLine.meta.longTermPreferences", agentState.longTermPreferences],
        ["sharedLine.meta.boundaries", agentState.boundaries],
        ["sharedLine.meta.stablePatterns", agentState.stablePatterns],
        ["sharedLine.meta.agentNotes", agentState.notes]
      ]
    },
    {
      title: "sharedLine.group.modelAdjustment",
      rows: modelAdjustment
        ? [
            ["sharedLine.meta.model", modelAdjustment.model],
            ["sharedLine.meta.forbiddenPhrases", modelAdjustment.forbiddenPhrases],
            ["sharedLine.meta.forbiddenPatterns", modelAdjustment.forbiddenPatterns],
            ["sharedLine.meta.injectPrompt", modelAdjustment.injectPrompt]
          ]
        : []
    }
  ];
  renderDetailGroups(sharedLineAgentStatePanel, groups);
}

function renderSharedLineCards(lines) {
  if (lines.length === 0) {
    return "";
  }
  return lines
    .map((line) => {
      const isArchived = line.status === "archived";
      const metadata = line.metadata || {};
      const lineAgentId = line.agentId || metadata.agentId || "";
      const metaChips = [
        lineAgentId ? [t("sharedLine.meta.agent"), lineAgentId] : null,
        metadata.mode ? [t("sharedLine.meta.mode"), metadata.mode] : null,
        metadata.visibility ? [t("sharedLine.meta.visibility"), metadata.visibility] : null,
        line.interpretationStatus ? [t("sharedLine.form.status"), line.interpretationStatus] : null,
        metadata.userConfirmed ? ["", t("sharedLine.status.confirmed")] : null
      ].filter(Boolean);
      const selected = line.id === state.selectedSharedLineId;
      const actionButtons = isArchived || line.id === "line_default"
        ? ""
        : `<button class="secondary danger-button" data-shared-line-action="archive" data-shared-line-id="${escapeHtml(line.id)}">${escapeHtml(t("actions.archive"))}</button>`;
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
          <div class="shared-line-card-actions">${actionButtons || `<span>${escapeHtml(t("sharedLine.readOnly"))}</span>`}</div>
        </article>
      `;
    })
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
  const archivedLines = sharedLine?.archivedLines || [];
  const history = sharedLine?.history || [];
  const snapshots = sharedLine?.snapshots || [];
  const activeLine = lines.find((line) => line.active) || {};
  state.selectedSharedLineId = sharedLine?.lineId || state.selectedSharedLineId || activeLine.id || "";
  sharedLineDetailStatus.textContent = current.interpretationStatus || activeLine.status || "active";
  sharedLineDetailStatus.className = `badge ${current.interpretationStatus === "confirmed" ? "ok" : "planned"}`;
  const activeLines = lines.filter((line) => line.status !== "archived");
  sharedLineLineCount.textContent = activeLines.length;
  sharedLineHistoryCount.textContent = history.length;
  sharedLineSnapshotCount.textContent = snapshots.length;
  sharedLineArchivedCount.textContent = archivedLines.length;
  const agentOptions = [
    ...new Set([
      ...activeLines.map((line) => line.agentId || line.metadata?.agentId || ""),
      ...archivedLines.map((line) => line.agentId || line.metadata?.agentId || ""),
      ...(sharedLine?.agentStates || []).map((item) => item.agentId || "")
    ].filter(Boolean))
  ].sort();
  if (state.activeSharedLineAgentFilter && !agentOptions.includes(state.activeSharedLineAgentFilter)) {
    state.activeSharedLineAgentFilter = "";
  }
  sharedLineAgentFilter.innerHTML = [
    `<option value="">${escapeHtml(t("sharedLine.filter.allAgents"))}</option>`,
    ...agentOptions.map((agentId) => `<option value="${escapeHtml(agentId)}">${escapeHtml(agentId)}</option>`)
  ].join("");
  sharedLineAgentFilter.value = state.activeSharedLineAgentFilter;
  const visibleLines = state.activeSharedLineAgentFilter
    ? activeLines.filter((line) => (line.agentId || line.metadata?.agentId || "") === state.activeSharedLineAgentFilter)
    : activeLines;
  const visibleArchivedLines = state.activeSharedLineAgentFilter
    ? archivedLines.filter((line) => (line.agentId || line.metadata?.agentId || "") === state.activeSharedLineAgentFilter)
    : archivedLines;
  renderSharedLineAgentState(sharedLine || {}, current, state.activeSharedLineAgentFilter);
  const lineCards = renderSharedLineCards(visibleLines);
  if (!lineCards) {
    sharedLineList.innerHTML = `<div class="endpoint-empty">${t("sharedLine.linesEmpty")}</div>`;
  } else {
    sharedLineList.innerHTML = lineCards;
  }
  const archivedCards = renderSharedLineCards(visibleArchivedLines);
  sharedLineArchiveList.innerHTML = archivedCards || `<div class="endpoint-empty">${t("sharedLine.archiveEmpty")}</div>`;
  sharedLineSummary.innerHTML = renderReadableText(summary || t("sharedLine.currentEmpty"), "•");
  sharedLineUpdated.textContent = current.updatedAt || "";
  const currentMetadata = {
    ...(current.metadata || {}),
    ...(sharedLine.sharedReality || {}),
    agentId: current.agentId || sharedLine.agentId || current.metadata?.agentId || "",
    positionHistory: sharedLine.positionHistory || current.metadata?.positionHistory || [],
    affectiveTrace: sharedLine.affectiveTrace || current.metadata?.affectiveTrace || []
  };
  renderSharedLineMetadata(currentMetadata);
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
}

function renderInnerLife() {
  const snapshot = getSnapshot();
  const innerLife = snapshot?.innerLife || {};
  const counts = innerLife.counts || {};
  const daemon = innerLife.daemon || {};
  const innerLifeAgentIds = [
    ...(innerLife.profiles || []).map((profile) => profile.agentId || profile.agent_id),
    ...(innerLife.sessions || []).map(itemAgentId),
    ...(innerLife.digestRuns || []).map(itemAgentId),
    ...(innerLife.inbox || []).map(itemAgentId),
    ...(innerLife.pendingShares || []).map(itemAgentId),
    ...(innerLife.recentShares || []).map(itemAgentId),
    ...(innerLife.history || []).map(itemAgentId),
    ...(innerLife.experiences || []).map(itemAgentId),
    ...(innerLife.summaries || []).map(itemAgentId)
  ];
  state.activeInnerLifeAgentFilter = renderAgentFilter(innerLifeAgentFilter, innerLifeAgentIds, state.activeInnerLifeAgentFilter);
  renderInnerLifeProfile(innerLife);
  innerLifeDaemonStatus.textContent = daemon.status || "paused";
  const daemonEnabled = Boolean(daemon.enabled) && daemon.status !== "paused";
  if (innerLifeDaemonToggle) {
    innerLifeDaemonToggle.classList.toggle("is-on", daemonEnabled);
    innerLifeDaemonToggle.classList.toggle("is-error", daemon.status === "error");
    innerLifeDaemonToggle.setAttribute("aria-pressed", daemonEnabled ? "true" : "false");
    innerLifeDaemonToggle.title = daemonEnabled ? t("innerLife.pauseDaemon") : t("innerLife.enableDaemon");
  }
  if (innerLifeDaemonToggleLabel) {
    innerLifeDaemonToggleLabel.textContent = daemonEnabled ? t("innerLife.pauseDaemon") : t("innerLife.enableDaemon");
  }
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
            <strong>${escapeHtml(innerLifeStateLabel(issue.level || "ok"))}</strong>
            <span>${escapeHtml(issue.code || "")}</span>
          </div>
          <p>${escapeHtml(innerLifeDoctorMessage(issue, doctor))}</p>
          ${innerLifeDoctorAction(issue) ? `<small>${escapeHtml(innerLifeDoctorAction(issue))}</small>` : ""}
        </article>
      `
    )
    .join("");
  innerLifePendingCount.textContent = counts.pending_shares_count ?? 0;
  innerLifeEventCount.textContent = counts.events_count ?? 0;
  innerLifeThoughtCount.textContent = counts.thoughts_count ?? 0;
  const sessions = filterByAgent(innerLife.sessions || [], state.activeInnerLifeAgentFilter);
  const sessionTotal =
    state.activeInnerLifeAgentFilter && state.innerLifeSessionTotals?.[state.activeInnerLifeAgentFilter] !== undefined
      ? state.innerLifeSessionTotals[state.activeInnerLifeAgentFilter]
      : innerLife.sessionsPage?.total ?? sessions.length;
  if (sessions.length === 0) {
    innerLifeSessionList.innerHTML = `<div class="endpoint-empty">${t("innerLife.sessionsEmpty")}</div>`;
  } else {
    innerLifeSessionList.innerHTML = sessions
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
  if (loadMoreInnerLifeSessions) {
    const canLoadMore = sessions.length < sessionTotal;
    loadMoreInnerLifeSessions.hidden = !canLoadMore;
    loadMoreInnerLifeSessions.disabled = Boolean(state.innerLifeSessionsLoading);
    loadMoreInnerLifeSessions.textContent = state.innerLifeSessionsLoading
      ? t("common.checking")
      : t("innerLife.loadMoreSessions", { count: String(Math.max(0, sessionTotal - sessions.length)) });
  }
  const inboxItems = filterByAgent(innerLife.inbox || [], state.activeInnerLifeAgentFilter);
  const inboxTotal =
    state.activeInnerLifeAgentFilter && state.innerLifeInboxTotals?.[state.activeInnerLifeAgentFilter] !== undefined
      ? state.innerLifeInboxTotals[state.activeInnerLifeAgentFilter]
      : innerLife.inboxPage?.total ?? inboxItems.length;
  if (innerLifeInboxList) {
    if (inboxItems.length === 0) {
      innerLifeInboxList.innerHTML = `<div class="endpoint-empty">${t("innerLife.inboxEmpty")}</div>`;
    } else {
      innerLifeInboxList.innerHTML = inboxItems
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
  if (loadMoreInnerLifeInbox) {
    const canLoadMore = inboxItems.length < inboxTotal;
    loadMoreInnerLifeInbox.hidden = !canLoadMore;
    loadMoreInnerLifeInbox.disabled = Boolean(state.innerLifeInboxLoading);
    loadMoreInnerLifeInbox.textContent = state.innerLifeInboxLoading
      ? t("common.checking")
      : t("innerLife.loadMoreInbox", { count: String(Math.max(0, inboxTotal - inboxItems.length)) });
  }
  const digestRuns = filterByAgent(innerLife.digestRuns || [], state.activeInnerLifeAgentFilter);
  const digestTotal =
    state.activeInnerLifeAgentFilter && state.innerLifeDigestTotals?.[state.activeInnerLifeAgentFilter] !== undefined
      ? state.innerLifeDigestTotals[state.activeInnerLifeAgentFilter]
      : innerLife.digestRunsPage?.total ?? digestRuns.length;
  if (digestRuns.length === 0) {
    innerLifeDigestList.innerHTML = `<div class="endpoint-empty">${t("innerLife.digestEmpty")}</div>`;
  } else {
    innerLifeDigestList.innerHTML = digestRuns
      .map(
        (run) => `
          <article class="shared-line-history-item">
            <div>
              <strong>${escapeHtml(run.mode || "manual")}</strong>
              <span>${escapeHtml(run.completedAt || run.createdAt || "")}</span>
            </div>
            <p>${escapeHtml(previewInnerLifeDigest(run.summary) || run.status || "")}</p>
            <small>${escapeHtml(run.status || "")}</small>
          </article>
        `
      )
      .join("");
  }
  if (loadMoreInnerLifeDigestRuns) {
    const canLoadMore = digestRuns.length < digestTotal;
    loadMoreInnerLifeDigestRuns.hidden = !canLoadMore;
    loadMoreInnerLifeDigestRuns.disabled = Boolean(state.innerLifeDigestRunsLoading);
    loadMoreInnerLifeDigestRuns.textContent = state.innerLifeDigestRunsLoading
      ? t("common.checking")
      : t("innerLife.loadMoreDigests", { count: String(Math.max(0, digestTotal - digestRuns.length)) });
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
  const historyItems = filterByAgent(innerLife.history || [], state.activeInnerLifeAgentFilter);
  if (innerLifeHistoryList) {
    if (historyItems.length === 0) {
      innerLifeHistoryList.innerHTML = `<div class="endpoint-empty">${t("innerLife.historyEmpty")}</div>`;
    } else {
      innerLifeHistoryList.innerHTML = historyItems
        .slice(0, 6)
        .map(
          (item) => `
            <article class="innerlife-record-item">
              <div class="innerlife-record-meta">
                <strong>${escapeHtml(innerLifeKindLabel(item.type))}</strong>
                <span>${escapeHtml(innerLifeStateLabel(item.status))}</span>
              </div>
              <time>${escapeHtml(item.createdAt || "")}</time>
              <p>${escapeHtml(previewInnerLifeText(item.body, 220))}</p>
            </article>
          `
        )
        .join("");
    }
  }
  const experiences = filterByAgent(innerLife.experiences || [], state.activeInnerLifeAgentFilter);
  if (innerLifeExperienceList) {
    if (experiences.length === 0) {
      innerLifeExperienceList.innerHTML = `<div class="endpoint-empty">${t("innerLife.experiencesEmpty")}</div>`;
    } else {
      innerLifeExperienceList.innerHTML = experiences
        .slice(0, 5)
        .map(
          (item) => `
            <article class="innerlife-record-item">
              <div class="innerlife-record-meta">
                <strong>${escapeHtml(innerLifeKindLabel(item.source || item.reviewStatus))}</strong>
                <span>${escapeHtml(innerLifeStateLabel(item.reviewStatus))}</span>
              </div>
              <time>${escapeHtml(item.createdAt || "")}</time>
              <p>${escapeHtml(previewInnerLifeText(item.body, 220))}</p>
            </article>
          `
        )
        .join("");
    }
  }
  const summaries = filterByAgent(innerLife.summaries || [], state.activeInnerLifeAgentFilter);
  if (innerLifeSummaryList) {
    if (summaries.length === 0) {
      innerLifeSummaryList.innerHTML = `<div class="endpoint-empty">${t("innerLife.summariesEmpty")}</div>`;
    } else {
      innerLifeSummaryList.innerHTML = summaries
        .slice(0, 5)
        .map(
          (item) => `
            <article class="innerlife-record-item">
              <div class="innerlife-record-meta">
                <strong>${escapeHtml(innerLifeKindLabel(item.mode))}</strong>
                <span>${escapeHtml(innerLifeKindLabel(item.source))}</span>
              </div>
              <time>${escapeHtml(item.completedAt || item.createdAt || "")}</time>
              <p>${escapeHtml(previewInnerLifeText(item.summary, 220))}</p>
            </article>
          `
        )
        .join("");
    }
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
            <strong>${escapeHtml(t("innerLife.thoughtBubble"))}</strong>
            <span>${escapeHtml(itemAgentId(share) || "")} · ${escapeHtml(innerLifeStateLabel(share.status))}</span>
          </div>
          <time>${escapeHtml(share.created_at || "")}</time>
          <pre>${escapeHtml(share.body || "")}</pre>
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
