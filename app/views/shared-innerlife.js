function createClaraCoreSharedInnerLifeView(context) {
  const {
    dom,
    t,
    getSnapshot,
    escapeHtml,
    formatSharedLineMetaValue,
    formatLocalDateTime,
    renderReadableText,
    itemAgentId,
    filterByAgent,
    renderAgentFilter,
    state,
    renderMemoryResults,
    memoryAgentId
  } = context;
  const {
    memoryAgentFilter, memoryList, sharedLineSummary, sharedLinePast, sharedLineNext, sharedLineUpdated, sharedLineList,
    sharedLineActiveCount, sharedLineAgentFilter, sharedLineDetailTitle, sharedLineParticipants, sharedLineContinuityPath,
    sharedLineUnderstandingSection, sharedLineUnderstanding, sharedLineUnresolvedSection, sharedLineUnresolved,
    sharedLineAgentStatePanel, sharedLineMetadataPanel, sharedLineHistoryList, sharedLineSnapshotList, sharedLineArchiveList,
    innerLifeAgentFilter, innerLifeProfileName, innerLifeFocus, innerLifeInterests,
    innerLifeUnsharedList, innerLifeSharedList, innerLifeSharedDetails, innerLifeAdvancedDetails,
    innerLifeSessionList,
    loadMoreInnerLifeSessions, innerLifeDigestList, loadMoreInnerLifeDigestRuns, innerLifeInboxList, loadMoreInnerLifeInbox,
    innerLifeShareCheckList, innerLifeShareList, innerLifeDaemonStatus,
    innerLifeHistoryList, innerLifeExperienceList, innerLifeSummaryList, innerLifeContextBar,
    innerLifeDaemonToggle, innerLifeDaemonToggleLabel, innerLifeNextRun, innerLifeLastResult, innerLifeRecovery,
    innerLifeDoctorStatus, innerLifeDoctorList, innerLifePendingCount,
    innerLifeProfileDisplayName, innerLifeProfileRecentFocus, innerLifeProfileInterests,
    innerLifeProfileShareAfterHours, innerLifeProfileShareCooldownHours, innerLifeProfileShareMaxDaily,
    innerLifeProfileJson, innerLifeStateJson, saveInnerLifeProfile, innerLifeProfileNotice,
    innerLifeProfileJsonView, innerLifeStateJsonView
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

function renderDetailGroups(target, groups, traceSource = {}) {
  if (!target) return;
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
      title: "sharedLine.group.boundary",
      rows: [
        ["sharedLine.meta.entryPosture", metadata.entryPosture],
        ["sharedLine.meta.boundaryNotes", metadata.boundaryNotes],
        ["sharedLine.meta.sourceSession", metadata.sourceSession],
        ["sharedLine.meta.notes", metadata.notes]
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

function renderSharedLineAgentState(sharedLine = {}, current = {}) {
  const fallbackAgentId = current.agentId || sharedLine.agentId || current.metadata?.agentId || "";
  const agentId = fallbackAgentId;
  const agentState = sharedLine.agentState || (sharedLine.agentStates || []).find((item) => item.agentId === agentId) || {};
  const modelAdjustment = sharedLine.modelAdjustment || null;
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
      const metadata = line.metadata || {};
      const selected = line.id === state.selectedSharedLineId;
      const updatedAt = formatLocalDateTime(line.positionUpdatedAt || line.updatedAt || line.createdAt);
      return `
        <article class="shared-line-card ${selected ? "active-line" : ""}" data-shared-line-action="select" data-shared-line-id="${escapeHtml(line.id)}" tabindex="0" role="option" aria-selected="${selected ? "true" : "false"}">
          <span class="shared-line-card-marker" aria-hidden="true"></span>
          <div class="shared-line-card-head">
            <strong>${escapeHtml(line.title || line.id)}</strong>
          </div>
          <p><span>${escapeHtml(t("sharedLine.now"))}</span>${escapeHtml(previewInnerLifeText(line.summary || metadata.stateSummary || t("sharedLine.currentEmpty"), 150))}</p>
          ${updatedAt ? `<time>${escapeHtml(updatedAt)}</time>` : ""}
        </article>
      `;
    })
    .join("");
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => formatSharedLineMetaValue(value)).filter(Boolean))];
}

