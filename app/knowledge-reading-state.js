(function (scope) {
  const KEY = 'claracore.knowledge.reading.v1';
  const MAX_DOCUMENTS_PER_ROOT = 20;
  const MAX_STORED_LENGTH = 65536;
  // Test builds wrote up to five complete histories with 4096-character paths.
  const MAX_LEGACY_LENGTH = 3 * 1024 * 1024;
  function createKnowledgeReadingState(storage) {
    if (storage === undefined) { try { storage = scope.localStorage; } catch { storage = null; } }
    let entries = [];
    const clampScroll = value => Math.min(10000000, Math.max(0, Number(value) || 0));
    const validDoc = doc => doc && typeof doc.path === 'string' && doc.path.length > 0 && doc.path.length <= 4096 && Number.isFinite(doc.scrollTop) && doc.scrollTop >= 0;
    const valid = item => item && typeof item.root === 'string' && item.root.length <= 4096 && typeof item.reference === 'string' && item.reference.length <= 4096 && Number.isFinite(item.scrollTop) && item.scrollTop >= 0;
    const normalizeEntry = item => ({
      root: item.root,
      reference: item.reference,
      scrollTop: clampScroll(item.scrollTop),
      documents: Array.isArray(item.documents) ? item.documents.filter(validDoc).slice(-MAX_DOCUMENTS_PER_ROOT).map(doc => ({ path: doc.path, scrollTop: clampScroll(doc.scrollTop) })) : []
    });
    try {
      const raw = storage?.getItem(KEY);
      if (raw && raw.length <= MAX_LEGACY_LENGTH) { const saved = JSON.parse(raw); if (saved.version === 1 && Array.isArray(saved.entries)) entries = saved.entries.filter(valid).slice(-5).map(normalizeEntry); }
    } catch { /* A malformed or unavailable UI preference must not block reading. */ }
    return {
      get(root) { const item = entries.find(item => item.root === root); return item ? { reference: item.reference, scrollTop: item.scrollTop } : null; },
      getDocument(root, docPath) {
        if (!root || !docPath) return null;
        const item = entries.find(entry => entry.root === root);
        if (item?.reference.split('#')[0] === docPath) return item.scrollTop;
        const doc = item?.documents?.find(entry => entry.path === docPath);
        return doc ? doc.scrollTop : null;
      },
      remember(root, reference, scrollTop = 0) {
        const clamped = clampScroll(scrollTop);
        const base = { root, reference, scrollTop: clamped };
        if (!root || !reference || !valid(base)) return;
        const existing = entries.find(entry => entry.root === root);
        const docPath = reference.split('#')[0];
        const documents = (existing?.documents || []).filter(doc => doc.path !== docPath);
        if (docPath) documents.push({ path: docPath, scrollTop: clamped });
        const item = { ...base, documents: documents.slice(-MAX_DOCUMENTS_PER_ROOT) };
        entries = entries.filter(entry => entry.root !== root).concat(item).slice(-5);
      },
      flush() {
        if (!storage) return;
        // Keep each library's current position and discard older history first.
        const saved = entries.map(entry => ({ ...entry, documents: entry.documents.slice() }));
        let raw = JSON.stringify({ version: 1, entries: saved });
        while (raw.length > MAX_STORED_LENGTH) {
          const oldestHistory = saved.find(entry => entry.documents.length > 0);
          if (oldestHistory) oldestHistory.documents.shift();
          else saved.shift();
          raw = JSON.stringify({ version: 1, entries: saved });
        }
        try { storage.setItem(KEY, raw); } catch { /* Session reading remains available. */ }
      }
    };
  }
  scope.createClaraCoreKnowledgeReadingState = createKnowledgeReadingState;
  if (typeof module !== 'undefined' && module.exports) module.exports = { createKnowledgeReadingState };
})(typeof window === 'undefined' ? globalThis : window);
