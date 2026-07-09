const innerlifeSessionToolDefinitions = [
  {
    "name": "innerlife_session_start",
    "title": "Start InnerLife Session",
    "description": "Start a Desktop-owned InnerLife session and return a compact share_plan, session id, the active Shared Line resume packet (shared_line), and a shared_lines summary list in one call. Pass lineId to activate/switch to that Shared Line in the same call. Replaces separate shared_line_list / shared_line_activate / shared_line_get startup calls. Fetch innerlife_briefing lazily for full context.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
          "type": "string"
        },
        "agentTool": {
          "type": "string"
        },
        "agentName": {
          "type": "string"
        },
        "userId": {
          "type": "string"
        },
        "host": {
          "type": "string"
        },
        "externalSessionId": {
          "type": "string"
        },
        "includeBriefing": {
          "type": "boolean"
        },
        "lineId": {
          "type": "string",
          "description": "Optional Shared Line id to activate in the same call."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_session_end",
    "title": "End InnerLife Session",
    "description": "End a Desktop-owned InnerLife session and create a waiting share afterthought.",
    "inputSchema": {
      "type": "object",
      "required": [
        "sessionId"
      ],
      "properties": {
        "sessionId": {
          "type": "string"
        },
        "summary": {
          "type": "string"
        },
        "transcript": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_sessions",
    "title": "List InnerLife Sessions",
    "description": "List recent Desktop-owned InnerLife sessions.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
          "type": "string"
        },
        "agentTool": {
          "type": "string"
        },
        "agentName": {
          "type": "string"
        },
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 100
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_status",
    "title": "InnerLife Status",
    "description": "Read the Desktop-owned InnerLife status. Returns a lite snapshot by default (counts, pending share previews, daemon, doctor). Pass detail=true for the full snapshot including inbox, sessions, digest runs, and history.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "detail": {
          "type": "boolean",
          "description": "Return the full snapshot instead of the lite summary."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_briefing",
    "title": "Get InnerLife Briefing",
    "description": "Read the current Desktop-owned InnerLife briefing.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_doctor",
    "title": "InnerLife Doctor",
    "description": "Diagnose Desktop-owned InnerLife health and recovery guidance.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  }
];

module.exports = {
  innerlifeSessionToolDefinitions
};
