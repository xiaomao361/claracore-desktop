const moduleGrid = document.querySelector("#moduleGrid");
const runtimeMode = document.querySelector("#runtimeMode");
const rootPath = document.querySelector("#rootPath");
const refreshButton = document.querySelector("#refreshButton");
const primaryAction = document.querySelector("#primaryAction");
const openDevelopmentPlan = document.querySelector("#openDevelopmentPlan");
const openDesignPlan = document.querySelector("#openDesignPlan");
const dataLocation = document.querySelector("#dataLocation");
const dataHint = document.querySelector("#dataHint");
const dataRootPath = document.querySelector("#dataRootPath");
const exportBackup = document.querySelector("#exportBackup");
const exportMemoryArchive = document.querySelector("#exportMemoryArchive");
const importMemoryArchive = document.querySelector("#importMemoryArchive");
const importOldMemoria = document.querySelector("#importOldMemoria");
const importOldContinuity = document.querySelector("#importOldContinuity");
const importOldInnerLife = document.querySelector("#importOldInnerLife");
const openBackupsFolder = document.querySelector("#openBackupsFolder");
const backupNotice = document.querySelector("#backupNotice");
const memoryArchiveNotice = document.querySelector("#memoryArchiveNotice");
const backupList = document.querySelector("#backupList");
const importPreviewList = document.querySelector("#importPreviewList");
const restoreConfirmPanel = document.querySelector("#restoreConfirmPanel");
const restorePreview = document.querySelector("#restorePreview");
const restoreConfirmInput = document.querySelector("#restoreConfirmInput");
const confirmRestoreBackup = document.querySelector("#confirmRestoreBackup");
const cancelRestoreBackup = document.querySelector("#cancelRestoreBackup");
const memoryStore = document.querySelector("#memoryStore");
const memoryStoreShort = document.querySelector("#memoryStoreShort");
const mcpCommand = document.querySelector("#mcpCommand");
const mcpConfig = document.querySelector("#mcpConfig");
const copyNotice = document.querySelector("#copyNotice");
const httpEndpointList = document.querySelector("#httpEndpointList");
const gatewayTraceList = document.querySelector("#gatewayTraceList");
const logTerminal = document.querySelector("#logTerminal");
const refreshLogs = document.querySelector("#refreshLogs");
const toggleLogFollow = document.querySelector("#toggleLogFollow");
const openGatewayFolder = document.querySelector("#openGatewayFolder");
const eventList = document.querySelector("#eventList");
const healthSummary = document.querySelector("#healthSummary");
const healthList = document.querySelector("#healthList");
const homeCognitiveUpdated = document.querySelector("#homeCognitiveUpdated");
const homeCognitiveSystems = document.querySelector("#homeCognitiveSystems");
const homeAgentViewList = document.querySelector("#homeAgentViewList");
const homeTraceList = document.querySelector("#homeTraceList");
const viewTitle = document.querySelector("#viewTitle");
const viewSubtitle = document.querySelector("#viewSubtitle");
const monitorVersion = document.querySelector("#monitorVersion");
const monitorUptime = document.querySelector("#monitorUptime");
const monitorCpu = document.querySelector("#monitorCpu");
const monitorRam = document.querySelector("#monitorRam");
const monitorDisk = document.querySelector("#monitorDisk");
const monitorTime = document.querySelector("#monitorTime");
const agentSetupMarkdown = document.querySelector("#agentSetupMarkdown");
const agentSetupNotice = document.querySelector("#agentSetupNotice");
const copyAgentSetup = document.querySelector("#copyAgentSetup");
const memoriaProvider = document.querySelector("#memoriaProvider");
const memoriaEndpoint = document.querySelector("#memoriaEndpoint");
const memoriaModel = document.querySelector("#memoriaModel");
const memoriaDimension = document.querySelector("#memoriaDimension");
const memoriaApiKey = document.querySelector("#memoriaApiKey");
const copyMemoriaApiKey = document.querySelector("#copyMemoriaApiKey");
const memoriaSource = document.querySelector("#memoriaSource");
const memoriaModelStatus = document.querySelector("#memoriaModelStatus");
const innerLifeBackend = document.querySelector("#innerLifeBackend");
const innerLifeEndpoint = document.querySelector("#innerLifeEndpoint");
const innerLifeLightModel = document.querySelector("#innerLifeLightModel");
const innerLifeDeepModel = document.querySelector("#innerLifeDeepModel");
const innerLifePollSeconds = document.querySelector("#innerLifePollSeconds");
const innerLifeApiKey = document.querySelector("#innerLifeApiKey");
const innerLifeApiKeySummary = document.querySelector("#innerLifeApiKeySummary");
const copyInnerLifeApiKey = document.querySelector("#copyInnerLifeApiKey");
const innerLifeSource = document.querySelector("#innerLifeSource");
const innerLifeModelStatus = document.querySelector("#innerLifeModelStatus");
const settingsInnerLifeDaemonStatus = document.querySelector("#settingsInnerLifeDaemonStatus");
const innerLifeDaemonControlPanel = document.querySelector("#innerLifeDaemonControlPanel");
const innerLifeNotice = document.querySelector("#innerLifeNotice");
const innerLifeAgentFilter = document.querySelector("#innerLifeAgentFilter");
const startInnerLifeSession = document.querySelector("#startInnerLifeSession");
const endInnerLifeSession = document.querySelector("#endInnerLifeSession");
const innerLifeSessionSummary = document.querySelector("#innerLifeSessionSummary");
const innerLifeInboxInput = document.querySelector("#innerLifeInboxInput");
const submitInnerLifeInbox = document.querySelector("#submitInnerLifeInbox");
const runInnerLifeDigest = document.querySelector("#runInnerLifeDigest");
const enableInnerLifeDaemon = document.querySelector("#enableInnerLifeDaemon");
const pauseInnerLifeDaemon = document.querySelector("#pauseInnerLifeDaemon");
const tickInnerLifeDaemon = document.querySelector("#tickInnerLifeDaemon");
const innerLifeShareContext = document.querySelector("#innerLifeShareContext");
const checkInnerLifeShareTiming = document.querySelector("#checkInnerLifeShareTiming");
const innerLifeSessionList = document.querySelector("#innerLifeSessionList");
const innerLifeDigestList = document.querySelector("#innerLifeDigestList");
const innerLifeInboxList = document.querySelector("#innerLifeInboxList");
const innerLifeShareCheckList = document.querySelector("#innerLifeShareCheckList");
const processInnerLifeOnce = document.querySelector("#processInnerLifeOnce");
const innerLifeShareList = document.querySelector("#innerLifeShareList");
const innerLifeDaemonStatus = document.querySelector("#innerLifeDaemonStatus");
const innerLifeNextRun = document.querySelector("#innerLifeNextRun");
const innerLifeLastResult = document.querySelector("#innerLifeLastResult");
const innerLifeRecovery = document.querySelector("#innerLifeRecovery");
const innerLifeDoctorStatus = document.querySelector("#innerLifeDoctorStatus");
const innerLifeDoctorList = document.querySelector("#innerLifeDoctorList");
const innerLifePendingCount = document.querySelector("#innerLifePendingCount");
const innerLifeEventCount = document.querySelector("#innerLifeEventCount");
const innerLifeThoughtCount = document.querySelector("#innerLifeThoughtCount");
const saveSettings = document.querySelector("#saveSettings");
const settingsNotice = document.querySelector("#settingsNotice");
const memorySearchInput = document.querySelector("#memorySearchInput");
const searchMemory = document.querySelector("#searchMemory");
const memoryList = document.querySelector("#memoryList");
const memoryAgentFilter = document.querySelector("#memoryAgentFilter");
const allMemoryList = document.querySelector("#allMemoryList");
const memoryGraphSummary = document.querySelector("#memoryGraphSummary");
const memoryGraph = document.querySelector("#memoryGraph");
const deletedMemoryList = document.querySelector("#deletedMemoryList");
const restrictedMemoryList = document.querySelector("#restrictedMemoryList");
const archivedMemoryList = document.querySelector("#archivedMemoryList");
const memoryAllLabelList = document.querySelector("#memoryAllLabelList");
const memoryAllHint = document.querySelector("#memoryAllHint");
const memoryRestrictedHint = document.querySelector("#memoryRestrictedHint");
const memoryActiveCount = document.querySelector("#memoryActiveCount");
const memoryDeletedCount = document.querySelector("#memoryDeletedCount");
const memoryEmbeddedCount = document.querySelector("#memoryEmbeddedCount");
const memoryPendingEmbeddingCount = document.querySelector("#memoryPendingEmbeddingCount");
const memoryRestrictedCount = document.querySelector("#memoryRestrictedCount");
const memoryArchivedCount = document.querySelector("#memoryArchivedCount");
const memoryLabelList = document.querySelector("#memoryLabelList");
const processMemoryEmbeddings = document.querySelector("#processMemoryEmbeddings");
const memoryEmbeddingNotice = document.querySelector("#memoryEmbeddingNotice");
const memoryEmbeddingProgressBar = document.querySelector("#memoryEmbeddingProgressBar");
const memoryTabs = Array.from(document.querySelectorAll("[data-memory-tab]"));
const memoryTabPanels = Array.from(document.querySelectorAll("[data-memory-panel]"));
const sharedLineSummary = document.querySelector("#sharedLineSummary");
const sharedLineUpdated = document.querySelector("#sharedLineUpdated");
const sharedLineList = document.querySelector("#sharedLineList");
const sharedLineAgentFilter = document.querySelector("#sharedLineAgentFilter");
const sharedLineLineCount = document.querySelector("#sharedLineLineCount");
const sharedLineHistoryCount = document.querySelector("#sharedLineHistoryCount");
const sharedLineSnapshotCount = document.querySelector("#sharedLineSnapshotCount");
const sharedLineHandoffCount = document.querySelector("#sharedLineHandoffCount");
const sharedLineTitleInput = document.querySelector("#sharedLineTitleInput");
const createSharedLine = document.querySelector("#createSharedLine");
const sharedLineInput = document.querySelector("#sharedLineInput");
const sharedLineStatusInput = document.querySelector("#sharedLineStatusInput");
const sharedLineFactsInput = document.querySelector("#sharedLineFactsInput");
const sharedLineDetailStatus = document.querySelector("#sharedLineDetailStatus");
const sharedLineNotice = document.querySelector("#sharedLineNotice");
const saveSharedLine = document.querySelector("#saveSharedLine");
const sharedLineMetadataPanel = document.querySelector("#sharedLineMetadataPanel");
const sharedLineResume = document.querySelector("#sharedLineResume");
const sharedLineHistoryList = document.querySelector("#sharedLineHistoryList");
const sharedLineSnapshotList = document.querySelector("#sharedLineSnapshotList");
const createSharedLineHandoff = document.querySelector("#createSharedLineHandoff");
const sharedLineHandoffObjective = document.querySelector("#sharedLineHandoffObjective");
const sharedLineHandoffCompleted = document.querySelector("#sharedLineHandoffCompleted");
const sharedLineHandoffOpenItems = document.querySelector("#sharedLineHandoffOpenItems");
const sharedLineHandoffNextStep = document.querySelector("#sharedLineHandoffNextStep");
const sharedLineHandoffList = document.querySelector("#sharedLineHandoffList");
const copySharedLineResume = document.querySelector("#copySharedLineResume");
const sharedLineTabs = Array.from(document.querySelectorAll("[data-shared-line-tab]"));
const sharedLineTabPanels = Array.from(document.querySelectorAll("[data-shared-line-panel]"));

