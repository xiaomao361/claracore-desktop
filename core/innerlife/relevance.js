// v0.6.6 turn-context patch: read-only InnerLife relevance.
//
// innerlife_share_check is the explicit, evidence-producing path: it INSERTs a
// row into innerlife_share_checks carrying the supplied context. That makes it
// wrong for automatic per-turn evaluation, which must not create product state.
// This module is the read-only counterpart — same token machinery, no writes,
// no Shared Line selection, no share status change.
//
// It answers one question: how well does this waiting share match the current
// prompt. It does not decide delivery; the arbiter does, against its own
// threshold.

const ASK_SIGNAL_EN = /\b(ask|asked|question|share|need|use|recall|remember|thought|idea)\b/i;
const ASK_SIGNAL_ZH = /分享|需要|使用|记得|回忆|问题|想法|你怎么看|有什么想说/u;

const PREVIEW_TOKEN_FLOOR = 3;
const ASK_SIGNAL_BOOST = 0.15;
const MAX_RELEVANCE = 1;

// Relevance is coverage of the share by the prompt, not raw overlap: a long
// prompt should not score higher just for containing more words. Dividing by
// the share's own token count asks "how much of what this share is about did
// the user actually bring up".
function coverage(promptTokens, shareTokens) {
  if (!shareTokens.size) return 0;
  let hit = 0;
  for (const token of new Set(promptTokens)) {
    if (shareTokens.has(token)) hit += 1;
  }
  return hit / shareTokens.size;
}

function createInnerLifeRelevanceScorer(ports = {}) {
  const tokenize = ports.meaningfulTokens;
  if (typeof tokenize !== "function") {
    throw new Error("InnerLife relevance scorer requires a meaningfulTokens port.");
  }

  // Returns a 0..1 score plus the signals behind it. Signals are kept so a
  // trace can explain a decision without storing the prompt.
  return function scoreShareRelevance(prompt, share) {
    const promptText = String(prompt || "");
    const shareText = String(share?.preview || share?.body || "");
    const promptTokens = tokenize(promptText);
    const shareTokens = new Set(tokenize(shareText));

    if (!promptTokens.length || shareTokens.size < PREVIEW_TOKEN_FLOOR) {
      return {
        relevance: 0,
        signals: { overlap: 0, coverage: 0, askSignal: false, reason: "insufficient_tokens" }
      };
    }

    const shareCoverage = coverage(promptTokens, shareTokens);
    const askSignal = ASK_SIGNAL_EN.test(promptText) || ASK_SIGNAL_ZH.test(promptText);
    // An explicit ask raises an already-connected share; it never manufactures
    // relevance on its own, or "有什么想说的" would surface an unrelated share.
    const boost = askSignal && shareCoverage > 0 ? ASK_SIGNAL_BOOST : 0;
    const relevance = Math.min(MAX_RELEVANCE, Number((shareCoverage + boost).toFixed(4)));

    let overlap = 0;
    for (const token of new Set(promptTokens)) {
      if (shareTokens.has(token)) overlap += 1;
    }

    return {
      relevance,
      signals: {
        overlap,
        coverage: Number(shareCoverage.toFixed(4)),
        askSignal,
        reason: relevance > 0 ? "token_coverage" : "no_overlap"
      }
    };
  };
}

module.exports = {
  ASK_SIGNAL_BOOST,
  PREVIEW_TOKEN_FLOOR,
  createInnerLifeRelevanceScorer
};
