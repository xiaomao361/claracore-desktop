const innerlifeSessionToolDefinitions = [
  {
    "name": "innerlife_session_start",
    "title": "Start InnerLife Session",
    "description": "Start a Desktop-owned InnerLife session and return a compact share_plan plus session id. Fetch innerlife_briefing lazily for full context.",
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
    "description": "Read the Desktop-owned InnerLife snapshot, including inbox, shares, sessions, daemon, and doctor.",
    "inputSchema": {
      "type": "object",
      "properties": {},
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