const translations = {
  en: {
    "nav.home": "Home",
    "nav.memory": "Memoria",
    "nav.sharedLine": "Shared Line",
    "nav.innerLife": "InnerLife",
    "nav.data": "Data",
    "nav.connections": "Connections",
    "nav.logs": "Logs",
    "nav.agentSetup": "Agent Setup",
    "nav.models": "Models",
    "nav.settings": "Settings",
    "footer.label": "Local ownership",
    "footer.value": "Portable core",
    "status.coreReady": "Core ready",
    "status.localMode": "Local mode",
    "status.dataSafe": "Data safe",
    "actions.refresh": "Refresh",
    "actions.openGateway": "Open runtime",
    "actions.import": "Import",
    "actions.export": "Export",
    "actions.restore": "Restore",
    "actions.archive": "Archive",
    "actions.open": "Open",
    "actions.copy": "Copy",
    "actions.cancel": "Cancel",
    "actions.search": "Search",
    "actions.edit": "Edit",
    "actions.delete": "Delete",
    "actions.embed": "Embed",
    "actions.restrict": "Restrict",
    "actions.unrestrict": "Unrestrict",
    "common.status": "Status",
    "common.path": "Path",
    "common.ready": "Ready",
    "common.paused": "Paused",
    "common.missing": "Missing",
    "common.needsAttention": "Needs attention",
    "common.optionalMissing": "Optional missing",
    "common.planned": "Planned",
    "common.notTracked": "Not tracked yet",
    "common.checking": "Checking...",
    "common.found": "Found",
    "common.notCreated": "Not created",
    "common.ok": "OK",
    "common.manual": "Manual",
    "common.local": "Local",
    "common.sqlite": "SQLite",
    "view.home.title": "ClaraCore",
    "view.home.subtitle": "Local Control Center",
    "view.memory.title": "Memoria",
    "view.memory.subtitle": "Owned long-term facts, separate from chat flow.",
    "view.sharedLine.title": "Shared Line",
    "view.sharedLine.subtitle": "The current position that connected agents can resume from.",
    "view.innerLife.title": "InnerLife",
    "view.innerLife.subtitle": "Agent-managed internal activity, grouped by agent identity.",
    "view.data.title": "Data",
    "view.data.subtitle": "Import, export, and restore without mixing risky actions.",
    "view.connections.title": "Connections",
    "view.connections.subtitle": "Local entry points for external agents.",
    "view.agentSetup.title": "Agent Setup",
    "view.agentSetup.subtitle": "Copyable handoff notes for external agents.",
    "view.models.title": "Models",
    "view.models.subtitle": "Model providers and daemon runtime controls.",
    "view.settings.title": "Settings",
    "view.settings.subtitle": "General product settings and shortcuts.",
    "home.model.title": "Model & Provider",
    "home.model.settings": "Model settings",
    "home.model.provider": "Provider",
    "home.model.localProvider": "Local provider",
    "home.model.model": "Model",
    "home.model.configuredOutside": "configured outside app",
    "home.model.mode": "Mode",
    "home.model.edit": "Edit models",
    "home.dataLocation.title": "Data Location",
    "home.dataLocation.root": "Root",
    "home.dataLocation.openControls": "Open data controls",
    "home.importExport.title": "Import / Export",
    "home.importExport.lastImport": "Last import",
    "home.importExport.lastExport": "Last export",
    "home.cognitive.title": "Cognitive Snapshot",
    "home.cognitive.body": "Cross-system health and current cognitive load.",
    "home.cognitive.updated": "Updated now",
    "home.cognitive.gateway": "Gateway",
    "home.cognitive.memoria": "Memoria",
    "home.cognitive.sharedLine": "Shared Line",
    "home.cognitive.innerLife": "InnerLife",
    "home.cognitive.totalMemories": "Total memories",
    "home.cognitive.activeMemories": "Active memories",
    "home.cognitive.labels": "Labels",
    "home.cognitive.vectors": "Vectors",
    "home.cognitive.totalLines": "Total lines",
    "home.cognitive.activeLines": "Active lines",
    "home.cognitive.handoffs": "Handoffs",
    "home.cognitive.agents": "Agents",
    "home.cognitive.pendingShares": "Pending shares",
    "home.cognitive.activeEvents": "Active events",
    "home.cognitive.sessions": "Sessions",
    "home.cognitive.daemon": "Daemon",
    "home.cognitive.surface": "Surface",
    "home.cognitive.mcpTools": "MCP tools",
    "home.cognitive.lifecycle": "Lifecycle",
    "home.cognitive.next": "Next",
    "home.cognitive.gatewayReady": "available",
    "home.cognitive.gatewayToolsReady": "ready",
    "home.cognitive.gatewayLifecycleReady": "Desktop-owned",
    "home.cognitive.gatewayNext": "agent-ready",
    "home.cognitive.maintenance": "Maintenance",
    "home.cognitive.issue": "Issue",
    "home.agentView.title": "Agent View",
    "home.agentView.body": "Current line, Memory, InnerLife, and recent Gateway activity.",
    "home.agentView.noActiveLine": "No active line",
    "home.agentView.noCurrentPosition": "No current position saved yet.",
    "home.agentView.recalledMemories": "Relevant memories",
    "home.agentView.pendingThoughts": "Pending shares",
    "home.agentView.gatewayDecisions": "Gateway calls",
    "home.agentView.currentScene": "Current scene",
    "home.agentView.recentFocus": "Recent focus",
    "home.agentView.none": "None",
    "home.trace.title": "Gateway Trace",
    "home.trace.body": "Recent MCP calls through the Desktop-owned Gateway.",
    "home.trace.openConnections": "Open connections",
    "home.trace.empty": "No Gateway calls yet.",
    "home.events.title": "Recent system events",
    "home.events.localOnly": "Local only",
    "health.title": "First-run check",
    "health.ok": "Ready",
    "health.warn": "Needs attention",
    "health.error": "Error",
    "health.dataRoot": "Data directory",
    "health.database": "Product database",
    "health.gateway": "Gateway entry",
    "health.embedding": "Embedding setup",
    "health.oldServices": "Old services",
    "home.agentConnection.title": "Agent connection",
    "home.agentConnection.developmentPlan": "Product reset plan",
    "home.agentConnection.designPlan": "Legacy v0.2 plan",
    "home.backup.title": "Backup reminder",
    "home.backup.body": "Export memory and shared-line data before large local changes.",
    "home.backup.review": "Review data",
    "memory.title": "Memoria",
    "memory.body": "Agent-facing facts, recall, labels, and structured event streams in one local store.",
    "memory.agentSurface": "Agent surface",
    "memory.store": "Store",
    "memory.policy": "Policy",
    "memory.factsFirst": "Facts first",
    "memory.boundary": "Boundary",
    "memory.factsAndRecords": "Facts and records",
    "memory.preview": "Preview",
    "memory.tab.search": "Search",
    "memory.tab.labels": "Labels",
    "memory.tab.graph": "Graph",
    "memory.tab.all": "All",
    "memory.tab.restricted": "Restricted",
    "memory.tab.archive": "Archive",
    "memory.preview1": "Recent facts stay reviewable.",
    "memory.preview2": "Private data remains under the local ClaraCore folder.",
    "memory.preview3": "Search and cleanup controls will land behind confirmation.",
    "memory.form.title": "Title",
    "memory.form.body": "Fact",
    "memory.form.labels": "Labels",
    "memory.form.restricted": "Restricted content",
    "memory.form.save": "Save memory",
    "memory.form.update": "Update memory",
    "memory.form.saved": "Memory saved",
    "memory.form.updated": "Memory updated",
    "memory.form.deleted": "Memory deleted",
    "memory.form.restored": "Memory restored",
    "memory.form.saveFailed": "Could not save memory",
    "memory.delete.confirm": "Delete this memory?",
    "memory.factWrite.title": "Long-term facts",
    "memory.empty": "No memories yet.",
    "memory.deleted.empty": "No deleted memories.",
    "memory.deleted.title": "Deleted memories",
    "memory.archived.empty": "No archived memories.",
    "memory.archived.title": "Archived memories",
    "memory.restricted.empty": "No restricted memories.",
    "memory.restricted.title": "Restricted memories",
    "memory.all.title": "All visible memories",
    "memory.list.sample": "Showing {shown} of {total}",
    "memory.lazy.openTab": "Open this view to load records.",
    "memory.loadMore": "Load more",
    "memory.labels.title": "Labels",
    "memory.labels.empty": "No labels yet.",
    "memory.aliases.title": "Label aliases",
    "memory.aliases.aliasPlaceholder": "Alias",
    "memory.aliases.labelPlaceholder": "Canonical label",
    "memory.aliases.save": "Save alias",
    "memory.aliases.saved": "Alias saved",
    "memory.aliases.deleted": "Alias deleted",
    "memory.aliases.empty": "No aliases yet.",
    "memory.aliases.saveFailed": "Could not save alias",
    "memory.aliases.deleteConfirm": "Delete this label alias?",
    "memory.stats.active": "Active",
    "memory.stats.deleted": "Deleted",
    "memory.stats.embedded": "Embedded",
    "memory.stats.pending": "Pending",
    "memory.stats.restricted": "Restricted",
    "memory.stats.archived": "Archived",
    "memory.records.title": "Structured records",
    "memory.records.user": "User",
    "memory.records.type": "Type",
    "memory.records.time": "Time",
    "memory.records.timezone": "Timezone",
    "memory.records.name": "Name",
    "memory.records.dedupe": "Dedupe key",
    "memory.records.note": "Note",
    "memory.records.value": "Value JSON",
    "memory.records.save": "Save record",
    "memory.records.saved": "Record saved",
    "memory.records.saveFailed": "Could not save record",
    "memory.records.invalidJson": "Value must be valid JSON",
    "memory.records.empty": "No structured records yet.",
    "memory.records.typesEmpty": "No record types yet.",
    "memory.records.summary": "{count} records · {days} active days · {steps} steps",
    "memory.graph.title": "Memory graph",
    "memory.graph.empty": "No graph links yet.",
    "memory.graph.summary": "{nodes} nodes · {edges} links",
    "memory.graph.primaryLayer": "Primary layer",
    "memory.graph.restrictedLayer": "Restricted layer",
    "memory.graph.zoomOut": "Zoom out",
    "memory.graph.zoomIn": "Zoom in",
    "memory.graph.fit": "Fit",
    "memory.graph.kind.memory": "Memory",
    "memory.graph.kind.label": "Label",
    "memory.graph.kind.shared_line": "Shared Line",
    "memory.graph.edge.labeled": "labeled",
    "memory.graph.edge.uses": "uses",
    "memory.maintenance.title": "Maintenance",
    "memory.maintenance.run": "Run maintenance",
    "memory.maintenance.ok": "No maintenance issues found.",
    "memory.maintenance.needsRepair": "{count} issue(s) need repair.",
    "memory.maintenance.done": "Maintenance complete",
    "memory.maintenance.failed": "Maintenance failed",
    "memory.maintenance.missing_embeddings": "Missing embeddings",
    "memory.maintenance.failed_embeddings": "Failed embeddings",
    "memory.maintenance.stale_embeddings": "Stale embeddings",
    "memory.maintenance.orphan_labels": "Orphan labels",
    "memory.maintenance.alias_labels": "Alias labels",
    "memory.maintenance.queued_embeddings": "Queued embeddings",
    "memory.maintenance.removed_orphan_labels": "Removed orphan labels",
    "memory.maintenance.canonicalized_alias_labels": "Canonicalized alias labels",
    "memory.merge.title": "Merge suggestions",
    "memory.merge.empty": "No merge suggestions found.",
    "memory.merge.count": "{count} suggestion(s)",
    "memory.merge.action": "Merge",
    "memory.merge.confirm": "Merge this source Memory into the target Memory? The source will move to deleted memories.",
    "memory.merge.done": "Memory merged",
    "memory.merge.failed": "Merge failed",
    "memory.merge.same_title": "same title",
    "memory.merge.body_contained": "overlapping body",
    "memory.merge.shared_labels": "shared labels",
    "memory.merge.similar_text": "similar text",
    "memory.archive.title": "Archive suggestions",
    "memory.archive.empty": "No dormant memories found.",
    "memory.archive.count": "{count} dormant item(s)",
    "memory.archive.run": "Archive dormant",
    "memory.archive.done": "Dormant memories archived",
    "memory.archive.failed": "Archive failed",
    "memory.archive.confirm": "Archive this Memory? It will leave normal list and search results.",
    "memory.archive.restoreDone": "Archived Memory restored",
    "memory.archive.dormant": "dormant",
    "memory.search.placeholder": "Search memory",
    "memory.search.list": "Showing recent memories.",
    "memory.search.keyword": "Keyword search results.",
    "memory.search.hybrid": "Keyword + vector search results.",
    "memory.search.fallback": "Vector search unavailable. Showing keyword results.",
    "memory.search.source.keyword": "Keyword",
    "memory.search.source.vector": "Vector",
    "memory.search.source.keyword+vector": "Keyword + vector",
    "memory.search.score": "Match",
    "memory.restricted.confirm": "View restricted memories? This section can contain private facts.",
    "memory.embedding.pending": "Embedding pending",
    "memory.embedding.ready": "Embedded",
    "memory.embedding.failed": "Embedding failed",
    "memory.embedding.saved": "Embedding updated",
    "memory.embedding.processing": "Embedding...",
    "memory.embedding.processPending": "Generate all missing vectors",
    "memory.embedding.processed": "Processed {count} vector item(s)",
    "memory.embedding.processFailed": "Vector generation failed",
    "memory.embedding.nonePending": "No pending vectors",
    "memory.embedding.progress": "Processed {processed}/{total}; ready {ready}, failed {failed}, pending {pending}",
    "memory.embedding.stopped": "Some failed; check Logs.",
    "logs.title": "Logs",
    "logs.body": "Runtime events and Gateway traces for local debugging.",
    "logs.runtimeEvents": "Runtime events",
    "logs.gatewayTraces": "Gateway traces",
    "logs.localOnly": "Local only",
    "logs.follow": "Follow",
    "logs.noRuntimeEvents": "No runtime events yet.",
    "logs.noGatewayTraces": "No Gateway traces yet.",
    "logs.empty": "No log lines yet.",
    "sharedLine.title": "Shared Line",
    "sharedLine.body": "Continuity shows the current shared position so agents can resume with less drift.",
    "sharedLine.agentSurface": "Agent surface",
    "sharedLine.activeLine": "Active line",
    "sharedLine.boundary": "Boundary",
    "sharedLine.currentPositionOnly": "Current position only",
    "sharedLine.stats.lines": "Lines",
    "sharedLine.stats.history": "History",
    "sharedLine.stats.snapshots": "Snapshots",
    "sharedLine.stats.handoffs": "Handoffs",
    "sharedLine.filter.agent": "Agent",
    "sharedLine.filter.allAgents": "All agents",
    "sharedLine.tab.lines": "Lines",
    "sharedLine.tab.history": "History",
    "sharedLine.tab.snapshots": "Snapshots",
    "sharedLine.tab.handoffs": "Handoffs",
    "sharedLine.detail.title": "Line detail",
    "sharedLine.group.basic": "Basic",
    "sharedLine.group.progress": "Progress",
    "sharedLine.group.boundary": "Interpretation & boundary",
    "sharedLine.group.trace": "Trace",
    "sharedLine.current": "Current position",
    "sharedLine.meta.agent": "Agent",
    "sharedLine.meta.visibility": "Visibility",
    "sharedLine.meta.mode": "Mode",
    "sharedLine.meta.nextStep": "Next step",
    "sharedLine.meta.stateSummary": "State summary",
    "sharedLine.meta.currentInterpretation": "Current interpretation",
    "sharedLine.meta.realityLine": "Shared reality line",
    "sharedLine.meta.entryPosture": "Entry posture",
    "sharedLine.meta.confirmedGround": "Confirmed ground",
    "sharedLine.meta.provisionalRead": "Provisional read",
    "sharedLine.meta.boundaryNotes": "Boundary notes",
    "sharedLine.meta.misreadRisks": "Misread risks",
    "sharedLine.meta.positionHistory": "Position history",
    "sharedLine.meta.affectiveTrace": "Affective trace",
    "sharedLine.lines": "Lines",
    "sharedLine.linesEmpty": "No Shared Lines yet.",
    "sharedLine.createLine": "Create line",
    "sharedLine.renameLine": "Rename line",
    "sharedLine.lineCreated": "Shared Line created",
    "sharedLine.lineActivated": "Shared Line activated",
    "sharedLine.lineRenamed": "Shared Line renamed",
    "sharedLine.lineArchived": "Shared Line archived",
    "sharedLine.lineRestored": "Shared Line restored",
    "sharedLine.renamePrompt": "Rename Shared Line",
    "sharedLine.archiveConfirm": "Archive this Shared Line?",
    "sharedLine.lineFailed": "Could not update Shared Line",
    "sharedLine.currentBody": "Ready to read from Continuity.",
    "sharedLine.currentEmpty": "No current position saved yet.",
    "sharedLine.resume": "Resume packet",
    "sharedLine.resumeBody": "Prepared for connected agents.",
    "sharedLine.review": "Review point",
    "sharedLine.reviewBody": "Confirm before overwriting context.",
    "sharedLine.controls": "Controls",
    "sharedLine.form.summary": "Update current position",
    "sharedLine.form.status": "Interpretation status",
    "sharedLine.form.factsUsed": "Facts used",
    "sharedLine.form.factsPlaceholder": "memory_id, note, source",
    "sharedLine.form.titlePlaceholder": "New line title",
    "sharedLine.form.placeholder": "Write the current shared position...",
    "sharedLine.form.save": "Save position",
    "sharedLine.form.saved": "Shared position saved",
    "sharedLine.form.saveFailed": "Could not save shared position",
    "sharedLine.form.confirmOverwrite": "This will overwrite a confirmed Shared Line. Continue?",
    "sharedLine.status.draft": "Draft",
    "sharedLine.status.confirmed": "Confirmed",
    "sharedLine.history": "Recent history",
    "sharedLine.historyEmpty": "No saved history yet.",
    "sharedLine.snapshots": "Recent snapshots",
    "sharedLine.snapshotsEmpty": "No snapshots yet.",
    "sharedLine.handoffs": "Recent handoffs",
    "sharedLine.handoffsEmpty": "No handoffs yet.",
    "sharedLine.createHandoff": "Create handoff",
    "sharedLine.handoff.objective": "Objective",
    "sharedLine.handoff.objectivePlaceholder": "Continue from the current Shared Line.",
    "sharedLine.handoff.completed": "Completed",
    "sharedLine.handoff.openItems": "Open items",
    "sharedLine.handoff.nextStep": "Next step",
    "sharedLine.handoff.nextStepPlaceholder": "What should the next agent do first?",
    "sharedLine.handoff.listPlaceholder": "item one, item two",
    "sharedLine.handoffCreated": "Handoff created",
    "sharedLine.handoffFailed": "Could not create handoff",
    "sharedLine.copyResume": "Copy resume packet",
    "sharedLine.resumeCopied": "Resume packet copied",
    "innerLife.body": "InnerLife is written and maintained by agents through MCP or CLI. This page only shows agent-scoped state.",
    "innerLife.paused": "Paused by default",
    "innerLife.pausedBody": "This is a normal state, not a failure.",
    "innerLife.allowQuiet": "Allow quiet background review",
    "innerLife.shareReviewed": "Share only reviewed output",
    "innerLife.startSession": "Start session",
    "innerLife.endSession": "End session",
    "innerLife.sessionStarted": "Session started",
    "innerLife.sessionEnded": "Session ended",
    "innerLife.sessionFailed": "Session action failed",
    "innerLife.sessionSummary": "Session summary",
    "innerLife.sessionSummaryPlaceholder": "What should InnerLife remember from this session?",
    "innerLife.sessionsEmpty": "No InnerLife sessions yet.",
    "innerLife.inbox": "Inbox",
    "innerLife.inboxPlaceholder": "Submit material for InnerLife to digest later.",
    "innerLife.submitInbox": "Submit inbox",
    "innerLife.inboxSubmitted": "Inbox submitted",
    "innerLife.runDigest": "Run digest",
    "innerLife.digestRan": "Digest completed",
    "innerLife.digestEmpty": "No digest runs yet.",
    "innerLife.enableDaemon": "Enable daemon",
    "innerLife.pauseDaemon": "Pause daemon",
    "innerLife.tickDaemon": "Run due tick",
    "innerLife.daemonEnabled": "Daemon enabled",
    "innerLife.daemonPaused": "Daemon paused",
    "innerLife.daemonTicked": "Daemon tick completed",
    "innerLife.daemonStatus": "Daemon",
    "innerLife.nextRun": "Next run",
    "innerLife.lastResult": "Last result",
    "innerLife.recovery": "Recovery",
    "innerLife.recoveryRetry": "failed, retry in",
    "innerLife.doctor": "Doctor",
    "innerLife.doctorEmpty": "No recovery action is needed.",
    "innerLife.daemonFailed": "Daemon action failed",
    "innerLife.shareContext": "Share context",
    "innerLife.shareContextPlaceholder": "What is happening now?",
    "innerLife.checkTiming": "Check share timing",
    "innerLife.timingChecked": "Share timing checked",
    "innerLife.timingEmpty": "No share timing checks yet.",
    "innerLife.processOnce": "Process once",
    "innerLife.pendingShares": "Pending shares",
    "innerLife.events": "Events",
    "innerLife.thoughts": "Thoughts",
    "innerLife.runtime": "Runtime",
    "innerLife.sessions": "Sessions",
    "innerLife.digests": "Digests",
    "innerLife.inboxRecent": "Recent inbox",
    "innerLife.inboxEmpty": "No inbox items yet.",
    "innerLife.timingChecks": "Timing checks",
    "innerLife.shareQueue": "Share queue",
    "innerLife.reviewPolicy": "Agent-managed",
    "innerLife.empty": "No pending InnerLife output.",
    "innerLife.generated": "InnerLife output is waiting for review.",
    "innerLife.processFailed": "InnerLife process failed",
    "innerLife.approved": "InnerLife output approved",
    "innerLife.rejected": "InnerLife output rejected",
    "innerLife.reviewFailed": "InnerLife review failed",
    "innerLife.approve": "Approve",
    "innerLife.reject": "Reject",
    "innerLife.approvedOutput": "Approved output",
    "innerLife.applyMemory": "Save as Memory",
    "innerLife.applySharedLine": "Use as Shared Line",
    "innerLife.markUsed": "Used",
    "innerLife.markDeferred": "Defer",
    "innerLife.markDiscarded": "Discard",
    "innerLife.marked": "Share updated",
    "innerLife.appliedMemory": "Saved as Memory",
    "innerLife.appliedSharedLine": "Shared Line updated",
    "innerLife.applyFailed": "Could not apply InnerLife output",
    "data.title": "Data import and export",
    "data.body": "Import and restore are separated so destructive actions stay clear.",
    "data.exportBackup": "Export backup",
    "data.exportMemoryArchive": "Export Memory JSON",
    "data.importMemoryArchive": "Import Memory JSON",
    "data.importOldMemoria": "Import old Memoria",
    "data.importOldContinuity": "Import old Continuity",
    "data.importOldInnerLife": "Import old InnerLife",
    "data.importRecords": "Import records",
    "data.restoreBackup": "Restore from backup",
    "data.location": "Location",
    "data.dataRoot": "Data root",
    "data.recentBackups": "Recent backups",
    "data.openBackupsFolder": "Open backups folder",
    "data.manifest": "Manifest",
    "data.verified": "Verified",
    "data.quickCheck": "Quick check",
    "data.noBackups": "No backups yet.",
    "data.backupCreated": "Backup created",
    "data.backupFailed": "Backup failed",
    "data.memoryExported": "Memory JSON exported",
    "data.memoryExportFailed": "Memory JSON export failed",
    "data.memoryImportDone": "Memory JSON import complete",
    "data.memoryImportFailed": "Memory JSON import failed",
    "data.memoryImportCancelled": "Memory JSON import cancelled",
    "data.memoryArchiveSummary": "{memories} memories, {records} records, {aliases} aliases",
    "data.oldMemoriaConfirm": "Import old Memoria into this product database? A verified product backup will be created first. Old source files will be read only.",
    "data.oldMemoriaImported": "Old Memoria import complete",
    "data.oldMemoriaImportFailed": "Old Memoria import failed",
    "data.oldMemoriaSummary": "{memories} memories, {records} records",
    "data.oldContinuityConfirm": "Import old Continuity into this product database? A verified product backup will be created first. Old source files will be read only.",
    "data.oldContinuityImported": "Old Continuity import complete",
    "data.oldContinuityImportFailed": "Old Continuity import failed",
    "data.oldContinuitySummary": "{lines} lines, {positions} positions, {handoffs} handoffs",
    "data.oldInnerLifeConfirm": "Import old InnerLife into this product database? A verified product backup will be created first. Old source files will be read only.",
    "data.oldInnerLifeImported": "Old InnerLife import complete",
    "data.oldInnerLifeImportFailed": "Old InnerLife import failed",
    "data.oldInnerLifeSummary": "{profiles} profiles, {inbox} inbox, {events} events, {shares} shares, {digestRuns} digests, {sessions} sessions",
    "data.restoreConfirm": "Restore this verified backup? A safety backup of the current database will be created first.",
    "data.restorePrompt": "Type RESTORE to confirm.",
    "data.restorePreview": "Restore preview",
    "data.restoreCurrent": "Current",
    "data.restoreTarget": "Target",
    "data.restoreMemories": "Memories",
    "data.restoreSharedLines": "Shared lines",
    "data.restoreBackups": "Backups",
    "data.restoreWillRemove": "Will be removed",
    "data.restoreWillReturn": "Will be restored",
    "data.restoreWillChange": "Will be changed",
    "data.restoreNoRecordChanges": "No Memory record changes in this restore preview.",
    "data.restoreCancelled": "Restore cancelled",
    "data.restoreDone": "Backup restored",
    "data.restoreFailed": "Restore failed",
    "data.importPreview": "Import preview",
    "data.importPreviewReadOnly": "Read-only scan. Import only writes to this product database after a verified backup.",
    "data.importPreviewMissing": "Not found",
    "data.importPreviewFound": "Found",
    "data.importPreviewTables": "Tables",
    "data.importPreviewQuickCheck": "Quick check",
    "data.importPlan": "Plan",
    "data.importCandidates": "candidate rows",
    "data.importSkipped": "Skipped tables",
    "data.importEnabled": "Import enabled",
    "data.importDisabled": "Import disabled",
    "data.importRequirement": "Requirement",
    "data.importTarget": "Target",
    "data.importSamples": "Sample rows",
    "data.importNoSamples": "No sample rows.",
    "connections.title": "Connections",
    "connections.body": "External agents connect through the local gateway instead of owning the data layer.",
    "connections.mcpCommand": "MCP command",
    "connections.mcpConfig": "MCP config",
    "connections.shortcuts": "Shortcuts",
    "connections.copyMcpCommand": "Copy MCP command",
    "connections.copyMcpConfig": "Copy MCP config",
    "connections.openGatewayFolder": "Open runtime folder",
    "connections.agentActivity": "Agent activity",
    "connections.noGatewayTraces": "No Gateway calls yet.",
    "connections.httpEndpoints": "HTTP endpoints",
    "connections.copied.mcpCommand": "MCP command copied",
    "connections.copied.mcpConfig": "MCP config copied",
    "connections.copied.endpoint": "Endpoint copied",
    "connections.endpoint.gateway-web": "Gateway console",
    "connections.endpoint.memoria-web": "Memoria",
    "connections.endpoint.continuity-web": "Continuity",
    "connections.endpoint.innerlife-web": "InnerLife",
    "connections.noEndpoints": "Unified Gateway endpoints will appear here after the product core is implemented.",
    "agentSetup.title": "Agent Setup",
    "agentSetup.body": "Copy this setup note into an agent so it can connect through the unified Gateway first.",
    "agentSetup.actions": "Actions",
    "agentSetup.copy": "Copy setup note",
    "agentSetup.openConnections": "Open connection details",
    "agentSetup.includes": "Includes",
    "agentSetup.includeGateway": "Gateway MCP config",
    "agentSetup.includeServices": "Planned product-owned service entry points",
    "agentSetup.includeRuntime": "Bundled runtime and data paths",
    "agentSetup.includeTroubleshooting": "Troubleshooting notes",
    "agentSetup.copied": "Setup note copied",
    "settings.title": "Model settings",
    "settings.body": "Provider and model choices should be understandable without reading configuration files.",
    "settings.modelsTitle": "Model configuration",
    "settings.modelsBody": "Keep model wiring simple and visible before enabling InnerLife.",
    "settings.memoriaTitle": "Memoria embedding",
    "settings.memoriaBody": "Used for Memory semantic search and graph-ready recall.",
    "settings.innerLifeTitle": "InnerLife daemon model",
    "settings.innerLifeBody": "Required before the InnerLife daemon can become useful.",
    "settings.endpoint": "Endpoint",
    "settings.embeddingModel": "Embedding model",
    "settings.dimension": "Dimension",
    "settings.source": "Source",
    "settings.lightModel": "Light model",
    "settings.deepModel": "Deep model",
    "settings.pollSeconds": "Loop seconds",
    "settings.pollMinutes": "Loop minutes",
    "settings.apiKey": "API key",
    "settings.apiKeyRef": "API key reference",
    "settings.apiKeyRefPlaceholder": "env:OPENAI_API_KEY",
    "settings.apiKey.configured": "Configured",
    "settings.apiKey.notConfigured": "Not configured",
    "settings.apiKey.copied": "API key reference copied",
    "settings.save": "Save settings",
    "settings.saveModels": "Save model configuration",
    "settings.saved": "Model configuration saved",
    "settings.saveFailed": "Could not save model configuration",
    "settings.status.ready": "ready",
    "settings.status.disabled": "disabled",
    "settings.status.future": "future",
    "settings.openaiCompatible": "OpenAI compatible",
    "settings.simpleBoundaryTitle": "Boundary",
    "settings.memoryRole": "Memory",
    "settings.memoryRoleBody": "Embedding only",
    "settings.innerLifeRole": "InnerLife",
    "settings.innerLifeRoleBody": "Daemon model",
    "settings.secretsRole": "Secrets",
    "settings.daemonStatus": "Daemon status",
    "settings.generalTitle": "Settings",
    "settings.generalBody": "General product settings stay here. Model wiring and daemon controls live in Models.",
    "settings.modelsRole": "Models",
    "settings.modelsRoleBody": "Provider and daemon runtime controls",
    "settings.dataRole": "Data",
    "settings.dataRoleBody": "Import, export, backup, and restore",
    "settings.agentRole": "Agents",
    "settings.agentRoleBody": "Connect through Gateway, MCP, or CLI",
    "settings.shortcutsTitle": "Shortcuts",
    "settings.openModels": "Open Models",
    "settings.openData": "Open Data",
    "settings.openAgentSetup": "Open Agent Setup",
    "settings.appearanceTitle": "Appearance",
    "settings.appearanceBody": "Language, theme, window behavior, and tray behavior.",
    "settings.pathsTitle": "Data paths",
    "settings.pathsBody": "Data directory, backup directory, and default import/export paths.",
    "settings.logsTitle": "Logs and diagnostics",
    "settings.logsBody": "Log retention days and debug trace switches.",
    "settings.gatewayTitle": "Gateway policy",
    "settings.gatewayBody": "Local access policy, port preferences, and transport preferences.",
    "settings.privacyTitle": "Privacy and security",
    "settings.privacyBody": "Restricted content visibility, automatic maintenance, and secret storage status.",
    "settings.developerTitle": "Advanced developer options",
    "settings.developerBody": "Development paths, packaged runtime information, and diagnostic toggles.",
    "settings.futureProviderNote": "Reserved for a future small ClaraCore local model.",
    "settings.defaultModel": "Default model",
    "settings.advanced": "Advanced",
    "settings.showServiceDetails": "Show service details",
    "settings.serviceDetailsBody": "Paths and process controls will stay behind disclosure controls.",
    "module.gateway.description": "Unified MCP and local service entry",
    "module.memoria.description": "Long-term factual memory",
    "module.continuity.description": "Shared line and current position",
    "module.innerlife.description": "Agent internal activity",
    "module.gateway.address": "Address",
    "module.gateway.localGateway": "Local gateway",
    "module.gateway.protocol": "Protocol",
    "module.gateway.auth": "Auth",
    "module.memoria.location": "Location",
    "module.memoria.localStore": "Local store",
    "module.memoria.agentSurface": "Agent surface",
    "module.memoria.records": "Memories",
    "module.memoria.vectors": "Vectors",
    "module.memoria.restricted": "Restricted",
    "module.memoria.maintenance": "Maintenance",
    "module.memoria.readyForAgents": "CLI + MCP ready",
    "module.continuity.role": "Role",
    "module.continuity.sharedLine": "Shared line",
    "module.innerlife.agentSurface": "Agent surface",
    "module.innerlife.agents": "Agents",
    "module.innerlife.inbox": "Inbox",
    "module.innerlife.shares": "Shares",
    "module.innerlife.sessions": "Sessions",
    "module.innerlife.daemon": "Daemon",
    "module.innerlife.reason": "Reason",
    "module.innerlife.nextRun": "Next run",
    "module.innerlife.whenEnabled": "When enabled",
    "event.requiredFound.title": "Product modules planned",
    "event.requiredFound.detail": "Gateway, Memoria, Continuity, and InnerLife are being rebuilt inside Desktop.",
    "event.requiredMissing.title": "Product module not implemented yet",
    "event.memoryFound.title": "Product database located",
    "event.memoryMissing.title": "Product database not created yet",
    "event.innerLifeFound.title": "InnerLife data is available",
    "event.innerLifeMissing.title": "InnerLife has no local data yet",
    "event.innerLife.detail": "Agents manage InnerLife through MCP or CLI.",
    "runtime.customRoot": "Custom root",
    "runtime.developmentRoot": "Development root",
    "runtime.requiredPresent": "Required local modules are present.",
    "runtime.needsAttention": "One or more required modules need attention.",
    "runtime.isolatedProductDev": "Isolated product dev",
    "runtime.customProductData": "Custom product data",
    "runtime.productCorePlanned": "Product core planned; old local services are not controlled.",
    "runtime.databaseReady": "Product database is present.",
    "runtime.databaseNotCreated": "Product database has not been created yet.",
    "runtime.unavailable": "Unavailable",
    "runtime.unableSnapshot": "Unable to read runtime snapshot.",
    "monitor.uptime": "Uptime",
    "monitor.cpu": "CPU",
    "monitor.ram": "RAM",
    "monitor.disk": "Disk",
    "monitor.localTime": "Local time"
  },
  zh: {
    "nav.home": "首页",
    "nav.memory": "记忆",
    "nav.sharedLine": "共同线",
    "nav.innerLife": "内在活动",
    "nav.data": "数据",
    "nav.connections": "连接",
    "nav.logs": "日志",
    "nav.agentSetup": "Agent 设置",
    "nav.models": "模型",
    "nav.settings": "设置",
    "footer.label": "本机掌控",
    "footer.value": "可迁移核心",
    "status.coreReady": "核心可用",
    "status.localMode": "本机模式",
    "status.dataSafe": "数据在本机",
    "actions.refresh": "刷新",
    "actions.openGateway": "打开运行目录",
    "actions.import": "导入",
    "actions.export": "导出",
    "actions.restore": "恢复",
    "actions.archive": "归档",
    "actions.open": "打开",
    "actions.copy": "复制",
    "actions.cancel": "取消",
    "actions.search": "搜索",
    "actions.edit": "编辑",
    "actions.delete": "删除",
    "actions.embed": "生成向量",
    "actions.restrict": "设为受限",
    "actions.unrestrict": "恢复普通",
    "common.status": "状态",
    "common.path": "路径",
    "common.ready": "可用",
    "common.paused": "已暂停",
    "common.missing": "缺失",
    "common.needsAttention": "需要处理",
    "common.optionalMissing": "可选项缺失",
    "common.planned": "待实现",
    "common.notTracked": "尚未记录",
    "common.checking": "检查中...",
    "common.found": "已找到",
    "common.notCreated": "未创建",
    "common.ok": "正常",
    "common.manual": "手动",
    "common.local": "本机",
    "common.sqlite": "SQLite",
    "view.home.title": "ClaraCore",
    "view.home.subtitle": "本机控制中心",
    "view.memory.title": "记忆",
    "view.memory.subtitle": "长期事实记录，和聊天流程分开。",
    "view.sharedLine.title": "共同线",
    "view.sharedLine.subtitle": "外部智能体可以从这里接上当前进展。",
    "view.innerLife.title": "内在活动",
    "view.innerLife.subtitle": "由 Agent 管理的内在活动，按 agent 身份查看。",
    "view.data.title": "数据",
    "view.data.subtitle": "导入、导出、恢复分开处理，避免误操作。",
    "view.connections.title": "连接",
    "view.connections.subtitle": "给外部智能体使用的本机入口。",
    "view.agentSetup.title": "Agent 设置",
    "view.agentSetup.subtitle": "给外部智能体复制使用的接入说明。",
    "view.models.title": "模型",
    "view.models.subtitle": "模型供应商与 daemon 运行控制。",
    "view.settings.title": "设置",
    "view.settings.subtitle": "通用产品设置和快捷入口。",
    "home.model.title": "模型与提供方",
    "home.model.settings": "模型设置",
    "home.model.provider": "提供方",
    "home.model.localProvider": "本机提供方",
    "home.model.model": "模型",
    "home.model.configuredOutside": "在应用外配置",
    "home.model.mode": "模式",
    "home.model.edit": "编辑模型",
    "home.dataLocation.title": "数据位置",
    "home.dataLocation.root": "根目录",
    "home.dataLocation.openControls": "打开数据控制",
    "home.importExport.title": "导入 / 导出",
    "home.importExport.lastImport": "上次导入",
    "home.importExport.lastExport": "上次导出",
    "home.cognitive.title": "认知快照",
    "home.cognitive.body": "跨系统健康状态和当前认知负载。",
    "home.cognitive.updated": "刚刚更新",
    "home.cognitive.gateway": "Gateway",
    "home.cognitive.memoria": "Memoria",
    "home.cognitive.sharedLine": "共同线",
    "home.cognitive.innerLife": "InnerLife",
    "home.cognitive.totalMemories": "记忆总数",
    "home.cognitive.activeMemories": "活跃记忆",
    "home.cognitive.labels": "标签",
    "home.cognitive.vectors": "向量",
    "home.cognitive.totalLines": "线总数",
    "home.cognitive.activeLines": "活跃线",
    "home.cognitive.handoffs": "交接",
    "home.cognitive.agents": "Agent",
    "home.cognitive.pendingShares": "待分享",
    "home.cognitive.activeEvents": "活跃事件",
    "home.cognitive.sessions": "会话",
    "home.cognitive.daemon": "后台循环",
    "home.cognitive.surface": "入口",
    "home.cognitive.mcpTools": "MCP 工具",
    "home.cognitive.lifecycle": "生命周期",
    "home.cognitive.next": "下一步",
    "home.cognitive.gatewayReady": "可用",
    "home.cognitive.gatewayToolsReady": "可用",
    "home.cognitive.gatewayLifecycleReady": "Desktop 自有",
    "home.cognitive.gatewayNext": "Agent 可接入",
    "home.cognitive.maintenance": "维护",
    "home.cognitive.issue": "问题",
    "home.agentView.title": "Agent 视图",
    "home.agentView.body": "当前线、Memory、InnerLife 和最近 Gateway 活动。",
    "home.agentView.noActiveLine": "没有活跃线",
    "home.agentView.noCurrentPosition": "还没有保存当前位置。",
    "home.agentView.recalledMemories": "相关记忆",
    "home.agentView.pendingThoughts": "待分享",
    "home.agentView.gatewayDecisions": "Gateway 调用",
    "home.agentView.currentScene": "当前场景",
    "home.agentView.recentFocus": "最近焦点",
    "home.agentView.none": "无",
    "home.trace.title": "Gateway 轨迹",
    "home.trace.body": "Desktop 自有 Gateway 最近的 MCP 调用。",
    "home.trace.openConnections": "打开连接",
    "home.trace.empty": "还没有 Gateway 调用。",
    "home.events.title": "近期系统事件",
    "home.events.localOnly": "仅本机",
    "health.title": "首次运行检查",
    "health.ok": "可用",
    "health.warn": "需要注意",
    "health.error": "错误",
    "health.dataRoot": "数据目录",
    "health.database": "产品数据库",
    "health.gateway": "Gateway 入口",
    "health.embedding": "向量设置",
    "health.oldServices": "旧服务",
    "home.agentConnection.title": "智能体连接",
    "home.agentConnection.developmentPlan": "新产品计划",
    "home.agentConnection.designPlan": "旧 v0.2 计划",
    "home.backup.title": "备份提醒",
    "home.backup.body": "做较大本机改动前，先导出记忆和共同线数据。",
    "home.backup.review": "查看数据",
    "memory.title": "记忆",
    "memory.body": "给 agent 使用的事实、回召、标签和结构化流水都在这个本机存储里。",
    "memory.agentSurface": "Agent 接口",
    "memory.store": "存储位置",
    "memory.policy": "策略",
    "memory.factsFirst": "事实优先",
    "memory.boundary": "边界",
    "memory.factsAndRecords": "事实与流水",
    "memory.preview": "预览",
    "memory.tab.search": "搜索",
    "memory.tab.labels": "标签",
    "memory.tab.graph": "图谱",
    "memory.tab.all": "全部",
    "memory.tab.restricted": "受限",
    "memory.tab.archive": "归档",
    "memory.preview1": "近期事实保持可查看。",
    "memory.preview2": "私有数据留在本机 ClaraCore 文件夹里。",
    "memory.preview3": "搜索和清理控制会放在确认之后。",
    "memory.form.title": "标题",
    "memory.form.body": "事实",
    "memory.form.labels": "标签",
    "memory.form.restricted": "受限内容",
    "memory.form.save": "保存记忆",
    "memory.form.update": "更新记忆",
    "memory.form.saved": "记忆已保存",
    "memory.form.updated": "记忆已更新",
    "memory.form.deleted": "记忆已删除",
    "memory.form.restored": "记忆已恢复",
    "memory.form.saveFailed": "记忆保存失败",
    "memory.delete.confirm": "删除这条记忆？",
    "memory.factWrite.title": "长期事实",
    "memory.empty": "还没有记忆。",
    "memory.deleted.empty": "没有已删除记忆。",
    "memory.deleted.title": "已删除记忆",
    "memory.archived.empty": "没有已归档记忆。",
    "memory.archived.title": "已归档记忆",
    "memory.restricted.empty": "没有受限记忆。",
    "memory.restricted.title": "受限记忆",
    "memory.all.title": "全部可见记忆",
    "memory.list.sample": "显示 {shown} / {total}",
    "memory.lazy.openTab": "打开这个视图后加载记录。",
    "memory.loadMore": "加载更多",
    "memory.labels.title": "标签",
    "memory.labels.empty": "还没有标签。",
    "memory.aliases.title": "标签别名",
    "memory.aliases.aliasPlaceholder": "别名",
    "memory.aliases.labelPlaceholder": "主标签",
    "memory.aliases.save": "保存别名",
    "memory.aliases.saved": "别名已保存",
    "memory.aliases.deleted": "别名已删除",
    "memory.aliases.empty": "还没有别名。",
    "memory.aliases.saveFailed": "别名保存失败",
    "memory.aliases.deleteConfirm": "删除这个标签别名？",
    "memory.stats.active": "可用",
    "memory.stats.deleted": "已删除",
    "memory.stats.embedded": "已向量化",
    "memory.stats.pending": "待处理",
    "memory.stats.restricted": "受限",
    "memory.stats.archived": "已归档",
    "memory.records.title": "结构化记录",
    "memory.records.user": "用户",
    "memory.records.type": "类型",
    "memory.records.time": "时间",
    "memory.records.timezone": "时区",
    "memory.records.name": "名称",
    "memory.records.dedupe": "去重键",
    "memory.records.note": "备注",
    "memory.records.value": "JSON 内容",
    "memory.records.save": "保存记录",
    "memory.records.saved": "记录已保存",
    "memory.records.saveFailed": "记录保存失败",
    "memory.records.invalidJson": "JSON 内容格式不正确",
    "memory.records.empty": "还没有结构化记录。",
    "memory.records.typesEmpty": "还没有记录类型。",
    "memory.records.summary": "{count} 条流水 · {days} 个活跃日 · {steps} 步",
    "memory.graph.title": "记忆图谱",
    "memory.graph.empty": "还没有图谱关系。",
    "memory.graph.summary": "{nodes} 个节点 · {edges} 条关系",
    "memory.graph.primaryLayer": "主要图层",
    "memory.graph.restrictedLayer": "受限图层",
    "memory.graph.zoomOut": "缩小",
    "memory.graph.zoomIn": "放大",
    "memory.graph.fit": "适配",
    "memory.graph.kind.memory": "记忆",
    "memory.graph.kind.label": "标签",
    "memory.graph.kind.shared_line": "共同线",
    "memory.graph.edge.labeled": "标记为",
    "memory.graph.edge.uses": "引用",
    "memory.maintenance.title": "维护",
    "memory.maintenance.run": "运行维护",
    "memory.maintenance.ok": "没有发现需要维护的问题。",
    "memory.maintenance.needsRepair": "{count} 个问题需要修复。",
    "memory.maintenance.done": "维护完成",
    "memory.maintenance.failed": "维护失败",
    "memory.maintenance.missing_embeddings": "缺失向量状态",
    "memory.maintenance.failed_embeddings": "失败向量",
    "memory.maintenance.stale_embeddings": "过期向量",
    "memory.maintenance.orphan_labels": "孤立标签",
    "memory.maintenance.alias_labels": "别名标签",
    "memory.maintenance.queued_embeddings": "已重新排队向量",
    "memory.maintenance.removed_orphan_labels": "已移除孤立标签",
    "memory.maintenance.canonicalized_alias_labels": "已归并别名标签",
    "memory.merge.title": "合并建议",
    "memory.merge.empty": "没有发现合并建议。",
    "memory.merge.count": "{count} 条建议",
    "memory.merge.action": "合并",
    "memory.merge.confirm": "把来源 Memory 合并到目标 Memory 吗？来源会移入已删除列表。",
    "memory.merge.done": "Memory 已合并",
    "memory.merge.failed": "合并失败",
    "memory.merge.same_title": "标题相同",
    "memory.merge.body_contained": "正文重叠",
    "memory.merge.shared_labels": "标签相同",
    "memory.merge.similar_text": "内容相似",
    "memory.archive.title": "归档建议",
    "memory.archive.empty": "没有发现休眠记忆。",
    "memory.archive.count": "{count} 条休眠项",
    "memory.archive.run": "归档休眠项",
    "memory.archive.done": "休眠记忆已归档",
    "memory.archive.failed": "归档失败",
    "memory.archive.confirm": "归档这条 Memory 吗？它会离开普通列表和搜索结果。",
    "memory.archive.restoreDone": "已归档 Memory 已恢复",
    "memory.archive.dormant": "休眠",
    "memory.search.placeholder": "搜索记忆",
    "memory.search.list": "显示最近记忆。",
    "memory.search.keyword": "普通搜索结果。",
    "memory.search.hybrid": "普通搜索 + 向量搜索结果。",
    "memory.search.fallback": "向量搜索暂不可用，已显示普通搜索结果。",
    "memory.search.source.keyword": "普通匹配",
    "memory.search.source.vector": "向量匹配",
    "memory.search.source.keyword+vector": "普通 + 向量",
    "memory.search.score": "匹配度",
    "memory.restricted.confirm": "查看受限记忆？这里可能包含私密事实。",
    "memory.embedding.pending": "待生成向量",
    "memory.embedding.ready": "向量已生成",
    "memory.embedding.failed": "向量失败",
    "memory.embedding.saved": "向量状态已更新",
    "memory.embedding.processing": "正在生成向量...",
    "memory.embedding.processPending": "生成全部缺失向量",
    "memory.embedding.processed": "已处理 {count} 条向量",
    "memory.embedding.processFailed": "向量生成失败",
    "memory.embedding.nonePending": "没有待生成向量",
    "memory.embedding.progress": "已处理 {processed}/{total}；成功 {ready}，失败 {failed}，待处理 {pending}",
    "memory.embedding.stopped": "部分失败，查看日志。",
    "logs.title": "日志",
    "logs.body": "本机运行事件和 Gateway 调用轨迹，用于调试。",
    "logs.runtimeEvents": "运行事件",
    "logs.gatewayTraces": "Gateway 轨迹",
    "logs.localOnly": "仅本机",
    "logs.follow": "跟随",
    "logs.noRuntimeEvents": "还没有运行事件。",
    "logs.noGatewayTraces": "还没有 Gateway 轨迹。",
    "logs.empty": "还没有日志行。",
    "sharedLine.title": "共同线",
    "sharedLine.body": "共同线只保存当前可接续的位置，让智能体回来时少偏移。",
    "sharedLine.agentSurface": "智能体入口",
    "sharedLine.activeLine": "当前线",
    "sharedLine.boundary": "边界",
    "sharedLine.currentPositionOnly": "只管当前位置",
    "sharedLine.stats.lines": "线",
    "sharedLine.stats.history": "历史",
    "sharedLine.stats.snapshots": "快照",
    "sharedLine.stats.handoffs": "交接",
    "sharedLine.filter.agent": "Agent",
    "sharedLine.filter.allAgents": "全部 Agent",
    "sharedLine.tab.lines": "线",
    "sharedLine.tab.history": "历史",
    "sharedLine.tab.snapshots": "快照",
    "sharedLine.tab.handoffs": "交接",
    "sharedLine.detail.title": "线详情",
    "sharedLine.group.basic": "基础信息",
    "sharedLine.group.progress": "当前进展",
    "sharedLine.group.boundary": "解释与边界",
    "sharedLine.group.trace": "轨迹",
    "sharedLine.current": "当前位置",
    "sharedLine.meta.agent": "Agent",
    "sharedLine.meta.visibility": "可见性",
    "sharedLine.meta.mode": "模式",
    "sharedLine.meta.nextStep": "下一步",
    "sharedLine.meta.stateSummary": "状态摘要",
    "sharedLine.meta.currentInterpretation": "当前解释",
    "sharedLine.meta.realityLine": "共同现实线",
    "sharedLine.meta.entryPosture": "进入姿态",
    "sharedLine.meta.confirmedGround": "已确认地面",
    "sharedLine.meta.provisionalRead": "临时解读",
    "sharedLine.meta.boundaryNotes": "边界标注",
    "sharedLine.meta.misreadRisks": "易误读风险",
    "sharedLine.meta.positionHistory": "位置轨迹",
    "sharedLine.meta.affectiveTrace": "情绪轨迹",
    "sharedLine.lines": "线",
    "sharedLine.linesEmpty": "还没有共同线。",
    "sharedLine.createLine": "创建线",
    "sharedLine.renameLine": "重命名线",
    "sharedLine.lineCreated": "共同线已创建",
    "sharedLine.lineActivated": "共同线已切换",
    "sharedLine.lineRenamed": "共同线已重命名",
    "sharedLine.lineArchived": "共同线已归档",
    "sharedLine.lineRestored": "共同线已恢复",
    "sharedLine.renamePrompt": "重命名共同线",
    "sharedLine.archiveConfirm": "归档这条共同线？",
    "sharedLine.lineFailed": "共同线操作失败",
    "sharedLine.currentBody": "可以从共同线读取。",
    "sharedLine.currentEmpty": "还没有保存当前位置。",
    "sharedLine.resume": "接续包",
    "sharedLine.resumeBody": "可提供给已连接的智能体。",
    "sharedLine.review": "确认点",
    "sharedLine.reviewBody": "覆盖上下文前先确认。",
    "sharedLine.controls": "控制",
    "sharedLine.form.summary": "更新当前位置",
    "sharedLine.form.status": "判断状态",
    "sharedLine.form.factsUsed": "引用事实",
    "sharedLine.form.factsPlaceholder": "memory_id, 备注, 来源",
    "sharedLine.form.titlePlaceholder": "新线标题",
    "sharedLine.form.placeholder": "写下当前共同位置...",
    "sharedLine.form.save": "保存位置",
    "sharedLine.form.saved": "共同线已保存",
    "sharedLine.form.saveFailed": "共同线保存失败",
    "sharedLine.form.confirmOverwrite": "这会覆盖已确认的共同线，继续吗？",
    "sharedLine.status.draft": "草稿",
    "sharedLine.status.confirmed": "已确认",
    "sharedLine.history": "最近历史",
    "sharedLine.historyEmpty": "还没有保存历史。",
    "sharedLine.snapshots": "最近快照",
    "sharedLine.snapshotsEmpty": "还没有快照。",
    "sharedLine.handoffs": "最近交接",
    "sharedLine.handoffsEmpty": "还没有交接记录。",
    "sharedLine.createHandoff": "创建交接",
    "sharedLine.handoff.objective": "目标",
    "sharedLine.handoff.objectivePlaceholder": "从当前共同线继续。",
    "sharedLine.handoff.completed": "已完成",
    "sharedLine.handoff.openItems": "待处理",
    "sharedLine.handoff.nextStep": "下一步",
    "sharedLine.handoff.nextStepPlaceholder": "下一个智能体先做什么？",
    "sharedLine.handoff.listPlaceholder": "事项一, 事项二",
    "sharedLine.handoffCreated": "交接已创建",
    "sharedLine.handoffFailed": "交接创建失败",
    "sharedLine.copyResume": "复制接续包",
    "sharedLine.resumeCopied": "接续包已复制",
    "innerLife.body": "InnerLife 由 Agent 通过 MCP 或 CLI 写入和维护，这里只按 agent 查看状态。",
    "innerLife.paused": "默认暂停",
    "innerLife.pausedBody": "这是正常状态，不是故障。",
    "innerLife.allowQuiet": "允许安静后台检查",
    "innerLife.shareReviewed": "只分享已确认输出",
    "innerLife.startSession": "开始会话",
    "innerLife.endSession": "结束会话",
    "innerLife.sessionStarted": "会话已开始",
    "innerLife.sessionEnded": "会话已结束",
    "innerLife.sessionFailed": "会话操作失败",
    "innerLife.sessionSummary": "会话摘要",
    "innerLife.sessionSummaryPlaceholder": "这次会话里 InnerLife 应该记住什么？",
    "innerLife.sessionsEmpty": "还没有 InnerLife 会话。",
    "innerLife.inbox": "收件箱",
    "innerLife.inboxPlaceholder": "提交材料，稍后让 InnerLife 消化。",
    "innerLife.submitInbox": "提交收件箱",
    "innerLife.inboxSubmitted": "收件箱已提交",
    "innerLife.runDigest": "运行 digest",
    "innerLife.digestRan": "Digest 已完成",
    "innerLife.digestEmpty": "还没有 digest 记录。",
    "innerLife.enableDaemon": "启用后台循环",
    "innerLife.pauseDaemon": "暂停后台循环",
    "innerLife.tickDaemon": "运行到期检查",
    "innerLife.daemonEnabled": "后台循环已启用",
    "innerLife.daemonPaused": "后台循环已暂停",
    "innerLife.daemonTicked": "后台检查已完成",
    "innerLife.daemonStatus": "后台循环",
    "innerLife.nextRun": "下次运行",
    "innerLife.lastResult": "上次结果",
    "innerLife.recovery": "恢复",
    "innerLife.recoveryRetry": "次失败，重试倒计时",
    "innerLife.doctor": "诊断",
    "innerLife.doctorEmpty": "无需恢复操作。",
    "innerLife.daemonFailed": "后台循环操作失败",
    "innerLife.shareContext": "分享上下文",
    "innerLife.shareContextPlaceholder": "现在发生了什么？",
    "innerLife.checkTiming": "检查分享时机",
    "innerLife.timingChecked": "分享时机已检查",
    "innerLife.timingEmpty": "还没有分享时机检查。",
    "innerLife.processOnce": "手动处理一次",
    "innerLife.pendingShares": "待审核输出",
    "innerLife.events": "事件",
    "innerLife.thoughts": "思考",
    "innerLife.runtime": "运行状态",
    "innerLife.sessions": "会话",
    "innerLife.digests": "Digests",
    "innerLife.inboxRecent": "最近收件箱",
    "innerLife.inboxEmpty": "还没有收件箱条目。",
    "innerLife.timingChecks": "时机检查",
    "innerLife.shareQueue": "分享队列",
    "innerLife.reviewPolicy": "由 Agent 管理",
    "innerLife.empty": "没有待审核的 InnerLife 输出。",
    "innerLife.generated": "InnerLife 输出已生成，等待审核。",
    "innerLife.processFailed": "InnerLife 处理失败",
    "innerLife.approved": "InnerLife 输出已批准",
    "innerLife.rejected": "InnerLife 输出已拒绝",
    "innerLife.reviewFailed": "InnerLife 审核失败",
    "innerLife.approve": "批准",
    "innerLife.reject": "拒绝",
    "innerLife.approvedOutput": "已批准输出",
    "innerLife.applyMemory": "保存为 Memory",
    "innerLife.applySharedLine": "用于共同线",
    "innerLife.markUsed": "已使用",
    "innerLife.markDeferred": "延后",
    "innerLife.markDiscarded": "放弃",
    "innerLife.marked": "分享状态已更新",
    "innerLife.appliedMemory": "已保存为 Memory",
    "innerLife.appliedSharedLine": "共同线已更新",
    "innerLife.applyFailed": "InnerLife 输出应用失败",
    "data.title": "数据导入与导出",
    "data.body": "导入和恢复分开，危险操作要清楚。",
    "data.exportBackup": "导出备份",
    "data.exportMemoryArchive": "导出 Memory JSON",
    "data.importMemoryArchive": "导入 Memory JSON",
    "data.importOldMemoria": "导入旧 Memoria",
    "data.importOldContinuity": "导入旧 Continuity",
    "data.importOldInnerLife": "导入旧 InnerLife",
    "data.importRecords": "导入记录",
    "data.restoreBackup": "从备份恢复",
    "data.location": "位置",
    "data.dataRoot": "数据根目录",
    "data.recentBackups": "最近备份",
    "data.openBackupsFolder": "打开备份目录",
    "data.manifest": "清单",
    "data.verified": "已校验",
    "data.quickCheck": "快速检查",
    "data.noBackups": "还没有备份。",
    "data.backupCreated": "备份已创建",
    "data.backupFailed": "备份失败",
    "data.memoryExported": "Memory JSON 已导出",
    "data.memoryExportFailed": "Memory JSON 导出失败",
    "data.memoryImportDone": "Memory JSON 导入完成",
    "data.memoryImportFailed": "Memory JSON 导入失败",
    "data.memoryImportCancelled": "Memory JSON 导入已取消",
    "data.memoryArchiveSummary": "{memories} 条记忆，{records} 条结构记录，{aliases} 个别名",
    "data.oldMemoriaConfirm": "把旧 Memoria 导入当前产品库吗？会先创建已验证的产品备份，旧来源文件只读。",
    "data.oldMemoriaImported": "旧 Memoria 导入完成",
    "data.oldMemoriaImportFailed": "旧 Memoria 导入失败",
    "data.oldMemoriaSummary": "{memories} 条记忆，{records} 条记录",
    "data.oldContinuityConfirm": "把旧 Continuity 导入当前产品库吗？会先创建已验证的产品备份，旧来源文件只读。",
    "data.oldContinuityImported": "旧 Continuity 导入完成",
    "data.oldContinuityImportFailed": "旧 Continuity 导入失败",
    "data.oldContinuitySummary": "{lines} 条线，{positions} 条当前位置，{handoffs} 条交接",
    "data.oldInnerLifeConfirm": "把旧 InnerLife 导入当前产品库吗？会先创建已验证的产品备份，旧来源文件只读。",
    "data.oldInnerLifeImported": "旧 InnerLife 导入完成",
    "data.oldInnerLifeImportFailed": "旧 InnerLife 导入失败",
    "data.oldInnerLifeSummary": "{profiles} 个 profile，{inbox} 条收件箱，{events} 条事件，{shares} 条分享，{digestRuns} 条 digest，{sessions} 个会话",
    "data.restoreConfirm": "恢复这个已校验备份？系统会先为当前数据库创建一个安全备份。",
    "data.restorePrompt": "输入 RESTORE 确认恢复。",
    "data.restorePreview": "恢复预览",
    "data.restoreCurrent": "当前",
    "data.restoreTarget": "目标",
    "data.restoreMemories": "记忆",
    "data.restoreSharedLines": "共同线",
    "data.restoreBackups": "备份",
    "data.restoreWillRemove": "将被移除",
    "data.restoreWillReturn": "将恢复回来",
    "data.restoreWillChange": "将被改回备份版本",
    "data.restoreNoRecordChanges": "这次恢复不会改变 Memory 记录。",
    "data.restoreCancelled": "恢复已取消",
    "data.restoreDone": "备份已恢复",
    "data.restoreFailed": "恢复失败",
    "data.importPreview": "导入预览",
    "data.importPreviewReadOnly": "只读扫描；只有在创建已验证备份后，才会写入当前产品库。",
    "data.importPreviewMissing": "未找到",
    "data.importPreviewFound": "已找到",
    "data.importPreviewTables": "表",
    "data.importPreviewQuickCheck": "快速检查",
    "data.importPlan": "计划",
    "data.importCandidates": "候选行",
    "data.importSkipped": "跳过的表",
    "data.importEnabled": "导入已开启",
    "data.importDisabled": "导入未开启",
    "data.importRequirement": "要求",
    "data.importTarget": "目标",
    "data.importSamples": "样例行",
    "data.importNoSamples": "没有样例行。",
    "connections.title": "连接",
    "connections.body": "外部智能体通过本机网关连接，不直接接管数据层。",
    "connections.mcpCommand": "MCP 命令",
    "connections.mcpConfig": "MCP 配置",
    "connections.shortcuts": "快捷操作",
    "connections.copyMcpCommand": "复制 MCP 命令",
    "connections.copyMcpConfig": "复制 MCP 配置",
    "connections.openGatewayFolder": "打开运行目录",
    "connections.agentActivity": "Agent 活动",
    "connections.noGatewayTraces": "还没有 Gateway 调用。",
    "connections.httpEndpoints": "HTTP 入口",
    "connections.copied.mcpCommand": "MCP 命令已复制",
    "connections.copied.mcpConfig": "MCP 配置已复制",
    "connections.copied.endpoint": "入口地址已复制",
    "connections.endpoint.gateway-web": "Gateway 控制台",
    "connections.endpoint.memoria-web": "Memoria",
    "connections.endpoint.continuity-web": "Continuity",
    "connections.endpoint.innerlife-web": "InnerLife",
    "connections.noEndpoints": "产品核心实现后，统一 Gateway 入口会显示在这里。",
    "agentSetup.title": "Agent 设置",
    "agentSetup.body": "把这份说明复制给 agent，让它优先通过统一 Gateway 连接。",
    "agentSetup.actions": "操作",
    "agentSetup.copy": "复制接入说明",
    "agentSetup.openConnections": "打开连接详情",
    "agentSetup.includes": "包含内容",
    "agentSetup.includeGateway": "Gateway MCP 配置",
    "agentSetup.includeServices": "产品自有服务入口规划",
    "agentSetup.includeRuntime": "内置运行环境与数据路径",
    "agentSetup.includeTroubleshooting": "常见问题处理",
    "agentSetup.copied": "接入说明已复制",
    "settings.title": "模型设置",
    "settings.body": "提供方和模型选择要做到不用读配置文件也能看懂。",
    "settings.modelsTitle": "模型配置",
    "settings.modelsBody": "先把模型连接保持简单可见，再启用 InnerLife。",
    "settings.memoriaTitle": "Memoria 向量模型",
    "settings.memoriaBody": "用于记忆语义搜索和图谱召回。",
    "settings.innerLifeTitle": "InnerLife daemon 模型",
    "settings.innerLifeBody": "InnerLife 后台循环可用前需要先配置这里。",
    "settings.endpoint": "地址",
    "settings.embeddingModel": "向量模型",
    "settings.dimension": "维度",
    "settings.source": "来源",
    "settings.lightModel": "轻量模型",
    "settings.deepModel": "深度模型",
    "settings.pollSeconds": "循环秒数",
    "settings.pollMinutes": "循环分钟数",
    "settings.apiKey": "API key",
    "settings.apiKeyRef": "API key 引用",
    "settings.apiKeyRefPlaceholder": "env:OPENAI_API_KEY",
    "settings.apiKey.configured": "已配置",
    "settings.apiKey.notConfigured": "未配置",
    "settings.apiKey.copied": "API key 引用已复制",
    "settings.save": "保存设置",
    "settings.saveModels": "保存模型配置",
    "settings.saved": "模型配置已保存",
    "settings.saveFailed": "模型配置保存失败",
    "settings.status.ready": "可用",
    "settings.status.disabled": "关闭",
    "settings.status.future": "预留",
    "settings.openaiCompatible": "OpenAI 兼容",
    "settings.simpleBoundaryTitle": "边界",
    "settings.memoryRole": "Memory",
    "settings.memoryRoleBody": "只用于向量",
    "settings.innerLifeRole": "InnerLife",
    "settings.innerLifeRoleBody": "后台循环模型",
    "settings.secretsRole": "密钥",
    "settings.daemonStatus": "后台循环状态",
    "settings.generalTitle": "设置",
    "settings.generalBody": "通用产品设置放在这里。模型连接和 daemon 控制在模型页。",
    "settings.modelsRole": "模型",
    "settings.modelsRoleBody": "供应商与 daemon 运行控制",
    "settings.dataRole": "数据",
    "settings.dataRoleBody": "导入、导出、备份和恢复",
    "settings.agentRole": "Agents",
    "settings.agentRoleBody": "通过 Gateway、MCP 或 CLI 接入",
    "settings.shortcutsTitle": "快捷入口",
    "settings.openModels": "打开模型",
    "settings.openData": "打开数据",
    "settings.openAgentSetup": "打开 Agent 设置",
    "settings.appearanceTitle": "外观",
    "settings.appearanceBody": "语言、主题、窗口行为、托盘行为。",
    "settings.pathsTitle": "数据路径",
    "settings.pathsBody": "数据目录、备份目录、导入导出默认路径。",
    "settings.logsTitle": "日志与诊断",
    "settings.logsBody": "日志保留天数、debug trace 开关。",
    "settings.gatewayTitle": "Gateway 策略",
    "settings.gatewayBody": "本地访问策略、端口偏好、transport 偏好。",
    "settings.privacyTitle": "隐私与安全",
    "settings.privacyBody": "restricted 内容显示、自动维护、secret storage 状态。",
    "settings.developerTitle": "高级开发选项",
    "settings.developerBody": "开发路径、packaged runtime 信息、诊断开关。",
    "settings.futureProviderNote": "为后续 ClaraCore 内置小模型预留。",
    "settings.defaultModel": "默认模型",
    "settings.advanced": "高级",
    "settings.showServiceDetails": "显示服务详情",
    "settings.serviceDetailsBody": "路径和进程控制会放在展开区后面。",
    "module.gateway.description": "统一 MCP 与本机服务入口",
    "module.memoria.description": "长期事实记忆",
    "module.continuity.description": "共同线与当前位置",
    "module.innerlife.description": "Agent 内在活动",
    "module.gateway.address": "地址",
    "module.gateway.localGateway": "本机网关",
    "module.gateway.protocol": "协议",
    "module.gateway.auth": "授权",
    "module.memoria.location": "位置",
    "module.memoria.localStore": "本机存储",
    "module.memoria.agentSurface": "Agent 接口",
    "module.memoria.records": "记忆",
    "module.memoria.vectors": "向量",
    "module.memoria.restricted": "受限",
    "module.memoria.maintenance": "维护",
    "module.memoria.readyForAgents": "CLI + MCP 可用",
    "module.continuity.role": "作用",
    "module.continuity.sharedLine": "共同线",
    "module.innerlife.agentSurface": "Agent 接口",
    "module.innerlife.agents": "Agents",
    "module.innerlife.inbox": "收件箱",
    "module.innerlife.shares": "分享",
    "module.innerlife.sessions": "会话",
    "module.innerlife.daemon": "后台循环",
    "module.innerlife.reason": "原因",
    "module.innerlife.nextRun": "下次运行",
    "module.innerlife.whenEnabled": "启用后运行",
    "event.requiredFound.title": "产品模块已规划",
    "event.requiredFound.detail": "Gateway、Memoria、Continuity、InnerLife 会在 Desktop 内重建。",
    "event.requiredMissing.title": "产品模块尚未实现",
    "event.memoryFound.title": "产品数据库已找到",
    "event.memoryMissing.title": "产品数据库尚未创建",
    "event.innerLifeFound.title": "InnerLife 数据已可用",
    "event.innerLifeMissing.title": "InnerLife 暂无本地数据",
    "event.innerLife.detail": "Agent 通过 MCP 或 CLI 管理 InnerLife。",
    "runtime.customRoot": "自定义根目录",
    "runtime.developmentRoot": "开发根目录",
    "runtime.requiredPresent": "必需的本机模块都已找到。",
    "runtime.needsAttention": "有必需模块需要处理。",
    "runtime.isolatedProductDev": "隔离的新产品开发",
    "runtime.customProductData": "自定义产品数据目录",
    "runtime.productCorePlanned": "产品核心已规划，不控制旧的本机服务。",
    "runtime.databaseReady": "产品数据库已存在。",
    "runtime.databaseNotCreated": "产品数据库尚未创建。",
    "runtime.unavailable": "不可用",
    "runtime.unableSnapshot": "无法读取运行状态。",
    "monitor.uptime": "运行时长",
    "monitor.cpu": "CPU",
    "monitor.ram": "内存",
    "monitor.disk": "磁盘",
    "monitor.localTime": "本地时间"
  }
};

