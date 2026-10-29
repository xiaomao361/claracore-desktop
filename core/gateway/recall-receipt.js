function recallReceipt(result, collected) {
  return { decisionId: collected.memoryDecisionId || "",
    ...(collected.memoryDecisionId ? { feedbackRef: { tool: "memory_context_feedback", arguments: { decisionId: collected.memoryDecisionId } } } : {}),
    domainStatus: result.domainStatus, decision: result.decision,
    selected: result.selected || (result.block ? [{ domain: result.block.domain, id: result.block.id }] : []),
    preparedBytes: Buffer.byteLength(JSON.stringify(result.blocks || (result.block ? [result.block] : []))),
    hostDelivery: 'unknown', used: 'unknown', outcome: 'unknown', latencyMs: collected.latencyMs };
}
module.exports = { recallReceipt };
