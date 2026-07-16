const assert = require("assert");
const {
  ollamaModelNameWithDefaultTag,
  resolveListedModelName
} = require("../model-provider-utils");

assert.equal(ollamaModelNameWithDefaultTag("bge-m3"), "bge-m3:latest");
assert.equal(ollamaModelNameWithDefaultTag("bge-m3:latest"), "bge-m3:latest");
assert.equal(ollamaModelNameWithDefaultTag("localhost:5000/library/bge-m3"), "localhost:5000/library/bge-m3:latest");
assert.equal(resolveListedModelName("bge-m3", ["bge-m3:latest"], "ollama"), "bge-m3:latest");
assert.equal(resolveListedModelName("bge-m3:latest", ["bge-m3"], "ollama"), "bge-m3");
assert.equal(resolveListedModelName("bge-m3", ["bge-m3:v1"], "ollama"), "");
assert.equal(resolveListedModelName("bge-m3", ["bge-m3:latest"], "openai-compatible"), "");

console.log(JSON.stringify({ ok: true, alias: "bge-m3", resolved: "bge-m3:latest" }, null, 2));