let currentLanguage = localStorage.getItem("claracore.language") || "en";

function t(key, values = {}) {
  const template = translations[currentLanguage]?.[key] || translations.en[key] || key;
  return Object.entries(values).reduce((result, [name, value]) => result.replace(`{${name}}`, value), template);
}

const views = {
  home: {
    titleKey: "view.home.title",
    subtitleKey: "view.home.subtitle",
    panel: document.querySelector("#homeView")
  },
  memory: {
    titleKey: "view.memory.title",
    subtitleKey: "view.memory.subtitle",
    panel: document.querySelector("#memoryView")
  },
  "shared-line": {
    titleKey: "view.sharedLine.title",
    subtitleKey: "view.sharedLine.subtitle",
    panel: document.querySelector("#sharedLineView")
  },
  innerlife: {
    titleKey: "view.innerLife.title",
    subtitleKey: "view.innerLife.subtitle",
    panel: document.querySelector("#innerlifeView")
  },
  data: {
    titleKey: "view.data.title",
    subtitleKey: "view.data.subtitle",
    panel: document.querySelector("#dataView")
  },
  connections: {
    titleKey: "view.connections.title",
    subtitleKey: "view.connections.subtitle",
    panel: document.querySelector("#connectionsView")
  },
  logs: {
    titleKey: "logs.title",
    subtitleKey: "logs.body",
    panel: document.querySelector("#logsView")
  },
  "agent-setup": {
    titleKey: "view.agentSetup.title",
    subtitleKey: "view.agentSetup.subtitle",
    panel: document.querySelector("#agentSetupView")
  },
  models: {
    titleKey: "view.models.title",
    subtitleKey: "view.models.subtitle",
    panel: document.querySelector("#modelView")
  },
  settings: {
    titleKey: "view.settings.title",
    subtitleKey: "view.settings.subtitle",
    panel: document.querySelector("#settingsView")
  }
};

