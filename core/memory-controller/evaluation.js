const { ACTIONS, evaluateStageA, normalizePrompt } = require("./stage-a");

function emptyMatrix() {
  return { truePositive: 0, falsePositive: 0, falseNegative: 0, trueNegative: 0 };
}

function addPrediction(matrix, expectedAction, actualAction) {
  const expectedRetrieve = expectedAction === ACTIONS.RETRIEVE;
  const actualRetrieve = actualAction === ACTIONS.RETRIEVE;
  if (expectedRetrieve && actualRetrieve) matrix.truePositive += 1;
  else if (!expectedRetrieve && actualRetrieve) matrix.falsePositive += 1;
  else if (expectedRetrieve) matrix.falseNegative += 1;
  else matrix.trueNegative += 1;
}

function explicitSearchBaseline(prompt) {
  const text = normalizePrompt(prompt);
  return /(?:搜索|查找|检索)(?:一下|我的|相关)?(?:记忆|memory)|\b(?:search|look up|retrieve) (?:my |the )?(?:memory|memories)\b/u.test(text)
    ? ACTIONS.RETRIEVE
    : ACTIONS.NOOP;
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function estimateTokens(text) {
  const normalized = String(text || "").trim();
  const cjkCount = (normalized.match(/[\u3400-\u9fff]/gu) || []).length;
  const nonCjk = normalized.replace(/[\u3400-\u9fff]/gu, " ");
  const wordCount = (nonCjk.match(/[\p{L}\p{N}]+/gu) || []).length;
  return Math.max(1, cjkCount + Math.ceil(wordCount * 1.3));
}

function evaluateFixtures(fixtures, options = {}) {
  const iterations = Math.max(1, Number.parseInt(String(options.iterations || 1), 10) || 1);
  const matrix = emptyMatrix();
  const alwaysRetrieve = emptyMatrix();
  const explicitSearch = emptyMatrix();
  const byLanguage = {};
  const byCategory = {};
  const failures = [];
  const latencies = [];

  for (const fixture of fixtures) {
    const result = evaluateStageA({ prompt: fixture.prompt, mode: fixture.mode });
    addPrediction(matrix, fixture.expectedAction, result.action);
    addPrediction(alwaysRetrieve, fixture.expectedAction, ACTIONS.RETRIEVE);
    addPrediction(explicitSearch, fixture.expectedAction, explicitSearchBaseline(fixture.prompt));
    byLanguage[fixture.language] ||= emptyMatrix();
    byCategory[fixture.category] ||= emptyMatrix();
    addPrediction(byLanguage[fixture.language], fixture.expectedAction, result.action);
    addPrediction(byCategory[fixture.category], fixture.expectedAction, result.action);
    if (result.action !== fixture.expectedAction || (fixture.expectedReason && result.reason !== fixture.expectedReason)) {
      failures.push({
        id: fixture.id,
        expectedAction: fixture.expectedAction,
        actualAction: result.action,
        expectedReason: fixture.expectedReason || null,
        actualReason: result.reason
      });
    }
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (const fixture of fixtures) {
      latencies.push(evaluateStageA(fixture.prompt).latencyMs);
    }
  }

  return {
    fixtureCount: fixtures.length,
    matrix,
    baselines: {
      alwaysRetrieve,
      explicitSearch
    },
    byLanguage,
    byCategory,
    failures,
    latencyMs: {
      samples: latencies.length,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: latencies.length ? Math.max(...latencies) : 0
    },
    promptTokens: {
      totalEstimate: fixtures.reduce((sum, fixture) => sum + estimateTokens(fixture.prompt), 0),
      maxEstimate: Math.max(...fixtures.map((fixture) => estimateTokens(fixture.prompt)))
    }
  };
}

module.exports = {
  addPrediction,
  emptyMatrix,
  estimateTokens,
  evaluateFixtures,
  explicitSearchBaseline,
  percentile
};
