const innerlifeSessionToolDefinitions = [
  {
    "name": "innerlife_session_start",
    "title": "Start InnerLife Session",
    "description": "Start a Desktop-owned InnerLife session and return a compact share_plan, session id, optional Shared Line resume packet (shared_line), and a shared_lines summary list in one call. Pass lineId to activate/switch to an exact Shared Line. If multiple lines are active and lineId is omitted, the session still starts and shared_line_error explains the ambiguity. Fetch innerlife_briefing lazily for full context.",
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
    "description": "End a Desktop-owned InnerLife session and create a waiting share afterthought. sessionId is the canonical domain session reference (the inner_session id returned by start, or its registered externalSessionId); session_id is accepted as a compatibility alias. Gateway caller conversation headers never replace it. Hooks may pass bestEffort=true when a missing session should be a safe no-op.",
    "inputSchema": {
      "type": "object",
      "anyOf": [
        {
          "required": ["sessionId"]
        },
        {
          "required": ["session_id"]
        }
      ],
      "properties": {
        "sessionId": {
          "type": "string"
        },
        "session_id": {
          "type": "string",
          "description": "Compatibility alias for sessionId. Prefer sessionId in new integrations."
        },
        "summary": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "object",
              "additionalProperties": true
            }
          ],
          "description": "Short text or a JSON object describing the completed session. Structured objects are stored as readable JSON text."
        },
        "transcript": {
          "type": "string"
        },
        "bestEffort": {
          "type": "boolean",
          "description": "For host lifecycle hooks only: return a missing acknowledgement instead of failing when no session was registered."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_afterthought_resolve",
    "title": "Resolve Failed InnerLife Afterthought",
    "description": "Explicitly resolve one terminal persisted session-afterthought failure owned by the authenticated Agent. Use retry after repairing the model path to requeue the preserved original input with a fresh bounded attempt budget. Use acknowledge with a reason to close the failure without claiming generation succeeded; its placeholder pending share is discarded and the evidence remains until normal processed-inbox retention.",
    "inputSchema": {
      "type": "object",
      "required": [
        "id",
        "action"
      ],
      "properties": {
        "id": {
          "type": "string",
          "description": "The failed session_end_afterthought inbox job id returned by innerlife_status(detail=true)."
        },
        "action": {
          "type": "string",
          "enum": [
            "retry",
            "acknowledge"
          ]
        },
        "reason": {
          "type": "string",
          "description": "Required for acknowledge; optional audit note for retry."
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
    "description": "Read Desktop-owned InnerLife operational state: counts, daemon, doctor, and indicators that shares or Inbox work are waiting. It does not return share bodies or Inbox bodies. Pass detail=true for the full snapshot including inbox, sessions, digest runs, and history.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "detail": {
          "oneOf": [
            { "type": "string", "enum": ["summary", "full"] },
            { "type": "boolean" }
          ],
          "description": "summary (default) is operational state only; full returns the complete snapshot. Boolean true is a compatibility alias for full. Responses report mode=status or mode=full; clients that branched on the pre-0.6.6 mode value must use detail instead."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_briefing",
    "title": "Get InnerLife Briefing",
    "description": "Read the current Desktop-owned InnerLife briefing as a decision-oriented synthesis: selected Shared Line summary when unambiguous, compact open loops, counts, and at most one candidate share preview. Shared Line context is optional: pass lineId to select one, or receive sharedLineContext.status=ambiguous while the briefing continues without it.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
          "type": "string"
        },
        "lineId": {
          "type": "string"
        },
        "detail": {
          "type": "string",
          "enum": ["summary", "full"],
          "description": "summary (default) is the decision synthesis. full returns the complete aggregate briefing."
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
