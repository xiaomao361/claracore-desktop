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
    sharedLinePrimaryList, sharedLineOverflowList, sharedLineAllAction,
    sharedLineActiveCount, sharedLineOverviewActiveCount, sharedLineOverviewArchivedCount, sharedLineProcessFlow,
    sharedLineAgentFilter, sharedLineDetailTitle, sharedLineParticipants, sharedLineContinuityPath,
    sharedLineUnderstandingSection, sharedLineUnderstanding, sharedLineUnresolvedSection, sharedLineUnresolved,
    sharedLineAgentStatePanel, sharedLineMetadataPanel, sharedLineHistoryList, sharedLineSnapshotList, sharedLineArchiveList,
    sharedLineDetailDialog, sharedLineDialogClose, sharedLineDialogKicker, sharedLineDialogTitle, sharedLineDialogMeta,
    sharedLineDialogLines, sharedLineDialogAgents, sharedLineDialogEvidence, sharedLineDialogArchive,
    innerLifeAgentFilter, innerLifeFocus, innerLifeInterests,
    innerLifeUnsharedList, innerLifeAllUnsharedAction, innerLifeSharedList, innerLifeAllSharedAction,
    innerLifeProcessFlow, innerLifeDaemonStatus, innerLifeNextRun, innerLifeLastResult,
    innerLifeDoctorStatus, innerLifeDetailDialog, innerLifeDetailBack, innerLifeDetailClose,
    innerLifeDetailKicker, innerLifeDetailTitle, innerLifeDetailMeta, innerLifeDetailBody
  } = dom;
  const SHARED_LINE_PREVIEW_LIMIT = 6;
  let sharedLineDialogTrigger = null;
  let sharedLineDialogMode = "";
  let innerLifeReaderModel = null;
  let innerLifeDialogTrigger = null;
  let innerLifeDialogKind = "";
  let innerLifeDialogItemId = "";
  let innerLifeDialogBackKind = "";

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
  if (normalized === "enabled" || normalized === "running") return t("innerLife.state.enabled");
  if (normalized === "paused") return t("innerLife.state.paused");
  if (normalized === "idle" || normalized === "not_due") return t("innerLife.state.idle");
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

