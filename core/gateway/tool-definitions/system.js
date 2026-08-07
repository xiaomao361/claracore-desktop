const systemToolDefinitions = [
  {
    "name": "claracore_status",
    "title": "ClaraCore Status",
    "description": "Read ClaraCore Desktop product data status.",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  {
    "name": "claracore_connection_test",
    "title": "ClaraCore Connection Test",
    "description": "Verify that this agent can reach ClaraCore Desktop through MCP and record a visible handshake trace.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
          "type": "string",
          "description": "Stable id for the calling agent, for example clara, lara, or codex."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "gateway_docs",
    "title": "Gateway Docs",
    "description": "Read the agent-facing ClaraCore Desktop usage guide. Omitting section returns a small default summary with connection truth, domain roles, the startup sequence, and the section index. Pass section for one bounded topic. Tool names and argument schemas come from tools/list, not from this guide.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "section": {
          "type": "string",
          "enum": [
            "start",
            "memory",
            "shared-line",
            "innerlife",
            "diagnostics",
            "full"
          ],
          "description": "Omit for the default summary."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "gateway_context",
    "title": "Gateway Context",
    "description": "Read one assembled agent context packet from Memory, Shared Line, InnerLife, and Doctor. Use detail=brief for bounded startup and resume reads; omitted detail preserves the 0.6.4 full payload. Start without lineId; when the identified agent owns multiple active Shared Lines, the call returns SHARED_LINE_ID_REQUIRED with candidates instead of guessing. Retry with the chosen lineId.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
          "type": "string"
        },
        "lineId": {
          "type": "string"
        },
        "query": {
          "type": "string"
        },
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 20
        },
        "detail": {
          "type": "string",
          "enum": [
            "brief",
            "full"
          ],
          "description": "Use brief for bounded startup context. Omit or use full for the 0.6.4 compatibility payload."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "gateway_auto_context",
    "title": "Gateway Automatic Context",
    "description": "Arbitrate automatic per-prompt Memory context in one call. Pass prompt and the Gateway runs the Memory Controller itself, then returns one bounded block or abstains. Do not retrieve Memory separately for this purpose. InnerLife is deliberately not collected here: whether a waiting thought fits is a question of register, not topic, and only the model can read register — use innerlife_share_check. Read-only: it never marks delivery or use, and never selects among active Shared Lines. Traces do not keep the prompt verbatim: they store a hash plus an 80-byte preview, so a prompt shorter than that is still recorded in full.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "prompt": {
          "type": "string",
          "description": "The current user message. Mutually exclusive with the candidate arrays."
        },
        "sessionId": {
          "type": "string",
          "description": "Optional InnerLife session id."
        },
        "agentId": {
          "type": "string"
        },
        "memoryCandidates": {
          "type": "array",
          "description": "Compatibility/test path. Memory Controller output; only action=INJECT_TOP1 with policyMode=canary is eligible.",
          "items": { "type": "object", "additionalProperties": true }
        },
        "shareCandidates": {
          "type": "array",
          "description": "Compatibility/test path. InnerLife share candidates whose timing gate opened; timing is not relevance.",
          "items": { "type": "object", "additionalProperties": true }
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "gateway_trace_list",
    "title": "Gateway Trace List",
    "description": "List recent ClaraCore Desktop Gateway tool-call traces.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 100
        },
        "toolName": {
          "type": "string"
        },
        "status": {
          "type": "string",
          "enum": [
            "ok",
            "error"
          ]
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "agent_identity_merge",
    "title": "Merge Agent Identity",
    "description": "Merge one ClaraCore Desktop agent id into another across Desktop-owned data. Source-only singleton state is moved, semantically equivalent dual-sided state is deduplicated, and differing profile, daemon, or Continuity state blocks atomically with field-level conflict details. Use this instead of editing SQLite directly.",
    "inputSchema": {
      "type": "object",
      "required": [
        "fromAgentId",
        "toAgentId",
        "confirm"
      ],
      "properties": {
        "fromAgentId": {
          "type": "string",
          "description": "Existing source agent id to retire, for example hermes:lara."
        },
        "toAgentId": {
          "type": "string",
          "description": "Canonical target agent id to keep, for example lara or hermes:lara."
        },
        "confirm": {
          "type": "boolean",
          "description": "Must be true because this updates many Desktop-owned records."
        }
      },
      "additionalProperties": false
    }
  }
];

module.exports = {
  systemToolDefinitions
};
