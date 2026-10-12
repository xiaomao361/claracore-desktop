// Reject malformed pages rather than silently turning them into page one.
function catalogInput(input = {}) {
  const limit = input.limit === undefined ? 10 : input.limit;
  const offset = input.offset === undefined ? 0 : input.offset;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new Error("Catalog limit must be an integer from 1 to 50.");
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Catalog offset must be a nonnegative safe integer.");
  return { limit, offset };
}

module.exports = { catalogInput };
