const path = require("path");
const fs = require("fs/promises");
const { previewImportSources, quoteIdentifier, runSqliteReadOnly } = require("../../import-preview");
const {
  safeArchiveString,
  normalizeArchiveLabels,
  normalizeArchiveStatus,
  normalizeArchiveSensitivity,
  stableImportId,
  pickFirst,
  normalizeImportLabels,
  normalizeImportLabel,
  normalizeContinuityStatus,
  normalizeInterpretationStatus,
  normalizeLegacyContinuityInterpretationStatus,
  buildLegacyContinuityMetadata,
  safeJsonArray,
  safeJsonObject,
  normalizeInnerLifeShareStatus,
  normalizeInnerLifeReviewStatus,
  normalizeInnerLifeEventStatus,
  legacyAgentLabels,
  parseImportJson,
  compactImportText,
  normalizeInnerLifeInboxStatus,
  normalizeInnerLifeSessionStatus,
  normalizeInnerLifeDigestStatus,
  reviewStatusFromShareStatus,
  PRODUCT_EXPORT_TABLES,
  sqlValue,
  insertRowsSql,
  summarizeProductTables
} = require("./helpers");

function createLegacyInnerLifeRuntime({ createProductBackup, ensureProductCore, productVersion, resetCachedDatabase, sqlString, timestampForFilename }) {
  async function readOldInnerLifeRows(dbPath) {
    const tableRows = await runSqliteReadOnly(dbPath, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;");
    const tables = new Set(tableRows.map((row) => row.name));
    const readTable = async (tableName) => {
      if (!tables.has(tableName)) return [];
      return runSqliteReadOnly(dbPath, `SELECT * FROM ${quoteIdentifier(tableName)};`);
    };
    return {
      tables: [...tables],
      profiles: await readTable("innerlife_profiles"),
      events: await readTable("innerlife_events"),
      thoughts: await readTable("innerlife_thoughts"),
      shares: await readTable("innerlife_shares"),
      agentProfiles: await readTable("agent_profiles"),
      agentState: await readTable("agent_state"),
      inboxEvents: await readTable("inbox_events"),
      internalEvents: await readTable("internal_events"),
      pendingShares: await readTable("pending_shares"),
      digestRuns: await readTable("digest_runs"),
      sessions: await readTable("sessions"),
      shareActions: await readTable("share_actions"),
      innerSummaries: await readTable("inner_summaries"),
      autonomousExperiences: await readTable("autonomous_experiences"),
      explorationRuns: await readTable("exploration_runs"),
      convergenceRuns: await readTable("convergence_runs"),
      sourceSubscriptions: await readTable("source_subscriptions")
    };
  }
  
  async function importOldInnerLifeIntoProduct(app, input = {}) {
    const preview = await previewImportSources();
    const source = preview.sources.innerlife;
    const dbPath = path.resolve(String(input.databasePath || source.database?.dbPath || ""));
    if (!dbPath || !source.database?.present) throw new Error("Old InnerLife database not found.");
    if (source.database?.quickCheck !== "ok") throw new Error(`Old InnerLife quick_check failed: ${source.database?.quickCheck}`);
    const statBefore = await fs.stat(dbPath);
    const backup = await createProductBackup(app);
    const { database } = await ensureProductCore(app);
    const importedAt = new Date().toISOString();
    const old = await readOldInnerLifeRows(dbPath);
    const summary = {
      importedAt,
      sourcePath: dbPath,
      backup,
      profiles: { imported: 0, skipped: 0 },
      events: { imported: 0, skipped: 0 },
      thoughts: { imported: 0, skipped: 0 },
      shares: { imported: 0, skipped: 0 },
      inbox: { imported: 0, skipped: 0 },
      digestRuns: { imported: 0, skipped: 0 },
      sessions: { imported: 0, skipped: 0 },
      shareActions: { imported: 0, skipped: 0 },
      sourceMtimeUnchanged: false,
      sourceSizeUnchanged: false
    };
    const agentIdMap = new Map();
    const eventIdMap = new Map();
    const thoughtIdMap = new Map();
  
    const ensureAgent = async (oldAgentId, displayName = "") => {
      const sourceAgentId = String(oldAgentId || "").trim() || "my-agent";
      if (agentIdMap.has(sourceAgentId)) return agentIdMap.get(sourceAgentId);
      const legacyAgentMap = {
        clara: "claude-code:clara",
        lara: "hermes:lara",
        "my-agent": "codex"
      };
      const importedAgentId = legacyAgentMap[sourceAgentId] || sourceAgentId;
      const label = String(displayName || sourceAgentId || "Imported Agent").trim() || "Imported Agent";
      await database.exec(`
        INSERT INTO agents (id, label, role, status)
        VALUES (${sqlString(importedAgentId)}, ${sqlString(label)}, 'agent', 'active')
        ON CONFLICT(id) DO NOTHING;
      `);
      agentIdMap.set(sourceAgentId, importedAgentId);
      return importedAgentId;
    };
  
    const oldStateByAgent = new Map(
      old.agentState.map((row) => [String(pickFirst(row, ["agent_id", "agentId"], "my-agent") || "my-agent"), row])
    );
    const profileRows = old.profiles.length > 0 ? old.profiles : old.agentProfiles;
    for (const row of profileRows) {
      const oldAgentId = String(pickFirst(row, ["agent_id", "agentId", "id"], "my-agent") || "my-agent").trim() || "my-agent";
      const displayName = String(pickFirst(row, ["display_name", "displayName", "name", "label"], oldAgentId) || oldAgentId).trim();
      const agentId = await ensureAgent(oldAgentId, displayName);
      const existing = await database.query(`SELECT agent_id FROM innerlife_profiles WHERE agent_id = ${sqlString(agentId)} LIMIT 1;`);
      if (existing.length && agentId !== "my-agent") {
        summary.profiles.skipped += 1;
        continue;
      }
      const enabled = ["1", "true", "enabled"].includes(String(pickFirst(row, ["enabled", "status"], "0") || "0").trim().toLowerCase()) ? 1 : 0;
      const profileJson = safeJsonObject(pickFirst(row, ["profile_json", "profileJson", "profile"], "{}"), {});
      const stateRow = oldStateByAgent.get(oldAgentId);
      const stateJson = safeJsonObject(pickFirst(row, ["state_json", "stateJson", "state"], stateRow?.state_json || "{}"), {});
      const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt);
      const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt"], stateRow?.updated_at || createdAt) || createdAt);
      await database.exec(`
        INSERT INTO innerlife_profiles (agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at)
        VALUES (
          ${sqlString(agentId)},
          ${sqlString(displayName || "Imported Agent")},
          ${enabled},
          ${sqlString(JSON.stringify({ ...profileJson, importedFrom: "old-innerlife", oldAgentId }))},
          ${sqlString(JSON.stringify({ ...stateJson, importedAt }))},
          ${sqlString(createdAt)},
          ${sqlString(updatedAt)}
        )
        ON CONFLICT(agent_id) DO UPDATE SET
          display_name = excluded.display_name,
          profile_json = excluded.profile_json,
          state_json = excluded.state_json,
          updated_at = excluded.updated_at;
      `);
      summary.profiles.imported += 1;
    }
  
    for (const row of old.agentState) {
      const oldAgentId = String(pickFirst(row, ["agent_id", "agentId"], "my-agent") || "my-agent").trim() || "my-agent";
      if (old.profiles.length > 0 || old.agentProfiles.some((profile) => String(profile.agent_id || "") === oldAgentId)) continue;
      const agentId = await ensureAgent(oldAgentId, oldAgentId);
      const stateJson = safeJsonObject(pickFirst(row, ["state_json", "stateJson"], "{}"), {});
      const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt"], importedAt) || importedAt);
      await database.exec(`
        INSERT INTO innerlife_profiles (agent_id, display_name, enabled, profile_json, state_json, created_at, updated_at)
        VALUES (
          ${sqlString(agentId)},
          ${sqlString(oldAgentId)},
          0,
          ${sqlString(JSON.stringify({ importedFrom: "old-innerlife-v2", oldAgentId }))},
          ${sqlString(JSON.stringify({ ...stateJson, importedAt, oldRevision: row.revision ?? null }))},
          ${sqlString(updatedAt)},
          ${sqlString(updatedAt)}
        )
        ON CONFLICT(agent_id) DO UPDATE SET
          state_json = excluded.state_json,
          updated_at = excluded.updated_at;
      `);
      summary.profiles.imported += 1;
    }
  
    for (const row of old.events) {
      const oldId = String(pickFirst(row, ["id", "event_id", "eventId"], "") || "").trim();
      const body = String(pickFirst(row, ["body", "content", "text", "summary"], "") || "").trim();
      if (!oldId || !body) {
        summary.events.skipped += 1;
        continue;
      }
      const id = stableImportId("old_innerlife_event", oldId);
      eventIdMap.set(oldId, id);
      const existing = await database.query(`SELECT id FROM innerlife_events WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary.events.skipped += 1;
        continue;
      }
      const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
      const kind = String(pickFirst(row, ["kind", "type", "event_type"], "imported") || "imported").trim() || "imported";
      const status = normalizeInnerLifeEventStatus(pickFirst(row, ["status"], "processed"));
      const createdAt = String(pickFirst(row, ["created_at", "createdAt", "timestamp"], importedAt) || importedAt);
      const metadata = safeJsonObject(pickFirst(row, ["metadata_json", "metadataJson", "metadata"], "{}"), {});
      await database.exec(`
        INSERT INTO innerlife_events (id, agent_id, kind, body, status, created_at, metadata_json)
        VALUES (
          ${sqlString(id)},
          ${sqlString(agentId)},
          ${sqlString(kind)},
          ${sqlString(body)},
          ${sqlString(status)},
          ${sqlString(createdAt)},
          ${sqlString(JSON.stringify({ ...metadata, importedFrom: "old-innerlife", oldId }))}
        );
      `);
      summary.events.imported += 1;
    }
  
    const importEventRow = async (row, options = {}) => {
      const oldId = String(pickFirst(row, ["id"], "") || "").trim();
      const body = String(options.body || compactImportText(pickFirst(row, ["body", "content", "text", "summary", "result_json", "experience_json"], ""), "")).trim();
      if (!oldId || !body) {
        summary.events.skipped += 1;
        return null;
      }
      const id = stableImportId(options.prefix || "old_innerlife_event", oldId);
      eventIdMap.set(oldId, id);
      const existing = await database.query(`SELECT id FROM innerlife_events WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary.events.skipped += 1;
        return id;
      }
      const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
      const kind = String(options.kind || pickFirst(row, ["kind", "type", "event_type", "summary_type"], "imported") || "imported").trim() || "imported";
      const status = normalizeInnerLifeEventStatus(pickFirst(row, ["status", "lifecycle_status"], "processed"));
      const createdAt = String(pickFirst(row, ["created_at", "createdAt", "timestamp", "fetched_at"], importedAt) || importedAt);
      const metadata = {
        importedFrom: "old-innerlife-v2",
        oldId,
        source: pickFirst(row, ["source", "source_name", "url"], ""),
        sourceRefs: parseImportJson(pickFirst(row, ["source_refs_json"], "[]"), []),
        metadata: parseImportJson(pickFirst(row, ["metadata_json"], "{}"), {}),
        raw: options.raw || {}
      };
      await database.exec(`
        INSERT INTO innerlife_events (id, agent_id, kind, body, status, created_at, metadata_json)
        VALUES (
          ${sqlString(id)},
          ${sqlString(agentId)},
          ${sqlString(kind)},
          ${sqlString(body)},
          ${sqlString(status)},
          ${sqlString(createdAt)},
          ${sqlString(JSON.stringify(metadata))}
        );
      `);
      summary.events.imported += 1;
      return id;
    };
  
    for (const row of old.internalEvents) {
      await importEventRow(row, {
        prefix: "old_innerlife_internal_event",
        kind: pickFirst(row, ["event_type"], "internal_event"),
        body: compactImportText(row.content, ""),
        raw: {
          fingerprint: row.fingerprint || "",
          lifecycleStatus: row.lifecycle_status || "",
          archivedAt: row.archived_at || "",
          archiveReason: row.archive_reason || ""
        }
      });
    }
  
    for (const row of old.innerSummaries) {
      await importEventRow(row, {
        prefix: "old_innerlife_summary",
        kind: `summary:${String(row.summary_type || "consolidation")}`,
        body: [row.title, row.content].filter(Boolean).join("\n\n"),
        raw: { updatedAt: row.updated_at || "" }
      });
    }
  
    for (const row of old.autonomousExperiences) {
      await importEventRow(row, {
        prefix: "old_innerlife_experience",
        kind: "autonomous_experience",
        body: [row.title, compactImportText(row.experience_json, "")].filter(Boolean).join("\n\n"),
        raw: {
          runId: row.run_id || "",
          sourceName: row.source_name || "",
          url: row.url || "",
          publishedAt: row.published_at || "",
          evidence: parseImportJson(row.evidence_json, [])
        }
      });
    }
  
    for (const row of old.explorationRuns) {
      await importEventRow(row, {
        prefix: "old_innerlife_exploration",
        kind: "exploration_run",
        body: compactImportText(row.result_json, row.selection_reason || row.selected_url || "Exploration run"),
        raw: {
          selectedUrl: row.selected_url || "",
          selectionReason: row.selection_reason || "",
          candidateCount: row.candidate_count || 0,
          error: row.error || ""
        }
      });
    }
  
    for (const row of old.convergenceRuns) {
      await importEventRow(row, {
        prefix: "old_innerlife_convergence",
        kind: "convergence_run",
        body: compactImportText(row.result_json, row.reason || "Convergence run"),
        raw: {
          reason: row.reason || "",
          inputCounts: parseImportJson(row.input_counts_json, {}),
          error: row.error || ""
        }
      });
    }
  
    for (const row of old.sourceSubscriptions) {
      await importEventRow(row, {
        prefix: "old_innerlife_source_subscription",
        kind: "source_subscription",
        body: [row.name, row.url].filter(Boolean).join("\n"),
        raw: {
          sourceType: row.source_type || "",
          enabled: Number(row.enabled || 0) === 1,
          updatedAt: row.updated_at || ""
        }
      });
    }
  
    for (const row of old.inboxEvents) {
      const oldId = String(pickFirst(row, ["id"], "") || "").trim();
      const body = compactImportText(row.content_json, "");
      if (!oldId || !body) {
        summary.inbox.skipped += 1;
        continue;
      }
      const id = stableImportId("old_innerlife_inbox", oldId);
      const existing = await database.query(`SELECT id FROM innerlife_inbox WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary.inbox.skipped += 1;
        continue;
      }
      const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
      const source = [row.source_type, row.source_id].filter(Boolean).join(":") || "old_innerlife";
      const status = normalizeInnerLifeInboxStatus(row.status);
      const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt);
      const processedAt = String(pickFirst(row, ["processed_at", "processedAt"], "") || "").trim();
      await database.exec(`
        INSERT INTO innerlife_inbox (id, agent_id, source, body, status, created_at, processed_at, metadata_json)
        VALUES (
          ${sqlString(id)},
          ${sqlString(agentId)},
          ${sqlString(source)},
          ${sqlString(body)},
          ${sqlString(status)},
          ${sqlString(createdAt)},
          ${processedAt ? sqlString(processedAt) : "NULL"},
          ${sqlString(JSON.stringify({
            importedFrom: "old-innerlife-v2",
            oldId,
            sourceType: row.source_type || "",
            sourceId: row.source_id || "",
            content: parseImportJson(row.content_json, {})
          }))}
        );
      `);
      summary.inbox.imported += 1;
    }
  
    for (const row of old.thoughts) {
      const oldId = String(pickFirst(row, ["id", "thought_id", "thoughtId"], "") || "").trim();
      const body = String(pickFirst(row, ["body", "content", "text", "summary"], "") || "").trim();
      if (!oldId || !body) {
        summary.thoughts.skipped += 1;
        continue;
      }
      const id = stableImportId("old_innerlife_thought", oldId);
      thoughtIdMap.set(oldId, id);
      const existing = await database.query(`SELECT id FROM innerlife_thoughts WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary.thoughts.skipped += 1;
        continue;
      }
      const oldEventId = String(pickFirst(row, ["event_id", "eventId"], "") || "").trim();
      const eventId = oldEventId && eventIdMap.has(oldEventId) ? eventIdMap.get(oldEventId) : null;
      const reviewStatus = normalizeInnerLifeReviewStatus(pickFirst(row, ["review_status", "reviewStatus", "status"], "unreviewed"));
      const createdAt = String(pickFirst(row, ["created_at", "createdAt", "timestamp"], importedAt) || importedAt);
      await database.exec(`
        INSERT INTO innerlife_thoughts (id, event_id, body, review_status, created_at)
        VALUES (${sqlString(id)}, ${eventId ? sqlString(eventId) : "NULL"}, ${sqlString(body)}, ${sqlString(reviewStatus)}, ${sqlString(createdAt)});
      `);
      summary.thoughts.imported += 1;
    }
  
    for (const row of old.shares) {
      const oldId = String(pickFirst(row, ["id", "share_id", "shareId"], "") || "").trim();
      const body = String(pickFirst(row, ["body", "content", "text", "summary"], "") || "").trim();
      if (!oldId || !body) {
        summary.shares.skipped += 1;
        continue;
      }
      const id = stableImportId("old_innerlife_share", oldId);
      const existing = await database.query(`SELECT id FROM innerlife_shares WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary.shares.skipped += 1;
        continue;
      }
      const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
      const oldThoughtId = String(pickFirst(row, ["thought_id", "thoughtId"], "") || "").trim();
      const thoughtId = oldThoughtId && thoughtIdMap.has(oldThoughtId) ? thoughtIdMap.get(oldThoughtId) : null;
      const status = normalizeInnerLifeShareStatus(pickFirst(row, ["status"], "pending"));
      const decisionReason = String(pickFirst(row, ["decision_reason", "decisionReason", "reason"], "") || "").trim();
      const createdAt = String(pickFirst(row, ["created_at", "createdAt", "timestamp"], importedAt) || importedAt);
      const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt"], createdAt) || createdAt);
      await database.exec(`
        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at)
        VALUES (
          ${sqlString(id)},
          ${sqlString(agentId)},
          ${thoughtId ? sqlString(thoughtId) : "NULL"},
          ${sqlString(status)},
          ${sqlString(body)},
          ${decisionReason ? sqlString(decisionReason) : "NULL"},
          ${sqlString(createdAt)},
          ${sqlString(updatedAt)}
        );
      `);
      summary.shares.imported += 1;
    }
  
    for (const row of old.pendingShares) {
      const oldId = String(pickFirst(row, ["id"], "") || "").trim();
      const body = String(pickFirst(row, ["body", "content"], "") || "").trim();
      if (!oldId || !body) {
        summary.shares.skipped += 1;
        continue;
      }
      const id = stableImportId("old_innerlife_share", oldId);
      const existing = await database.query(`SELECT id FROM innerlife_shares WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary.shares.skipped += 1;
        thoughtIdMap.set(oldId, stableImportId("old_innerlife_share_thought", oldId));
        continue;
      }
      const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
      const status = normalizeInnerLifeShareStatus(row.status);
      const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt);
      const updatedAt = String(pickFirst(row, ["updated_at", "updatedAt"], createdAt) || createdAt);
      const thoughtId = stableImportId("old_innerlife_share_thought", oldId);
      await database.exec(`
        INSERT INTO innerlife_thoughts (id, event_id, body, review_status, created_at)
        VALUES (
          ${sqlString(thoughtId)},
          NULL,
          ${sqlString(body)},
          ${sqlString(reviewStatusFromShareStatus(status))},
          ${sqlString(createdAt)}
        )
        ON CONFLICT(id) DO NOTHING;
  
        INSERT INTO innerlife_shares (id, agent_id, thought_id, status, body, decision_reason, created_at, updated_at)
        VALUES (
          ${sqlString(id)},
          ${sqlString(agentId)},
          ${sqlString(thoughtId)},
          ${sqlString(status)},
          ${sqlString(body)},
          ${row.decision_reason || row.reason ? sqlString(row.decision_reason || row.reason) : "NULL"},
          ${sqlString(createdAt)},
          ${sqlString(updatedAt)}
        );
      `);
      thoughtIdMap.set(oldId, thoughtId);
      summary.thoughts.imported += 1;
      summary.shares.imported += 1;
    }
  
    for (const row of old.digestRuns) {
      const oldId = String(pickFirst(row, ["id"], "") || "").trim();
      if (!oldId) {
        summary.digestRuns.skipped += 1;
        continue;
      }
      const id = stableImportId("old_innerlife_digest", oldId);
      const existing = await database.query(`SELECT id FROM innerlife_digest_runs WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary.digestRuns.skipped += 1;
        continue;
      }
      const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
      const output = parseImportJson(row.output_json, {});
      const summaryText = compactImportText(output, row.reason || row.error || "");
      const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt);
      await database.exec(`
        INSERT INTO innerlife_digest_runs (id, agent_id, mode, status, input_json, summary, created_at, completed_at, metadata_json)
        VALUES (
          ${sqlString(id)},
          ${sqlString(agentId)},
          ${sqlString(String(row.mode || "imported"))},
          ${sqlString(normalizeInnerLifeDigestStatus(row.status))},
          ${sqlString(JSON.stringify(parseImportJson(row.input_refs_json, [])))},
          ${sqlString(summaryText)},
          ${sqlString(createdAt)},
          ${normalizeInnerLifeDigestStatus(row.status) === "pending" ? "NULL" : sqlString(createdAt)},
          ${sqlString(JSON.stringify({
            importedFrom: "old-innerlife-v2",
            oldId,
            changed: Number(row.changed || 0) === 1,
            reason: row.reason || "",
            error: row.error || "",
            output,
            stateBefore: parseImportJson(row.state_before_json, {}),
            stateAfter: parseImportJson(row.state_after_json, {})
          }))}
        );
      `);
      summary.digestRuns.imported += 1;
    }
  
    for (const row of old.sessions) {
      const oldId = String(pickFirst(row, ["id"], "") || "").trim();
      if (!oldId) {
        summary.sessions.skipped += 1;
        continue;
      }
      const id = stableImportId("old_innerlife_session", oldId);
      const existing = await database.query(`SELECT id FROM innerlife_sessions WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (existing.length) {
        summary.sessions.skipped += 1;
        continue;
      }
      const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
      const externalSessionId = String(row.external_session_id || oldId);
      const startedAt = String(pickFirst(row, ["created_at", "started_at", "createdAt"], importedAt) || importedAt);
      const endedAt = String(pickFirst(row, ["ended_at", "endedAt"], "") || "").trim();
      const reflection = parseImportJson(row.reflection_json, {});
      await database.exec(`
        INSERT INTO innerlife_sessions (id, agent_id, user_id, host, external_session_id, status, started_at, ended_at, briefing_json, summary, metadata_json)
        VALUES (
          ${sqlString(id)},
          ${sqlString(agentId)},
          ${sqlString(String(row.user_id || "local-user"))},
          ${sqlString(String(row.host || "desktop"))},
          ${sqlString(externalSessionId)},
          ${sqlString(normalizeInnerLifeSessionStatus(row.status))},
          ${sqlString(startedAt)},
          ${endedAt ? sqlString(endedAt) : "NULL"},
          ${sqlString(JSON.stringify(parseImportJson(row.start_briefing_json, {})))},
          ${sqlString(compactImportText(reflection, ""))},
          ${sqlString(JSON.stringify({
            importedFrom: "old-innerlife-v2",
            oldId,
            startRevision: row.start_revision ?? null,
            endRevision: row.end_revision ?? null,
            conversation: parseImportJson(row.conversation_json, null),
            reflection
          }))}
        );
      `);
      summary.sessions.imported += 1;
    }
  
    for (const row of old.shareActions) {
      const oldId = String(pickFirst(row, ["id"], "") || "").trim();
      const oldShareId = String(pickFirst(row, ["share_id", "shareId"], "") || "").trim();
      if (!oldId || !oldShareId) {
        summary.shareActions.skipped += 1;
        continue;
      }
      const id = stableImportId("old_innerlife_share_action", oldId);
      const shareId = stableImportId("old_innerlife_share", oldShareId);
      const shareExists = await database.query(`SELECT id FROM innerlife_shares WHERE id = ${sqlString(shareId)} LIMIT 1;`);
      const existing = await database.query(`SELECT id FROM innerlife_share_actions WHERE id = ${sqlString(id)} LIMIT 1;`);
      if (!shareExists.length || existing.length) {
        summary.shareActions.skipped += 1;
        continue;
      }
      const agentId = await ensureAgent(pickFirst(row, ["agent_id", "agentId"], "my-agent"));
      const createdAt = String(pickFirst(row, ["created_at", "createdAt"], importedAt) || importedAt);
      await database.exec(`
        INSERT INTO innerlife_share_actions (id, share_id, agent_id, action, reason, created_at, metadata_json)
        VALUES (
          ${sqlString(id)},
          ${sqlString(shareId)},
          ${sqlString(agentId)},
          ${sqlString(String(row.action || "imported"))},
          ${sqlString(String(row.reason || ""))},
          ${sqlString(createdAt)},
          ${sqlString(JSON.stringify({
            importedFrom: "old-innerlife-v2",
            oldId,
            sessionId: row.session_id ? stableImportId("old_innerlife_session", row.session_id) : null,
            deliveryStyle: row.delivery_style || "",
            metadata: parseImportJson(row.metadata_json, {})
          }))}
        );
      `);
      summary.shareActions.imported += 1;
    }
  
    const statAfter = await fs.stat(dbPath);
    summary.sourceMtimeUnchanged = statAfter.mtimeMs === statBefore.mtimeMs;
    summary.sourceSizeUnchanged = statAfter.size === statBefore.size;
    if (!summary.sourceMtimeUnchanged || !summary.sourceSizeUnchanged) {
      throw new Error("Old InnerLife source changed during import.");
    }
    return {
      ...summary,
      innerLife: await database.getInnerLifeSnapshot()
    };
  }

  return {
    importOldInnerLifeIntoProduct
  };
}

module.exports = {
  createLegacyInnerLifeRuntime
};
