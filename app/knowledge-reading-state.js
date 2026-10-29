(function (scope) {
  const KEY = 'claracore.knowledge.reading.v1';
  function createKnowledgeReadingState(storage) {
    if (storage === undefined) { try { storage = scope.localStorage; } catch { storage = null; } }
    let entries = [];
    const valid = item => item && typeof item.root === 'string' && item.root.length <= 4096 && typeof item.reference === 'string' && item.reference.length <= 4096 && Number.isFinite(item.scrollTop) && item.scrollTop >= 0;
    try {
      const raw = storage?.getItem(KEY);
      if (raw && raw.length <= 65536) { const saved = JSON.parse(raw); if (saved.version === 1 && Array.isArray(saved.entries)) entries = saved.entries.filter(valid).slice(-5); }
    } catch { /* A malformed or unavailable UI preference must not block reading. */ }
    return {
      get(root) { const item = entries.find(item => item.root === root); return item ? { reference: item.reference, scrollTop: item.scrollTop } : null; },
      remember(root, reference, scrollTop = 0) {
        const item = { root, reference, scrollTop: Math.min(10000000, Math.max(0, Number(scrollTop) || 0)) };
        if (!root || !reference || !valid(item)) return;
        entries = entries.filter(entry => entry.root !== root).concat(item).slice(-5);
      },
      flush() { try { storage?.setItem(KEY, JSON.stringify({ version: 1, entries })); } catch { /* Session reading remains available. */ } }
    };
  }
  scope.createClaraCoreKnowledgeReadingState = createKnowledgeReadingState;
  if (typeof module !== 'undefined' && module.exports) module.exports = { createKnowledgeReadingState };
})(typeof window === 'undefined' ? globalThis : window);
