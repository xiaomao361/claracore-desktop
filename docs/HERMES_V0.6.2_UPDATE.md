# Hermes / Lara Update For ClaraCore Desktop v0.6.2

## What Changed

The installed Desktop version is `0.6.2`. It includes the `0.6.0` deterministic
Memory Controller plus the `0.6.1` and `0.6.2` performance and retention work.
The Controller is an observe-only decision surface, not a replacement for
Memoria and not permission for a client to inject hidden context.

Hermes remains the client host; Lara remains the stable Agent identity:

```text
agentId=lara
clientId=hermes
conversationId=<current Hermes session id when the host can keep it current>
```

## Copy This To Hermes

```text
ClaraCore Desktop has been upgraded to v0.6.2. This includes the v0.6.0 Memory
Controller contract. Reconnect to the live ClaraCore MCP endpoint and treat the
live tool list plus gateway_docs as authoritative.

Keep caller identity stable:
- agentId: lara
- clientId: hermes
- conversationId: the current Hermes session id only when you can keep it current

Reconnect verification:
1. Call claracore_connection_test and confirm server version 0.6.2, agentId=lara,
   clientId=hermes, and the expected transport.
2. Call gateway_docs.
3. Call shared_line_list with status=active.
4. Call gateway_context with an explicit lineId when multiple active lines are
   returned.

Memory Controller rules:
- memory_context is off by default.
- When the operator enables observe mode, it records a bounded decision but
  returns empty context and authorizes no injection.
- Call memory_context once for each non-empty user prompt only if Hermes has a
  real verified per-prompt lifecycle hook.
- If Hermes has no such hook, do not claim automatic Controller integration.
  Keep memoria_search as the explicit recall path when the user asks to recall,
  research, audit, or compare prior state.
- Do not replace explicit Memoria create/update/search behavior with
  memory_context.

Existing lifecycle rules remain:
- Save the inner_session_* id returned by innerlife_session_start and pass that
  exact id to innerlife_session_end.
- Use bestEffort=true only for a lifecycle fallback whose start was not
  confirmed.
- Select a real Shared Line id before retrying SHARED_LINE_ID_REQUIRED.

Overload rules:
- HTTP 429 with JSON-RPC code -32001 means the Desktop Gateway is busy, not down.
- Honor Retry-After, retry at most twice with delay, and do not create parallel
  retry storms.

Return this verification receipt:
{
  "connection": "ok|failed",
  "serverVersion": "",
  "agentId": "",
  "clientId": "",
  "transport": "",
  "memoryContextAvailable": false,
  "perPromptHookAvailable": false,
  "automaticControllerRoutingEnabled": false,
  "observeOnlyUnderstood": false,
  "sharedLineSelection": "explicit|unambiguous|blocked",
  "innerLifeSessionHandlePreserved": false,
  "retryPolicy": "bounded|missing",
  "evidence": [],
  "nextAction": ""
}
```

## Acceptance Boundary

Hermes is updated only when its receipt is backed by live MCP responses. Tool
availability alone does not prove per-prompt routing. If
`perPromptHookAvailable=false`, then
`automaticControllerRoutingEnabled` must also be `false`; that is a truthful
supported state, not a failure of ClaraCore Desktop.
