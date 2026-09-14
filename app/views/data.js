function createClaraCoreDataView({ dom, t, escapeHtml, formatBytes, formatLocalDateTime, getSnapshot, refresh, showCopyNotice }) {
  let pendingRestoreBackupId = null;
  let showAllBackups = false;
  let backupPolicyDirty = false;
  let operationalParts = null;

  function renderBackupPolicy() {
    if (!dom.backupPolicyForm || backupPolicyDirty) return;
    const policy = getSnapshot()?.configuration?.backup || {};
    dom.backupSchedule.value = policy.enabled === false ? "manual" : policy.schedule || "manual";
    dom.backupHour.value = policy.hour ?? 3;
    dom.backupRetention.value = policy.retentionDays ?? 7;
    dom.backupMirror.value = policy.mirrorDir || "";
  }

  async function saveBackupPolicy(event) {
    event.preventDefault();
    if (!dom.backupPolicyForm.reportValidity()) return;
    dom.saveBackupPolicy.disabled = true;
    let saved = false;
    try {
      const result = await window.ClaraCoreDesktop.saveSettings({
        "backup.enabled": true,
        "backup.schedule": dom.backupSchedule.value,
        "backup.retention_days": Number(dom.backupRetention.value),
        "backup.mirror_dir": dom.backupMirror.value,
        "memory.maintenance.hour": Number(dom.backupHour.value)
      });
      if (!result?.configuration) throw new Error(t("data.backupPolicyFailed"));
      saved = true;
      backupPolicyDirty = false;
      await refresh();
      dom.backupPolicyNotice.textContent = t("data.backupPolicySaved");
    } catch (error) {
      console.error(error);
      dom.backupPolicyNotice.textContent = t(saved ? "data.backupPolicyRefreshFailed" : "data.backupPolicyFailed");
    } finally {
      dom.saveBackupPolicy.disabled = false;
    }
  }

  function fileNameFromPath(value) {
    return String(value || "").split(/[\\/]/).filter(Boolean).pop() || "";
  }

  function renderOperationalStatus() {
    if (!dom.operationalStatus) return;
    const snapshot = getSnapshot();
    const status = snapshot?.operationalStatus;
    if (!status) { dom.operationalStatus.textContent = t("data.statusLoading"); operationalParts = null; return; }
    const event = status.backup.event;
    const policy = snapshot.configuration?.backup || {};
    const vectors = status.vectors;
    const protocol = snapshot.connections?.httpGateway?.lastProtocolRequest;
    const rows = [
      [t("data.lastVerified"), status.backup.lastVerifiedAt ? formatLocalDateTime(status.backup.lastVerifiedAt) : t("data.noVerified")],
      [t("data.lastDaily"), status.backup.lastCompletedDay || t("data.noVerified")],
      [t("data.backupOutcome"), !event ? t("data.noBackupOutcome") :
        event.level === "error" ? t(`data.backupFailure.${event.stage || "local"}`) :
        event.pending ? t("data.cleanupPending") : t("data.backupComplete")],
      [t("data.mirrorOutcome"), !policy.mirrorDir ? t("data.localOnly") :
        event?.mirrorPath && event.level !== "error" && event.mirrorPath.replace(/[\\/][^\\/]+$/, "") === policy.mirrorDir.replace(/[\\/]+$/, "")
          ? t("data.mirrorVerified") : t("data.mirrorUnverified")],
      [t("data.vectorCoverage"), vectors.enabled ? `${vectors.ready} / ${vectors.total}` : t("data.vectorDisabled")],
      [t("data.vectorSearch"), !vectors.lastSearch ? t("data.noSearch") : vectors.lastSearch.status === "failed" ? t("data.searchFailed") : t("data.searchReady")],
      [t("data.protocolObserved"), protocol ? `${protocol.agentId} · ${protocol.version} · ${formatLocalDateTime(protocol.at)}` : t("data.noProtocol")]
    ];
    if (vectors.enabled && vectors.ready < vectors.total) rows.push([t("data.vectorAction"), t("data.vectorActionBody")]);
    if (event) rows.push([t("data.backupCheckedAt"), formatLocalDateTime(event.at)]);
    const mirrorVerified = Boolean(policy.mirrorDir && event?.mirrorPath && event.level !== "error"
      && event.mirrorPath.replace(/[\\/][^\\/]+$/, "") === policy.mirrorDir.replace(/[\\/]+$/, ""));
    const backupTone = event?.level === "error" ? "error" : event?.pending ? "warn" : event ? "ok" : "neutral";
    const searchFailed = vectors.enabled && vectors.lastSearch?.status === "failed";
    const vectorTone = !vectors.enabled || !vectors.total ? "neutral" : searchFailed ? "error" : vectors.ready < vectors.total ? "warn" : "ok";
    const card = (label, tone, badge, value, note, extra = "") =>
      `<article class="runtime-status-card"><header><h4>${escapeHtml(label)}</h4><span class="runtime-status-badge is-${tone}">${escapeHtml(badge)}</span></header><strong class="runtime-status-value">${escapeHtml(String(value))}</strong><p class="runtime-status-note">${escapeHtml(note)}</p>${extra}</article>`;
    const cards = [
      card(t("data.compact.backup"), backupTone, t(`data.compact.${backupTone === "error" ? "failed" : backupTone === "warn" ? "pendingCleanup" : backupTone === "ok" ? "completed" : "unrecorded"}`),
        status.backup.lastVerifiedAt ? formatLocalDateTime(status.backup.lastVerifiedAt) : t("data.noVerified"),
        t(`data.compact.${!policy.mirrorDir ? "localOnly" : mirrorVerified ? "mirrorVerified" : "mirrorPending"}`)),
      card(t("data.compact.vectors"), vectorTone, t(`data.compact.${!vectors.enabled ? "disabled" : searchFailed ? "searchFailed" : !vectors.total ? "unrecorded" : vectors.ready < vectors.total ? "incomplete" : "covered"}`),
        vectors.enabled ? `${vectors.ready} / ${vectors.total}` : "—",
        t(`data.compact.${!vectors.enabled ? "keywordOnly" : !vectors.lastSearch ? "noSearch" : searchFailed ? "keywordFallback" : "searchReady"}`),
        vectors.enabled && vectors.total > 0 ? `<meter class="runtime-status-meter" min="0" max="${Number(vectors.total)}" value="${Number(vectors.ready)}" aria-label="${escapeHtml(t("data.vectorCoverage"))}"></meter>` : ""),
      card("MCP", "neutral", t("data.compact.recentRequest"), protocol?.version || "—",
        protocol ? `${protocol.agentId} · ${formatLocalDateTime(protocol.at)}` : t("data.noProtocol"))
    ].join("");
    const alerts = [];
    if (event?.level === "error") alerts.push(t(`data.backupFailure.${event.stage || "local"}`));
    else if (event?.pending) alerts.push(t("data.cleanupPending"));
    if (searchFailed) alerts.push(t("data.searchFailed"));
    if (vectors.enabled && vectors.ready < vectors.total) alerts.push(t("data.vectorActionBody"));
    const details = rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join("");
    // Keep the native disclosure node stable across polling, including focus and open state.
    if (!operationalParts) {
      dom.operationalStatus.innerHTML = `<h3 class="section-title" data-status-title></h3><div class="runtime-status-grid" data-status-cards></div><div class="runtime-status-alerts" data-status-alerts role="status"></div><details class="runtime-status-details"><summary data-status-summary></summary><dl data-status-details></dl></details>`;
      operationalParts = Object.fromEntries(["title", "cards", "alerts", "summary", "details"].map(name => [name, dom.operationalStatus.querySelector(`[data-status-${name}]`)]));
    }
    operationalParts.title.textContent = t("data.runtimeStatus");
    operationalParts.summary.textContent = t("data.compact.details");
    const update = (node, html) => { if (node.innerHTML !== html) node.innerHTML = html; };
    update(operationalParts.cards, cards);
    update(operationalParts.alerts, alerts.map(message => `<p>${escapeHtml(message)}</p>`).join(""));
    operationalParts.alerts.hidden = alerts.length === 0;
    update(operationalParts.details, details);
  }

  function renderBackups() {
    renderOperationalStatus();
    renderBackupPolicy();
    const backups = getSnapshot()?.backups || [];
    const visibleBackups = showAllBackups ? backups : backups.slice(0, 3);
    dom.backupList.classList.toggle("expanded", showAllBackups && backups.length > 3);
    dom.backupListToggle.hidden = backups.length <= 3;
    dom.backupListToggle.textContent = showAllBackups
      ? t("data.collapseBackups")
      : `${t("data.showAllBackups")} (${backups.length})`;
    if (backups.length === 0) {
      dom.backupList.innerHTML = `<div class="endpoint-empty">${t("data.noBackups")}</div>`;
      return;
    }
    dom.backupList.innerHTML = visibleBackups
      .map((backup) => {
        const manifestPath = backup.metadata?.manifestPath || "";
        const quickCheck = backup.metadata?.verification?.quickCheck || "";
        const backupFile = fileNameFromPath(backup.path);
        const statusLabel = backup.status === "verified" ? t("data.verified") : backup.status || "";
        return `
          <div class="backup-item ${escapeHtml(backup.status || "")}" data-backup-id="${escapeHtml(backup.id || "")}">
            <div class="backup-item-heading">
              <div>
                <strong>${escapeHtml(formatLocalDateTime(backup.created_at))}</strong>
                <span class="backup-status">${escapeHtml(statusLabel)}</span>
              </div>
              <div class="backup-actions">
                ${
                  backup.status === "verified"
                    ? `<button class="secondary" data-backup-action="restore" data-backup-id="${escapeHtml(backup.id)}">${t("actions.restore")}</button>`
                    : ""
                }
                <button class="secondary danger-button" data-backup-action="delete" data-backup-id="${escapeHtml(backup.id)}">${t("actions.delete")}</button>
              </div>
            </div>
            <div class="backup-file-row" title="${escapeHtml([backup.path, manifestPath].filter(Boolean).join("\n"))}">
              <code>${escapeHtml(backupFile || backup.path || "")}</code>
              ${quickCheck ? `<span class="backup-quick-check"><span>${t("data.quickCheck")}</span><strong>${escapeHtml(quickCheck)}</strong></span>` : ""}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function closeRestoreConfirm() {
    pendingRestoreBackupId = null;
    dom.restoreConfirmInput.value = "";
    dom.restorePreview.innerHTML = "";
    dom.restoreConfirmPanel.classList.add("hidden");
  }

  function renderRestoreDiffSection(label, count, records) {
    if (!count) return "";
    return `
      <section class="restore-diff-section">
        <div>
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(count)}</span>
        </div>
        <ul class="restore-diff-list">
          ${(records || [])
            .map(
              (record) => `
                <li>
                  <span>${escapeHtml(record.title || record.id || "-")}</span>
                  <small>${escapeHtml(record.bodyPreview || formatLocalDateTime(record.updatedAt))}</small>
                </li>
              `
            )
            .join("")}
        </ul>
      </section>
    `;
  }

  function renderRestoreMemoryDiff(memoryDiff) {
    if (!memoryDiff) return "";
    const totalChanges = (memoryDiff.removedCount || 0) + (memoryDiff.restoredCount || 0) + (memoryDiff.changedCount || 0);
    if (!totalChanges) {
      return `<div class="restore-diff empty">${t("data.restoreNoRecordChanges")}</div>`;
    }
    return `
      <div class="restore-diff">
        ${renderRestoreDiffSection(t("data.restoreWillReturn"), memoryDiff.restoredCount, memoryDiff.restored)}
        ${renderRestoreDiffSection(t("data.restoreWillRemove"), memoryDiff.removedCount, memoryDiff.removed)}
        ${renderRestoreDiffSection(t("data.restoreWillChange"), memoryDiff.changedCount, memoryDiff.changed)}
      </div>
    `;
  }

  function renderRestorePreview(preview) {
    const current = preview?.current || {};
    const target = preview?.target || {};
    const rows = [
      [t("data.restoreMemories"), current.memories_count, target.memories_count],
      [t("data.restoreSharedLines"), current.continuity_lines_count, target.continuity_lines_count],
      [t("data.restoreBackups"), current.backups_count, target.backups_count]
    ];
    dom.restorePreview.innerHTML = `
      <strong>${t("data.restorePreview")}</strong>
      <table>
        <thead>
          <tr><th></th><th>${t("data.restoreCurrent")}</th><th>${t("data.restoreTarget")}</th></tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ([label, currentValue, targetValue]) => `
                <tr>
                  <td>${escapeHtml(label)}</td>
                  <td>${escapeHtml(currentValue ?? "-")}</td>
                  <td>${escapeHtml(targetValue ?? "-")}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
      ${renderRestoreMemoryDiff(preview?.memoryDiff)}
      <small>${t("data.quickCheck")}: ${escapeHtml(preview?.quickCheck || "")}</small>
    `;
  }

  async function exportBackup() {
    dom.exportBackup.disabled = true;
    dom.backupNotice.textContent = t("common.checking");
    try {
      const backup = await window.ClaraCoreDesktop.createBackup();
      await refresh();
      showCopyNotice(`${t("data.backupCreated")}: ${backup.path}`, dom.backupNotice);
    } catch (error) {
      console.error(error);
      dom.backupNotice.textContent = t("data.backupFailed");
    } finally {
      dom.exportBackup.disabled = false;
    }
  }

  async function exportProductJson() {
    dom.exportProductJson.disabled = true;
    dom.productJsonNotice.textContent = t("common.checking");
    try {
      const exported = await window.ClaraCoreDesktop.exportProductJson({});
      if (exported?.canceled) {
        dom.productJsonNotice.textContent = "";
        return;
      }
      await refresh();
      showCopyNotice(`${t("data.productJsonExported")}: ${exported.path}`, dom.productJsonNotice);
    } catch (error) {
      console.error(error);
      dom.productJsonNotice.textContent = t("data.productJsonExportFailed");
    } finally {
      dom.exportProductJson.disabled = false;
    }
  }

  async function importProductJson() {
    if (!window.confirm(t("data.productJsonImportConfirm"))) return;
    dom.importProductJson.disabled = true;
    dom.productJsonNotice.textContent = t("common.checking");
    try {
      const imported = await window.ClaraCoreDesktop.importProductJson({});
      if (imported?.canceled) {
        dom.productJsonNotice.textContent = t("data.productJsonImportCancelled");
        return;
      }
      await refresh();
      showCopyNotice(t("data.productJsonImportDone"), dom.productJsonNotice);
    } catch (error) {
      console.error(error);
      dom.productJsonNotice.textContent = t("data.productJsonImportFailed");
    } finally {
      dom.importProductJson.disabled = false;
    }
  }

  async function previewRestore(event) {
    const button = event.target.closest("[data-backup-action='restore']");
    if (!button) return;
    const backupId = button.dataset.backupId;
    if (!backupId) return;
    if (!window.confirm(t("data.restoreConfirm"))) return;
    button.disabled = true;
    dom.backupNotice.textContent = t("common.checking");
    try {
      const preview = await window.ClaraCoreDesktop.previewRestore(backupId);
      pendingRestoreBackupId = backupId;
      dom.restoreConfirmInput.value = "";
      renderRestorePreview(preview);
      dom.restoreConfirmPanel.classList.remove("hidden");
      dom.restoreConfirmInput.focus();
      dom.backupNotice.textContent = "";
    } catch (error) {
      console.error(error);
      dom.backupNotice.textContent = t("data.restoreFailed");
    } finally {
      button.disabled = false;
    }
  }

  async function deleteBackup(event) {
    const button = event.target.closest("[data-backup-action='delete']");
    if (!button) return;
    const backupId = button.dataset.backupId;
    if (!backupId) return;
    if (!window.confirm(t("data.deleteBackupConfirm"))) return;
    button.disabled = true;
    dom.backupNotice.textContent = t("common.checking");
    try {
      await window.ClaraCoreDesktop.deleteBackup(backupId);
      if (pendingRestoreBackupId === backupId) closeRestoreConfirm();
      await refresh();
      showCopyNotice(t("data.backupDeleted"), dom.backupNotice);
    } catch (error) {
      console.error(error);
      dom.backupNotice.textContent = t("data.backupDeleteFailed");
    } finally {
      button.disabled = false;
    }
  }

  async function confirmRestore() {
    if (!pendingRestoreBackupId) return;
    if (dom.restoreConfirmInput.value !== "RESTORE") {
      dom.backupNotice.textContent = t("data.restoreCancelled");
      dom.restoreConfirmInput.focus();
      return;
    }
    dom.confirmRestoreBackup.disabled = true;
    dom.backupNotice.textContent = t("common.checking");
    try {
      await window.ClaraCoreDesktop.restoreBackup(pendingRestoreBackupId);
      closeRestoreConfirm();
      await refresh();
      showCopyNotice(t("data.restoreDone"), dom.backupNotice);
    } catch (error) {
      console.error(error);
      dom.backupNotice.textContent = t("data.restoreFailed");
    } finally {
      dom.confirmRestoreBackup.disabled = false;
    }
  }

  function bindEvents() {
    dom.backupPolicyForm?.addEventListener("input", () => { backupPolicyDirty = true; });
    dom.backupPolicyForm?.addEventListener("change", () => { backupPolicyDirty = true; });
    dom.backupPolicyForm?.addEventListener("submit", saveBackupPolicy);
    dom.chooseBackupMirror?.addEventListener("click", async () => {
      try {
        const result = await window.ClaraCoreDesktop.chooseBackupDirectory();
        if (!result.canceled) {
          dom.backupMirror.value = result.path;
          backupPolicyDirty = true;
        }
      } catch (error) {
        console.error(error);
        dom.backupPolicyNotice.textContent = t("data.backupPolicyFailed");
      }
    });
    dom.clearBackupMirror?.addEventListener("click", () => {
      dom.backupMirror.value = "";
      backupPolicyDirty = true;
    });
    dom.exportBackup.addEventListener("click", () => exportBackup());
    dom.exportProductJson.addEventListener("click", () => exportProductJson());
    dom.importProductJson.addEventListener("click", () => importProductJson());
    dom.openBackupsFolder.addEventListener("click", () => {
      const backupsDir = getSnapshot()?.data?.backupsDir;
      if (backupsDir) {
        window.ClaraCoreDesktop.openPath(backupsDir);
      }
    });
    dom.backupListToggle.addEventListener("click", () => {
      showAllBackups = !showAllBackups;
      renderBackups();
    });
    dom.backupList.addEventListener("click", (event) => {
      previewRestore(event).catch(console.error);
      deleteBackup(event).catch(console.error);
    });
    dom.cancelRestoreBackup.addEventListener("click", () => {
      closeRestoreConfirm();
      dom.backupNotice.textContent = t("data.restoreCancelled");
    });
    dom.confirmRestoreBackup.addEventListener("click", () => {
      confirmRestore().catch(console.error);
    });
  }

  return {
    bindEvents,
    renderBackups
  };
}

window.createClaraCoreDataView = createClaraCoreDataView;