let snapshot = null;
let activeView = "home";
let activeMemoryTab = "search";
let memoryGraphZoom = 1;
let memoryGraphPan = { x: 0, y: 0 };
let memoryGraphState = null;
let memoryGraphAnimation = null;
let memoryGraphDrag = null;
let activeMemoryGraphLayer = "primary";
let memoryEmbeddingBatchRunning = false;
let logFollowEnabled = true;
let logRefreshTimer = null;
let logRefreshInFlight = false;
const liveLogLines = [];
const loadedMemoryTabs = {
  all: false,
  restricted: false,
  archive: false
};
const memoryPaging = {
  pageSize: 20,
  all: { loaded: 0 },
  restricted: { loaded: 0 },
  archived: { loaded: 0 },
  deleted: { loaded: 0 }
};
let editingMemoryId = null;
let renamingSharedLineId = null;
let activeSharedLineAgentFilter = "";
let activeMemoryAgentFilter = "";
let activeInnerLifeAgentFilter = "";
let selectedSharedLineId = "";
let pendingRestoreBackupId = null;
let runtimeRefreshTimer = null;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJsonObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
}

function formatMode(mode) {
  if (mode === "custom-product-data") return t("runtime.customProductData");
  if (mode === "isolated-product-dev") return t("runtime.isolatedProductDev");
  return mode === "custom-root" ? t("runtime.customRoot") : t("runtime.developmentRoot");
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function serviceBadge(module) {
  if (module.state === "planned") {
    return `<span class="badge planned">${t("common.planned")}</span>`;
  }
  if (module.present && module.state === "paused") {
    return `<span class="badge paused">${t("common.paused")}</span>`;
  }
  if (module.present) {
    return `<span class="badge ok">${t("common.ready")}</span>`;
  }
  if (!module.required) {
    return `<span class="badge optional">${t("common.optionalMissing")}</span>`;
  }
  return `<span class="badge missing">${t("common.missing")}</span>`;
}

function moduleTone(module) {
  if (module.state === "planned") return "is-planned";
  if (!module.present && module.required) return "needs-attention";
  if (module.state === "paused") return "is-paused";
  return "is-ready";
}

function moduleIcon(module) {
  const icons = {
    gateway: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.8 5.2A7.8 7.8 0 1 0 15.8 18.8"></path>
        <path d="M7 15.8c2.4-2.5 4.5-3.7 6.4-3.6 1.6.1 2.7 1.1 4.1 1 1.2 0 2.1-.6 3-1.8"></path>
        <circle cx="17.3" cy="12" r="1.8"></circle>
      </svg>
    `,
    memoria: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16.2 5.5A7.2 7.2 0 1 0 16.2 18.5"></path>
        <path d="M7.2 16c2.1-2.3 4.1-3.4 5.8-3.3 1.5.1 2.5 1 3.8.9 1.1 0 2-.6 2.8-1.7"></path>
        <circle cx="16.8" cy="12" r="3.3"></circle>
        <circle cx="16.8" cy="12" r=".8"></circle>
      </svg>
    `,
    continuity: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 14.8c3-3.5 5.8-5.2 8.2-5.1 2.1.1 3.4 1.5 5.3 1.4"></path>
        <path d="M17 7.2l2.8 3.8-3.8 2.8"></path>
        <path d="M7.2 18.4A7.5 7.5 0 0 1 8 5.8"></path>
      </svg>
    `,
    innerlife: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.3 6.4A6.8 6.8 0 1 0 15.3 17.6"></path>
        <path d="M8.2 15.1c1.9-1.9 3.7-2.8 5.2-2.7 1.2.1 2 .8 3.1.8"></path>
        <path d="M17.2 9.2c1.8 1.1 1.8 4.5 0 5.6"></path>
        <circle cx="16.3" cy="12" r="1.2"></circle>
      </svg>
    `
  };
  return icons[module.id] || icons.gateway;
}

function moduleDetails(module) {
  if (module.state === "planned") {
    return [
      [t("common.status"), t("common.planned")],
      [t("home.model.mode"), formatMode(snapshot?.mode)],
      [t("common.path"), module.servicePath]
    ];
  }
  if (module.id === "gateway") {
    return [
      [t("module.gateway.address"), t("module.gateway.localGateway")],
      [t("module.gateway.protocol"), "MCP"],
      [t("module.gateway.auth"), t("common.local")],
      [t("common.path"), module.servicePath]
    ];
  }
  if (module.id === "memoria") {
    const stats = snapshot?.memoryStats || {};
    const maintenance = snapshot?.memoryMaintenance || {};
    const vectorSummary = `${stats.embeddedCount ?? 0} / ${stats.pendingEmbeddingCount ?? 0}${stats.failedEmbeddingCount ? ` / ${stats.failedEmbeddingCount}` : ""}`;
    return [
      [t("module.memoria.agentSurface"), t("module.memoria.readyForAgents")],
      [t("module.memoria.records"), `${stats.activeCount ?? 0} / ${stats.totalCount ?? 0}`],
      [t("module.memoria.vectors"), vectorSummary],
      [t("module.memoria.restricted"), String(stats.restrictedCount ?? 0)],
      [t("module.memoria.maintenance"), maintenance.status === "ok" ? t("common.ok") : t("common.needsAttention")]
    ];
  }
  if (module.id === "continuity") {
    return [
      [t("home.model.provider"), t("common.sqlite")],
      [t("module.continuity.role"), t("module.continuity.sharedLine")],
      [t("common.status"), module.present ? t("common.ok") : t("common.missing")],
      [t("common.path"), module.servicePath]
    ];
  }
  if (module.id === "innerlife") {
    const innerLife = snapshot?.innerLife || {};
    const counts = innerLife.counts || {};
    const daemon = innerLife.daemon || {};
    const agentIds = [
      ...(innerLife.sessions || []).map(itemAgentId),
      ...(innerLife.digestRuns || []).map(itemAgentId),
      ...(innerLife.inbox || []).map(itemAgentId),
      ...(innerLife.pendingShares || []).map(itemAgentId),
      ...(innerLife.recentShares || []).map(itemAgentId)
    ];
    const agentCount = new Set(agentIds.filter(Boolean)).size;
    return [
      [t("module.innerlife.agentSurface"), "MCP + CLI"],
      [t("module.innerlife.agents"), String(agentCount)],
      [t("module.innerlife.inbox"), `${counts.pending_inbox_count ?? 0} / ${counts.processed_inbox_count ?? 0}`],
      [t("module.innerlife.shares"), `${counts.pending_shares_count ?? 0} / ${counts.used_shares_count ?? 0}`],
      [t("module.innerlife.sessions"), `${counts.active_sessions_count ?? 0} / ${counts.ended_sessions_count ?? 0}`],
      [t("module.innerlife.daemon"), daemon.enabled ? (daemon.status || t("common.ready")) : t("common.paused")]
    ];
  }
  return [
    [t("common.status"), t("common.paused")],
    [t("module.innerlife.reason"), t("common.manual")],
    [t("module.innerlife.nextRun"), t("module.innerlife.whenEnabled")],
    [t("common.path"), module.servicePath]
  ];
}

function renderModules(modules) {
  moduleGrid.innerHTML = modules
    .map((module) => {
      const details = moduleDetails(module)
        .map(
          ([label, value]) => `
            <div class="module-detail">
              <span>${label}</span>
              <strong>${value}</strong>
            </div>
          `
        )
        .join("");
      return `
        <article class="module-card ${module.id} ${moduleTone(module)}">
          <header>
            <div class="module-icon">${moduleIcon(module)}</div>
            <div>
              <strong>${module.label}</strong>
              <p>${t(`module.${module.id}.description`)}</p>
            </div>
            ${serviceBadge(module)}
          </header>
          <div class="module-details">${details}</div>
        </article>
      `;
    })
    .join("");
}

function renderEvents() {
  if (!snapshot) return;
  const plannedModules = snapshot.modules.filter((module) => module.state === "planned");
  const requiredMissing = snapshot.modules.filter((module) => module.required && !module.present && module.state !== "planned");
  const innerLife = snapshot.modules.find((module) => module.id === "innerlife");
  const events = [
    {
      title:
        plannedModules.length > 0
          ? t("event.requiredFound.title")
          : requiredMissing.length === 0
            ? t("event.requiredFound.title")
            : t("event.requiredMissing.title"),
      detail:
        plannedModules.length > 0
          ? t("event.requiredFound.detail")
          : requiredMissing.length === 0
            ? t("event.requiredFound.detail")
          : requiredMissing.map((module) => module.label).join(", ")
    },
    {
      title: snapshot.data.databasePresent ? t("event.memoryFound.title") : t("event.memoryMissing.title"),
      detail: snapshot.data.databasePath
    },
    {
      title: innerLife?.present ? t("event.innerLifeFound.title") : t("event.innerLifeMissing.title"),
      detail: t("event.innerLife.detail")
    }
  ];

  eventList.innerHTML = events
    .map(
      (event) => `
        <li>
          <strong>${event.title}</strong>
          <span>${event.detail}</span>
        </li>
      `
    )
    .join("");
}

function homeSystemSnapshots() {
  const stats = snapshot?.memoryStats || {};
  const maintenance = snapshot?.memoryMaintenance || {};
  const firstMemoryIssue = (maintenance.issues || [])[0];
  const sharedLine = snapshot?.sharedLine || {};
  const lines = sharedLine.lines || [];
  const activeLines = lines.filter((line) => line.status !== "archived");
  const handoffs = sharedLine.handoffs || [];
  const innerLife = snapshot?.innerLife || {};
  const counts = innerLife.counts || {};
  const daemon = innerLife.daemon || {};
  const agentIds = new Set(
    [
      ...lines.map((line) => safeJsonObject(line.metadata, {}).agentId || line.agentId),
      ...(innerLife.sessions || []).map(itemAgentId),
      ...(innerLife.digestRuns || []).map(itemAgentId),
      ...(innerLife.inbox || []).map(itemAgentId),
      ...(innerLife.pendingShares || []).map(itemAgentId),
      ...(innerLife.recentShares || []).map(itemAgentId)
    ].filter(Boolean)
  );
  return [
    {
      id: "gateway",
      title: t("home.cognitive.gateway"),
      health: "ok",
      rows: [
        [t("home.cognitive.surface"), "stdio MCP"],
        [t("home.cognitive.mcpTools"), t("home.cognitive.gatewayToolsReady")],
        [t("home.cognitive.lifecycle"), t("home.cognitive.gatewayLifecycleReady")],
        [t("home.cognitive.next"), t("home.cognitive.gatewayNext")]
      ]
    },
    {
      id: "memoria",
      title: t("home.cognitive.memoria"),
      health: maintenance.status === "ok" ? "ok" : "warn",
      rows: [
        [t("home.cognitive.totalMemories"), stats.totalCount ?? 0],
        [t("home.cognitive.activeMemories"), stats.activeCount ?? 0],
        [t("home.cognitive.labels"), Array.isArray(stats.labels) ? stats.labels.length : 0],
        [t("home.cognitive.vectors"), `${stats.embeddedCount ?? 0}/${stats.pendingEmbeddingCount ?? 0}`],
        maintenance.status === "ok"
          ? [t("home.cognitive.maintenance"), t("common.ok")]
          : [t("home.cognitive.issue"), `${firstMemoryIssue?.code || maintenance.status} ${firstMemoryIssue?.count ?? ""}`.trim()]
      ]
    },
    {
      id: "shared-line",
      title: t("home.cognitive.sharedLine"),
      health: sharedLine.currentPosition?.summary ? "ok" : "warn",
      rows: [
        [t("home.cognitive.totalLines"), lines.length],
        [t("home.cognitive.activeLines"), activeLines.length],
        [t("home.cognitive.handoffs"), handoffs.length],
        [t("home.cognitive.agents"), agentIds.size]
      ]
    },
    {
      id: "innerlife",
      title: t("home.cognitive.innerLife"),
      health: daemon.status === "error" ? "error" : daemon.enabled ? "ok" : "warn",
      rows: [
        [t("home.cognitive.pendingShares"), counts.pending_shares_count ?? 0],
        [t("home.cognitive.activeEvents"), counts.events_count ?? 0],
        [t("home.cognitive.sessions"), counts.active_sessions_count ?? 0],
        [t("home.cognitive.daemon"), daemon.enabled ? daemon.status || t("common.ready") : t("common.paused")]
      ]
    }
  ];
}

function homeAgentIds() {
  const sharedLine = snapshot?.sharedLine || {};
  const innerLife = snapshot?.innerLife || {};
  const ids = [
    ...(sharedLine.lines || []).map((line) => safeJsonObject(line.metadata, {}).agentId || line.agentId),
    ...(innerLife.sessions || []).map(itemAgentId),
    ...(innerLife.digestRuns || []).map(itemAgentId),
    ...(innerLife.inbox || []).map(itemAgentId),
    ...(innerLife.pendingShares || []).map(itemAgentId),
    ...(innerLife.recentShares || []).map(itemAgentId),
    ...(snapshot?.gatewayTraces || []).map((trace) => trace.agentId)
  ].filter(Boolean);
  const unique = [...new Set(ids)];
  const priority = ["clara", "lara"].filter((agentId) => unique.includes(agentId));
  const rest = unique.filter((agentId) => !priority.includes(agentId));
  if (unique.length) return [...priority, ...rest].slice(0, 2);
  return ["codex"];
}

function compactHomeText(value, max = 118) {
  const text = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[•·]/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0] || "";
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function memoryMatchesAgent(memory, agentId) {
  const labels = Array.isArray(memory.labels) ? memory.labels : [];
  return labels.some((label) => label === `agent:${agentId}` || label === `agent-id:${agentId}` || label.endsWith(`:${agentId}`));
}

function latestAgentText(items, agentId, fields) {
  const match = (items || []).find((item) => itemAgentId(item) === agentId);
  if (!match) return "";
  for (const field of fields) {
    if (match[field]) return String(match[field]);
  }
  return "";
}

function homeAgentView(agentId) {
  const sharedLine = snapshot?.sharedLine || {};
  const lines = sharedLine.lines || [];
  const current = lines.find((line) => {
    const metadata = safeJsonObject(line.metadata, {});
    return (metadata.agentId || line.agentId) === agentId && line.status !== "archived";
  }) || (sharedLine.line?.status !== "archived" ? sharedLine.line : null);
  const innerLife = snapshot?.innerLife || {};
  const sessions = filterByAgent(innerLife.sessions || [], agentId);
  const activeSession = sessions.find((session) => session.status === "active") || sessions[0];
  const pendingShares = filterByAgent(innerLife.pendingShares || [], agentId);
  const traces = (snapshot?.gatewayTraces || []).filter((trace) => trace.agentId === agentId);
  const matchedMemories = (snapshot?.memories || []).filter((memory) => memoryMatchesAgent(memory, agentId));
  const recentFocus =
    latestAgentText(pendingShares, agentId, ["summary", "content", "body", "thought", "output"]) ||
    latestAgentText(filterByAgent(innerLife.inbox || [], agentId), agentId, ["body", "summary", "content"]);
  return {
    agentId,
    displayName: agentId,
    lineTitle: current?.title || t("home.agentView.noActiveLine"),
    lineBody: compactHomeText(current?.summary || sharedLine.currentPosition?.summary) || t("home.agentView.noCurrentPosition"),
    recalledMemories: matchedMemories.length,
    pendingThoughts: pendingShares.length,
    gatewayDecisions: traces.length,
    currentScene: activeSession ? activeSession.host || activeSession.externalSessionId || activeSession.id : t("home.agentView.none"),
    recentFocus: recentFocus || t("home.agentView.none")
  };
}

function renderHomeDashboard() {
  if (!snapshot) return;
  homeCognitiveUpdated.textContent = t("home.cognitive.updated");
  homeCognitiveSystems.innerHTML = homeSystemSnapshots()
    .map(
      (system) => `
        <article class="cognitive-system-card ${escapeHtml(system.health)}">
          <div class="cognitive-system-title">
            <strong>${escapeHtml(system.title)}</strong>
            <span class="badge ${escapeHtml(system.health === "error" ? "missing" : system.health === "warn" || system.health === "planned" ? "planned" : "ok")}">${escapeHtml(system.health === "planned" ? t("common.planned") : system.health)}</span>
          </div>
          <div class="cognitive-system-rows">
            ${system.rows
              .map(
                ([label, value]) => `
                  <div class="kv-row">
                    <span>${escapeHtml(label)}</span>
                    <strong>${escapeHtml(value)}</strong>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");

  homeAgentViewList.innerHTML = homeAgentIds()
    .map(homeAgentView)
    .map(
      (agent) => `
        <article class="home-agent-card">
          <div class="home-agent-head">
            <strong>${escapeHtml(agent.displayName)}</strong>
            <span>${escapeHtml(agent.lineTitle)}</span>
          </div>
          <p>${escapeHtml(agent.lineBody)}</p>
          <div class="home-agent-stats">
            <div><span>${escapeHtml(t("home.agentView.recalledMemories"))}</span><strong>${escapeHtml(agent.recalledMemories)}</strong></div>
            <div><span>${escapeHtml(t("home.agentView.pendingThoughts"))}</span><strong>${escapeHtml(agent.pendingThoughts)}</strong></div>
            <div><span>${escapeHtml(t("home.agentView.gatewayDecisions"))}</span><strong>${escapeHtml(agent.gatewayDecisions)}</strong></div>
          </div>
          <div class="home-agent-meta">
            <div><span>${escapeHtml(t("home.agentView.currentScene"))}</span><strong>${escapeHtml(agent.currentScene)}</strong></div>
            <div><span>${escapeHtml(t("home.agentView.recentFocus"))}</span><strong>${escapeHtml(agent.recentFocus)}</strong></div>
          </div>
        </article>
      `
    )
    .join("");

  const traces = snapshot.gatewayTraces || [];
  if (!traces.length) {
    homeTraceList.innerHTML = `<div class="endpoint-empty">${t("home.trace.empty")}</div>`;
  } else {
    homeTraceList.innerHTML = traces
      .slice(0, 5)
      .map(
        (trace) => `
          <article class="home-trace-row ${escapeHtml(trace.status || "")}">
            <div>
              <strong>${escapeHtml(trace.toolName || "unknown")}</strong>
              <span>${escapeHtml(trace.error || trace.responseSummary || "")}</span>
            </div>
            <code>${escapeHtml(trace.status || "ok")} · ${escapeHtml(String(trace.durationMs ?? 0))}ms</code>
          </article>
        `
      )
      .join("");
  }
}

function renderHealth() {
  const health = snapshot?.health;
  if (!health) return;
  healthSummary.textContent = t(`health.${health.status}`) || health.status;
  healthSummary.className = `quiet health-summary ${health.status}`;
  healthList.innerHTML = (health.checks || [])
    .map((check) => {
      const level = check.level || "warn";
      return `
        <div class="health-item ${escapeHtml(level)}">
          <span class="health-dot"></span>
          <div>
            <strong>${escapeHtml(t(check.labelKey) || check.id)}</strong>
            <small>${escapeHtml(check.detail || "")}</small>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderConnections() {
  if (!snapshot?.connections) return;
  mcpCommand.textContent = snapshot.connections.mcpCommand;
  mcpConfig.textContent = snapshot.connections.mcpConfig;
  const traces = snapshot.gatewayTraces || [];
  if (traces.length === 0) {
    gatewayTraceList.innerHTML = `<div class="endpoint-empty">${t("connections.noGatewayTraces")}</div>`;
  } else {
    gatewayTraceList.innerHTML = traces
      .slice(0, 8)
      .map(
        (trace) => `
          <div class="endpoint-card trace-card ${escapeHtml(trace.status || "")}">
            <div>
              <strong>${escapeHtml(trace.toolName || "")}</strong>
              <code>${escapeHtml(trace.status || "")} · ${escapeHtml(String(trace.durationMs ?? 0))}ms</code>
              <span>${escapeHtml(trace.error || trace.responseSummary || "")}</span>
              <small>${escapeHtml(trace.createdAt || "")}</small>
            </div>
          </div>
        `
      )
      .join("");
  }
  const endpoints = snapshot.connections.httpEndpoints || [];
  if (endpoints.length === 0) {
    httpEndpointList.innerHTML = `<div class="endpoint-empty">${t("connections.noEndpoints")}</div>`;
    return;
  }
  httpEndpointList.innerHTML = endpoints
    .map(
      (endpoint) => `
        <div class="endpoint-card">
          <div>
            <strong>${t(`connections.endpoint.${endpoint.id}`)}</strong>
            <code>${endpoint.url}</code>
            <span>${endpoint.healthUrl}</span>
          </div>
          <div class="endpoint-actions">
            <button class="secondary" data-open-url="${endpoint.url}">${t("actions.open")}</button>
            <button class="secondary" data-copy-url="${endpoint.url}">${t("actions.copy")}</button>
          </div>
        </div>
      `
    )
    .join("");
}

function renderLogs() {
  const runtimeEvents = (snapshot?.runtimeEvents || []).map((event) => ({
    createdAt: event.createdAt || "",
    line: `[${event.createdAt || ""}] [${event.level || "info"}/${event.source || "runtime"}] ${event.message || ""}${
      event.metadata && Object.keys(event.metadata).length ? ` ${JSON.stringify(event.metadata)}` : ""
    }`
  }));
  const gatewayEvents = (snapshot?.gatewayTraces || []).map((trace) => ({
    createdAt: trace.createdAt || "",
    line: `[${trace.createdAt || ""}] [gateway/${trace.status || "ok"}] ${trace.toolName || "unknown"} ${String(trace.durationMs ?? 0)}ms ${
      trace.error || trace.responseSummary || ""
    }`
  }));
  const lines = [...runtimeEvents, ...gatewayEvents, ...liveLogLines]
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(-200)
    .map((entry) => entry.line);
  logTerminal.textContent = lines.length ? lines.join("\n") : t("logs.empty");
  toggleLogFollow.classList.toggle("active", logFollowEnabled);
  if (logFollowEnabled) {
    logTerminal.scrollTop = logTerminal.scrollHeight;
  }
}

function appendLiveLogLine(source, message) {
  const createdAt = new Date().toISOString();
  liveLogLines.push({
    createdAt,
    line: `[${createdAt}] [ui/${source}] ${message}`
  });
  while (liveLogLines.length > 80) liveLogLines.shift();
  renderLogs();
}

function setEmbeddingProgress(stats, progress) {
  memoryEmbeddedCount.textContent = stats.embeddedCount ?? 0;
  memoryPendingEmbeddingCount.textContent = stats.pendingEmbeddingCount ?? 0;
  const pending = Number(stats.pendingEmbeddingCount || 0);
  const text = t("memory.embedding.progress", {
    processed: progress.processed,
    total: progress.total,
    ready: progress.ready,
    failed: progress.failed,
    pending
  });
  memoryEmbeddingNotice.textContent = text;
  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;
  memoryEmbeddingProgressBar.style.width = `${percent}%`;
  appendLiveLogLine("memoria", text);
}

function buildAgentSetupMarkdown() {
  if (!snapshot?.connections) return t("common.checking");
  const endpoints = (snapshot.connections.httpEndpoints || [])
    .map((endpoint) => `- ${t(`connections.endpoint.${endpoint.id}`)}: ${endpoint.url}`)
    .join("\n") || "- No HTTP endpoints are exposed yet.";
  return `# ClaraCore Agent Setup

This is the product-core reset setup. Desktop is the owner of Gateway, Memoria, Continuity, and InnerLife. Old local services are references only and should not be stopped or changed by this setup.

## Gateway MCP

\`\`\`json
${snapshot.connections.mcpConfig}
\`\`\`

## First Context Call

After connecting, call \`gateway_context\` first. It returns the current Shared Line, recent Memory, InnerLife state, Doctor guidance, and recovery advice in one packet.

## Runtime

- App root: ${snapshot.appRoot}
- Data root: ${snapshot.data.root}
- Product database: ${snapshot.data.databasePath}
- Gateway command: ${snapshot.connections.mcpCommand}
- Python: ${snapshot.connections.python}
- Python source: ${snapshot.connections.pythonSource}
- Gateway env: ${snapshot.connections.gatewayEnvPath}

## HTTP Management Endpoints

${endpoints}

## Product Service Plan

- Gateway: available for status, unified context, Memory tools, Shared Line tools, and InnerLife tools
- Memoria: available for manual memory create, list, search, update, and delete
- Continuity: available for current position and resume packet
- InnerLife: available for session lifecycle, reviewed shares, daemon controls, and Doctor guidance

More product-owned MCP tools and CLI fallbacks will be added through this Gateway.

## Troubleshooting

- If MCP tools are missing, confirm the command above uses the same Data root as Desktop.
- If an old local Gateway is running, leave it alone during this product-core development phase.
- If you need a custom data directory, set CLARACORE_DESKTOP_DATA_DIR before launching Desktop.
`;
}

function renderAgentSetup() {
  agentSetupMarkdown.textContent = buildAgentSetupMarkdown();
}

function modelStatus(provider, hasModel = true) {
  if (provider === "claracore-built-in") {
    return { label: t("settings.status.future"), className: "badge warn", note: t("settings.futureProviderNote") };
  }
  if (provider === "disabled") {
    return { label: t("settings.status.disabled"), className: "badge warn", note: "" };
  }
  return {
    label: hasModel ? t("settings.status.ready") : t("common.needsAttention"),
    className: hasModel ? "badge ok" : "badge warn",
    note: ""
  };
}

function maskMiddle(value) {
  const text = String(value || "").trim();
  if (!text) return t("settings.apiKey.notConfigured");
  if (text.length <= 8) return `${text.slice(0, 2)}••••${text.slice(-2)}`;
  return `${text.slice(0, 6)}••••••${text.slice(-4)}`;
}

function setSecretInput(input, value) {
  const secret = String(value || "").trim();
  input.dataset.secretValue = secret;
  input.dataset.maskedValue = secret ? maskMiddle(secret) : "";
  input.value = input.dataset.maskedValue;
}

function getSecretInputValue(input) {
  const visible = String(input.value || "").trim();
  if (visible === String(input.dataset.maskedValue || "")) {
    return String(input.dataset.secretValue || "").trim();
  }
  return visible;
}

function secondsToDisplayMinutes(value) {
  const seconds = Number.parseInt(String(value || 60), 10) || 60;
  return String(Math.max(1, Math.round(seconds / 60)));
}

function displayMinutesToSeconds(value) {
  const minutes = Number.parseInt(String(value || 1), 10) || 1;
  return String(Math.max(1, minutes) * 60);
}

function renderSettings() {
  if (!snapshot?.configuration) return;
  const memoria = snapshot.configuration.memoria;
  const innerlife = snapshot.configuration.innerlife;
  memoriaProvider.value = memoria.provider;
  memoriaEndpoint.value = memoria.endpoint;
  memoriaModel.value = memoria.model;
  memoriaDimension.value = memoria.dimension;
  setSecretInput(memoriaApiKey, memoria.apiKeyRef || "");
  memoriaSource.value = memoria.source;
  innerLifeBackend.value = innerlife.backend;
  innerLifeEndpoint.value = innerlife.baseUrl;
  innerLifeLightModel.value = innerlife.lightModel;
  innerLifeDeepModel.value = innerlife.deepModel;
  innerLifePollSeconds.value = secondsToDisplayMinutes(innerlife.pollSeconds);
  setSecretInput(innerLifeApiKey, innerlife.apiKeyRef || "");
  innerLifeApiKeySummary.textContent = maskMiddle(innerlife.apiKeyRef);
  innerLifeSource.value = innerlife.source;
  const memoriaStatus = modelStatus(memoria.provider, Boolean(memoria.model));
  memoriaModelStatus.textContent = memoriaStatus.label;
  memoriaModelStatus.className = memoriaStatus.className;
  memoriaModelStatus.title = memoriaStatus.note;
  const innerLifeStatus = modelStatus(innerlife.backend, Boolean(innerlife.lightModel || innerlife.deepModel));
  innerLifeModelStatus.textContent = innerLifeStatus.label;
  innerLifeModelStatus.className = innerLifeStatus.className;
  innerLifeModelStatus.title = innerLifeStatus.note;
  const daemon = snapshot?.innerLife?.daemon || {};
  if (settingsInnerLifeDaemonStatus) {
    settingsInnerLifeDaemonStatus.textContent = daemon.enabled ? daemon.status || t("common.ready") : t("common.paused");
  }
  if (innerLifeDaemonControlPanel) {
    innerLifeDaemonControlPanel.classList.toggle("is-enabled", Boolean(daemon.enabled) && daemon.status !== "error");
    innerLifeDaemonControlPanel.classList.toggle("is-paused", !daemon.enabled || daemon.status === "paused");
    innerLifeDaemonControlPanel.classList.toggle("is-error", daemon.status === "error");
  }
  if (enableInnerLifeDaemon && pauseInnerLifeDaemon) {
    enableInnerLifeDaemon.disabled = Boolean(daemon.enabled) && daemon.status !== "paused";
    pauseInnerLifeDaemon.disabled = !daemon.enabled || daemon.status === "paused";
  }
}

function splitListInput(value) {
  return String(value || "")
    .split(/\n|,/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatSharedLineMetaValue(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return "";
    return value
      .map((item) => {
        if (item && typeof item === "object") return JSON.stringify(item);
        return String(item || "");
      })
      .filter(Boolean)
      .join("\n");
  }
  if (value && typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value || "").trim();
}

function splitReadableText(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  const normalized = text
    .replace(/\r/g, "")
    .split(/\n+|(?<=[。！？!?；;])\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);
  if (normalized.length > 1) return normalized.slice(0, 12);
  return text
    .split(/(?<=，|,)\s*/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function renderReadableText(value, icon = "•") {
  const parts = splitReadableText(value);
  if (parts.length === 0) return "";
  return parts.map((part) => `<span class="readable-line"><i>${escapeHtml(icon)}</i>${escapeHtml(part)}</span>`).join("");
}

function memoryAgentId(memory) {
  const labels = Array.isArray(memory?.labels) ? memory.labels : [];
  const agentIdLabel = labels.find((label) => String(label || "").startsWith("agent-id:"));
  if (agentIdLabel) return String(agentIdLabel).slice("agent-id:".length);
  const agentLabel = labels.find((label) => String(label || "").startsWith("agent:"));
  return agentLabel ? String(agentLabel).slice("agent:".length) : "";
}

function itemAgentId(item) {
  return item?.agentId || item?.agent_id || item?.metadata?.agentId || "";
}

function filterByAgent(items, agentId, getter = itemAgentId) {
  if (!agentId) return items || [];
  return (items || []).filter((item) => getter(item) === agentId);
}

function renderAgentFilter(select, agentIds, activeValue) {
  if (!select) return "";
  const options = [...new Set((agentIds || []).filter(Boolean))].sort();
  const nextValue = activeValue && options.includes(activeValue) ? activeValue : "";
  select.innerHTML = [
    `<option value="">${escapeHtml(t("sharedLine.filter.allAgents"))}</option>`,
    ...options.map((agentId) => `<option value="${escapeHtml(agentId)}">${escapeHtml(agentId)}</option>`)
  ].join("");
  select.value = nextValue;
  return nextValue;
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
  const memories = snapshot?.memories || [];
  activeMemoryAgentFilter = renderAgentFilter(memoryAgentFilter, memories.map(memoryAgentId), activeMemoryAgentFilter);
  renderMemoryResults(filterByAgent(memories, activeMemoryAgentFilter, memoryAgentId));
}

function renderSharedLine() {
  const sharedLine = snapshot?.sharedLine;
  const current = sharedLine?.currentPosition || {};
  const summary = current.summary || "";
  const lines = sharedLine?.lines || [];
  const history = sharedLine?.history || [];
  const snapshots = sharedLine?.snapshots || [];
  const handoffs = sharedLine?.handoffs || [];
  const activeLine = lines.find((line) => line.active) || {};
  selectedSharedLineId = sharedLine?.lineId || selectedSharedLineId || activeLine.id || "";
  sharedLineDetailStatus.textContent = current.interpretationStatus || activeLine.status || "active";
  sharedLineDetailStatus.className = `badge ${current.interpretationStatus === "confirmed" ? "ok" : "planned"}`;
  sharedLineLineCount.textContent = lines.filter((line) => line.status !== "archived").length;
  sharedLineHistoryCount.textContent = history.length;
  sharedLineSnapshotCount.textContent = snapshots.length;
  sharedLineHandoffCount.textContent = handoffs.length;
  const agentOptions = [...new Set(lines.map((line) => line.metadata?.agentId || "").filter(Boolean))].sort();
  if (activeSharedLineAgentFilter && !agentOptions.includes(activeSharedLineAgentFilter)) {
    activeSharedLineAgentFilter = "";
  }
  sharedLineAgentFilter.innerHTML = [
    `<option value="">${escapeHtml(t("sharedLine.filter.allAgents"))}</option>`,
    ...agentOptions.map((agentId) => `<option value="${escapeHtml(agentId)}">${escapeHtml(agentId)}</option>`)
  ].join("");
  sharedLineAgentFilter.value = activeSharedLineAgentFilter;
  const visibleLines = activeSharedLineAgentFilter
    ? lines.filter((line) => (line.metadata?.agentId || "") === activeSharedLineAgentFilter)
    : lines;
  if (renamingSharedLineId && !lines.some((line) => line.id === renamingSharedLineId && line.status !== "archived")) {
    renamingSharedLineId = null;
    sharedLineTitleInput.value = "";
  }
  createSharedLine.textContent = renamingSharedLineId ? t("sharedLine.renameLine") : t("sharedLine.createLine");
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
          const selected = line.id === selectedSharedLineId;
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
            <div class="shared-line-card-actions"><span>${selected ? escapeHtml(t("common.ready")) : escapeHtml(t("actions.open"))}</span></div>
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
  activeInnerLifeAgentFilter = renderAgentFilter(innerLifeAgentFilter, innerLifeAgentIds, activeInnerLifeAgentFilter);
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
  const sessions = filterByAgent(innerLife.sessions || [], activeInnerLifeAgentFilter);
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
  const inboxItems = filterByAgent(innerLife.inbox || [], activeInnerLifeAgentFilter);
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
  const digestRuns = filterByAgent(innerLife.digestRuns || [], activeInnerLifeAgentFilter);
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
            <p>${escapeHtml((run.summary || "").split("\n").find((line) => line.trim()) || run.status || "")}</p>
            <small>${escapeHtml(run.status || "")}</small>
          </article>
        `
      )
      .join("");
  }
  const shareChecks = filterByAgent(innerLife.shareChecks || [], activeInnerLifeAgentFilter);
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
  const pendingShares = filterByAgent(innerLife.pendingShares || [], activeInnerLifeAgentFilter);
  const approvedShares = filterByAgent(innerLife.recentShares || [], activeInnerLifeAgentFilter).filter((share) => share.status === "approved").slice(0, 5);
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

function renderBackups() {
  const backups = snapshot?.backups || [];
  if (backups.length === 0) {
    backupList.innerHTML = `<div class="endpoint-empty">${t("data.noBackups")}</div>`;
    return;
  }
  backupList.innerHTML = backups
    .map(
      (backup) => {
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
      }
    )
    .join("");
}

function renderImportPreview() {
  const sources = snapshot?.importPreview?.sources || {};
  const entries = Object.values(sources);
  if (entries.length === 0) {
    importPreviewList.innerHTML = `<div class="endpoint-empty">${t("data.importPreviewMissing")}</div>`;
    return;
  }
  importPreviewList.innerHTML = entries
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

function memoryItemsHtml(memories, action = "delete", itemClass = "") {
  return memories
    .map((memory) => {
      const labels = (memory.labels || [])
        .map((label) => `<span>${escapeHtml(label)}</span>`)
        .join("");
      const embeddingStatus = memory.embedding_status || "pending";
      const embeddingLabel = t(`memory.embedding.${embeddingStatus}`) || embeddingStatus;
      const embeddingDetail = memory.embedding_error
        ? `<span title="${escapeHtml(memory.embedding_error)}">${escapeHtml(memory.embedding_error)}</span>`
        : `<span>${escapeHtml(memory.embedding_model || "")}</span>`;
      const sourceLabel = memory.search_source ? t(`memory.search.source.${memory.search_source}`) || memory.search_source : "";
      const scoreLabel =
        memory.search_source && Number(memory.search_score) > 0
          ? `${t("memory.search.score")} ${Math.round(Number(memory.search_score) * 100)}%`
          : "";
      const searchMeta =
        sourceLabel || scoreLabel
          ? `<div class="memory-search-rank"><span>${escapeHtml(sourceLabel)}</span><span>${escapeHtml(scoreLabel)}</span></div>`
          : "";
      return `
        <article class="memory-item ${itemClass}" data-memory-id="${escapeHtml(memory.id)}">
          <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
          <p>${escapeHtml(memory.body)}</p>
          ${searchMeta}
          <div class="memory-meta">
            <span>${escapeHtml(memory.created_at || memory.updated_at || "")}</span>
            <div>${labels}</div>
          </div>
          <div class="memory-embedding ${escapeHtml(embeddingStatus)}">
            <b>${escapeHtml(embeddingLabel)}</b>
            ${embeddingDetail}
          </div>
          <div class="memory-actions">
            ${action === "restore" ? `<button class="secondary" data-memory-action="restore" data-memory-id="${escapeHtml(memory.id)}">${t("actions.restore")}</button>` : ""}
            ${action === "restore-archived" ? `<button class="secondary" data-memory-action="restore-archived" data-memory-id="${escapeHtml(memory.id)}">${t("actions.restore")}</button>` : ""}
            ${action === "delete" ? `<button class="secondary danger-button" data-memory-action="delete" data-memory-id="${escapeHtml(memory.id)}">${t("actions.delete")}</button>` : ""}
            ${action === "delete-restricted" ? `<button class="secondary danger-button" data-memory-action="delete-restricted" data-memory-id="${escapeHtml(memory.id)}">${t("actions.delete")}</button>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMemoryResults(memories, target = memoryList, options = {}) {
  if (memories.length === 0) {
    target.innerHTML = `<div class="endpoint-empty">${t("memory.empty")}</div>`;
    return;
  }
  const html = memoryItemsHtml(memories, options.action || "delete", options.itemClass || "");
  if (options.append) {
    target.insertAdjacentHTML("beforeend", html);
  } else {
    target.innerHTML = html;
  }
}

function renderDeletedMemoryResults(memories) {
  if (memories.length === 0) {
    deletedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.deleted.empty")}</div>`;
    return;
  }
  deletedMemoryList.innerHTML = memories
    .map((memory) => {
      const labels = (memory.labels || [])
        .map((label) => `<span>${escapeHtml(label)}</span>`)
        .join("");
      return `
        <article class="memory-item deleted" data-memory-id="${escapeHtml(memory.id)}">
          <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
          <p>${escapeHtml(memory.body)}</p>
          <div class="memory-meta">
            <span>${escapeHtml(memory.updated_at || memory.created_at || "")}</span>
            <div>${labels}</div>
          </div>
          <div class="memory-actions">
            <button class="secondary" data-memory-action="restore" data-memory-id="${escapeHtml(memory.id)}">${t("actions.restore")}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRestrictedMemoryResults(memories) {
  if (memories.length === 0) {
    restrictedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.restricted.empty")}</div>`;
    return;
  }
  restrictedMemoryList.innerHTML = memories
    .map((memory) => {
      const labels = (memory.labels || [])
        .map((label) => `<span>${escapeHtml(label)}</span>`)
        .join("");
      return `
        <article class="memory-item restricted" data-memory-id="${escapeHtml(memory.id)}">
          <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
          <p>${escapeHtml(memory.body)}</p>
          <div class="memory-meta">
            <span>${escapeHtml(memory.updated_at || memory.created_at || "")}</span>
            <div>${labels}</div>
          </div>
          <div class="memory-actions">
            <button class="secondary danger-button" data-memory-action="delete-restricted" data-memory-id="${escapeHtml(memory.id)}">${t("actions.delete")}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderArchivedMemoryResults(memories) {
  if (memories.length === 0) {
    archivedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.archived.empty")}</div>`;
    return;
  }
  archivedMemoryList.innerHTML = memories
    .map((memory) => {
      const labels = (memory.labels || [])
        .map((label) => `<span>${escapeHtml(label)}</span>`)
        .join("");
      return `
        <article class="memory-item archived" data-memory-id="${escapeHtml(memory.id)}">
          <strong>${escapeHtml(memory.title || t("memory.form.body"))}</strong>
          <p>${escapeHtml(memory.body)}</p>
          <div class="memory-meta">
            <span>${escapeHtml(memory.updated_at || memory.created_at || "")}</span>
            <div>${labels}</div>
          </div>
          <div class="memory-actions">
            <button class="secondary" data-memory-action="restore-archived" data-memory-id="${escapeHtml(memory.id)}">${t("actions.restore")}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderMemoryTabs() {
  for (const tab of memoryTabs) {
    const isActive = tab.dataset.memoryTab === activeMemoryTab;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  }
  for (const panel of memoryTabPanels) {
    panel.classList.toggle("active", panel.dataset.memoryPanel === activeMemoryTab);
  }
}

function removeLoadMoreButton(kind) {
  document.querySelector(`[data-load-more="${kind}"]`)?.remove();
}

function renderLoadMore(kind) {
  const totalByKind = {
    all: snapshot?.memoryStats?.activeCount ?? 0,
    restricted: snapshot?.memoryStats?.restrictedCount ?? 0,
    archived: snapshot?.memoryStats?.archivedCount ?? 0,
    deleted: snapshot?.memoryStats?.deletedCount ?? 0
  };
  const loadedByKind = {
    all: memoryPaging.all.loaded,
    restricted: memoryPaging.restricted.loaded,
    archived: memoryPaging.archived.loaded,
    deleted: memoryPaging.deleted.loaded,
    archive: Math.max(memoryPaging.archived.loaded, memoryPaging.deleted.loaded)
  };
  const total = kind === "archive" ? Math.max(totalByKind.archived, totalByKind.deleted) : totalByKind[kind];
  const loaded = loadedByKind[kind] || 0;
  const container =
    kind === "all"
      ? allMemoryList
      : kind === "restricted"
        ? restrictedMemoryList
        : kind === "archive"
          ? archivedMemoryList.parentElement
          : null;
  if (!container) return;
  removeLoadMoreButton(kind);
  if (loaded >= total) return;
  container.insertAdjacentHTML(
    "afterend",
    `<button class="secondary load-more-button" data-load-more="${kind}">${t("memory.loadMore")}</button>`
  );
}

async function loadMemoryTabData(tabName, options = {}) {
  if (!snapshot) return;
  const force = Boolean(options.force);
  const append = Boolean(options.append);
  if (tabName === "all" && (force || append || !loadedMemoryTabs.all)) {
    const offset = append ? memoryPaging.all.loaded : 0;
    const rows = await window.ClaraCoreDesktop.getMemories({ limit: memoryPaging.pageSize, offset });
    snapshot.memories = append ? [...(snapshot.memories || []), ...rows] : rows;
    memoryPaging.all.loaded = snapshot.memories.length;
    loadedMemoryTabs.all = true;
    if ((rows || []).length > 0) renderMemoryResults(filterByAgent(rows || [], activeMemoryAgentFilter, memoryAgentId), allMemoryList, { append });
    memoryAllHint.textContent = t("memory.list.sample", {
      shown: snapshot?.memories?.length || 0,
      total: snapshot?.memoryStats?.activeCount ?? 0
    });
    renderLoadMore("all");
  }
  if (tabName === "restricted" && (force || append || !loadedMemoryTabs.restricted)) {
    const offset = append ? memoryPaging.restricted.loaded : 0;
    const rows = await window.ClaraCoreDesktop.getRestrictedMemories({ limit: memoryPaging.pageSize, offset });
    snapshot.restrictedMemories = append ? [...(snapshot.restrictedMemories || []), ...rows] : rows;
    memoryPaging.restricted.loaded = snapshot.restrictedMemories.length;
    loadedMemoryTabs.restricted = true;
    if ((rows || []).length > 0) renderMemoryResults(filterByAgent(rows || [], activeMemoryAgentFilter, memoryAgentId), restrictedMemoryList, { append, action: "delete-restricted", itemClass: "restricted" });
    memoryRestrictedHint.textContent = t("memory.list.sample", {
      shown: snapshot?.restrictedMemories?.length || 0,
      total: snapshot?.memoryStats?.restrictedCount ?? 0
    });
    renderLoadMore("restricted");
  }
  if (tabName === "archive" && (force || append || !loadedMemoryTabs.archive)) {
    const archivedOffset = append ? memoryPaging.archived.loaded : 0;
    const deletedOffset = append ? memoryPaging.deleted.loaded : 0;
    const [archived, deleted] = await Promise.all([
      window.ClaraCoreDesktop.getArchivedMemories({ limit: memoryPaging.pageSize, offset: archivedOffset }),
      window.ClaraCoreDesktop.getDeletedMemories({ limit: memoryPaging.pageSize, offset: deletedOffset })
    ]);
    snapshot.archivedMemories = append ? [...(snapshot.archivedMemories || []), ...archived] : archived;
    snapshot.deletedMemories = append ? [...(snapshot.deletedMemories || []), ...deleted] : deleted;
    memoryPaging.archived.loaded = snapshot.archivedMemories.length;
    memoryPaging.deleted.loaded = snapshot.deletedMemories.length;
    loadedMemoryTabs.archive = true;
    if ((archived || []).length > 0) renderMemoryResults(filterByAgent(archived || [], activeMemoryAgentFilter, memoryAgentId), archivedMemoryList, { append, action: "restore-archived", itemClass: "archived" });
    if ((deleted || []).length > 0) renderMemoryResults(filterByAgent(deleted || [], activeMemoryAgentFilter, memoryAgentId), deletedMemoryList, { append, action: "restore", itemClass: "deleted" });
    renderLoadMore("archive");
  }
}

function renderMemoryLabels(labels) {
  if (!memoryAllLabelList) return;
  if (labels.length === 0) {
    memoryAllLabelList.innerHTML = `<div class="endpoint-empty">${t("memory.labels.empty")}</div>`;
    return;
  }
  memoryAllLabelList.innerHTML = labels
    .map(
      (item) => `
        <button class="label-row" data-memory-label="${escapeHtml(item.label)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.count)}</strong>
        </button>
      `
    )
    .join("");
}

function graphHash(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function computeGraphLayout(nodes, edges) {
  const width = 1180;
  const height = 650;
  const centerX = width / 2;
  const centerY = height / 2;
  const degree = new Map();
  for (const edge of edges) {
    degree.set(edge.from, (degree.get(edge.from) || 0) + 1);
    degree.set(edge.to, (degree.get(edge.to) || 0) + 1);
  }

  const positions = new Map();
  const labelNodes = nodes
    .filter((node) => node.kind === "label")
    .sort((left, right) => (degree.get(right.id) || 0) - (degree.get(left.id) || 0));
  const memoryNodes = nodes.filter((node) => node.kind === "memory");
  const otherNodes = nodes.filter((node) => node.kind !== "label" && node.kind !== "memory");

  memoryNodes.forEach((node, index) => {
    const seed = graphHash(node.id);
    const angle = index * 2.399963229728653 + (seed % 1000) / 1000;
    const radius = Math.sqrt((index + 1) / Math.max(1, memoryNodes.length)) * 245 + ((seed % 70) - 35);
    positions.set(node.id, {
      x: Math.max(24, Math.min(width - 24, centerX + Math.cos(angle) * radius * 1.38)),
      y: Math.max(24, Math.min(height - 24, centerY + Math.sin(angle) * radius * 0.92)),
      size: 2.5 + Math.min(2.5, (degree.get(node.id) || 1) / 6)
    });
  });

  labelNodes.forEach((node, index) => {
    const seed = graphHash(node.id);
    const angle = index * 2.399963229728653 + (seed % 1000) / 700;
    const radius = 95 + Math.sqrt((index + 1) / Math.max(1, labelNodes.length)) * 285 + ((seed % 80) - 40);
    positions.set(node.id, {
      x: Math.max(24, Math.min(width - 24, centerX + Math.cos(angle) * radius * 1.35)),
      y: Math.max(24, Math.min(height - 24, centerY + Math.sin(angle) * radius * 0.86)),
      size: 7 + Math.min(7, (degree.get(node.id) || 1) / 7)
    });
  });

  otherNodes.forEach((node, index) => {
    const angle = (index / Math.max(1, otherNodes.length)) * Math.PI * 2;
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * 90,
      y: centerY + Math.sin(angle) * 90,
      size: 8
    });
  });

  return { width, height, positions, degree };
}

function graphViewBox(width, height) {
  const safeZoom = Math.max(1, Math.min(3, memoryGraphZoom));
  const viewWidth = width / safeZoom;
  const viewHeight = height / safeZoom;
  const x = (width - viewWidth) / 2;
  const y = (height - viewHeight) / 2;
  return `${x.toFixed(1)} ${y.toFixed(1)} ${viewWidth.toFixed(1)} ${viewHeight.toFixed(1)}`;
}

function setMemoryGraphZoom(action) {
  if (action === "in") {
    memoryGraphZoom = Math.min(3, Number((memoryGraphZoom + 0.25).toFixed(2)));
  } else if (action === "out") {
    memoryGraphZoom = Math.max(1, Number((memoryGraphZoom - 0.25).toFixed(2)));
  } else {
    memoryGraphZoom = 1;
    memoryGraphPan = { x: 0, y: 0 };
  }
  drawMemoryGraphCanvas();
}

async function setMemoryGraphLayer(layer) {
  if (layer === activeMemoryGraphLayer) return;
  if (layer === "restricted" && !window.confirm(t("memory.restricted.confirm"))) return;
  if (layer === "restricted" && !snapshot?.restrictedMemoryGraph) {
    snapshot.restrictedMemoryGraph = await window.ClaraCoreDesktop.getMemoryGraph({ limit: 1000, includeRestricted: true });
  }
  activeMemoryGraphLayer = layer === "restricted" ? "restricted" : "primary";
  memoryGraphZoom = 1;
  memoryGraphPan = { x: 0, y: 0 };
  renderMemoryGraph();
}

function stopMemoryGraphAnimation() {
  if (memoryGraphAnimation) {
    cancelAnimationFrame(memoryGraphAnimation);
    memoryGraphAnimation = null;
  }
}

function drawMemoryGraphCanvas() {
  if (!memoryGraphState) return;
  const { canvas, nodes, edges, positions, width, height } = memoryGraphState;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.max(1, Math.floor(rect.width * pixelRatio));
  const targetHeight = Math.max(1, Math.floor(rect.height * pixelRatio));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const fitScale = Math.min(rect.width / width, rect.height / height);
  const scale = fitScale * memoryGraphZoom;
  const offsetX = (rect.width - width * scale) / 2 + memoryGraphPan.x;
  const offsetY = (rect.height - height * scale) / 2 + memoryGraphPan.y;
  canvas.dataset.zoom = String(memoryGraphZoom);
  canvas.dataset.panX = String(Math.round(memoryGraphPan.x));
  canvas.dataset.panY = String(Math.round(memoryGraphPan.y));
  const point = (position) => ({
    x: offsetX + position.x * scale,
    y: offsetY + position.y * scale,
    r: Math.max(1.6, position.size * scale)
  });
  const now = performance.now();

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(122, 148, 136, 0.22)";
  ctx.beginPath();
  for (const edge of edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;
    const a = point(from);
    const b = point(to);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();

  for (const node of nodes) {
    const position = positions.get(node.id);
    if (!position) continue;
    const p = point(position);
    const phase = ((now / 1000) + (graphHash(node.id) % 900) / 1000) * Math.PI * 2 / 2.8;
    const pulse = 1 + Math.sin(phase) * 0.09;
    const radius = p.r * pulse;
    const isRestricted = node.sensitivity === "restricted";
    const fill = node.kind === "label" ? "#c88934" : node.kind === "shared_line" ? "#28745a" : isRestricted ? "#a64036" : "#365f84";
    if (isRestricted) {
      ctx.beginPath();
      ctx.fillStyle = "rgba(166, 64, 54, 0.14)";
      ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.fillStyle = fill;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.82)";
    ctx.lineWidth = 1;
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.font = "9px Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (const node of nodes) {
    if (node.kind === "memory") continue;
    const position = positions.get(node.id);
    if (!position) continue;
    const p = point(position);
    const label = String(node.label || node.id);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(251, 251, 248, 0.94)";
    ctx.fillStyle = "#202421";
    ctx.strokeText(label, p.x + p.r + 5, p.y);
    ctx.fillText(label, p.x + p.r + 5, p.y);
  }

  memoryGraphAnimation = requestAnimationFrame(drawMemoryGraphCanvas);
}

function renderMemoryOverview() {
  if (activeMemoryGraphLayer === "restricted" && !snapshot?.restrictedMemoryGraph) {
    activeMemoryGraphLayer = "primary";
    memoryGraphZoom = 1;
    memoryGraphPan = { x: 0, y: 0 };
  }
  const stats = snapshot?.memoryStats || {};
  memoryActiveCount.textContent = stats.activeCount ?? 0;
  memoryDeletedCount.textContent = stats.deletedCount ?? 0;
  memoryEmbeddedCount.textContent = stats.embeddedCount ?? 0;
  memoryPendingEmbeddingCount.textContent = stats.pendingEmbeddingCount ?? 0;
  if (!memoryEmbeddingBatchRunning) {
    const actionableEmbeddings = Number(stats.pendingEmbeddingCount || 0) + Number(stats.failedEmbeddingCount || 0);
    processMemoryEmbeddings.disabled = actionableEmbeddings <= 0;
    if (actionableEmbeddings <= 0) memoryEmbeddingNotice.textContent = t("memory.embedding.nonePending");
    if (actionableEmbeddings <= 0) memoryEmbeddingProgressBar.style.width = "0%";
  }
  memoryRestrictedCount.textContent = stats.restrictedCount ?? 0;
  memoryArchivedCount.textContent = stats.archivedCount ?? 0;
  const labels = stats.labels || [];
  if (labels.length === 0) {
    memoryLabelList.innerHTML = `<span class="quiet">${t("memory.labels.empty")}</span>`;
  } else {
    memoryLabelList.innerHTML = labels
      .slice(0, 12)
      .map((item) => `<button class="tag-button" data-memory-label="${escapeHtml(item.label)}">${escapeHtml(item.label)} <span>${escapeHtml(item.count)}</span></button>`)
      .join("");
  }
  renderMemoryLabels(labels);
  if (!loadedMemoryTabs.all) {
    allMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.lazy.openTab")}</div>`;
  }
  memoryAllHint.textContent = t("memory.list.sample", {
    shown: loadedMemoryTabs.all ? snapshot?.memories?.length || 0 : 0,
    total: stats.activeCount ?? 0
  });
  memoryRestrictedHint.textContent = t("memory.list.sample", {
    shown: loadedMemoryTabs.restricted ? snapshot?.restrictedMemories?.length || 0 : 0,
    total: stats.restrictedCount ?? 0
  });
  if (!loadedMemoryTabs.restricted) {
    restrictedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.lazy.openTab")}</div>`;
  }
  if (!loadedMemoryTabs.archive) {
    archivedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.lazy.openTab")}</div>`;
    deletedMemoryList.innerHTML = `<div class="endpoint-empty">${t("memory.lazy.openTab")}</div>`;
  }
  renderMemoryGraph();
  renderMemoryTabs();
}

function renderMemoryGraph() {
  const graph = activeMemoryGraphLayer === "restricted" ? snapshot?.restrictedMemoryGraph || {} : snapshot?.memoryGraph || {};
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  memoryGraphSummary.textContent = t("memory.graph.summary", {
    nodes: nodes.length,
    edges: edges.length
  });
  if (nodes.length === 0 || edges.length === 0) {
    stopMemoryGraphAnimation();
    memoryGraphState = null;
    memoryGraph.innerHTML = `<div class="endpoint-empty">${t("memory.graph.empty")}</div>`;
    return;
  }
  const { width, height, positions, degree } = computeGraphLayout(nodes, edges);
  const positionedNodes = nodes.filter((node) => positions.has(node.id));
  const positionedEdges = edges.filter((edge) => positions.has(edge.from) && positions.has(edge.to));
  stopMemoryGraphAnimation();
  memoryGraph.innerHTML = `
    <div class="graph-toolbar">
      <div>
        <button class="graph-layer ${activeMemoryGraphLayer === "primary" ? "active" : ""}" data-graph-layer="primary">${escapeHtml(t("memory.graph.primaryLayer"))}</button>
        <button class="graph-layer ${activeMemoryGraphLayer === "restricted" ? "active restricted" : ""}" data-graph-layer="restricted">${escapeHtml(t("memory.graph.restrictedLayer"))}</button>
      </div>
      <div class="graph-zoom-controls">
        <button class="secondary" data-graph-zoom="out" aria-label="${escapeHtml(t("memory.graph.zoomOut"))}">−</button>
        <button class="secondary" data-graph-zoom="fit">${escapeHtml(t("memory.graph.fit"))}</button>
        <button class="secondary" data-graph-zoom="in" aria-label="${escapeHtml(t("memory.graph.zoomIn"))}">+</button>
      </div>
      <strong>${escapeHtml(t("memory.graph.summary", { nodes: nodes.length, edges: edges.length }))}</strong>
    </div>
    <div class="graph-canvas">
      <canvas id="memoryGraphCanvas" data-node-count="${positionedNodes.length}" data-edge-count="${positionedEdges.length}" data-restricted-count="${positionedNodes.filter((node) => node.sensitivity === "restricted").length}" aria-label="${escapeHtml(t("memory.graph.title"))}"></canvas>
    </div>
  `;
  memoryGraphState = {
    canvas: document.querySelector("#memoryGraphCanvas"),
    nodes: positionedNodes,
    edges: positionedEdges,
    positions,
    degree,
    width,
    height
  };
  drawMemoryGraphCanvas();
}

function collectSettingsForm() {
  return {
    "memory.embedding.provider": memoriaProvider.value,
    "memory.embedding.base_url": memoriaEndpoint.value,
    "memory.embedding.model": memoriaModel.value,
    "memory.embedding.dimension": memoriaDimension.value,
    "memory.embedding.api_key_ref": getSecretInputValue(memoriaApiKey),
    "innerlife.provider": innerLifeBackend.value,
    "innerlife.base_url": innerLifeEndpoint.value,
    "innerlife.light_model": innerLifeLightModel.value,
    "innerlife.deep_model": innerLifeDeepModel.value,
    "innerlife.loop_seconds": displayMinutesToSeconds(innerLifePollSeconds.value),
    "innerlife.llm.api_key_ref": getSecretInputValue(innerLifeApiKey)
  };
}

function renderSnapshot() {
  runtimeMode.textContent = formatMode(snapshot.mode);
  rootPath.textContent = snapshot.root;
  dataLocation.textContent = snapshot.data.root;
  dataHint.textContent = snapshot.data.databasePresent ? t("runtime.databaseReady") : t("runtime.databaseNotCreated");
  dataRootPath.textContent = snapshot.data.root;
  memoryStore.textContent = snapshot.data.databasePath;
  memoryStoreShort.textContent = snapshot.data.databasePresent ? t("common.found") : t("common.notCreated");
  renderModules(snapshot.modules);
  renderHomeDashboard();
  renderHealth();
  renderEvents();
  renderConnections();
  renderLogs();
  renderAgentSetup();
  renderSettings();
  renderMemoryOverview();
  renderMemoryList();
  renderSharedLine();
  renderInnerLife();
  renderBackups();
  renderImportPreview();
}

function renderResourceSnapshot(resources) {
  monitorVersion.textContent = `v${resources.appVersion || "0.1.0"}`;
  monitorUptime.textContent = resources.uptime || "--:--:--";
  monitorCpu.textContent = Number.isFinite(resources.cpuPercent) ? `${resources.cpuPercent}%` : "--";
  monitorRam.textContent =
    resources.memory?.text && Number.isFinite(resources.memory?.percent)
      ? `${resources.memory.text} (${resources.memory.percent}%)`
      : "--";
  monitorDisk.textContent =
    resources.disk?.text && Number.isFinite(resources.disk?.percent)
      ? `${resources.disk.text} (${resources.disk.percent}%)`
      : "--";
  monitorTime.textContent = resources.localTime || "--";
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-value]").forEach((element) => {
    element.value = t(element.dataset.i18nValue);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-language]").forEach((button) => {
    button.classList.toggle("active", button.dataset.language === currentLanguage);
  });
}

function setView(viewName) {
  const nextView = views[viewName] ? viewName : "home";
  activeView = nextView;
  Object.entries(views).forEach(([name, view]) => {
    view.panel.classList.toggle("active-view", name === nextView);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === nextView);
  });
  viewTitle.textContent = t(views[nextView].titleKey);
  viewSubtitle.textContent = t(views[nextView].subtitleKey);
  syncLogRefreshTimer();
}

function setLanguage(language) {
  if (!translations[language]) return;
  currentLanguage = language;
  localStorage.setItem("claracore.language", language);
  applyStaticTranslations();
  setView(activeView);
  if (snapshot) renderSnapshot();
  window.ClaraCoreDesktop.setLanguage(language).catch(console.error);
}

async function refresh() {
  snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
  loadedMemoryTabs.all = false;
  loadedMemoryTabs.restricted = false;
  loadedMemoryTabs.archive = false;
  memoryPaging.all.loaded = 0;
  memoryPaging.restricted.loaded = 0;
  memoryPaging.archived.loaded = 0;
  memoryPaging.deleted.loaded = 0;
  removeLoadMoreButton("all");
  removeLoadMoreButton("restricted");
  removeLoadMoreButton("archive");
  renderSnapshot();
  if (activeMemoryTab !== "search" && activeMemoryTab !== "labels" && activeMemoryTab !== "graph") {
    loadMemoryTabData(activeMemoryTab).catch(console.error);
  }
}

async function refreshRuntimeSnapshotOnly() {
  snapshot = await window.ClaraCoreDesktop.getRuntimeSnapshot();
  renderSnapshot();
}

function syncLogRefreshTimer() {
  if (logRefreshTimer) {
    clearInterval(logRefreshTimer);
    logRefreshTimer = null;
  }
  if (activeView !== "logs" || !logFollowEnabled) return;
  logRefreshTimer = setInterval(async () => {
    if (logRefreshInFlight) return;
    logRefreshInFlight = true;
    try {
      await refreshRuntimeSnapshotOnly();
    } catch (error) {
      console.error(error);
    } finally {
      logRefreshInFlight = false;
    }
  }, 2000);
}

async function refreshResources() {
  const resources = await window.ClaraCoreDesktop.getResourceSnapshot();
  renderResourceSnapshot(resources);
}

function scheduleRuntimeRefresh() {
  if (runtimeRefreshTimer) return;
  runtimeRefreshTimer = window.setTimeout(() => {
    runtimeRefreshTimer = null;
    refresh().catch(console.error);
  }, 250);
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewTarget));
});

document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
});

