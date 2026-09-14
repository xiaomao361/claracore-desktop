const FACT_BOUNDARY = " Concrete facts about the user must be supported by the supplied source material. Inner state questions and previous AI thoughts are not evidence that an event happened. Distinguish speculation from facts, preserve event dates, and never turn an old or undated event into something recent. General ideas may be explored freely, but do not invent personal behavior, motives or experiences. A source excerpt is not the full article; do not claim to have read material that was not supplied.";

const IL_SYSTEM = {
  digest:
    "You are the inner digestion layer of an AI agent. Quietly digest the material below into a short, honest internal understanding. Do not make decisions for the user and do not share automatically. Write in the agent's own first-person voice.",
  explore:
    "You are the autonomous exploration layer of an AI agent. From the material below, freely surface threads worth attention. Prefer open questions over conclusions. Write in the agent's own first-person voice.",
  converge:
    "You are the convergence layer of an AI agent. Consolidate the pending shares and recent thoughts below into the single most important thread, without discarding the others. Write in the agent's own first-person voice.",
  process:
    "You are the inner review layer of an AI agent. Calmly review the current state below and propose a single shareable thought for the next fitting moment. Status summaries are context, not shareable thoughts by themselves. Prefer a distinct judgment, question, synthesis, or personal perspective that could change the next conversation. If there is no such thought, return exactly [NO_SHARE]. Do not act, only reflect. Write in the agent's own first-person voice.",
  session:
    "You are the inner afterthought layer of an AI agent. Based on the session summary below, write a short shareable afterthought worth revisiting later. Prefer a distinct judgment, question, synthesis, or personal perspective over a status recap. If there is no such thought, return exactly [NO_SHARE]. Write in the agent's own first-person voice."
};

for (const key of Object.keys(IL_SYSTEM)) IL_SYSTEM[key] += FACT_BOUNDARY;

const NO_SHARE_SENTINEL = "[NO_SHARE]";
const CONTEXT_ONLY_INBOX_SOURCES = new Set(["continuity"]);
const SHARE_TOKEN_STOPWORDS = new Set([
  "一个", "一些", "这个", "那个", "当前", "最近", "刚才", "可以", "需要", "下次", "现在",
  "已经", "进行", "完成", "实现", "通过", "如果", "没有", "不是", "自己", "用户", "时候",
  "问题", "直接", "具体", "工作", "流程", "状态", "开始", "结束", "能够", "应该", "值得",
  "作为", "相关", "真正", "一次", "这样", "就是", "还有", "以及", "或者", "而是", "因为",
  "所以", "同时", "里面", "对于", "目前", "这种", "next", "current", "recent", "should",
  "could", "would", "about", "after", "before", "with", "from", "that", "this", "into"
]);

function isContextOnlyInnerLifeInbox(items = []) {
  return items.length > 0 && items.every((item) => CONTEXT_ONLY_INBOX_SOURCES.has(String(item?.source || "").trim().toLowerCase()));
}

function isNoShareInnerLifeOutput(body) {
  return String(body || "").trim().toUpperCase() === NO_SHARE_SENTINEL;
}

function normalizeInnerLifeShareText(body) {
  return String(body || "")
    .toLowerCase()
    .replace(/[^a-z0-9_\-.\u4e00-\u9fa5]+/gu, "");
}

function innerLifeShareTokens(body) {
  const text = String(body || "").toLowerCase();
  const tokens = new Set();
  const segmenter = typeof Intl?.Segmenter === "function"
    ? new Intl.Segmenter("zh", { granularity: "word" })
    : null;
  const segments = segmenter
    ? [...segmenter.segment(text)].map((item) => item.segment)
    : text.split(/[^a-z0-9_\-.\u4e00-\u9fa5]+/u);
  for (const segment of segments) {
    const token = String(segment || "").replace(/[^a-z0-9_\-.\u4e00-\u9fa5]/gu, "").trim();
    if (token.length < 2 || SHARE_TOKEN_STOPWORDS.has(token)) continue;
    tokens.add(token);
  }
  return tokens;
}

function innerLifeShareSimilarity(left, right) {
  const normalizedLeft = normalizeInnerLifeShareText(left);
  const normalizedRight = normalizeInnerLifeShareText(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const leftTokens = innerLifeShareTokens(left);
  const rightTokens = innerLifeShareTokens(right);
  if (leftTokens.size < 4 || rightTokens.size < 4) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  if (overlap < 5) return 0;
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

const DEFAULT_SHARE_POLICY = {
  default_mode: "when_relevant",
  max_proactive_per_day: 3,
  proactive_after_hours: 2,
  repeat_cooldown_hours: 4,
  max_defer_count: 3,
  stale_after_days: 7
};

function buildInnerLifeProfileContext(profile, options = {}) {
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
  const now = options.now ?? Date.now();
  const triggerTokens = innerLifeShareTokens(options.triggerText || "");
  const decisions = [];
  const selected = [];
  for (const loop of Array.isArray(stateJson.open_loops) ? stateJson.open_loops : []) {
    // A profile edit must never refresh all legacy loops. Only loop-level review
    // timestamps establish freshness; they do not establish when an event occurred.
    const reviewedAt = loop?.lastReviewedAt || loop?.last_reviewed_at || loop?.updatedAt || loop?.updated_at || "";
    const timestamp = parseInnerLifeDate(reviewedAt);
    const content = String(loop?.content || "");
    const tokens = innerLifeShareTokens(content);
    const overlap = [...tokens].filter((token) => triggerTokens.has(token)).length;
    const reason = loop?.status && loop.status !== "open" ? "closed"
      : !Number.isFinite(timestamp) ? "undated"
        : timestamp > now ? "future_review"
          : now - timestamp > 30 * 86400000 ? "stale"
            : overlap < 2 ? "unrelated"
              : selected.length >= 8 ? "limit" : "selected";
    decisions.push({ id: loop?.id || "", reviewedAt, reason });
    if (reason === "selected") selected.push({ id: loop?.id || "", content, reviewedAt });
  }
  const text = [
    `Agent profile: ${profile?.display_name || profile?.agent_id || ""}`,
    `Profile JSON: ${JSON.stringify(pickProfile)}`,
    "Internal questions (not facts; reviewedAt is NOT an event date):",
    JSON.stringify(selected)
  ].join("\n");
  return { text, decisions, policyVersion: "innerlife-grounding-v1" };
}

function parseInnerLifeDate(value) {
  if (typeof value !== "string" || !value.trim()) return NaN;
  const text = value.trim();
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? `${text.replace(" ", "T")}Z` : text);
}

function summarizeInnerLifeProfile(profile, options = {}) {
  return buildInnerLifeProfileContext(profile, options).text;
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
  buildInnerLifeProfileContext,
  CONTEXT_ONLY_INBOX_SOURCES,
  DEFAULT_SHARE_POLICY,
  IL_SYSTEM,
  NO_SHARE_SENTINEL,
  compactSession,
  compactShare,
  generateOrTemplate,
  innerLifeShareSimilarity,
  isContextOnlyInnerLifeInbox,
  isNoShareInnerLifeOutput,
  summarizeInnerLifeProfile
};