function primaryPast(sharedLine = {}, current = {}) {
  const priorHistory = (sharedLine.history || []).find((item) => item.summary && item.summary !== current.summary);
  if (priorHistory) return priorHistory.summary;
  const priorPositions = Array.isArray(sharedLine.positionHistory) ? sharedLine.positionHistory : [];
  const priorPosition = priorPositions.slice().reverse().find((item) => {
    const value = typeof item === "object" ? item.position || item.summary || item.note : item;
    return value && value !== current.summary;
  });
  return typeof priorPosition === "object"
    ? priorPosition.position || priorPosition.summary || priorPosition.note || ""
    : priorPosition || "";
}

function renderPrimaryValues(target, values, emptyKey, decorated = true) {
  if (!target) return;
  const items = uniqueValues(values);
  target.innerHTML = items.length
    ? items.map((item) => `<p>${decorated ? renderReadableText(item, "•") || escapeHtml(item) : escapeHtml(item).replace(/\n/g, "<br>")}</p>`).join("")
    : `<p class="quiet">${escapeHtml(t(emptyKey))}</p>`;
}

function renderArchivedLines(lines) {
  if (!sharedLineArchiveList) return;
  if (!lines.length) {
    sharedLineArchiveList.innerHTML = `<div class="endpoint-empty">${escapeHtml(t("sharedLine.archiveEmpty"))}</div>`;
    return;
  }
  sharedLineArchiveList.innerHTML = lines
    .map((line) => `
      <article class="shared-line-archive-item">
        <strong>${escapeHtml(line.title || line.id)}</strong>
        ${line.summary ? `<p>${escapeHtml(line.summary)}</p>` : ""}
        <time>${escapeHtml(formatLocalDateTime(line.positionUpdatedAt || line.updatedAt || line.createdAt))}</time>
      </article>
    `)
    .join("");
}

function renderSelectedHistory(sharedLine = {}) {
  const history = sharedLine.history || [];
  const snapshots = sharedLine.snapshots || [];
  sharedLineHistoryList.innerHTML = history.length
    ? history.map((item) => `
        <article class="shared-line-history-item">
          <div><strong>${escapeHtml(formatLocalDateTime(item.createdAt))}</strong></div>
          <p>${renderReadableText(item.summary || "", "•") || escapeHtml(item.summary || "")}</p>
        </article>
      `).join("")
    : `<div class="endpoint-empty">${escapeHtml(t("sharedLine.historyEmpty"))}</div>`;
  sharedLineSnapshotList.innerHTML = snapshots.length
    ? snapshots.map((item) => `
        <article class="shared-line-history-item">
          <div><strong>${escapeHtml(formatLocalDateTime(item.createdAt))}</strong></div>
          <p>${renderReadableText(item.summary || "", "•") || escapeHtml(item.summary || "")}</p>
        </article>
      `).join("")
    : `<div class="endpoint-empty">${escapeHtml(t("sharedLine.snapshotsEmpty"))}</div>`;
}

function renderMemoryList() {
  const snapshot = getSnapshot();
  const memories = snapshot?.memories || [];
  state.activeMemoryAgentFilter = renderAgentFilter(memoryAgentFilter, memories.map(memoryAgentId), state.activeMemoryAgentFilter);
  renderMemoryResults(filterByAgent(memories, state.activeMemoryAgentFilter, memoryAgentId));
}