copyAgentSetup.addEventListener("click", () => {
  copyValue(buildAgentSetupMarkdown(), t("agentSetup.copied"), agentSetupNotice).catch(console.error);
});

saveSettings.addEventListener("click", async () => {
  saveSettings.disabled = true;
  settingsNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.saveSettings(collectSettingsForm());
    await refresh();
    showCopyNotice(t("settings.saved"), settingsNotice);
  } catch (error) {
    console.error(error);
    settingsNotice.textContent = t("settings.saveFailed");
  } finally {
    saveSettings.disabled = false;
  }
});

copyMemoriaApiKey.addEventListener("click", () => {
  const value = getSecretInputValue(memoriaApiKey);
  if (!value) {
    showCopyNotice(t("settings.apiKey.notConfigured"), settingsNotice);
    return;
  }
  copyValue(value, t("settings.apiKey.copied"), settingsNotice).catch(console.error);
});

copyInnerLifeApiKey.addEventListener("click", () => {
  const value = getSecretInputValue(innerLifeApiKey);
  if (!value) {
    showCopyNotice(t("settings.apiKey.notConfigured"), settingsNotice);
    return;
  }
  copyValue(value, t("settings.apiKey.copied"), settingsNotice).catch(console.error);
});

searchMemory.addEventListener("click", async () => {
  const response = await window.ClaraCoreDesktop.searchMemories(memorySearchInput.value);
  const results = Array.isArray(response) ? response : response?.results || [];
  renderMemoryResults(filterByAgent(results, activeMemoryAgentFilter, memoryAgentId));
  if (response?.error) showCopyNotice(t("memory.search.fallback"));
});

