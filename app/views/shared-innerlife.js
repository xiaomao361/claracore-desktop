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
    sharedLineActiveCount, sharedLineOverviewActiveCount, sharedLineOverviewArchivedCount,
    sharedLineAgentFilter, sharedLineDetailTitle, sharedLineParticipants, sharedLineContinuityPath,
    sharedLineUnderstandingSection, sharedLineUnderstanding, sharedLineUnresolvedSection, sharedLineUnresolved,
    sharedLineReferencesSection, sharedLineReferences,
    sharedLineAgentStatePanel, sharedLineMetadataPanel, sharedLineHistoryList, sharedLineSnapshotList, sharedLineArchiveList,
    sharedLineDetailDialog, sharedLineDialogClose, sharedLineDialogKicker, sharedLineDialogTitle, sharedLineDialogMeta,
    sharedLineDialogLines, sharedLineDialogAgents, sharedLineDialogEvidence, sharedLineDialogArchive,
    innerLifeAgentFilter, innerLifeFocus, innerLifeInterests,
    innerLifeUnsharedList, innerLifeAllUnsharedAction, innerLifeSharedList, innerLifeAllSharedAction,
    innerLifeDaemonStatus, innerLifeNextRun, innerLifeLastResult,
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
  let innerLifeTextPage = null;
  let innerLifeTextRevision = 0;
  function innerLifeMore(key) {
    const page = state.innerLifeSnapshot?.[`${key}Page`];
    return `${state.innerLifePageError === key ? `<p role="alert">${escapeHtml(t("review.pageFailed"))}</p>` : ""}${page?.hasMore ? `<button type="button" class="ghost-button" data-innerlife-more="${key}">${escapeHtml(t("review.loadMore"))}</button>` : ""}`;
  }


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
  const known = { daemon_retrying: "review.daemonRetry", afterthought_terminal_failure: "review.afterthoughtFailed", afterthought_retrying: "review.afterthoughtRetry", missing_model: "review.modelMissing" };
  return known[code] ? t(known[code]) : issue?.message || doctor?.summary || t("review.unknownState");
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
    ? items.map((item) => decorated
      ? `<p>${renderReadableText(item, "•") || escapeHtml(item)}</p>`
      : `<div class="reading-prose">${window.ClaraCoreKnowledgeMarkdown.render(item, "", { reading: true, linkMode: "text" })}</div>`).join("")
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
    lines: [t("review.activeLines"), t("sharedLine.dialog.linesTitle"), t("sharedLine.dialog.linesMeta")],
    agents: [t("review.agentContext"), t("sharedLine.agentContext"), t("sharedLine.agentContextBody")],
    evidence: [t("review.lineEvidence"), t("sharedLine.dialog.evidenceTitle"), t("sharedLine.advanced.body")],
    archive: [t("review.archive"), t("sharedLine.pastLines"), t("sharedLine.reading.archiveBody")]
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
  const overviewCatalog = state.sharedLineCatalog || snapshot?.sharedLine || {};
  const selectedPacket = (
    state.selectedSharedLinePacket?.lineId === state.selectedSharedLineId
    && state.selectedSharedLinePacket?.currentPosition?.lineId === state.selectedSharedLineId
  )
    ? state.selectedSharedLinePacket
    : null;
  const sharedLine = selectedPacket || (
    overviewCatalog.overview !== true
    && overviewCatalog.lineId === state.selectedSharedLineId
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
      ...(overviewCatalog.agents || []),
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
    sharedLineAllAction.hidden = overflowLines.length === 0 && !overviewCatalog.linesPage?.hasMore;
    sharedLineAllAction.textContent = t("sharedLine.viewAllLines", { count: String(overviewCatalog.linesPage?.total ?? visibleLines.length) });
  }
  if (sharedLineActiveCount) sharedLineActiveCount.textContent = t("sharedLine.lineCount", { count: String(overviewCatalog.linesPage?.total ?? visibleLines.length) });
  if (sharedLineOverviewActiveCount) sharedLineOverviewActiveCount.textContent = String(overviewCatalog.linesPage?.total ?? activeLines.length);
  if (sharedLineOverviewArchivedCount) sharedLineOverviewArchivedCount.textContent = String(overviewCatalog.archivedLinesPage?.total ?? archivedLines.length);
  renderArchivedLines(visibleArchivedLines);

  const hasSelection = Boolean(sharedLine?.lineId && current.lineId === sharedLine.lineId
    && (!state.activeSharedLineAgentFilter || (current.agentId || sharedLine.agentId || selectedLine.agentId) === state.activeSharedLineAgentFilter));
  const readFailed = state.sharedLineReadStatus === "error";
  const readLoading = state.sharedLineReadStatus === "loading";
  if (dom.sharedLineResume) dom.sharedLineResume.disabled = !hasSelection || state.sharedLineReadStatus !== "ready" || state.sharedLineCopying === true || !String(current.summary || "").trim();
  if (dom.sharedLineRetry) {
    dom.sharedLineRetry.hidden = !readFailed;
    dom.sharedLineRetry.disabled = readLoading;
  }
  if (sharedLineContinuityPath) sharedLineContinuityPath.hidden = !hasSelection;
  sharedLineDetailTitle.textContent = hasSelection
    ? selectedLine.title || current.lineTitle || sharedLine.lineTitle || sharedLine.lineId
    : t(readLoading ? "sharedLine.detail.loadingTitle" : "sharedLine.detail.emptyTitle");
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
  // Only the selected current position defines its current plan. In particular,
  // an explicit empty nextStep cannot resurrect an old handoff or metadata plan.
  const nextStep = Object.hasOwn(current, "nextStep") ? current.nextStep : current.metadata?.nextStep;
  const nextValues = typeof nextStep === "string" && nextStep.trim() ? [nextStep] : [];
  if (sharedLineNext?.closest(".stage-next")) sharedLineNext.closest(".stage-next").hidden = !hasSelection || !nextValues.length;
  renderPrimaryValues(sharedLineNext, nextValues, "sharedLine.nextEmpty", false);
  if (dom.sharedLineRecordState) {
    const statusKey = ["draft", "needs_review", "stale"].includes(current.interpretationStatus) ? current.interpretationStatus : "";
    dom.sharedLineRecordState.textContent = hasSelection && statusKey ? t(`sharedLine.recordState.${statusKey}`) : "";
  }
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

  const references = (Array.isArray(current.factsUsed)
    ? current.factsUsed
    : Array.isArray(current.metadata?.factsUsed) ? current.metadata.factsUsed : [])
    .filter((reference) => typeof reference === "string" && reference.trim());
  if (sharedLineReferencesSection) sharedLineReferencesSection.hidden = !hasSelection || !references.length;
  if (sharedLineReferences) sharedLineReferences.innerHTML = hasSelection
    ? references.map((reference) => `<li>${escapeHtml(reference)}</li>`).join("")
    : "";

  const catalogNotice = state.sharedLineCatalogLoading ? `<p role="status">${escapeHtml(t("runtime.loading"))}</p>`
    : state.sharedLineCatalogError ? `<p role="alert">${escapeHtml(t("review.pageFailed"))}</p><button type="button" data-shared-line-retry-catalog>${escapeHtml(t("review.retry"))}</button>` : "";
  if (sharedLinePrimaryList) sharedLinePrimaryList.insertAdjacentHTML("beforeend", catalogNotice);
  if (sharedLineOverflowList) sharedLineOverflowList.insertAdjacentHTML("beforeend", catalogNotice + (overviewCatalog.linesPage?.hasMore ? `<button type="button" data-shared-line-more="active">${escapeHtml(t("review.loadMore"))}</button>` : ""));
  if (sharedLineArchiveList) sharedLineArchiveList.insertAdjacentHTML("beforeend", catalogNotice + (overviewCatalog.archivedLinesPage?.hasMore ? `<button type="button" data-shared-line-more="archived">${escapeHtml(t("review.loadMore"))}</button>` : ""));

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
      <small class="innerlife-read-more">${escapeHtml(t("review.readFull"))}</small>
    </button>
  `;
}

function formatInnerLifeInterval(seconds) {
  const value = Number(seconds) || 0;
  if (value >= 3600 && value % 3600 === 0) return t("review.hours", { count: value / 3600 });
  if (value >= 60 && value % 60 === 0) return t("review.minutes", { count: value / 60 });
  return t("review.seconds", { count: value || 60 });
}

function renderInnerLifeReaderList(items, { empty = t("review.noRecords"), body = (item) => item.body || item.summary || item.reason || "", meta = (item) => item.status || item.mode || item.source || "" } = {}) {
  if (!items.length) return `<div class="endpoint-empty">${escapeHtml(empty)}</div>`;
  return `<div class="innerlife-reader-list">${items.map((item) => `<article>
    <div><strong>${escapeHtml(innerLifeKindLabel(meta(item)))}</strong><time>${escapeHtml(formatLocalDateTime(item.completedAt || item.createdAt || item.startedAt || item.updated_at))}</time></div>
    <p style="white-space: pre-wrap">${escapeHtml(body(item) || "-")}</p>
    ${item.truncated ? `<button type="button" data-innerlife-open="record-${item.source === "digest" ? "digest" : item.shareId ? "thought" : "event"}" data-innerlife-share-id="${escapeHtml(item.id)}">${escapeHtml(t("review.readFull"))}</button>` : ""}
  </article>`).join("")}</div>`;
}

function innerLifeDialogContent(kind, itemId) {
  const model = innerLifeReaderModel;
  if (!model) return null;
  const { selectedProfile, selectedState, unsharedShares, sharedShares, daemon, doctor, doctorItems, sessions, digestRuns, inboxItems, shareChecks, history, experiences, summaries, pollSeconds } = model;
  if (kind === "thought" || kind.startsWith("record-")) {
    const page = innerLifeTextPage?.agentId && innerLifeTextPage.agentId !== state.activeInnerLifeAgentFilter ? null : innerLifeTextPage;
    const body = page?.status === "ready"
      ? `<article class="innerlife-full-thought"><p style="white-space: pre-wrap">${escapeHtml(page.body || "-")}</p></article><div class="innerlife-text-pages">${page.offset ? `<button type="button" data-innerlife-text-offset="${Math.max(0, page.offset - 16000)}">${escapeHtml(t("review.previous"))}</button>` : ""}${page.hasMore ? `<button type="button" data-innerlife-text-offset="${page.nextOffset}">${escapeHtml(t("review.next"))}</button>` : ""}</div>`
      : `<p role="status">${escapeHtml(t(page?.status === "error" ? "review.pageFailed" : "runtime.loading"))}</p>${page?.status === "error" ? `<button type="button" data-innerlife-text-offset="${page.offset || 0}">${escapeHtml(t("review.retry"))}</button>` : ""}`;
    const share = [...unsharedShares, ...sharedShares].find(item => item.id === itemId);
    const evidence = share?.deliveryEvidence;
    return { kicker: t("review.original"), title: t("review.readFull"),
      meta: page?.status === "ready" && (page.hasMore || page.offset) ? t("review.textRange", { from: page.offset + 1, to: page.nextOffset, total: page.total }) : t("review.original"),
      body: body + (share && hasVerifiedInnerLifeDelivery(share) ? `<section class="innerlife-evidence"><h3>${escapeHtml(t("review.deliveryEvidence"))}</h3><p>${escapeHtml(evidence.responseExcerpt || "")}</p><small>${escapeHtml(evidence.conversationId || "")}</small></section>` : "") };
  }
  if (kind === "unshared-library" || kind === "shared-library") {
    const shared = kind === "shared-library";
    const items = shared ? sharedShares : unsharedShares;
    return {
      kicker: shared ? t("review.archive") : t("review.thoughtLibrary"),
      title: shared ? t("review.sharedRecords") : t("review.unsharedRecords"),
      meta: t("review.loaded", { count: items.length }),
      body: `<div class="innerlife-dialog-index">${items.length ? items.map((item) => renderInnerLifeThought(item, { shared, compact: true })).join("") : `<div class="endpoint-empty">${escapeHtml(t("review.noRecords"))}</div>`}</div>${innerLifeMore(shared ? "sharedShares" : "unsharedShares")}`
    };
  }
  if (kind === "status") {
    const retrySeconds = Number.parseInt(String(daemon.metadata?.retrySeconds || 0), 10) || 0;
    const failureCount = Number.parseInt(String(daemon.metadata?.failureCount || 0), 10) || 0;
    const needsRecovery = failureCount > 0 || Boolean(daemon.lastError) || ["error", "failed"].includes(daemon.status)
      || (doctor.issues || []).some(issue => issue.level !== "ok" && issue.level !== "info");
    const recovery = needsRecovery ? t("review.recoveryNeeded") : doctor.status === "ok" ? t("review.recoveryClear") : t("review.unknownState");
    return {
      kicker: t("review.currentState"), title: t("review.statusTitle"), meta: t("review.statusIntro"),
      body: `<div class="innerlife-fact-grid">
        <div><span>${escapeHtml(t("review.background"))}</span><strong>${escapeHtml(innerLifeStateLabel(daemon.status || (daemon.enabled ? "enabled" : "paused")) || "-")}</strong></div>
        <div><span>${escapeHtml(t("review.nextCheck"))}</span><strong>${escapeHtml(formatLocalDateTime(daemon.nextRunAt) || "-")}</strong></div>
        <div><span>${escapeHtml(t("review.lastResult"))}</span><strong>${escapeHtml(innerLifeLastResultLabel(daemon.lastResult || daemon.lastError))}</strong></div>
        <div><span>${escapeHtml(t("review.overallStatus"))}</span><strong>${escapeHtml(innerLifeStateLabel(doctor.status) || doctor.status || "-")}</strong></div>
      </div>${`<p class="innerlife-callout ${!needsRecovery && doctor.status === "ok" ? "is-ok" : ""}">${escapeHtml(recovery)}${failureCount && retrySeconds ? ` ${escapeHtml(t("review.retryState", { count: failureCount, seconds: retrySeconds }))}` : ""}</p>`}`
    };
  }
  if (kind === "profile") {
    const policy = selectedProfile?.profile?.share_policy || {};
    const mode = policy.default_mode === "never" ? t("review.neverShare") : policy.default_mode === "always" ? t("review.alwaysShare") : t("review.relevantShare");
    return {
      kicker: t("review.sharingLogic"), title: t("review.shareTitle"), meta: t("review.shareIntro"),
      body: `<div class="innerlife-rule-list">
        <section><span>${escapeHtml(t("review.wakeFrequency"))}</span><strong>${escapeHtml(formatInnerLifeInterval(pollSeconds))}</strong><p>${escapeHtml(t("review.wakeDescription"))}</p></section>
        <section><span>${escapeHtml(t("review.shareConditions"))}</span><strong>${escapeHtml(mode)}</strong><p>${escapeHtml(t("review.shareDescription"))}</p></section>
        <section><span>${escapeHtml(t("review.repeatCooldown"))}</span><strong>${escapeHtml(t("review.hours", { count: Number(policy.repeat_cooldown_hours ?? 4) }))}</strong><p>${escapeHtml(t("review.repeatDescription"))}</p></section>
        <section><span>${escapeHtml(t("review.dailyLimit"))}</span><strong>${escapeHtml(t("review.times", { count: Number(policy.max_proactive_per_day ?? 3) }))}</strong><p>${escapeHtml(t("review.dailyDescription"))}</p></section>
      </div><button type="button" class="innerlife-raw-action" data-innerlife-open="raw-profile">${escapeHtml(t("review.rawAction"))}</button>`
    };
  }
  if (kind === "raw-profile") {
    return { kicker: t("review.audit"), title: t("review.rawTitle"), meta: t("review.rawIntro"), body: `<section class="innerlife-raw-section"><h3>Profile JSON</h3><pre>${escapeHtml(JSON.stringify(selectedProfile?.profile || {}, null, 2))}</pre></section><section class="innerlife-raw-section"><h3>State JSON</h3><pre>${escapeHtml(JSON.stringify(selectedState || {}, null, 2))}</pre></section>` };
  }
  if (kind === "activity") {
    return { kicker: t("review.digest"), title: t("review.activityTitle"), meta: t("review.recentActivity"), body: `<h3>${escapeHtml(t("review.changes"))}</h3>${renderInnerLifeReaderList(history, { empty: t("review.noChanges") })}<h3>${escapeHtml(t("review.experiences"))}</h3>${renderInnerLifeReaderList(experiences, { empty: t("review.noExperiences") })}<h3>${escapeHtml(t("review.summaries"))}</h3>${renderInnerLifeReaderList(summaries, { empty: t("review.noSummaries") })}` };
  }
  if (kind === "technical") {
    return { kicker: t("review.diagnosticKicker"), title: t("review.technicalTitle"), meta: t("review.recentTechnical"), body: `<h3>${escapeHtml(t("review.statusDetails"))}</h3>${renderInnerLifeReaderList(doctorItems, { body: (item) => [innerLifeDoctorMessage(item, doctor), item.action].filter(Boolean).join("\n"), meta: (item) => item.level || item.code })}<h3>${escapeHtml(t("review.sessions"))}</h3>${renderInnerLifeReaderList(sessions)}${innerLifeMore("sessions")}<h3>${escapeHtml(t("review.digests"))}</h3>${renderInnerLifeReaderList(digestRuns)}${innerLifeMore("digestRuns")}<h3>${escapeHtml(t("review.inputs"))}</h3>${renderInnerLifeReaderList(inboxItems)}${innerLifeMore("inbox")}<h3>${escapeHtml(t("review.timingChecks"))}</h3>${renderInnerLifeReaderList(shareChecks)}` };
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
  if (innerLifeDetailBody.innerHTML !== content.body) innerLifeDetailBody.innerHTML = content.body;
  innerLifeDetailBack.hidden = !backKind;
  if (!innerLifeDetailDialog.open) innerLifeDetailDialog.showModal();
}

async function readInnerLifeText(kind, itemId, offset = 0) {
  const request = ++innerLifeTextRevision;
  const agentId = state.activeInnerLifeAgentFilter;
  innerLifeTextPage = { status: "loading", offset };
  openInnerLifeDetail(kind, itemId, { backKind: innerLifeDialogBackKind });
  try {
    const page = await window.ClaraCoreDesktop.getInnerLifeText({ id: itemId, agentId, kind: kind === "thought" ? "share" : kind.slice(7), offset });
    if (request !== innerLifeTextRevision || agentId !== state.activeInnerLifeAgentFilter || kind !== innerLifeDialogKind || itemId !== innerLifeDialogItemId) return;
    if (page.id !== itemId || page.agentId !== agentId) throw new Error("InnerLife text scope mismatch.");
    innerLifeTextPage = { ...page, status: "ready" };
  } catch (error) {
    if (request !== innerLifeTextRevision || agentId !== state.activeInnerLifeAgentFilter || kind !== innerLifeDialogKind || itemId !== innerLifeDialogItemId) return;
    console.error(error);
    innerLifeTextPage = { status: "error", offset };
  }
  openInnerLifeDetail(kind, itemId, { backKind: innerLifeDialogBackKind });
}

function bindInnerLifeReader() {
  const handleOpen = (event) => {
    const page = event.target.closest("[data-innerlife-text-offset]");
    if (page) { readInnerLifeText(innerLifeDialogKind, innerLifeDialogItemId, Number(page.dataset.innerlifeTextOffset)); return; }
    const action = event.target.closest("[data-innerlife-open]");
    if (!action) return;
    const kind = action.dataset.innerlifeOpen;
    const libraryKind = ["unshared-library", "shared-library"].includes(innerLifeDialogKind) ? innerLifeDialogKind : "";
    const backKind = kind === "raw-profile" ? "profile" : kind === "thought" ? libraryKind : "";
    innerLifeTextRevision += 1;
    innerLifeTextPage = null;
    openInnerLifeDetail(kind, action.dataset.innerlifeShareId || "", { trigger: action, backKind });
    if (kind === "thought" || kind.startsWith("record-")) readInnerLifeText(kind, action.dataset.innerlifeShareId);
  };
  document.querySelector("#innerlifeView .innerlife-reader")?.addEventListener("click", handleOpen);
  innerLifeDetailDialog?.addEventListener("click", handleOpen);
  innerLifeDetailClose?.addEventListener("click", () => innerLifeDetailDialog.close());
  innerLifeDetailBack?.addEventListener("click", () => openInnerLifeDetail(innerLifeDialogBackKind));
  innerLifeDetailDialog?.addEventListener("close", () => {
    const trigger = innerLifeDialogTrigger;
    innerLifeDialogTrigger = null;
    innerLifeTextRevision += 1;
    innerLifeTextPage = null;
    innerLifeDialogKind = "";
    innerLifeDialogBackKind = "";
    requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  });
}

function renderInnerLife() {
  const snapshot = getSnapshot();
  const source = state.innerLifeSnapshot || snapshot?.innerLife || {};
  let innerLife = state.innerLifeLoadStatus === "loading" || state.innerLifeLoadStatus === "error"
    ? { profiles: source.profiles || [] } : source;
  const profiles = Array.isArray(innerLife.profiles) ? innerLife.profiles : [];
  const selectedAgentId = renderInnerLifeAgentSelector(profiles);
  if (innerLife.agentId !== selectedAgentId && innerLife.daemon?.agentId !== selectedAgentId) innerLife = { profiles };
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
  if (state.innerLifeLoadStatus === "loading" || state.innerLifeLoadStatus === "error") {
    innerLifeUnsharedList.innerHTML = `<p role="status">${escapeHtml(t(state.innerLifeLoadStatus === "error" ? "review.pageFailed" : "runtime.loading"))}</p>${state.innerLifeLoadStatus === "error" ? `<button type="button" data-innerlife-retry>${escapeHtml(t("review.retry"))}</button>` : ""}`;
  }
  if (innerLifeAllUnsharedAction) {
    innerLifeAllUnsharedAction.hidden = unsharedShares.length <= 3 && !innerLife.unsharedSharesPage?.hasMore;
    innerLifeAllUnsharedAction.textContent = t("review.unsharedCount", { count: innerLife.unsharedSharesPage?.total ?? unsharedShares.length });
  }
  if (innerLifeSharedList) {
    innerLifeSharedList.innerHTML = sharedShares.length
      ? sharedShares.slice(0, 5).map((share) => renderInnerLifeThought(share, { shared: true, compact: true })).join("")
      : `<div class="endpoint-empty">${escapeHtml(t("innerLife.sharedEmpty"))}</div>`;
  }
  if (innerLifeAllSharedAction) {
    innerLifeAllSharedAction.hidden = sharedShares.length <= 5 && !innerLife.sharedSharesPage?.hasMore;
    innerLifeAllSharedAction.textContent = t("review.sharedCount", { count: innerLife.sharedSharesPage?.total ?? sharedShares.length });
  }

  const scopeMatches = innerLife.agentId === selectedAgentId || innerLife.daemon?.agentId === selectedAgentId;
  const daemon = scopeMatches ? innerLife.daemon || {} : {};
  if (innerLifeDaemonStatus) innerLifeDaemonStatus.textContent = scopeMatches ? innerLifeStateLabel(daemon.status || (daemon.enabled ? "enabled" : "paused")) || "-" : t("review.unknownState");
  if (innerLifeNextRun) innerLifeNextRun.textContent = formatLocalDateTime(daemon.nextRunAt) || "-";
  if (innerLifeLastResult) innerLifeLastResult.textContent = innerLifeLastResultLabel(daemon.lastResult || daemon.lastError);
  const doctor = scopeMatches ? innerLife.doctor || {} : {};
  if (innerLifeDoctorStatus) innerLifeDoctorStatus.textContent = innerLifeStateLabel(doctor.status) || doctor.status || "-";
  const doctorItems = Array.isArray(doctor.issues) && doctor.issues.length
    ? doctor.issues
    : doctor.status === "ok" ? [{ level: "ok", code: "healthy", message: doctor.summary || t("innerLife.doctorEmpty") }] : [{ level: "unknown", code: "unknown", message: t("review.unknownState") }];
  const sessions = filterByAgent(innerLife.sessions || [], selectedAgentId);
  const digestRuns = filterByAgent(innerLife.digestRuns || [], selectedAgentId);
  const inboxItems = filterByAgent(innerLife.inbox || [], selectedAgentId);
  const shareChecks = filterByAgent(innerLife.shareChecks || [], selectedAgentId);
  const history = filterByAgent(innerLife.history || [], selectedAgentId);
  const experiences = filterByAgent(innerLife.experiences || [], selectedAgentId);
  const summaries = filterByAgent(innerLife.summaries || [], selectedAgentId);
  const pollSeconds = snapshot?.configuration?.innerlife?.pollSeconds || 60;
  innerLifeReaderModel = { selectedProfile, selectedState, unsharedShares, sharedShares, daemon, doctor, doctorItems, sessions, digestRuns, inboxItems, shareChecks, history, experiences, summaries, pollSeconds };

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
