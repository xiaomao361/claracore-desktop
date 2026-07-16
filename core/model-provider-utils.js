function normalizeModelName(value) {
  return String(value || "").trim();
}

function ollamaModelNameWithDefaultTag(value) {
  const model = normalizeModelName(value);
  if (!model) return "";
  const lastSlash = model.lastIndexOf("/");
  const tagIndex = model.indexOf(":", lastSlash + 1);
  return tagIndex === -1 ? `${model}:latest` : model;
}

function resolveListedModelName(configuredModel, listedModels = [], provider = "") {
  const configured = normalizeModelName(configuredModel);
  const models = listedModels.map(normalizeModelName).filter(Boolean);
  if (!configured) return "";
  const exact = models.find((model) => model === configured);
  if (exact) return exact;
  if (String(provider || "").trim().toLowerCase() !== "ollama") return "";
  const taggedConfigured = ollamaModelNameWithDefaultTag(configured);
  return models.find((model) => ollamaModelNameWithDefaultTag(model) === taggedConfigured) || "";
}

module.exports = {
  ollamaModelNameWithDefaultTag,
  resolveListedModelName
};