memoryAgentFilter?.addEventListener("change", async () => {
  activeMemoryAgentFilter = memoryAgentFilter.value || "";
  renderMemoryList();
  if (activeMemoryTab !== "search") {
    await loadMemoryTabData(activeMemoryTab, { force: true });
  }
});

innerLifeAgentFilter?.addEventListener("change", () => {
  activeInnerLifeAgentFilter = innerLifeAgentFilter.value || "";
  renderInnerLife();
});

processMemoryEmbeddings.addEventListener("click", async () => {
  memoryEmbeddingBatchRunning = true;
  processMemoryEmbeddings.disabled = true;
  memoryEmbeddingNotice.textContent = t("memory.embedding.processing");
  const progress = {
    processed: 0,
    total: Number(snapshot?.memoryStats?.pendingEmbeddingCount || 0),
    ready: 0,
    failed: 0
  };
  appendLiveLogLine("memoria", "starting full embedding generation");
  try {
    let firstBatch = true;
    while (true) {
      const result = await window.ClaraCoreDesktop.processMemoryEmbeddings({
        batchSize: memoryPaging.pageSize,
        requeue: firstBatch
      });
      firstBatch = false;
      const results = result?.results || [];
      progress.processed += Number(result?.processed || results.length || 0);
      progress.ready += results.filter((item) => item.ok).length;
      progress.failed += results.filter((item) => !item.ok).length;
      const stats = await window.ClaraCoreDesktop.getMemoryStats();
      progress.total = Math.max(progress.total, progress.processed + Number(stats.pendingEmbeddingCount || 0));
      setEmbeddingProgress(stats, progress);
      if (!result?.processed || Number(stats.pendingEmbeddingCount || 0) <= 0) break;
      await new Promise((resolve) => window.setTimeout(resolve, 80));
    }
    await refreshRuntimeSnapshotOnly();
    const finalText =
      progress.failed > 0
        ? `${t("memory.embedding.processed", { count: progress.processed })}; ${t("memory.embedding.stopped")}`
        : t("memory.embedding.processed", { count: progress.processed });
    memoryEmbeddingNotice.textContent = finalText;
    appendLiveLogLine("memoria", finalText);
  } catch (error) {
    console.error(error);
    memoryEmbeddingNotice.textContent = t("memory.embedding.processFailed");
    appendLiveLogLine("memoria", `${t("memory.embedding.processFailed")}: ${error.message || error}`);
  } finally {
    memoryEmbeddingBatchRunning = false;
    const pending = Number(snapshot?.memoryStats?.pendingEmbeddingCount || 0);
    const failed = Number(snapshot?.memoryStats?.failedEmbeddingCount || 0);
    processMemoryEmbeddings.disabled = pending <= 0 && failed <= 0;
  }
});

memorySearchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    searchMemory.click();
  }
});

function searchMemoryLabel(label) {
  activeMemoryTab = "search";
  renderMemoryTabs();
  memorySearchInput.value = label || "";
  searchMemory.click();
}

memoryTabs.forEach((tab) => {
  tab.addEventListener("click", async () => {
    const nextTab = tab.dataset.memoryTab || "search";
    if (nextTab === "restricted" && activeMemoryTab !== "restricted" && !window.confirm(t("memory.restricted.confirm"))) {
      renderMemoryTabs();
      return;
    }
    activeMemoryTab = nextTab;
    renderMemoryTabs();
    try {
      await loadMemoryTabData(nextTab);
    } catch (error) {
      console.error(error);
      showCopyNotice(t("runtime.unavailable"));
    }
  });
});

function setSharedLineTab(tabName) {
  sharedLineTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.sharedLineTab === tabName));
  sharedLineTabPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.sharedLinePanel === tabName));
}

sharedLineTabs.forEach((tab) => {
  tab.addEventListener("click", () => setSharedLineTab(tab.dataset.sharedLineTab || "lines"));
});

sharedLineAgentFilter.addEventListener("change", () => {
  activeSharedLineAgentFilter = sharedLineAgentFilter.value || "";
  renderSharedLine();
});

memoryLabelList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-memory-label]");
  if (!button) return;
  searchMemoryLabel(button.dataset.memoryLabel || "");
});

memoryAllLabelList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-memory-label]");
  if (!button) return;
  searchMemoryLabel(button.dataset.memoryLabel || "");
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-load-more]");
  if (!button) return;
  button.disabled = true;
  loadMemoryTabData(button.dataset.loadMore, { append: true })
    .catch((error) => {
      console.error(error);
      showCopyNotice(t("runtime.unavailable"));
    })
    .finally(() => {
      button.disabled = false;
    });
});

memoryGraph.addEventListener("click", (event) => {
  const zoomButton = event.target.closest("[data-graph-zoom]");
  if (zoomButton) {
    setMemoryGraphZoom(zoomButton.dataset.graphZoom || "fit");
    return;
  }
  const layerButton = event.target.closest("[data-graph-layer]");
  if (layerButton) {
    setMemoryGraphLayer(layerButton.dataset.graphLayer || "primary").catch((error) => {
      console.error(error);
      showCopyNotice(t("runtime.unavailable"));
    });
  }
});

memoryGraph.addEventListener("wheel", (event) => {
  if (!event.target.closest(".graph-canvas")) return;
  event.preventDefault();
  setMemoryGraphZoom(event.deltaY < 0 ? "in" : "out");
});

memoryGraph.addEventListener("mousedown", (event) => {
  if (!event.target.closest(".graph-canvas")) return;
  memoryGraphDrag = {
    x: event.clientX,
    y: event.clientY,
    startPan: { ...memoryGraphPan }
  };
  memoryGraph.classList.add("dragging");
});

window.addEventListener("mousemove", (event) => {
  if (!memoryGraphDrag) return;
  memoryGraphPan = {
    x: memoryGraphDrag.startPan.x + event.clientX - memoryGraphDrag.x,
    y: memoryGraphDrag.startPan.y + event.clientY - memoryGraphDrag.y
  };
});

