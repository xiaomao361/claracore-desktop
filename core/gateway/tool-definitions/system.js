const systemToolDefinitions = [
  {
    "name": "claracore_status",
    "title": "ClaraCore Status",
    "description": "Read ClaraCore Desktop product data status, the authenticated caller connection, and a secret-safe configuration projection. Inline API keys are never returned.",
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
    "description": "Read the versioned Agent Guide for using ClaraCore Desktop. Omit arguments for a bounded overview, pass section for one maintained topic, or pass query to search guide passages. The guide version is release-gated with the app. Tool names and argument schemas come from tools/list.",
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
        },
        "query": {
          "type": "string",
          "maxLength": 200,
          "description": "Search the maintained Agent Guide. Use concise English product or workflow terms. Cannot be combined with section."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "gateway_context",
    "title": "Gateway Context",
    "description": "Read one assembled agent context packet from Memory, Shared Line, InnerLife, and Doctor. Omitted detail defaults to the bounded brief packet. Pass detail=full only for an explicit compatibility or diagnostic read. Start without lineId; when the identified agent owns multiple active Shared Lines, the call returns SHARED_LINE_ID_REQUIRED with candidates instead of guessing.",
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
          "description": "brief is the default bounded startup context. full is an explicit compatibility and diagnostic payload."
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
    "description": "List bounded recent ClaraCore Desktop Gateway trace summaries. Defaults to 10 rows; limit can explicitly request up to 50. Use gateway_trace_get for one request record.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 50
        },
        "offset": {
          "type": "number",
          "minimum": 0
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
    "name": "gateway_trace_get",
    "title": "Get Gateway Trace",
    "description": "Get one complete ClaraCore Desktop Gateway trace by id.",
    "inputSchema": {
      "type": "object",
      "required": ["id"],
      "properties": {
        "id": { "type": "string" }
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
