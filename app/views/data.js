function createClaraCoreDataView({ dom, t, escapeHtml, formatBytes, getSnapshot, refresh, showCopyNotice }) {
  let pendingRestoreBackupId = null;

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
        return `
          <div class="backup-item ${escapeHtml(backup.status || "")}" data-backup-id="${escapeHtml(backup.id || "")}">
            <div class="backup-item-heading">
              <div>
                <strong>${escapeHtml(backup.created_at || "")}</strong>
                <span>${escapeHtml(backup.status || "")}</span>
              </div>
              ${
                backup.status === "verified"
                  ? `<button class="secondary" data-backup-action="restore" data-backup-id="${escapeHtml(backup.id)}">${t("actions.restore")}</button>`
                  : ""
              }
            </div>
            <code>${escapeHtml(backup.path || "")}</code>
            ${manifestPath ? `<small>${t("data.manifest")}: ${escapeHtml(manifestPath)}</small>` : ""}
            ${quickCheck ? `<small>${t("data.quickCheck")}: ${escapeHtml(quickCheck)}</small>` : ""}
          </div>
        `;
      })
      .join("");
  }

  function renderImportPreview() {
    const sources = getSnapshot()?.importPreview?.sources || {};
    const entries = Object.values(sources);
    if (entries.length === 0) {
      dom.importPreviewList.innerHTML = `<div class="endpoint-empty">${t("data.importPreviewMissing")}</div>`;
      return;
    }
    dom.importPreviewList.innerHTML = entries
      .map((source) => {
        const database = source.database || {};
        const present = Boolean(database.present);
        const counts = Object.entries(database.counts || {})
          .map(([table, count]) => `${table}: ${count}`)
          .join(", ");
        const extras = [
          source.labelAliases?.present ? `label_aliases.json: ${formatBytes(source.labelAliases.sizeBytes)}` : "",
          source.modelAdjustments?.present ? `model_adjustments.json: ${formatBytes(source.modelAdjustments.sizeBytes)}` : "",
          source.envFile?.present ? "innerlife.env" : ""
        ].filter(Boolean);
        const importPlan = source.importPlan || {};
        const candidateRows = Number.isFinite(importPlan.candidateRows) ? importPlan.candidateRows : 0;
        const skippedTables = importPlan.skippedTables || [];
        const importState = importPlan.importEnabled ? t("data.importEnabled") : t("data.importDisabled");
        const candidateHtml = (importPlan.candidates || [])
          .map((candidate) => {
            const sampleRows = candidate.samples || [];
            const sampleHtml = sampleRows.length
              ? sampleRows
                  .map((sample) => {
                    const parts = [sample.id ? `# ${sample.id}` : "", sample.title, sample.status, sample.preview].filter(Boolean);
                    return `<li>${escapeHtml(parts.join(" · "))}</li>`;
                  })
                  .join("")
              : `<li>${t("data.importNoSamples")}</li>`;
            return `
              <div class="import-candidate">
                <div>
                  <strong>${escapeHtml(candidate.table || "")}</strong>
                  <span>${escapeHtml(String(candidate.rowCount ?? 0))} ${t("data.importCandidates")}</span>
                </div>
                <small>${t("data.importTarget")}: ${escapeHtml(candidate.target || "")} · ${escapeHtml(candidate.note || "")}</small>
                <small>${t("data.importSamples")}:</small>
                <ul>${sampleHtml}</ul>
                ${candidate.sampleError ? `<small class="error-text">${escapeHtml(candidate.sampleError)}</small>` : ""}
              </div>
            `;
          })
          .join("");
        return `
          <article class="import-preview-item ${present ? "present" : "missing"}">
            <div>
              <strong>${escapeHtml(source.label || source.id || "")}</strong>
              <span>${present ? t("data.importPreviewFound") : t("data.importPreviewMissing")}</span>
            </div>
            <code>${escapeHtml(database.dbPath || source.root || "")}</code>
            <small>${escapeHtml(formatBytes(database.sizeBytes || 0))}</small>
            ${
              present
                ? `<small>${t("data.importPreviewTables")}: ${escapeHtml((database.tables || []).length)} · ${t("data.importPreviewQuickCheck")}: ${escapeHtml(database.quickCheck || "-")}</small>`
                : ""
            }
            ${counts ? `<small>${escapeHtml(counts)}</small>` : ""}
            ${extras.length ? `<small>${escapeHtml(extras.join(", "))}</small>` : ""}
            <small><strong>${t("data.importPlan")}:</strong> ${escapeHtml(String(candidateRows))} ${t("data.importCandidates")} · ${escapeHtml(importState)}</small>
            ${importPlan.requirement ? `<small><strong>${t("data.importRequirement")}:</strong> ${escapeHtml(importPlan.requirement)}</small>` : ""}
            ${candidateHtml ? `<div class="import-candidate-list">${candidateHtml}</div>` : ""}
            ${skippedTables.length ? `<small>${t("data.importSkipped")}: ${escapeHtml(skippedTables.join(", "))}</small>` : ""}
            ${database.error ? `<small class="error-text">${escapeHtml(database.error)}</small>` : ""}
          </article>
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
                  <small>${escapeHtml(record.bodyPreview || record.updatedAt || "")}</small>
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

  async function exportMemoryArchive() {
    dom.exportMemoryArchive.disabled = true;
    dom.memoryArchiveNotice.textContent = t("common.checking");
    try {
      const exported = await window.ClaraCoreDesktop.exportMemoryArchive({});
      if (exported?.canceled) {
        dom.memoryArchiveNotice.textContent = "";
        return;
      }
      await refresh();
      const counts = exported.counts || {};
      showCopyNotice(
        `${t("data.memoryExported")}: ${t("data.memoryArchiveSummary", {
          memories: counts.memories || 0,
          records: counts.records || 0,
          aliases: counts.aliases || 0
        })} · ${exported.path}`,
        dom.memoryArchiveNotice
      );
    } catch (error) {
      console.error(error);
      dom.memoryArchiveNotice.textContent = t("data.memoryExportFailed");
    } finally {
      dom.exportMemoryArchive.disabled = false;
    }
  }

  async function importMemoryArchive() {
    dom.importMemoryArchive.disabled = true;
    dom.memoryArchiveNotice.textContent = t("common.checking");
    try {
      const imported = await window.ClaraCoreDesktop.importMemoryArchive({});
      if (imported?.canceled) {
        dom.memoryArchiveNotice.textContent = t("data.memoryImportCancelled");
        return;
      }
      await refresh();
      showCopyNotice(
        `${t("data.memoryImportDone")}: ${t("data.memoryArchiveSummary", {
          memories: imported.memories?.imported || 0,
          records: imported.records?.imported || 0,
          aliases: imported.aliases?.imported || 0
        })}`,
        dom.memoryArchiveNotice
      );
    } catch (error) {
      console.error(error);
      dom.memoryArchiveNotice.textContent = t("data.memoryImportFailed");
    } finally {
      dom.importMemoryArchive.disabled = false;
    }
  }

  function oldSourceImporters() {
    return {
      memoria: {
        button: dom.importOldMemoria,
        confirmKey: "data.oldMemoriaConfirm",
        doneKey: "data.oldMemoriaImported",
        failedKey: "data.oldMemoriaImportFailed",
        importFn: () => window.ClaraCoreDesktop.importOldMemoria({}),
        summary(imported) {
          return t("data.oldMemoriaSummary", {
            memories: imported.memories?.imported || 0,
            records: imported.records?.imported || 0
          });
        }
      },
      continuity: {
        button: dom.importOldContinuity,
        confirmKey: "data.oldContinuityConfirm",
        doneKey: "data.oldContinuityImported",
        failedKey: "data.oldContinuityImportFailed",
        importFn: () => window.ClaraCoreDesktop.importOldContinuity({}),
        summary(imported) {
          return t("data.oldContinuitySummary", {
            lines: imported.lines?.imported || 0,
            positions: imported.positions?.imported || 0,
            handoffs: imported.handoffs?.imported || 0
          });
        }
      },
      innerlife: {
        button: dom.importOldInnerLife,
        confirmKey: "data.oldInnerLifeConfirm",
        doneKey: "data.oldInnerLifeImported",
        failedKey: "data.oldInnerLifeImportFailed",
        importFn: () => window.ClaraCoreDesktop.importOldInnerLife({}),
        summary(imported) {
          return t("data.oldInnerLifeSummary", {
            profiles: imported.profiles?.imported || 0,
            inbox: imported.inbox?.imported || 0,
            events: imported.events?.imported || 0,
            shares: imported.shares?.imported || 0,
            digestRuns: imported.digestRuns?.imported || 0,
            sessions: imported.sessions?.imported || 0
          });
        }
      }
    };
  }

  async function importOldSource(sourceId, triggerButton = null) {
    const config = oldSourceImporters()[sourceId];
    if (!config) return;
    if (!window.confirm(t(config.confirmKey))) return;
    const button = triggerButton || config.button;
    if (button) button.disabled = true;
    dom.memoryArchiveNotice.textContent = t("common.checking");
    try {
      const imported = await config.importFn();
      await refresh();
      const backupPath = imported.backup?.path ? ` · ${imported.backup.path}` : "";
      showCopyNotice(`${t(config.doneKey)}: ${config.summary(imported)}${backupPath}`, dom.memoryArchiveNotice);
    } catch (error) {
      console.error(error);
      dom.memoryArchiveNotice.textContent = t(config.failedKey);
    } finally {
      if (button) button.disabled = false;
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
    dom.exportMemoryArchive.addEventListener("click", () => exportMemoryArchive());
    dom.importMemoryArchive.addEventListener("click", () => importMemoryArchive());
    dom.importOldMemoria.addEventListener("click", () => importOldSource("memoria"));
    dom.importOldContinuity.addEventListener("click", () => importOldSource("continuity"));
    dom.importOldInnerLife.addEventListener("click", () => importOldSource("innerlife"));
    dom.openBackupsFolder.addEventListener("click", () => {
      const backupsDir = getSnapshot()?.data?.backupsDir;
      if (backupsDir) {
        window.ClaraCoreDesktop.openPath(backupsDir);
      }
    });
    dom.backupList.addEventListener("click", (event) => {
      previewRestore(event).catch(console.error);
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
    renderBackups,
    renderImportPreview
  };
}

window.createClaraCoreDataView = createClaraCoreDataView;