function renderSharedLine() {
  const snapshot = getSnapshot();
  const catalog = snapshot?.sharedLine || {};
  const sharedLine = state.selectedSharedLinePacket || (catalog.lineId === state.selectedSharedLineId ? catalog : null);
  const current = sharedLine?.currentPosition || {};
  const lines = catalog.lines || [];
  const archivedLines = catalog.archivedLines || [];
  const activeLines = lines.filter((line) => line.status !== "archived");
  const selectedLine = activeLines.find((line) => line.id === state.selectedSharedLineId)
    || (sharedLine?.lines || []).find((line) => line.id === sharedLine?.lineId)
    || {};
  const agentOptions = [
    ...new Set([
      ...activeLines.map((line) => line.agentId || line.metadata?.agentId || ""),
      ...archivedLines.map((line) => line.agentId || line.metadata?.agentId || ""),
      ...(catalog.agentStates || []).map((item) => item.agentId || "")
    ].filter(Boolean))
  ].sort();
  if (state.activeSharedLineAgentFilter && !agentOptions.includes(state.activeSharedLineAgentFilter)) {
    state.activeSharedLineAgentFilter = "";
  }
  if (sharedLineAgentFilter) {
    sharedLineAgentFilter.innerHTML = [
      `<option value="">${escapeHtml(t("sharedLine.filter.allAgents"))}</option>`,
      ...agentOptions.map((agentId) => `<option value="${escapeHtml(agentId)}">${escapeHtml(agentId)}</option>`)
    ].join("");
    sharedLineAgentFilter.value = state.activeSharedLineAgentFilter;
  }
  const visibleLines = state.activeSharedLineAgentFilter
    ? activeLines.filter((line) => (line.agentId || line.metadata?.agentId || "") === state.activeSharedLineAgentFilter)
    : activeLines;
  const visibleArchivedLines = state.activeSharedLineAgentFilter
    ? archivedLines.filter((line) => (line.agentId || line.metadata?.agentId || "") === state.activeSharedLineAgentFilter)
    : archivedLines;
  const lineCards = renderSharedLineCards(visibleLines);
  sharedLineList.innerHTML = lineCards || `<div class="endpoint-empty">${escapeHtml(t("sharedLine.linesEmpty"))}</div>`;
  if (sharedLineActiveCount) sharedLineActiveCount.textContent = t("sharedLine.lineCount", { count: String(activeLines.length) });
  renderArchivedLines(visibleArchivedLines);

  const hasSelection = Boolean(sharedLine?.lineId && current.lineId === sharedLine.lineId);
  if (sharedLineContinuityPath) sharedLineContinuityPath.hidden = !hasSelection;
  sharedLineDetailTitle.textContent = hasSelection
    ? selectedLine.title || current.lineTitle || sharedLine.lineTitle || sharedLine.lineId
    : t("sharedLine.detail.emptyTitle");
  const participants = uniqueValues([selectedLine.agentId, current.agentId, sharedLine?.agentId]);
  sharedLineParticipants.textContent = hasSelection && participants.length
    ? t("sharedLine.participants", { names: participants.join(" · ") })
    : hasSelection ? t("sharedLine.participantsEmpty") : t("sharedLine.detail.emptyBody");
  renderPrimaryValues(sharedLinePast, [primaryPast(sharedLine || {}, current)], "sharedLine.pastEmpty", false);
  renderPrimaryValues(
    sharedLineSummary,
    [current.summary, current.metadata?.stateSummary, current.metadata?.currentInterpretation],
    "sharedLine.currentEmpty",
    false
  );
  const handoffNext = (sharedLine?.handoffs || []).find((item) => item.nextStep)?.nextStep || "";
  renderPrimaryValues(sharedLineNext, [current.metadata?.nextStep, current.nextStep, handoffNext], "sharedLine.nextEmpty", false);
  sharedLineUpdated.textContent = hasSelection && current.updatedAt
    ? t("sharedLine.updatedAt", { time: formatLocalDateTime(current.updatedAt) })
    : "";

  const sharedReality = { ...(current.metadata || {}), ...(sharedLine?.sharedReality || {}) };
  const understanding = uniqueValues([sharedReality.confirmedGround, sharedReality.realityLine]);
  sharedLineUnderstandingSection.hidden = understanding.length === 0;
  renderPrimaryValues(sharedLineUnderstanding, understanding, "sharedLine.understandingEmpty");
  const unresolved = uniqueValues([sharedReality.provisionalRead, sharedReality.misreadRisks]);
  sharedLineUnresolvedSection.hidden = unresolved.length === 0;
  renderPrimaryValues(sharedLineUnresolved, unresolved, "sharedLine.unresolvedEmpty");

  const currentMetadata = {
    ...(current.metadata || {}),
    ...(sharedLine?.sharedReality || {}),
    agentId: current.agentId || sharedLine?.agentId || current.metadata?.agentId || "",
    positionHistory: sharedLine?.positionHistory || current.metadata?.positionHistory || [],
    affectiveTrace: sharedLine?.affectiveTrace || current.metadata?.affectiveTrace || []
  };
  renderSharedLineMetadata(currentMetadata);
  renderSharedLineAgentState(sharedLine || {}, current);
  renderSelectedHistory(sharedLine || {});
}

