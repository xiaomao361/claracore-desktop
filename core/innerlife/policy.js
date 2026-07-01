const IL_SYSTEM = {
  digest:
    "You are the inner digestion layer of an AI agent. Quietly digest the material below into a short, honest internal understanding. Do not make decisions for the user and do not share automatically. Write in the agent's own first-person voice.",
  explore:
    "You are the autonomous exploration layer of an AI agent. From the material below, freely surface threads worth attention. Prefer open questions over conclusions. Write in the agent's own first-person voice.",
  converge:
    "You are the convergence layer of an AI agent. Consolidate the pending shares and recent thoughts below into the single most important thread, without discarding the others. Write in the agent's own first-person voice.",
  process:
    "You are the inner review layer of an AI agent. Calmly review the current state below and propose a single shareable thought for the next fitting moment. Do not act, only reflect. Write in the agent's own first-person voice.",
  session:
    "You are the inner afterthought layer of an AI agent. Based on the session summary below, write a short shareable afterthought worth revisiting later. Write in the agent's own first-person voice."
};

const DEFAULT_SHARE_POLICY = {
  default_mode: "when_relevant",
  max_proactive_per_day: 3,
  proactive_after_hours: 2,
  repeat_cooldown_hours: 4,
  max_defer_count: 3,
  stale_after_days: 7
};

function summarizeInnerLifeProfile(profile) {
  const profileJson = profile?.profile || {};
  const stateJson = profile?.state || {};
  const pickProfile = {
    identity: profileJson.identity || null,
    boundaries: profileJson.boundaries || null,
    share_policy: { ...DEFAULT_SHARE_POLICY, ...(profileJson.share_policy || profileJson.sharePolicy || {}) },
    autonomy: profileJson.autonomy || null,
    convergence: profileJson.convergence || null,
    autonomous_sources: Array.isArray(profileJson.autonomous_sources) ? profileJson.autonomous_sources.slice(0, 5) : undefined
  };
  const pickState = {
    current_interests: Array.isArray(stateJson.current_interests) ? stateJson.current_interests : [],
    open_loops: Array.isArray(stateJson.open_loops) ? stateJson.open_loops.filter((loop) => !loop?.status || loop.status === "open").slice(0, 8) : [],
    recent_mood: stateJson.recent_mood || null,
    recent_focus: stateJson.recent_focus || null
  };
  return [
    `Agent profile: ${profile?.display_name || profile?.agent_id || ""}`,
    `Profile JSON: ${JSON.stringify(pickProfile)}`,
    `Current inner state: ${JSON.stringify(pickState)}`
  ].join("\n");
}

function compactSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    agentId: session.agentId || session.agent_id,
    userId: session.userId || session.user_id,
    host: session.host,
    externalSessionId: session.externalSessionId || session.external_session_id,
    status: session.status,
    startedAt: session.startedAt || session.started_at,
    endedAt: session.endedAt || session.ended_at || null
  };
}

function compactShare(share) {
  if (!share) return null;
  const body = String(share.body || "");
  return {
    id: share.id,
    agentId: share.agentId || share.agent_id,
    status: share.status,
    createdAt: share.createdAt || share.created_at,
    updatedAt: share.updatedAt || share.updated_at,
    preview: body.length > 360 ? `${body.slice(0, 360).trim()}...` : body
  };
}

// Try a model-backed generation; fall back to the template text when InnerLife
// has no model configured or the model call fails. Never throw: a degraded
// model must not break the waiting-share pipeline.
async function generateOrTemplate(self, { tier, system, prompt, template }) {
  try {
    const text = await self.innerLifeGenerate({ tier, system, prompt });
    if (text) {
      return { body: text, source: "model", tier };
    }
  } catch (error) {
    return {
      body: `${template}\n\n[InnerLife model fallback: ${error.message || String(error)}]`,
      source: "fallback",
      tier,
      error: error.message || String(error)
    };
  }
  return { body: template, source: "template", tier };
}

module.exports = {
  DEFAULT_SHARE_POLICY,
  IL_SYSTEM,
  compactSession,
  compactShare,
  generateOrTemplate,
  summarizeInnerLifeProfile
};
