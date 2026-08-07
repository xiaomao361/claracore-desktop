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
const LATIN_TOKEN_FLOOR = 3;
const ASK_SIGNAL_BOOST = 0.15;
const MAX_RELEVANCE = 1;
// A single shared common word is not a topic match. Two distinct overlapping
// terms is the floor before any ratio is trusted.
const MIN_OVERLAP_TOKENS = 2;

// Relevance answers "of the distinctive words the user just used, how many does
// this share also talk about" — so the denominator is the prompt, not the share.
//
// Dividing by the share's own token count was the first attempt and it is
// wrong: it penalises length. A thoughtful three-sentence share has 25-40
// tokens, so it would have needed a dozen overlapping words to clear the
// threshold, which no ordinary question produces. Measured against real bodies
// that scored 0.2 where a near-paraphrase scored 0.55, meaning only a share
// that restated the prompt could ever be delivered and the feature would have
// silently never fired.
function promptCoverage(promptTokens, shareTokens) {
  const distinct = new Set(promptTokens);
  if (!distinct.size || !shareTokens.size) return { ratio: 0, overlap: 0 };
  let overlap = 0;
  for (const token of distinct) {
    if (shareTokens.has(token)) overlap += 1;
  }
  return { ratio: overlap / distinct.size, overlap };
}

// Tokenisation is relevance policy, so it lives here rather than being borrowed.
//
// The shared `meaningfulTokens` helper splits on everything that is not a
// latin/digit/CJK character, which means an unpunctuated Chinese sentence stays
// a single token. Coverage would then be 1 with an overlap of 1, fall under the
// two-token floor, and score 0 — Chinese relevance was dead in every case.
// Chinese runs are emitted as character bigrams instead, which is the cheap
// standard for CJK matching and makes the overlap floor meaningful again.
const CJK = "\\u4e00-\\u9fa5\\u3040-\\u30ff\\uac00-\\ud7af";
const CJK_RUN = new RegExp(`[${CJK}]+`, "gu");
const LATIN_RUN = /[a-z0-9]+/gu;

function relevanceTokens(text) {
  const lowered = String(text || "").toLowerCase();
  const tokens = [];
  for (const match of lowered.matchAll(LATIN_RUN)) {
    if (match[0].length >= LATIN_TOKEN_FLOOR) tokens.push(match[0]);
  }
  for (const match of lowered.matchAll(CJK_RUN)) {
    const run = match[0];
    if (run.length === 1) {
      tokens.push(run);
      continue;
    }
    for (let index = 0; index < run.length - 1; index += 1) {
      tokens.push(run.slice(index, index + 2));
    }
  }
  return tokens.slice(0, 200);
}

function createInnerLifeRelevanceScorer(ports = {}) {
  const tokenize = typeof ports.tokenize === "function" ? ports.tokenize : relevanceTokens;

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

    const { ratio, overlap } = promptCoverage(promptTokens, shareTokens);
    if (overlap < MIN_OVERLAP_TOKENS) {
      return {
        relevance: 0,
        signals: { overlap, coverage: Number(ratio.toFixed(4)), askSignal: false, reason: "below_overlap_floor" }
      };
    }

    const askSignal = ASK_SIGNAL_EN.test(promptText) || ASK_SIGNAL_ZH.test(promptText);
    // An explicit ask raises an already-connected share; it never manufactures
    // relevance on its own, or "有什么想说的" would surface an unrelated share.
    const boost = askSignal ? ASK_SIGNAL_BOOST : 0;
    const relevance = Math.min(MAX_RELEVANCE, Number((ratio + boost).toFixed(4)));

    return {
      relevance,
      signals: {
        overlap,
        coverage: Number(ratio.toFixed(4)),
        askSignal,
        reason: "prompt_coverage"
      }
    };
  };
}

module.exports = {
  ASK_SIGNAL_BOOST,
  MIN_OVERLAP_TOKENS,
  PREVIEW_TOKEN_FLOOR,
  createInnerLifeRelevanceScorer,
  relevanceTokens
};
