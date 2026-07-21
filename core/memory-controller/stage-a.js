const POLICY_VERSION = "stage-a-v1";

const ACTIONS = Object.freeze({
  NOOP: "NOOP",
  RETRIEVE: "RETRIEVE"
});

const REASON_CODES = Object.freeze({
  CONTROLLER_DISABLED: "controller_disabled",
  MEMORY_OPT_OUT: "memory_opt_out",
  CURRENT_TURN_INSTRUCTION: "current_turn_instruction",
  EXPLICIT_HISTORY_REQUEST: "explicit_history_request",
  CONTINUATION_REQUEST: "continuation_request",
  STABLE_PREFERENCE_REQUEST: "stable_preference_request",
  PRIOR_DECISION_REQUEST: "prior_decision_request",
  REUSABLE_KNOWLEDGE_REQUEST: "reusable_knowledge_request",
  ORDINARY_CURRENT_TURN: "ordinary_current_turn"
});

const RULES = Object.freeze([
  {
    id: "memory-opt-out",
    action: ACTIONS.NOOP,
    reason: REASON_CODES.MEMORY_OPT_OUT,
    patterns: [
      /(?:不要|不用|无需|别)(?:再)?(?:回忆|参考|使用|调用|检索)(?:任何)?(?:旧|以前|之前|上次)?(?:记忆|方案|内容|记录)?/u,
      /(?:忽略|忘掉)(?:之前|以前|上次|旧的)(?:方案|记忆|记录|内容)?/u,
      /\b(?:do not|don't|dont|never) (?:recall|retrieve|use|reference) (?:old|earlier|previous|past)?\s*(?:memory|memories|context|plans?)\b/u,
      /\b(?:ignore|forget) (?:the )?(?:old|earlier|previous|past) (?:memory|memories|context|plans?)\b/u
    ]
  },
  {
    id: "current-turn-instruction",
    action: ACTIONS.NOOP,
    reason: REASON_CODES.CURRENT_TURN_INSTRUCTION,
    patterns: [
      /^(?:请)?记得(?:要)?(?:提交|运行|执行|保存|关闭|打开|提醒|告诉|带|买|做|把|检查|更新|推送)/u,
      /\bremember to\b/u,
      /之前先.{0,32}(?:再|然后|最后)/u,
      /(?:继续|接着)(?:运行|执行|处理|等待|监控|观察|测试|构建|安装|下载|上传|修复)(?:当前|这个|刚才)?/u,
      /\bcontinue (?:running|executing|processing|monitoring|waiting|testing|building|installing|downloading|uploading|fixing|the current|this (?:command|task|run|process))\b/u
    ]
  },
  {
    id: "prior-decision",
    action: ACTIONS.RETRIEVE,
    reason: REASON_CODES.PRIOR_DECISION_REQUEST,
    patterns: [
      /我们(?:之前|上次|当时)?(?:是)?怎么(?:定|决定|约定)(?:的|来着)?/u,
      /我们(?:之前|上次|当时)(?:对|关于).{0,120}(?:做了|作出|有过)?(?:什么|哪些)?(?:决定|约定|结论)/u,
      /(?:之前|上次|当时)(?:的|做的)?(?:决定|约定|结论)/u,
      /\bwhat did we (?:decide|agree|settle on)\b/u,
      /\b(?:(?:our|the) )?(?:earlier|previous|last) (?:decision|agreement|conclusion)\b/u
    ]
  },
  {
    id: "stable-preference",
    action: ACTIONS.RETRIEVE,
    reason: REASON_CODES.STABLE_PREFERENCE_REQUEST,
    patterns: [
      /我的(?:之前|以前|长期|一贯|稳定)?(?:偏好|习惯|口味|风格)/u,
      /我(?:之前|以前|一向|通常)(?:更)?(?:喜欢|偏好|习惯)/u,
      /你还记得我(?:喜欢|偏好|习惯)/u,
      /我的.{0,12}\b(?:previous|usual|long[- ]term) (?:preference|habit|style)\b/u,
      /\bmy (?:earlier|previous|usual|long[- ]term)?\s*(?:preference|preferences|habit|habits|style)\b/u,
      /\bdo you remember (?:how|what) i (?:like|prefer|usually)\b/u
    ]
  },
  {
    id: "continuation",
    action: ACTIONS.RETRIEVE,
    reason: REASON_CODES.CONTINUATION_REQUEST,
    patterns: [
      /(?:继续|接着)(?:刚才|上次|之前)(?:的|那个|话题|工作|任务|讨论)?/u,
      /回到(?:刚才|上次|之前|那个)(?:的|那个|话题|工作|任务|讨论)?/u,
      /沿着(?:上次|之前|刚才)(?:的)?(?:思路|方向|工作|讨论)/u,
      /\bcontinue from (?:last time|where we left off|the earlier|the previous)\b/u,
      /\bpick up where we left off\b/u,
      /\b(?:resume|return to) .{0,20}(?:之前|上次|刚才).{0,20}\b(?:work|task|discussion|thread|topic)\b/u,
      /\b(?:resume|return to) (?:our|the|that) (?:earlier|previous|last) (?:work|task|discussion|thread|topic)\b/u
    ]
  },
  {
    id: "reusable-knowledge",
    action: ACTIONS.RETRIEVE,
    reason: REASON_CODES.REUSABLE_KNOWLEDGE_REQUEST,
    patterns: [
      /(?:之前|以前|上次)(?:那个|的)?.{0,20}(?:方法|办法|做法|方案|经验|卡片|知识卡)/u,
      /(?:那张|之前的)(?:卡片|知识卡)/u,
      /(?:以前|之前|上次)(?:踩|遇到)过(?:这个|类似)?坑/u,
      /(?:这个|类似)?坑(?:以前|之前|上次)(?:踩|遇到)过/u,
      /(?:老办法|老方法)(?:还)?(?:能用|怎么做|是什么|来)?/u,
      /\breuse (?:our|the|that)?\s*(?:earlier|previous|last) (?:approach|method|playbook|solution)\b/u,
      /\b(?:that|the earlier|the previous) (?:card|knowledge card|playbook|method|approach)\b/u,
      /\b(?:did we|have we) (?:hit|solve|handle) (?:this|a similar) (?:issue|problem) before\b/u
    ]
  },
  {
    id: "explicit-history",
    action: ACTIONS.RETRIEVE,
    reason: REASON_CODES.EXPLICIT_HISTORY_REQUEST,
    patterns: [
      /还记得(?:吗|不|我们|我|你)/u,
      /你(?:之前|上次|当时)(?:说过|提过|写过|建议过|记录过)/u,
      /(?:上次|当时)(?:我们|你|我)?(?:说|聊|提|做|发生|记录|讨论|写)(?:的|过|了)?/u,
      /(?:之前|以前)(?:我们|你|我)(?:说|聊|提|做|发生|记录|讨论|写)(?:的|过|了)?/u,
      /\bdo you remember\b/u,
      /\b(?:last time|back then)\b/u,
      /\bwhat (?:did )?(?:we|you|i) (?:say|discuss|do|record|write|said|discussed|did|recorded|wrote) earlier\b/u,
      /\byou (?:said|mentioned|suggested|recorded|wrote) (?:earlier|before|last time)\b/u
    ]
  }
]);

function normalizePrompt(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function evaluateStageA(input = {}) {
  const prompt = normalizePrompt(typeof input === "string" ? input : input.prompt);
  const mode = normalizePrompt(typeof input === "string" ? "observe" : input.mode || "observe");
  const startedAt = process.hrtime.bigint();

  let matchedRule = null;
  if (["off", "disabled"].includes(mode)) {
    matchedRule = {
      id: "controller-disabled",
      action: ACTIONS.NOOP,
      reason: REASON_CODES.CONTROLLER_DISABLED
    };
  } else {
    matchedRule = RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(prompt))) || null;
  }

  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  return {
    action: matchedRule?.action || ACTIONS.NOOP,
    reason: matchedRule?.reason || REASON_CODES.ORDINARY_CURRENT_TURN,
    policyVersion: POLICY_VERSION,
    ruleId: matchedRule?.id || "ordinary-current-turn",
    normalizedPrompt: prompt,
    latencyMs: elapsedMs
  };
}

module.exports = {
  ACTIONS,
  POLICY_VERSION,
  REASON_CODES,
  RULES,
  evaluateStageA,
  normalizePrompt
};
