# Privacy and data

ClaraCore is designed around a local workspace. Which content leaves your
computer depends on the clients and model providers you choose to connect.

## Stored on your device

- SQLite stores memories, Shared Lines, InnerLife state, configuration, and
  bounded activity/trace records.
- Knowledge source files remain in your selected Markdown directory. Local
  indexes store pointers, hashes, and embeddings rather than a second source body.
- Explicit understanding submissions create recovery journals containing the
  submitted evidence, plans, and execution state.
- Backups, intake receipts, recovery copies, and host outboxes may contain
  sensitive material. Protect them like the original data.

## Requests to other software

| Connection | Content it can receive |
| --- | --- |
| An authenticated MCP client | The context and tool results it explicitly requests. The client's own processing and retention rules apply. |
| A remote Memory embedding provider | Text being embedded for Memory. |
| An enabled InnerLife model provider | The bounded material and context used for the selected generation task. |
| An explicitly allowed understanding planner | Submitted evidence and relevant recalled context needed to plan operations. |
| An optional decision model | Its bounded classification request; see [Decision models](DECISION_MODELS.md). |

Knowledge semantic computation is restricted to supported local models. Source
links are not automatically crawled; opening an external link is a separate
user action. Built-in local inference does not require a remote provider for
each embedding request. Other enabled connections may still use the network.

## Access and secrets

The Gateway binds to loopback, requires a bearer token, and rejects non-local
Origins. The token is local and persists until rotated. Tool profiles change
what clients discover; they do not restrict what an authenticated client may
call. Connect only clients you trust with the workspace.

Secrets use the supported local credential mechanisms; normal configuration
results expose status or references rather than secret values. Provider
credentials are not a reason to export or publish the user-data directory.

## Evidence and automation

Connecting MCP does not install hooks, import chat histories, or capture every
conversation. Host adapters must supply permitted evidence and stable identities.
A selected context block is not proof that a host delivered it or that an agent
used it. Generated thoughts and source statements remain distinguishable from
confirmed user facts.

## Sharing and deletion

Review files and logs before sharing them. Redact tokens, provider URLs where
private, source text, memory contents, and identity references. Back up unique
data before deleting or restoring it. A database export does not necessarily
include Knowledge originals or all recovery state. Use [Security](../SECURITY.md)
for vulnerability reports.
