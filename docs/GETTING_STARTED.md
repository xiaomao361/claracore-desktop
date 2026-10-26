# Getting started

## Choose a build

Download the latest installer from [Releases](https://github.com/xiaomao361/claracore-desktop/releases/latest).
Full includes `bge-small-zh-v1.5`, a local 512-dimensional embedding model.
Lite omits that model; select an installed local Ollama embedding model or
disable embeddings. Core storage and explicit reads remain available without
an embedding model; semantic features require a working model and index.

macOS packages target Apple Silicon and are signed and notarized. Windows
packages target x64 and are unsigned. Linux and Intel Mac prebuilt installers
are not currently provided.

On macOS, open the DMG and copy ClaraCore Desktop to Applications. On Windows,
run the installer. Open Desktop and keep it running for MCP access.

## Connect your client

Open **Agent Access** and copy the generated configuration. Client configuration
formats differ; use the output for your client rather than copying another
client's process-based configuration.

The connection uses Streamable HTTP:

```text
URL: http://127.0.0.1:50668/mcp
Authorization: Bearer <your-local-token>
X-ClaraCore-Agent-ID: <stable-agent-id>
X-ClaraCore-Client-ID: <host-client-id>
```

Use the actual URL and token shown by Desktop. Never commit the token. If your
host can supply a conversation ID, send `X-ClaraCore-Conversation-ID` dynamically
for each conversation. This header is required for understanding submissions
and recovery, and must not be a globally shared constant.

Reconnect the client, then call `claracore_connection_test`. Its result confirms
the caller identity, endpoint, and selected tool profile. Call `gateway_docs`
for the Agent guide. The default profile exposes the everyday tools;
[additional profiles](MCP_COMPATIBILITY.md) expose specialist schemas.

## Try a small workflow

Ask the agent to search for a known memory or list its Shared Lines. Choose a
specific line to resume when several goals are active. For a new durable fact,
search first and save only information you have authorized the agent to retain.
For Knowledge, select your Markdown directory in Settings before reading or
indexing it. See [Configuration](CONFIGURATION.md).

MCP access alone does not install conversation hooks or enable automatic
capture. A host must explicitly integrate automatic context delivery.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Connection refused | Desktop is running, and the configured URL/port matches Agent Access. |
| Authentication error | Copy the current token; reconnect after a rotation. |
| Missing tools | Select the intended profile and reconnect the client. |
| Several active lines | Read the bounded candidates and supply an exact `lineId`. |
| Semantic search unavailable | Check the selected local model and index status; exact reads may still work. |
| Maintenance needs review | Read the detailed category; pending work and repair failures are different. |

See [multi-client identity](MULTI_AGENT_CLIENTS.md), [maintenance](DESKTOP_MAINTENANCE.md),
and [HTTP migration](HTTP_MCP_MIGRATION.md) for more detail.