window.addEventListener("mouseup", () => {
  if (!memoryGraphDrag) return;
  memoryGraphDrag = null;
  memoryGraph.classList.remove("dragging");
});

async function handleMemoryListAction(event) {
  const button = event.target.closest("[data-memory-action]");
  if (!button) return;
  const memoryId = button.dataset.memoryId;
  if (button.dataset.memoryAction === "delete") {
    if (!window.confirm(t("memory.delete.confirm"))) return;
    button.disabled = true;
    await window.ClaraCoreDesktop.deleteMemory(memoryId);
    await refresh();
    showCopyNotice(t("memory.form.deleted"));
  }
}

memoryList.addEventListener("click", handleMemoryListAction);
allMemoryList.addEventListener("click", handleMemoryListAction);

restrictedMemoryList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-memory-action]");
  if (!button) return;
  const memoryId = button.dataset.memoryId;
  if (button.dataset.memoryAction === "delete-restricted") {
    if (!window.confirm(t("memory.delete.confirm"))) return;
    button.disabled = true;
    await window.ClaraCoreDesktop.deleteMemory(memoryId);
    await refresh();
    showCopyNotice(t("memory.form.deleted"));
  }
});

archivedMemoryList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-memory-action='restore-archived']");
  if (!button) return;
  button.disabled = true;
  try {
    await window.ClaraCoreDesktop.restoreArchivedMemory(button.dataset.memoryId);
    await refresh();
    showCopyNotice(t("memory.archive.restoreDone"));
  } catch (error) {
    console.error(error);
    showCopyNotice(t("memory.form.saveFailed"));
  }
});

deletedMemoryList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-memory-action='restore']");
  if (!button) return;
  button.disabled = true;
  try {
    await window.ClaraCoreDesktop.restoreMemory(button.dataset.memoryId);
    await refresh();
    showCopyNotice(t("memory.form.restored"));
  } catch (error) {
    console.error(error);
    showCopyNotice(t("memory.form.saveFailed"));
  }
});

createSharedLine.addEventListener("click", async () => {
  createSharedLine.disabled = true;
  sharedLineNotice.textContent = t("common.checking");
  try {
    const result = renamingSharedLineId
      ? await window.ClaraCoreDesktop.renameSharedLine(renamingSharedLineId, sharedLineTitleInput.value)
      : await window.ClaraCoreDesktop.createSharedLine({
          title: sharedLineTitleInput.value,
          makeActive: true
        });
    snapshot.sharedLine = result.sharedLine;
    const message = renamingSharedLineId ? t("sharedLine.lineRenamed") : t("sharedLine.lineCreated");
    renamingSharedLineId = null;
    sharedLineTitleInput.value = "";
    renderSharedLine();
    showCopyNotice(message, sharedLineNotice);
  } catch (error) {
    console.error(error);
    sharedLineNotice.textContent = t("sharedLine.lineFailed");
  } finally {
    createSharedLine.disabled = false;
  }
});

sharedLineTitleInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    createSharedLine.click();
  }
});

sharedLineList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-shared-line-action]");
  if (!button) return;
  const action = button.dataset.sharedLineAction;
  const lineId = button.dataset.sharedLineId;
  button.setAttribute("aria-busy", "true");
  if (action !== "select") sharedLineNotice.textContent = t("common.checking");
  try {
    let result;
    if (action === "select") {
      selectedSharedLineId = lineId;
      result = { sharedLine: await window.ClaraCoreDesktop.getSharedLine({ lineId }) };
      sharedLineNotice.textContent = "";
    } else if (action === "activate") {
      result = await window.ClaraCoreDesktop.activateSharedLine(lineId);
      showCopyNotice(t("sharedLine.lineActivated"), sharedLineNotice);
    } else if (action === "rename") {
      renamingSharedLineId = lineId;
      sharedLineTitleInput.value = button.dataset.sharedLineTitle || "";
      createSharedLine.textContent = t("sharedLine.renameLine");
      sharedLineTitleInput.focus();
      sharedLineNotice.textContent = "";
      return;
    } else if (action === "archive") {
      if (!window.confirm(t("sharedLine.archiveConfirm"))) {
        sharedLineNotice.textContent = "";
        return;
      }
      renamingSharedLineId = null;
      result = await window.ClaraCoreDesktop.archiveSharedLine(lineId);
      showCopyNotice(t("sharedLine.lineArchived"), sharedLineNotice);
    } else if (action === "restore") {
      renamingSharedLineId = null;
      result = await window.ClaraCoreDesktop.restoreSharedLine(lineId, true);
      showCopyNotice(t("sharedLine.lineRestored"), sharedLineNotice);
    }
    if (!result?.sharedLine) return;
    snapshot.sharedLine = result.sharedLine;
    renderSharedLine();
  } catch (error) {
    console.error(error);
    sharedLineNotice.textContent = t("sharedLine.lineFailed");
  } finally {
    button.removeAttribute("aria-busy");
  }
});

sharedLineList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest("[data-shared-line-action]");
  if (!card) return;
  event.preventDefault();
  card.click();
});

saveSharedLine.addEventListener("click", async () => {
  saveSharedLine.disabled = true;
  sharedLineNotice.textContent = t("common.checking");
  try {
    const input = {
      summary: sharedLineInput.value,
      interpretationStatus: sharedLineStatusInput.value === "confirmed" ? "confirmed" : "draft",
      factsUsed: splitListInput(sharedLineFactsInput.value)
    };
    let sharedLine;
    try {
      sharedLine = await window.ClaraCoreDesktop.saveSharedLine(input);
    } catch (error) {
      if (String(error?.message || "").includes("Confirmed Shared Line overwrite requires explicit confirmation")) {
        if (!window.confirm(t("sharedLine.form.confirmOverwrite"))) throw error;
        sharedLine = await window.ClaraCoreDesktop.saveSharedLine({
          ...input,
          confirmOverwrite: true
        });
      } else {
        throw error;
      }
    }
    snapshot.sharedLine = sharedLine;
    renderSharedLine();
    showCopyNotice(t("sharedLine.form.saved"), sharedLineNotice);
  } catch (error) {
    console.error(error);
    sharedLineNotice.textContent = t("sharedLine.form.saveFailed");
  } finally {
    saveSharedLine.disabled = false;
  }
});

copySharedLineResume.addEventListener("click", () => {
  copyValue(sharedLineResume.textContent, t("sharedLine.resumeCopied"), sharedLineNotice).catch(console.error);
});

createSharedLineHandoff.addEventListener("click", async () => {
  createSharedLineHandoff.disabled = true;
  sharedLineNotice.textContent = t("common.checking");
  try {
    const summary = sharedLineInput.value || snapshot?.sharedLine?.currentPosition?.summary || "";
    const result = await window.ClaraCoreDesktop.createSharedLineHandoff({
      objective: sharedLineHandoffObjective.value || summary || "Continue from the current Shared Line.",
      completed: splitListInput(sharedLineHandoffCompleted.value),
      openItems: splitListInput(sharedLineHandoffOpenItems.value),
      nextStep:
        sharedLineHandoffNextStep.value ||
        (summary ? "Resume from this Shared Line and update it after the next meaningful step." : "Save a Shared Line position before continuing.")
    });
    snapshot.sharedLine = result.sharedLine;
    sharedLineHandoffObjective.value = "";
    sharedLineHandoffCompleted.value = "";
    sharedLineHandoffOpenItems.value = "";
    sharedLineHandoffNextStep.value = "";
    renderSharedLine();
    showCopyNotice(t("sharedLine.handoffCreated"), sharedLineNotice);
  } catch (error) {
    console.error(error);
    sharedLineNotice.textContent = t("sharedLine.handoffFailed");
  } finally {
    createSharedLineHandoff.disabled = false;
  }
});

startInnerLifeSession.addEventListener("click", async () => {
  startInnerLifeSession.disabled = true;
  innerLifeNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.startInnerLifeSession({
      agentId: "codex",
      userId: "local-user",
      host: "desktop",
      externalSessionId: `desktop-${Date.now()}`
    });
    await refresh();
    showCopyNotice(t("innerLife.sessionStarted"), innerLifeNotice);
  } catch (error) {
    console.error(error);
    innerLifeNotice.textContent = t("innerLife.sessionFailed");
  } finally {
    startInnerLifeSession.disabled = false;
  }
});

endInnerLifeSession.addEventListener("click", async () => {
  endInnerLifeSession.disabled = true;
  innerLifeNotice.textContent = t("common.checking");
  try {
    const sessions = snapshot?.innerLife?.sessions || [];
    const activeSession = sessions.find((session) => session.status === "active");
    if (!activeSession) throw new Error("No active InnerLife session.");
    await window.ClaraCoreDesktop.endInnerLifeSession(activeSession.id, {
      summary: innerLifeSessionSummary.value
    });
    innerLifeSessionSummary.value = "";
    await refresh();
    showCopyNotice(t("innerLife.sessionEnded"), innerLifeNotice);
  } catch (error) {
    console.error(error);
    innerLifeNotice.textContent = t("innerLife.sessionFailed");
  } finally {
    endInnerLifeSession.disabled = false;
  }
});

submitInnerLifeInbox.addEventListener("click", async () => {
  submitInnerLifeInbox.disabled = true;
  innerLifeNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.submitInnerLifeInbox({
      agentId: "codex",
      source: "desktop",
      body: innerLifeInboxInput.value
    });
    innerLifeInboxInput.value = "";
    await refresh();
    showCopyNotice(t("innerLife.inboxSubmitted"), innerLifeNotice);
  } catch (error) {
    console.error(error);
    innerLifeNotice.textContent = t("innerLife.processFailed");
  } finally {
    submitInnerLifeInbox.disabled = false;
  }
});

runInnerLifeDigest.addEventListener("click", async () => {
  runInnerLifeDigest.disabled = true;
  innerLifeNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.runInnerLifeDigest({
      mode: "manual",
      prompt: innerLifeShareContext.value
    });
    showCopyNotice(t("innerLife.digestRan"), innerLifeNotice);
    await refresh();
  } catch (_error) {
    innerLifeNotice.textContent = t("innerLife.processFailed");
  } finally {
    runInnerLifeDigest.disabled = false;
  }
});

enableInnerLifeDaemon.addEventListener("click", async () => {
  enableInnerLifeDaemon.disabled = true;
  innerLifeNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.setInnerLifeDaemon({ action: "enable" });
    await refresh();
    showCopyNotice(t("innerLife.daemonEnabled"), innerLifeNotice);
  } catch (error) {
    console.error(error);
    innerLifeNotice.textContent = t("innerLife.daemonFailed");
  } finally {
    renderInnerLife();
  }
});

pauseInnerLifeDaemon.addEventListener("click", async () => {
  pauseInnerLifeDaemon.disabled = true;
  innerLifeNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.setInnerLifeDaemon({ action: "pause" });
    await refresh();
    showCopyNotice(t("innerLife.daemonPaused"), innerLifeNotice);
  } catch (error) {
    console.error(error);
    innerLifeNotice.textContent = t("innerLife.daemonFailed");
  } finally {
    renderInnerLife();
  }
});

tickInnerLifeDaemon.addEventListener("click", async () => {
  tickInnerLifeDaemon.disabled = true;
  innerLifeNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.tickInnerLifeDaemon({ force: true });
    await refresh();
    showCopyNotice(t("innerLife.daemonTicked"), innerLifeNotice);
  } catch (error) {
    console.error(error);
    innerLifeNotice.textContent = t("innerLife.daemonFailed");
  } finally {
    tickInnerLifeDaemon.disabled = false;
  }
});

checkInnerLifeShareTiming.addEventListener("click", async () => {
  checkInnerLifeShareTiming.disabled = true;
  innerLifeNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.checkInnerLifeShareTiming({
      context: innerLifeShareContext.value
    });
    showCopyNotice(t("innerLife.timingChecked"), innerLifeNotice);
    await refresh();
  } catch (_error) {
    innerLifeNotice.textContent = t("innerLife.processFailed");
  } finally {
    checkInnerLifeShareTiming.disabled = false;
  }
});

processInnerLifeOnce.addEventListener("click", async () => {
  processInnerLifeOnce.disabled = true;
  innerLifeNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.processInnerLifeOnce({});
    await refresh();
    showCopyNotice(t("innerLife.generated"), innerLifeNotice);
  } catch (error) {
    console.error(error);
    innerLifeNotice.textContent = t("innerLife.processFailed");
  } finally {
    processInnerLifeOnce.disabled = false;
  }
});

innerLifeShareList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-innerlife-action]");
  if (!button) return;
  const shareId = button.dataset.innerlifeShareId;
  const action = button.dataset.innerlifeAction;
  if (!shareId || !action) return;
  button.disabled = true;
  innerLifeNotice.textContent = t("common.checking");
  try {
    if (action === "apply-memory") {
      await window.ClaraCoreDesktop.applyInnerLifeShareToMemory(shareId);
      await refresh();
      showCopyNotice(t("innerLife.appliedMemory"), innerLifeNotice);
      return;
    }
    if (action === "apply-shared-line") {
      await window.ClaraCoreDesktop.applyInnerLifeShareToSharedLine(shareId);
      await refresh();
      showCopyNotice(t("innerLife.appliedSharedLine"), innerLifeNotice);
      return;
    }
    if (["used", "deferred", "discarded"].includes(action)) {
      await window.ClaraCoreDesktop.markInnerLifeShare(shareId, action);
      await refresh();
      showCopyNotice(t("innerLife.marked"), innerLifeNotice);
      return;
    }
    await window.ClaraCoreDesktop.reviewInnerLifeShare(shareId, action);
    await refresh();
    showCopyNotice(action === "approve" ? t("innerLife.approved") : t("innerLife.rejected"), innerLifeNotice);
  } catch (error) {
    console.error(error);
    innerLifeNotice.textContent = action.startsWith("apply-") ? t("innerLife.applyFailed") : t("innerLife.reviewFailed");
  } finally {
    button.disabled = false;
  }
});

exportBackup.addEventListener("click", async () => {
  exportBackup.disabled = true;
  backupNotice.textContent = t("common.checking");
  try {
    const backup = await window.ClaraCoreDesktop.createBackup();
    await refresh();
    showCopyNotice(`${t("data.backupCreated")}: ${backup.path}`, backupNotice);
  } catch (error) {
    console.error(error);
    backupNotice.textContent = t("data.backupFailed");
  } finally {
    exportBackup.disabled = false;
  }
});

exportMemoryArchive.addEventListener("click", async () => {
  exportMemoryArchive.disabled = true;
  memoryArchiveNotice.textContent = t("common.checking");
  try {
    const exported = await window.ClaraCoreDesktop.exportMemoryArchive({});
    if (exported?.canceled) {
      memoryArchiveNotice.textContent = "";
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
      memoryArchiveNotice
    );
  } catch (error) {
    console.error(error);
    memoryArchiveNotice.textContent = t("data.memoryExportFailed");
  } finally {
    exportMemoryArchive.disabled = false;
  }
});

importMemoryArchive.addEventListener("click", async () => {
  importMemoryArchive.disabled = true;
  memoryArchiveNotice.textContent = t("common.checking");
  try {
    const imported = await window.ClaraCoreDesktop.importMemoryArchive({});
    if (imported?.canceled) {
      memoryArchiveNotice.textContent = t("data.memoryImportCancelled");
      return;
    }
    await refresh();
    showCopyNotice(
      `${t("data.memoryImportDone")}: ${t("data.memoryArchiveSummary", {
        memories: imported.memories?.imported || 0,
        records: imported.records?.imported || 0,
        aliases: imported.aliases?.imported || 0
      })}`,
      memoryArchiveNotice
    );
  } catch (error) {
    console.error(error);
    memoryArchiveNotice.textContent = t("data.memoryImportFailed");
  } finally {
    importMemoryArchive.disabled = false;
  }
});

const oldSourceImporters = {
  memoria: {
    button: importOldMemoria,
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
    button: importOldContinuity,
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
    button: importOldInnerLife,
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

async function importOldSource(sourceId, triggerButton = null) {
  const config = oldSourceImporters[sourceId];
  if (!config) return;
  if (!window.confirm(t(config.confirmKey))) return;
  const button = triggerButton || config.button;
  if (button) button.disabled = true;
  memoryArchiveNotice.textContent = t("common.checking");
  try {
    const imported = await config.importFn();
    await refresh();
    const backupPath = imported.backup?.path ? ` · ${imported.backup.path}` : "";
    showCopyNotice(`${t(config.doneKey)}: ${config.summary(imported)}${backupPath}`, memoryArchiveNotice);
  } catch (error) {
    console.error(error);
    memoryArchiveNotice.textContent = t(config.failedKey);
  } finally {
    if (button) button.disabled = false;
  }
}

importOldMemoria.addEventListener("click", () => importOldSource("memoria"));
importOldContinuity.addEventListener("click", () => importOldSource("continuity"));
importOldInnerLife.addEventListener("click", () => importOldSource("innerlife"));

openBackupsFolder.addEventListener("click", () => {
  if (snapshot?.data?.backupsDir) {
    window.ClaraCoreDesktop.openPath(snapshot.data.backupsDir);
  }
});

function closeRestoreConfirm() {
  pendingRestoreBackupId = null;
  restoreConfirmInput.value = "";
  restorePreview.innerHTML = "";
  restoreConfirmPanel.classList.add("hidden");
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
  restorePreview.innerHTML = `
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

backupList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-backup-action='restore']");
  if (!button) return;
  const backupId = button.dataset.backupId;
  if (!backupId) return;
  if (!window.confirm(t("data.restoreConfirm"))) return;
  button.disabled = true;
  backupNotice.textContent = t("common.checking");
  try {
    const preview = await window.ClaraCoreDesktop.previewRestore(backupId);
    pendingRestoreBackupId = backupId;
    restoreConfirmInput.value = "";
    renderRestorePreview(preview);
    restoreConfirmPanel.classList.remove("hidden");
    restoreConfirmInput.focus();
    backupNotice.textContent = "";
  } catch (error) {
    console.error(error);
    backupNotice.textContent = t("data.restoreFailed");
  } finally {
    button.disabled = false;
  }
});

cancelRestoreBackup.addEventListener("click", () => {
  closeRestoreConfirm();
  backupNotice.textContent = t("data.restoreCancelled");
});

confirmRestoreBackup.addEventListener("click", async () => {
  if (!pendingRestoreBackupId) return;
  if (restoreConfirmInput.value !== "RESTORE") {
    backupNotice.textContent = t("data.restoreCancelled");
    restoreConfirmInput.focus();
    return;
  }
  confirmRestoreBackup.disabled = true;
  backupNotice.textContent = t("common.checking");
  try {
    await window.ClaraCoreDesktop.restoreBackup(pendingRestoreBackupId);
    closeRestoreConfirm();
    await refresh();
    showCopyNotice(t("data.restoreDone"), backupNotice);
  } catch (error) {
    console.error(error);
    backupNotice.textContent = t("data.restoreFailed");
  } finally {
    confirmRestoreBackup.disabled = false;
  }
});

refreshButton.addEventListener("click", () => {
  refresh().catch((error) => {
    console.error(error);
  });
});

refreshLogs.addEventListener("click", () => {
  refreshRuntimeSnapshotOnly().catch((error) => {
    console.error(error);
  });
});

toggleLogFollow.addEventListener("click", () => {
  logFollowEnabled = !logFollowEnabled;
  toggleLogFollow.classList.toggle("active", logFollowEnabled);
  syncLogRefreshTimer();
  renderLogs();
});

primaryAction.addEventListener("click", () => {
  if (snapshot?.data?.root) {
    window.ClaraCoreDesktop.openPath(snapshot.data.root);
  }
});

openGatewayFolder.addEventListener("click", () => {
  if (snapshot?.data?.runtimeDir) {
    window.ClaraCoreDesktop.openPath(snapshot.data.runtimeDir);
  }
});

function showCopyNotice(label, target = copyNotice) {
  if (!target) return;
  target.textContent = label;
  window.setTimeout(() => {
    target.textContent = "";
  }, 1800);
}

async function copyValue(value, label, target = copyNotice) {
  if (!value) return;
  const ok = await window.ClaraCoreDesktop.copyText(value);
  if (ok) showCopyNotice(label, target);
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!snapshot?.connections) return;
    if (button.dataset.copy === "mcp-command") {
      copyValue(snapshot.connections.mcpCommand, t("connections.copied.mcpCommand")).catch(console.error);
    }
    if (button.dataset.copy === "mcp-config") {
      copyValue(snapshot.connections.mcpConfig, t("connections.copied.mcpConfig")).catch(console.error);
    }
  });
});

httpEndpointList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.openUrl) {
    window.ClaraCoreDesktop.openExternal(button.dataset.openUrl).catch(console.error);
  }
  if (button.dataset.copyUrl) {
    copyValue(button.dataset.copyUrl, t("connections.copied.endpoint")).catch(console.error);
  }
});

openDevelopmentPlan.addEventListener("click", () => {
  if (snapshot?.plans?.productReset) {
    window.ClaraCoreDesktop.openPath(snapshot.plans.productReset);
  }
});

openDesignPlan.addEventListener("click", () => {
  if (snapshot?.plans?.v02Legacy) {
    window.ClaraCoreDesktop.openPath(snapshot.plans.v02Legacy);
  }
});

refresh().catch((error) => {
  runtimeMode.textContent = t("runtime.unavailable");
  rootPath.textContent = t("runtime.unableSnapshot");
});

refreshResources().catch((error) => {
  console.error(error);
  monitorCpu.textContent = "--";
  monitorRam.textContent = "--";
  monitorDisk.textContent = "--";
});
window.setInterval(() => {
  refreshResources().catch(console.error);
}, 5000);

applyStaticTranslations();
window.ClaraCoreDesktop.setLanguage(currentLanguage).catch(console.error);
if (typeof window.ClaraCoreDesktop.onRuntimeChanged === "function") {
  window.ClaraCoreDesktop.onRuntimeChanged(() => scheduleRuntimeRefresh());
}
setView("home");
