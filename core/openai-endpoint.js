// A bare origin uses /v1; explicit compatibility prefixes are preserved.
function openAiEndpoint(baseUrl, resource) {
  const url = new URL(String(baseUrl || '').trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an http or https API base URL without credentials, query or fragment.');
  }
  let prefix = url.pathname.replace(/\/+$/, '').replace(/\/(?:chat\/completions|embeddings|models)$/, '');
  if (!prefix) prefix = '/v1';
  url.pathname = `${prefix}/${resource}`;
  return url.toString();
}
module.exports = { openAiEndpoint };
