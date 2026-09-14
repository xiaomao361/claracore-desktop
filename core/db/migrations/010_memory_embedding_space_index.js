// Eligibility reads only metadata. A covering index avoids fetching the large
// vector_json payload for every eligible memory before native vector search.
const schema = `
  CREATE INDEX IF NOT EXISTS idx_memory_embeddings_space
    ON memory_embeddings(provider,model,dimension,status,memory_id);
`;

module.exports = {
  id: "010_memory_embedding_space_index", phase: "after-schema", schema,
  async up(database) { await database.exec(schema); }
};
