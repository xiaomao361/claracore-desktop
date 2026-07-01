const innerlifeToolDefinitions = [
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
  },
  {
    "name": "innerlife_profile_set",
    "title": "Set InnerLife Profile",
    "description": "Update the calling agent's Desktop-owned InnerLife profile, state, focus, and sharing policy.",
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
        "displayName": {
          "type": "string"
        },
        "profile": {
          "type": "object"
        },
        "state": {
          "type": "object"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_profile_list",
    "title": "List InnerLife Profiles",
    "description": "List Desktop-owned InnerLife agent profiles.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 200
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_profile_delete",
    "title": "Delete InnerLife Profile",
    "description": "Delete one agent's Desktop-owned InnerLife profile and all InnerLife data for that agent.",
    "inputSchema": {
      "type": "object",
      "required": [
        "agentId"
      ],
      "properties": {
        "agentId": {
          "type": "string"
        },
        "agentTool": {
          "type": "string"
        },
        "agentName": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_digest",
    "title": "Run InnerLife Digest",
    "description": "Run a Desktop-owned InnerLife digest and record what was digested.",
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
        "mode": {
          "type": "string"
        },
        "prompt": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_share_check",
    "title": "Check InnerLife Share Timing",
    "description": "Check whether a waiting InnerLife share fits the current context.",
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
        "shareId": {
          "type": "string"
        },
        "sessionId": {
          "type": "string"
        },
        "context": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_submit_inbox",
    "title": "Submit InnerLife Inbox",
    "description": "Submit material into the Desktop-owned InnerLife inbox for autonomous processing.",
    "inputSchema": {
      "type": "object",
      "required": [
        "body"
      ],
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
        "source": {
          "type": "string"
        },
        "body": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_submit_fact",
    "title": "Submit InnerLife Fact",
    "description": "Submit factual material into the Desktop-owned InnerLife inbox for later digestion.",
    "inputSchema": {
      "type": "object",
      "required": [
        "body"
      ],
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
        "body": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_submit_continuity",
    "title": "Submit InnerLife Continuity",
    "description": "Submit current Shared Line material into the Desktop-owned InnerLife inbox for later digestion.",
    "inputSchema": {
      "type": "object",
      "required": [
        "body"
      ],
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
        "body": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_pending_shares",
    "title": "List InnerLife Pending Shares",
    "description": "List Desktop-owned InnerLife share candidates.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "status": {
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
    "name": "innerlife_share_actions",
    "title": "List InnerLife Share Actions",
    "description": "List review, use, defer, and discard actions for InnerLife shares.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "shareId": {
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
    "name": "innerlife_mark_share",
    "title": "Mark InnerLife Share",
    "description": "Mark an InnerLife share as used, deferred, or discarded.",
    "inputSchema": {
      "type": "object",
      "required": [
        "id",
        "action"
      ],
      "properties": {
        "id": {
          "type": "string"
        },
        "action": {
          "type": "string",
          "enum": [
            "used",
            "deferred",
            "discarded"
          ]
        },
        "reason": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_daemon_status",
    "title": "InnerLife Daemon Status",
    "description": "Read the Desktop-owned InnerLife daemon state.",
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
    "name": "innerlife_daemon_set",
    "title": "Set InnerLife Daemon",
    "description": "Enable or pause the Desktop-owned InnerLife daemon.",
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
        "action": {
          "type": "string",
          "enum": [
            "enable",
            "pause"
          ]
        },
        "enabled": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_daemon_tick",
    "title": "Tick InnerLife Daemon",
    "description": "Run one due InnerLife daemon tick and create a waiting share when material is ready.",
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
        "force": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_history",
    "title": "InnerLife History",
    "description": "List recent Desktop-owned InnerLife internal change events (digest, explore, converge, session_end).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
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
    "name": "innerlife_experiences",
    "title": "InnerLife Experiences",
    "description": "List Desktop-owned InnerLife experiences — shares that were used and represent formed outputs.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
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
    "name": "innerlife_summaries",
    "title": "InnerLife Summaries",
    "description": "List stable Desktop-owned InnerLife digest summaries.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
          "type": "string"
        },
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 50
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_explore",
    "title": "Explore InnerLife",
    "description": "Trigger autonomous Desktop-owned InnerLife exploration — surfaces what deserves attention from Memory and recent thoughts, creates a waiting share candidate.",
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
        "prompt": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_converge",
    "title": "Converge InnerLife",
    "description": "Consolidate active Desktop-owned InnerLife pending shares and recent thoughts into a single converged share candidate.",
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
        }
      },
      "additionalProperties": false
    }
  }
];

module.exports = {
  innerlifeToolDefinitions
};