function innerLifeLastResultLabel(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toLowerCase();
  if (!raw) return "-";
  if (normalized === "initialized") return t("innerLife.lastResult.ready");
  if (normalized === "idle" || normalized === "not_due") return t("innerLife.lastResult.idle");
  if (normalized === "paused") return t("innerLife.state.paused");
  const processed = normalized.match(/^processed\s+(\d+)\s+inbox item/);
  if (processed) return t("innerLife.lastResult.processed", { count: processed[1] });
  if (normalized.startsWith("retry in ")) return t("innerLife.lastResult.retrying");
  return innerLifeStateLabel(raw) || raw;
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
          <h3>${escapeHtml(group.titleText || t(group.title))}</h3>
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

function renderSharedLineAgentState(catalog = {}, activeAgentId = "") {
  const states = Array.isArray(catalog.agentStates) ? catalog.agentStates : [];
  const visibleStates = activeAgentId
    ? states.filter((item) => item.agentId === activeAgentId)
    : states;
  if (!sharedLineAgentStatePanel) return;
  if (visibleStates.length === 0) {
    const message = activeAgentId
      ? t("sharedLine.agentContextEmptyFor", { agent: activeAgentId })
      : t("sharedLine.agentContextEmpty");
    sharedLineAgentStatePanel.innerHTML = `<div class="endpoint-empty">${escapeHtml(message)}</div>`;
    return;
  }

  const valueItems = (value) => {
    const source = Array.isArray(value) ? value : [value];
    return source
      .flatMap((item) => String(formatSharedLineMetaValue(item) || "").split("\n"))
      .map((item) => item.trim())
      .filter(Boolean);
  };
  const renderField = (labelKey, value, kind = "chips") => {
    const items = valueItems(value);
    if (items.length === 0) return "";
    const body = kind === "copy"
      ? `<div class="shared-line-agent-role-copy">${items.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>`
      : `<div class="shared-line-agent-role-chips">${items.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`;
    return `
      <section class="shared-line-agent-role-field ${kind === "copy" ? "is-copy" : ""}">
        <h4>${escapeHtml(t(labelKey))}</h4>
        ${body}
      </section>
    `;
  };

  sharedLineAgentStatePanel.innerHTML = visibleStates.map((agentState) => {
    const agentId = agentState.agentId || t("sharedLine.group.agentState");
    const initial = Array.from(agentId.trim())[0]?.toUpperCase() || "A";
    const fields = [
      renderField("sharedLine.meta.communicationStyle", agentState.communicationStyle, "copy"),
      renderField("sharedLine.meta.relationshipPosition", agentState.relationshipPosition, "copy"),
      renderField("sharedLine.meta.longTermPreferences", agentState.longTermPreferences),
      renderField("sharedLine.meta.boundaries", agentState.boundaries),
      renderField("sharedLine.meta.stablePatterns", agentState.stablePatterns),
      renderField("sharedLine.meta.agentNotes", agentState.notes, "copy")
    ].filter(Boolean).join("");
    return `
      <article class="shared-line-agent-role-card" data-agent-role-id="${escapeHtml(agentId)}">
        <header class="shared-line-agent-role-head">
          <span class="shared-line-agent-role-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
          <span class="shared-line-agent-role-identity">
            <strong>${escapeHtml(agentId)}</strong>
            <small>${escapeHtml(t("sharedLine.agentRoleScope"))}</small>
          </span>
          <span class="shared-line-agent-role-badge">${escapeHtml(t("sharedLine.agentRoleBadge"))}</span>
        </header>
        <div class="shared-line-agent-role-fields">
          ${fields || `<p class="shared-line-agent-role-empty">${escapeHtml(t("sharedLine.agentRoleUnset"))}</p>`}
        </div>
      </article>
    `;
  }).join("");
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
        <button type="button" class="shared-line-card ${selected ? "active-line" : ""}" data-shared-line-action="select" data-shared-line-id="${escapeHtml(line.id)}" aria-pressed="${selected ? "true" : "false"}">
          <span class="shared-line-card-marker" aria-hidden="true"></span>
          <div class="shared-line-card-head">
            <strong title="${escapeHtml(line.title || line.id)}">${escapeHtml(line.title || line.id)}</strong>
          </div>
          <p><span>${escapeHtml(t("sharedLine.now"))}</span>${escapeHtml(previewInnerLifeText(line.summary || metadata.stateSummary || t("sharedLine.currentEmpty"), 150))}</p>
          ${updatedAt ? `<time>${escapeHtml(updatedAt)}</time>` : ""}
        </button>
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
        ${line.summary ? `<p title="${escapeHtml(line.summary)}">${escapeHtml(previewInnerLifeText(line.summary, 220))}</p>` : ""}
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

function openSharedLineDialog(mode, trigger = null) {
  if (!sharedLineDetailDialog) return;
  const sections = {
    lines: sharedLineDialogLines,
    agents: sharedLineDialogAgents,
    evidence: sharedLineDialogEvidence,
    archive: sharedLineDialogArchive
  };
  const copy = {
    lines: ["ACTIVE LINES", t("sharedLine.dialog.linesTitle"), t("sharedLine.dialog.linesMeta")],
    agents: ["AGENT CONTEXT", t("sharedLine.agentContext"), t("sharedLine.agentContextBody")],
    evidence: ["LINE EVIDENCE", t("sharedLine.dialog.evidenceTitle"), t("sharedLine.advanced.body")],
    archive: ["ARCHIVE", t("sharedLine.pastLines"), t("sharedLine.reading.archiveBody")]
  };
  const selectedCopy = copy[mode];
  if (!selectedCopy || !sections[mode]) return;
  if (!sharedLineDetailDialog.open && trigger) sharedLineDialogTrigger = trigger;
  sharedLineDialogMode = mode;
  Object.entries(sections).forEach(([key, section]) => { if (section) section.hidden = key !== mode; });
  sharedLineDialogKicker.textContent = selectedCopy[0];
  sharedLineDialogTitle.textContent = selectedCopy[1];
  sharedLineDialogMeta.textContent = selectedCopy[2];
  if (!sharedLineDetailDialog.open) sharedLineDetailDialog.showModal();
}

function bindSharedLineReader() {
  if (!sharedLineDetailDialog || sharedLineDetailDialog.dataset.bound === "true") return;
  sharedLineDetailDialog.dataset.bound = "true";
  document.querySelector("#sharedLineView")?.addEventListener("click", (event) => {
    const action = event.target.closest("[data-shared-line-open]");
    if (!action) return;
    openSharedLineDialog(action.dataset.sharedLineOpen, action);
  });
  sharedLineDialogClose?.addEventListener("click", () => sharedLineDetailDialog.close());
  sharedLineDetailDialog.addEventListener("close", () => {
    const trigger = sharedLineDialogTrigger;
    sharedLineDialogTrigger = null;
    sharedLineDialogMode = "";
    trigger?.focus();
  });
}

function renderMemoryList() {
  const snapshot = getSnapshot();
  const memories = snapshot?.memories || snapshot?.recentMemories || [];
  state.activeMemoryAgentFilter = renderAgentFilter(memoryAgentFilter, memories.map(memoryAgentId), state.activeMemoryAgentFilter);
  renderMemoryResults(filterByAgent(memories, state.activeMemoryAgentFilter, memoryAgentId));
}

function renderSharedLine() {
  const snapshot = getSnapshot();
  const overviewCatalog = snapshot?.sharedLine || {};
  const selectedPacket = (
    state.selectedSharedLinePacket?.lineId === state.selectedSharedLineId
    && state.selectedSharedLinePacket?.currentPosition?.lineId === state.selectedSharedLineId
  )
    ? state.selectedSharedLinePacket
    : null;
  const sharedLine = selectedPacket || (
    overviewCatalog.lineId === state.selectedSharedLineId
    && overviewCatalog.currentPosition?.lineId === state.selectedSharedLineId
      ? overviewCatalog
      : null
  );
  const current = sharedLine?.currentPosition || {};
  const lines = overviewCatalog.lines || [];
  const archivedLines = overviewCatalog.archivedLines || [];
  const activeLines = lines.filter((line) => line.status !== "archived");
  const selectedLine = activeLines.find((line) => line.id === state.selectedSharedLineId)
    || (sharedLine?.lines || []).find((line) => line.id === sharedLine?.lineId)
    || {};
  const agentOptions = [
    ...new Set([
      ...activeLines.map((line) => line.agentId || line.metadata?.agentId || ""),
      ...archivedLines.map((line) => line.agentId || line.metadata?.agentId || ""),
      ...(overviewCatalog.agentStates || []).map((item) => item.agentId || "")
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
  const primaryLines = visibleLines.slice(0, SHARED_LINE_PREVIEW_LIMIT);
  const overflowLines = visibleLines.slice(SHARED_LINE_PREVIEW_LIMIT);
  if (sharedLinePrimaryList) {
    sharedLinePrimaryList.innerHTML = renderSharedLineCards(primaryLines)
      || `<div class="endpoint-empty">${escapeHtml(t("sharedLine.linesEmpty"))}</div>`;
  }
  if (sharedLineOverflowList) sharedLineOverflowList.innerHTML = renderSharedLineCards(visibleLines)
    || `<div class="endpoint-empty">${escapeHtml(t("sharedLine.linesEmpty"))}</div>`;
  if (sharedLineAllAction) {
    sharedLineAllAction.hidden = overflowLines.length === 0;
    sharedLineAllAction.textContent = t("sharedLine.viewAllLines", { count: String(visibleLines.length) });
  }
  if (sharedLineActiveCount) sharedLineActiveCount.textContent = t("sharedLine.lineCount", { count: String(visibleLines.length) });
  if (sharedLineOverviewActiveCount) sharedLineOverviewActiveCount.textContent = String(activeLines.length);
  if (sharedLineOverviewArchivedCount) sharedLineOverviewArchivedCount.textContent = String(archivedLines.length);
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
  renderSharedLineAgentState(overviewCatalog, state.activeSharedLineAgentFilter);
  renderSelectedHistory(sharedLine || {});
  if (sharedLineProcessFlow) {
    const steps = [
      [t("sharedLine.process.progress"), (sharedLine?.history || []).length, t("sharedLine.process.progressBody")],
      [t("sharedLine.process.understand"), understanding.length, t("sharedLine.process.understandBody")],
      [t("sharedLine.process.position"), hasSelection ? 1 : 0, t("sharedLine.process.positionBody")],
      [t("sharedLine.process.resume"), current.nextStep || current.metadata?.nextStep ? 1 : 0, t("sharedLine.process.resumeBody")]
    ];
    sharedLineProcessFlow.innerHTML = steps.map(([title, count, description], index) => `<div><span>${index + 1}</span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small><em>${escapeHtml(t("sharedLine.process.count", { count: String(count) }))}</em></div>`).join("");
  }
  if (sharedLineDetailDialog?.open && sharedLineDialogMode) openSharedLineDialog(sharedLineDialogMode);
}

function renderInnerLifeAgentSelector(profiles) {
  if (!innerLifeAgentFilter) return "";
  const available = (profiles || []).filter((profile) => profile?.agentId);
  const ids = available.map((profile) => profile.agentId);
  const selected = ids.includes(state.activeInnerLifeAgentFilter)
    ? state.activeInnerLifeAgentFilter
    : ids[0] || "";
  innerLifeAgentFilter.innerHTML = available
    .map((profile) => `<option value="${escapeHtml(profile.agentId)}">${escapeHtml(profile.agentId)}</option>`)
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

function cleanInnerLifeThought(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(session afterthought|review before sharing|agent profile|profile json|current inner state)\s*:?/i.test(line))
    .map((line) => line
      .replace(/^inner_session_[a-z0-9_-]+\s+/i, "")
      .replace(/^(session|summary)\s*:\s*/i, ""))
    .filter(Boolean)
    .join("\n");
}

function renderInnerLifeThought(share, { shared = false, compact = false } = {}) {
  const evidence = share.deliveryEvidence || {};
  const timestamp = shared
    ? evidence.sharedAt || share.updated_at || share.created_at
    : share.created_at || share.updated_at;
  const stateLabel = shared
    ? t(hasVerifiedInnerLifeDelivery(share) ? "innerLife.thoughtState.shared" : "innerLife.thoughtState.sharedUnverified")
    : unsharedThoughtLabel(share.status);
  const body = cleanInnerLifeThought(share.body) || share.body || "";
  if (compact) {
    return `<button type="button" class="innerlife-archive-row" data-innerlife-open="thought" data-innerlife-share-id="${escapeHtml(share.id)}">
      <span class="innerlife-archive-dot" aria-hidden="true"></span>
      <span class="innerlife-archive-copy"><strong>${escapeHtml(previewInnerLifeText(body, 88))}</strong><small>${escapeHtml(stateLabel)}${timestamp ? ` · ${escapeHtml(formatLocalDateTime(timestamp))}` : ""}</small></span>
      <span aria-hidden="true">→</span>
    </button>`;
  }
  return `
    <button type="button" class="innerlife-thought ${shared ? "is-shared" : ""}" data-innerlife-open="thought" data-innerlife-share-id="${escapeHtml(share.id)}">
      <div class="innerlife-thought-meta">
        <span>${escapeHtml(stateLabel)}</span>
        ${timestamp ? `<time>${escapeHtml(formatLocalDateTime(timestamp))}</time>` : ""}
      </div>
      <p>${escapeHtml(previewInnerLifeText(body, 260))}</p>
      <small class="innerlife-read-more">阅读全文 →</small>
    </button>
  `;
}

function formatInnerLifeInterval(seconds) {
  const value = Number(seconds) || 0;
  if (value >= 3600 && value % 3600 === 0) return `${value / 3600} 小时`;
  if (value >= 60 && value % 60 === 0) return `${value / 60} 分钟`;
  return `${value || 60} 秒`;
}

function renderInnerLifeReaderList(items, { empty = "暂无记录", body = (item) => item.body || item.summary || item.reason || "", meta = (item) => item.status || item.mode || item.source || "" } = {}) {
  if (!items.length) return `<div class="endpoint-empty">${escapeHtml(empty)}</div>`;
  return `<div class="innerlife-reader-list">${items.map((item) => `<article>
    <div><strong>${escapeHtml(innerLifeKindLabel(meta(item)))}</strong><time>${escapeHtml(formatLocalDateTime(item.completedAt || item.createdAt || item.startedAt || item.updated_at))}</time></div>
    <p>${escapeHtml(cleanInnerLifeThought(body(item)) || previewInnerLifeDigest(body(item)) || "-")}</p>
  </article>`).join("")}</div>`;
}

function innerLifeDialogContent(kind, itemId) {
  const model = innerLifeReaderModel;
  if (!model) return null;
  const { selectedProfile, selectedState, unsharedShares, sharedShares, daemon, doctor, doctorItems, sessions, digestRuns, inboxItems, shareChecks, history, experiences, summaries, pollSeconds } = model;
  if (kind === "thought") {
    const share = [...unsharedShares, ...sharedShares].find((item) => String(item.id) === String(itemId));
    if (!share) return null;
    const shared = String(share.status || "").toLowerCase() === "used";
    const evidence = share.deliveryEvidence || {};
    return {
      kicker: shared ? "ARCHIVE" : "THOUGHT",
      title: shared ? "曾经说出口" : "一个正在形成的念头",
      meta: [shared ? (hasVerifiedInnerLifeDelivery(share) ? "已确认送达" : "历史记录，送达未核验") : unsharedThoughtLabel(share.status), formatLocalDateTime(evidence.sharedAt || share.created_at || share.updated_at)].filter(Boolean).join(" · "),
      body: `<article class="innerlife-full-thought"><span aria-hidden="true">“</span><p>${escapeHtml(cleanInnerLifeThought(share.body) || share.body || "-")}</p></article>${shared && hasVerifiedInnerLifeDelivery(share) ? `<section class="innerlife-evidence"><h3>送达依据</h3><p>${escapeHtml(evidence.responseExcerpt || "")}</p><small>${escapeHtml(evidence.conversationId || "")}</small></section>` : ""}`
    };
  }
  if (kind === "unshared-library" || kind === "shared-library") {
    const shared = kind === "shared-library";
    const items = shared ? sharedShares : unsharedShares;
    return {
      kicker: shared ? "ARCHIVE" : "THOUGHT LIBRARY",
      title: shared ? "曾经说出口的记录" : "尚未分享的念头",
      meta: `最近载入 ${items.length} 条 · 点击任一条阅读全文`,
      body: `<div class="innerlife-dialog-index">${items.length ? items.map((item) => renderInnerLifeThought(item, { shared, compact: true })).join("") : `<div class="endpoint-empty">暂无记录</div>`}</div>`
    };
  }
  if (kind === "status") {
    const retrySeconds = Number.parseInt(String(daemon.metadata?.retrySeconds || 0), 10) || 0;
    const failureCount = Number.parseInt(String(daemon.metadata?.failureCount || 0), 10) || 0;
    return {
      kicker: "CURRENT STATE", title: "InnerLife 现在是否正常", meta: "先看结论，需要排查时再进入技术诊断",
      body: `<div class="innerlife-fact-grid">
        <div><span>后台活动</span><strong>${escapeHtml(innerLifeStateLabel(daemon.status || (daemon.enabled ? "enabled" : "paused")) || "-")}</strong></div>
        <div><span>下次检查</span><strong>${escapeHtml(formatLocalDateTime(daemon.nextRunAt) || "-")}</strong></div>
        <div><span>最近结果</span><strong>${escapeHtml(innerLifeLastResultLabel(daemon.lastResult || daemon.lastError))}</strong></div>
        <div><span>整体状态</span><strong>${escapeHtml(innerLifeStateLabel(doctor.status) || doctor.status || "-")}</strong></div>
      </div>${failureCount ? `<p class="innerlife-callout">已经失败 ${failureCount} 次，约 ${retrySeconds} 秒后重试。</p>` : `<p class="innerlife-callout is-ok">当前没有需要处理的恢复任务。</p>`}`
    };
  }
  if (kind === "profile") {
    const policy = selectedProfile?.profile?.share_policy || {};
    const mode = policy.default_mode === "never" ? "默认留在内在活动" : policy.default_mode === "always" ? "符合条件时优先分享" : "与当前对话相关时分享";
    return {
      kicker: "SHARING LOGIC", title: "它怎样决定是否说出口", meta: "参数如何影响实际行为",
      body: `<div class="innerlife-rule-list">
        <section><span>多久醒来检查一次</span><strong>${escapeHtml(formatInnerLifeInterval(pollSeconds))}</strong><p>检查是否有材料等待消化。</p></section>
        <section><span>什么情况下会分享</span><strong>${escapeHtml(mode)}</strong><p>没有合适语境时，念头会继续留在这里。</p></section>
        <section><span>说过以后多久不重复</span><strong>${escapeHtml(`${Number(policy.repeat_cooldown_hours ?? 4)} 小时`)}</strong><p>避免同一类念头反复打断对话。</p></section>
        <section><span>一天最多主动分享</span><strong>${escapeHtml(`${Number(policy.max_proactive_per_day ?? 3)} 次`)}</strong><p>每日主动分享上限。</p></section>
      </div><button type="button" class="innerlife-raw-action" data-innerlife-open="raw-profile">查看原始配置与状态 →</button>`
    };
  }
  if (kind === "raw-profile") {
    return { kicker: "AUDIT", title: "原始配置与状态", meta: "仅用于核对真实数据；完整内容在同一阅读层中展示", body: `<section class="innerlife-raw-section"><h3>Profile JSON</h3><pre>${escapeHtml(JSON.stringify(selectedProfile?.profile || {}, null, 2))}</pre></section><section class="innerlife-raw-section"><h3>State JSON</h3><pre>${escapeHtml(JSON.stringify(selectedState || {}, null, 2))}</pre></section>` };
  }
  if (kind === "activity") {
    return { kicker: "DIGEST", title: "它最近消化出了什么", meta: "变化、经历与稳定认识，按时间自然阅读", body: `<h3>变化</h3>${renderInnerLifeReaderList(history, { empty: "暂无变化" })}<h3>经历</h3>${renderInnerLifeReaderList(experiences, { empty: "暂无经历" })}<h3>稳定认识</h3>${renderInnerLifeReaderList(summaries, { empty: "暂无总结" })}` };
  }
  if (kind === "technical") {
    return { kicker: "DIAGNOSTICS", title: "技术诊断记录", meta: "按时间连续查看全部记录", body: `<h3>状态说明</h3>${renderInnerLifeReaderList(doctorItems, { body: (item) => innerLifeDoctorMessage(item, doctor), meta: (item) => item.level || item.code })}<h3>会话</h3>${renderInnerLifeReaderList(sessions)}<h3>消化任务</h3>${renderInnerLifeReaderList(digestRuns)}<h3>最近输入</h3>${renderInnerLifeReaderList(inboxItems)}<h3>分享时机判断</h3>${renderInnerLifeReaderList(shareChecks)}` };
  }
  return null;
}

function openInnerLifeDetail(kind, itemId = "", { trigger = null, backKind = "" } = {}) {
  const content = innerLifeDialogContent(kind, itemId);
  if (!content || !innerLifeDetailDialog) return;
  if (!innerLifeDetailDialog.open && trigger) innerLifeDialogTrigger = trigger;
  innerLifeDialogKind = kind;
  innerLifeDialogItemId = itemId;
  innerLifeDialogBackKind = backKind;
  innerLifeDetailKicker.textContent = content.kicker;
  innerLifeDetailTitle.textContent = content.title;
  innerLifeDetailMeta.textContent = content.meta;
  innerLifeDetailBody.innerHTML = content.body;
  innerLifeDetailBack.hidden = !backKind;
  if (!innerLifeDetailDialog.open) innerLifeDetailDialog.showModal();
}

function bindInnerLifeReader() {
  const handleOpen = (event) => {
    const action = event.target.closest("[data-innerlife-open]");
    if (!action) return;
    const kind = action.dataset.innerlifeOpen;
    const libraryKind = ["unshared-library", "shared-library"].includes(innerLifeDialogKind) ? innerLifeDialogKind : "";
    const backKind = kind === "raw-profile" ? "profile" : kind === "thought" ? libraryKind : "";
    openInnerLifeDetail(kind, action.dataset.innerlifeShareId || "", { trigger: action, backKind });
  };
  document.querySelector("#innerlifeView .innerlife-reader")?.addEventListener("click", handleOpen);
  innerLifeDetailDialog?.addEventListener("click", handleOpen);
  innerLifeDetailClose?.addEventListener("click", () => innerLifeDetailDialog.close());
  innerLifeDetailBack?.addEventListener("click", () => openInnerLifeDetail(innerLifeDialogBackKind));
  innerLifeDetailDialog?.addEventListener("close", () => {
    const trigger = innerLifeDialogTrigger;
    innerLifeDialogTrigger = null;
    innerLifeDialogKind = "";
    innerLifeDialogBackKind = "";
    requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  });
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

  if (innerLifeFocus) {
    innerLifeFocus.textContent = selectedProfile
      ? previewInnerLifeText(selectedState.recent_focus, 120) || t("innerLife.focusEmpty")
      : t("innerLife.noProfiles");
  }
  if (innerLifeInterests) {
    innerLifeInterests.innerHTML = interests
      .slice(0, 4)
      .map((interest) => `<span>${escapeHtml(previewInnerLifeText(interest, 48))}</span>`)
      .join("");
    innerLifeInterests.hidden = interests.length === 0;
  }
  const selectedRecentShares = selectedProfile ? filterByAgent(innerLife.recentShares || [], selectedAgentId) : [];
  const selectedUnsharedShares = selectedProfile
    ? filterByAgent(innerLife.unsharedShares || innerLife.pendingShares || selectedRecentShares, selectedAgentId)
    : [];
  const selectedSharedShares = selectedProfile
    ? filterByAgent(innerLife.sharedShares || selectedRecentShares, selectedAgentId)
    : [];
  const unsharedShares = selectedUnsharedShares.filter((share) =>
    ["pending", "approved", "deferred"].includes(String(share.status || "").toLowerCase()) &&
    !hasVerifiedInnerLifeDelivery(share)
  );
  // Legacy shares were marked used before delivery evidence existed; keep them
  // visible in the shared list instead of dropping them from both lists.
  const sharedShares = selectedSharedShares.filter((share) => String(share.status || "").toLowerCase() === "used");

  if (innerLifeUnsharedList) {
    innerLifeUnsharedList.innerHTML = unsharedShares.length
      ? unsharedShares.slice(0, 3).map((share) => renderInnerLifeThought(share)).join("")
      : `<div class="endpoint-empty">${escapeHtml(selectedProfile ? t("innerLife.unsharedEmpty") : t("innerLife.noProfiles"))}</div>`;
  }
  if (innerLifeAllUnsharedAction) {
    innerLifeAllUnsharedAction.hidden = unsharedShares.length <= 3;
    innerLifeAllUnsharedAction.textContent = `查看全部 ${unsharedShares.length} 条尚未分享的念头 →`;
  }
  if (innerLifeSharedList) {
    innerLifeSharedList.innerHTML = sharedShares.length
      ? sharedShares.slice(0, 5).map((share) => renderInnerLifeThought(share, { shared: true, compact: true })).join("")
      : `<div class="endpoint-empty">${escapeHtml(t("innerLife.sharedEmpty"))}</div>`;
  }
  if (innerLifeAllSharedAction) {
    innerLifeAllSharedAction.hidden = sharedShares.length <= 5;
    innerLifeAllSharedAction.textContent = `查看最近载入的 ${sharedShares.length} 条分享记录 →`;
  }

  const daemon = innerLife.daemon || {};
  if (innerLifeDaemonStatus) innerLifeDaemonStatus.textContent = innerLifeStateLabel(daemon.status || (daemon.enabled ? "enabled" : "paused")) || "-";
  if (innerLifeNextRun) innerLifeNextRun.textContent = formatLocalDateTime(daemon.nextRunAt) || "-";
  if (innerLifeLastResult) innerLifeLastResult.textContent = innerLifeLastResultLabel(daemon.lastResult || daemon.lastError);
  const doctor = innerLife.doctor || {};
  if (innerLifeDoctorStatus) innerLifeDoctorStatus.textContent = innerLifeStateLabel(doctor.status) || doctor.status || "-";
  const doctorItems = Array.isArray(doctor.issues) && doctor.issues.length
    ? doctor.issues
    : [{ level: "ok", code: "healthy", message: doctor.summary || t("innerLife.doctorEmpty") }];
  const sessions = filterByAgent(innerLife.sessions || [], selectedAgentId);
  const digestRuns = filterByAgent(innerLife.digestRuns || [], selectedAgentId);
  const inboxItems = filterByAgent(innerLife.inbox || [], selectedAgentId);
  const shareChecks = filterByAgent(innerLife.shareChecks || [], selectedAgentId);
  const history = filterByAgent(innerLife.history || [], selectedAgentId);
  const experiences = filterByAgent(innerLife.experiences || [], selectedAgentId);
  const summaries = filterByAgent(innerLife.summaries || [], selectedAgentId);
  const pollSeconds = snapshot?.configuration?.innerlife?.pollSeconds || 60;
  innerLifeReaderModel = { selectedProfile, selectedState, unsharedShares, sharedShares, daemon, doctor, doctorItems, sessions, digestRuns, inboxItems, shareChecks, history, experiences, summaries, pollSeconds };

  if (innerLifeProcessFlow) {
    const steps = [
      ["输入进入", inboxItems.length, "最近收到的材料", "technical"],
      ["后台消化", digestRuns.length, "整理经历和变化", "activity"],
      ["形成念头", unsharedShares.length, "先留在心里", "unshared-library"],
      ["判断场合", shareChecks.length, "检查当下是否合适", "technical"],
      ["带入对话", sharedShares.length, "有依据的分享记录", "shared-library"]
    ];
    innerLifeProcessFlow.innerHTML = steps.map(([title, count, description, target], index) => `<button type="button" data-innerlife-open="${target}"><span>${index + 1}</span><strong>${title}</strong><small>${description}</small><em>最近 ${count} 条</em></button>`).join("");
  }
  if (innerLifeDetailDialog?.open && innerLifeDialogKind) openInnerLifeDetail(innerLifeDialogKind, innerLifeDialogItemId, { backKind: innerLifeDialogBackKind });
}

  bindSharedLineReader();
  bindInnerLifeReader();

  return {
    renderMemoryList,
    renderSharedLine,
    renderInnerLife
  };
}

window.createClaraCoreSharedInnerLifeView = createClaraCoreSharedInnerLifeView;
