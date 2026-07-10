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
    "description": "Read the agent-facing ClaraCore Desktop usage guide, product boundaries, startup sequence, and fallback notes.",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  {
    "name": "gateway_context",
    "title": "Gateway Context",
    "description": "Read one assembled agent context packet from Memory, Shared Line, InnerLife, and Doctor. Pass lineId when the identified agent owns multiple active Shared Lines; otherwise the call returns SHARED_LINE_ID_REQUIRED without guessing.",
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
    "description": "Merge one ClaraCore Desktop agent id into another across Desktop-owned data. Use this instead of editing SQLite directly.",
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