function renderInnerLifeAgentSelector(profiles) {
  if (!innerLifeAgentFilter) return "";
  const available = (profiles || []).filter((profile) => profile?.agentId);
  const ids = available.map((profile) => profile.agentId);
  const selected = ids.includes(state.activeInnerLifeAgentFilter)
    ? state.activeInnerLifeAgentFilter
    : ids[0] || "";
  innerLifeAgentFilter.innerHTML = available
    .map((profile) => {
      const label = profile.displayName && profile.displayName !== profile.agentId
        ? `${profile.displayName} · ${profile.agentId}`
        : profile.agentId;
      return `<option value="${escapeHtml(profile.agentId)}">${escapeHtml(label)}</option>`;
    })
    .join("");
  innerLifeAgentFilter.disabled = available.length === 0;
  innerLifeAgentFilter.value = selected;
  state.activeInnerLifeAgentFilter = selected;
  return selected;
}

function hasVerifiedInnerLifeDelivery(share) {
  const evidence = share?.deliveryEvidence || {};
  return Boolean(
    share?.status === "used" &&
    String(evidence.conversationId || "").trim() &&
    String(evidence.responseExcerpt || "").trim() &&
    !Number.isNaN(Date.parse(String(evidence.sharedAt || "")))
  );
}

function unsharedThoughtLabel(status) {
  const key = ["pending", "approved", "deferred"].includes(status)
    ? `innerLife.thoughtState.${status}`
    : "innerLife.thoughtState.formed";
  return t(key);
}

function renderInnerLifeThought(share, { shared = false } = {}) {
  const evidence = share.deliveryEvidence || {};
  const timestamp = shared
    ? evidence.sharedAt || share.updated_at || share.created_at
    : share.created_at || share.updated_at;
  const stateLabel = shared
    ? t(hasVerifiedInnerLifeDelivery(share) ? "innerLife.thoughtState.shared" : "innerLife.thoughtState.sharedUnverified")
    : unsharedThoughtLabel(share.status);
  return `
    <article class="innerlife-thought ${shared ? "is-shared" : ""}" data-innerlife-share-id="${escapeHtml(share.id)}">
      <div class="innerlife-thought-meta">
        <span>${escapeHtml(stateLabel)}</span>
        ${timestamp ? `<time>${escapeHtml(formatLocalDateTime(timestamp))}</time>` : ""}
      </div>
      <p>${escapeHtml(share.body || "")}</p>
    </article>
  `;
}

