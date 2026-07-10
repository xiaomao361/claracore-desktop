function createClaraCoreDataView({ dom, t, escapeHtml, formatBytes, formatLocalDateTime, getSnapshot, refresh, showCopyNotice }) {
  let pendingRestoreBackupId = null;

  function fileNameFromPath(value) {
    return String(value || "").split(/[\\/]/).filter(Boolean).pop() || "";
  }

  function renderBackups() {
    const backups = getSnapshot()?.backups || [];
    if (backups.length === 0) {
      dom.backupList.innerHTML = `<div class="endpoint-empty">${t("data.noBackups")}</div>`;
      return;
    }
    dom.backupList.innerHTML = backups
      .map((backup) => {
        const manifestPath = backup.metadata?.manifestPath || "";
        const quickCheck = backup.metadata?.verification?.quickCheck || "";
        const backupFile = fileNameFromPath(backup.path);
        const manifestFile = fileNameFromPath(manifestPath);
        return `
          <div class="backup-item ${escapeHtml(backup.status || "")}" data-backup-id="${escapeHtml(backup.id || "")}">
            <div class="backup-item-heading">
              <div>
                <strong>${escapeHtml(formatLocalDateTime(backup.created_at))}</strong>
                <span class="backup-status">${escapeHtml(backup.status || "")}</span>
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
            <div class="backup-file-row" title="${escapeHtml(backup.path || "")}">
              <span>${escapeHtml(t("data.backupFile"))}</span>
              <code>${escapeHtml(backupFile || backup.path || "")}</code>
            </div>
            <div class="backup-meta-grid">
              ${manifestPath ? `<div title="${escapeHtml(manifestPath)}"><span>${t("data.manifest")}: </span><strong>${escapeHtml(manifestFile || manifestPath)}</strong></div>` : ""}
              ${quickCheck ? `<div><span>${t("data.quickCheck")}: </span><strong>${escapeHtml(quickCheck)}</strong></div>` : ""}
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
    dom.exportBackup.addEventListener("click", () => exportBackup());
    dom.exportProductJson.addEventListener("click", () => exportProductJson());
    dom.importProductJson.addEventListener("click", () => importProductJson());
    dom.openBackupsFolder.addEventListener("click", () => {
      const backupsDir = getSnapshot()?.data?.backupsDir;
      if (backupsDir) {
        window.ClaraCoreDesktop.openPath(backupsDir);
      }
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