function renderInnerLife() {
  const snapshot = getSnapshot();
  const innerLife = snapshot?.innerLife || {};
  const profiles = Array.isArray(innerLife.profiles) ? innerLife.profiles : [];
  const selectedAgentId = renderInnerLifeAgentSelector(profiles);
  const selectedProfile = profiles.find((profile) => profile.agentId === selectedAgentId) || null;
  const selectedState = selectedProfile?.state || {};
  const interests = Array.isArray(selectedState.current_interests)
    ? selectedState.current_interests.filter(Boolean)
    : [];

  if (innerLifeProfileName) innerLifeProfileName.textContent = selectedProfile?.displayName || selectedAgentId || "";
  if (innerLifeFocus) {
    innerLifeFocus.textContent = selectedProfile
      ? selectedState.recent_focus || t("innerLife.focusEmpty")
      : t("innerLife.noProfiles");
  }
  if (innerLifeInterests) {
    innerLifeInterests.innerHTML = interests
      .map((interest) => `<span>${escapeHtml(interest)}</span>`)
      .join("");
    innerLifeInterests.hidden = interests.length === 0;
  }
  if (innerLifeProfileJsonView) innerLifeProfileJsonView.textContent = JSON.stringify(selectedProfile?.profile || {}, null, 2);
  if (innerLifeStateJsonView) innerLifeStateJsonView.textContent = JSON.stringify(selectedState, null, 2);

  const selectedShares = selectedProfile ? filterByAgent(innerLife.recentShares || [], selectedAgentId) : [];
  const unsharedShares = selectedShares.filter((share) =>
    ["pending", "approved", "deferred"].includes(String(share.status || "").toLowerCase()) &&
    !hasVerifiedInnerLifeDelivery(share)
  );
  // Legacy shares were marked used before delivery evidence existed; keep them
  // visible in the shared list instead of dropping them from both lists.
  const sharedShares = selectedShares.filter((share) => String(share.status || "").toLowerCase() === "used");

  if (innerLifeUnsharedList) {
    innerLifeUnsharedList.innerHTML = unsharedShares.length
      ? unsharedShares.map((share) => renderInnerLifeThought(share)).join("")
      : `<div class="endpoint-empty">${escapeHtml(selectedProfile ? t("innerLife.unsharedEmpty") : t("innerLife.noProfiles"))}</div>`;
  }
  if (innerLifeSharedList) {
    innerLifeSharedList.innerHTML = sharedShares.length
      ? sharedShares.map((share) => renderInnerLifeThought(share, { shared: true })).join("")
      : `<div class="endpoint-empty">${escapeHtml(t("innerLife.sharedEmpty"))}</div>`;
  }
  if (innerLifeSharedDetails) innerLifeSharedDetails.hidden = !selectedProfile;

  const daemon = innerLife.daemon || {};
  if (innerLifeDaemonStatus) innerLifeDaemonStatus.textContent = daemon.status || "-";
  if (innerLifeNextRun) innerLifeNextRun.textContent = formatLocalDateTime(daemon.nextRunAt) || "-";
  if (innerLifeLastResult) innerLifeLastResult.textContent = daemon.lastResult || daemon.lastError || "-";
  const retrySeconds = Number.parseInt(String(daemon.metadata?.retrySeconds || 0), 10) || 0;
  const failureCount = Number.parseInt(String(daemon.metadata?.failureCount || 0), 10) || 0;
  if (innerLifeRecovery) {
    innerLifeRecovery.textContent = failureCount > 0
      ? `${failureCount} ${t("innerLife.recoveryRetry")} ${retrySeconds}s`
      : daemon.lastError || "-";
  }
  const doctor = innerLife.doctor || {};
  if (innerLifeDoctorStatus) innerLifeDoctorStatus.textContent = doctor.status || "-";
  const doctorItems = Array.isArray(doctor.issues) && doctor.issues.length
    ? doctor.issues
    : [{ level: "ok", code: "healthy", message: doctor.summary || t("innerLife.doctorEmpty") }];
  if (innerLifeDoctorList) {
    innerLifeDoctorList.innerHTML = doctorItems.slice(0, 5).map((issue) => `
      <article class="shared-line-history-item">
        <div><strong>${escapeHtml(innerLifeStateLabel(issue.level || "ok"))}</strong><span>${escapeHtml(issue.code || "")}</span></div>
        <p>${escapeHtml(innerLifeDoctorMessage(issue, doctor))}</p>
      </article>
    `).join("");
  }

  const sessions = filterByAgent(innerLife.sessions || [], selectedAgentId);
  if (innerLifeSessionList) {
    innerLifeSessionList.innerHTML = sessions.length ? sessions.map((session) => `
      <article class="shared-line-history-item">
        <div><strong>${escapeHtml(session.status || "")}</strong><span>${escapeHtml(formatLocalDateTime(session.startedAt))}</span></div>
        <p>${escapeHtml(session.summary && session.summary !== "{}" ? session.summary : session.externalSessionId || session.id || "")}</p>
      </article>
    `).join("") : `<div class="endpoint-empty">${escapeHtml(t("innerLife.sessionsEmpty"))}</div>`;
  }
  const digestRuns = filterByAgent(innerLife.digestRuns || [], selectedAgentId);
  if (innerLifeDigestList) {
    innerLifeDigestList.innerHTML = digestRuns.length ? digestRuns.map((run) => `
      <article class="shared-line-history-item">
        <div><strong>${escapeHtml(run.mode || "")}</strong><span>${escapeHtml(formatLocalDateTime(run.completedAt || run.createdAt))}</span></div>
        <p>${escapeHtml(previewInnerLifeDigest(run.summary) || run.status || "")}</p>
      </article>
    `).join("") : `<div class="endpoint-empty">${escapeHtml(t("innerLife.digestEmpty"))}</div>`;
  }
  const inboxItems = filterByAgent(innerLife.inbox || [], selectedAgentId);
  if (innerLifeInboxList) {
    innerLifeInboxList.innerHTML = inboxItems.length ? inboxItems.map((item) => `
      <article class="shared-line-history-item">
        <div><strong>${escapeHtml(item.source || "desktop")}</strong><span>${escapeHtml(formatLocalDateTime(item.createdAt))}</span></div>
        <p>${escapeHtml(item.body || "")}</p>
      </article>
    `).join("") : `<div class="endpoint-empty">${escapeHtml(t("innerLife.inboxEmpty"))}</div>`;
  }
  const shareChecks = filterByAgent(innerLife.shareChecks || [], selectedAgentId);
  if (innerLifeShareCheckList) {
    innerLifeShareCheckList.innerHTML = shareChecks.length ? shareChecks.slice(0, 10).map((check) => `
      <article class="shared-line-history-item">
        <div><strong>${escapeHtml(check.decision || "")}</strong><span>${escapeHtml(formatLocalDateTime(check.createdAt))}</span></div>
        <p>${escapeHtml(check.reason || "")}</p>
      </article>
    `).join("") : `<div class="endpoint-empty">${escapeHtml(t("innerLife.timingEmpty"))}</div>`;
  }

  const renderRecords = (target, items, emptyKey, bodyKey, metaKey) => {
    if (!target) return;
    target.innerHTML = items.length ? items.slice(0, 10).map((item) => `
      <article class="innerlife-record-item">
        <div class="innerlife-record-meta"><strong>${escapeHtml(innerLifeKindLabel(item[metaKey] || item.type || item.source))}</strong></div>
        <time>${escapeHtml(formatLocalDateTime(item.completedAt || item.createdAt))}</time>
        <p>${escapeHtml(previewInnerLifeText(item[bodyKey], 220))}</p>
      </article>
    `).join("") : `<div class="endpoint-empty">${escapeHtml(t(emptyKey))}</div>`;
  };
  renderRecords(innerLifeHistoryList, filterByAgent(innerLife.history || [], selectedAgentId), "innerLife.historyEmpty", "body", "type");
  renderRecords(innerLifeExperienceList, filterByAgent(innerLife.experiences || [], selectedAgentId), "innerLife.experiencesEmpty", "body", "source");
  renderRecords(innerLifeSummaryList, filterByAgent(innerLife.summaries || [], selectedAgentId), "innerLife.summariesEmpty", "summary", "mode");

  if (innerLifeAdvancedDetails && !selectedProfile) innerLifeAdvancedDetails.open = false;
}

  return {
    renderMemoryList,
    renderSharedLine,
    renderInnerLife
  };
}

window.createClaraCoreSharedInnerLifeView = createClaraCoreSharedInnerLifeView;
