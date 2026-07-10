const innerlifeShareToolDefinitions = [
  {
    "name": "innerlife_digest",
    "title": "Run InnerLife Digest",
    "description": "Run a Desktop-owned InnerLife digest and record what was digested. Pass lineId for exact Shared Line context; when omitted and multiple lines are active, digestion continues with sharedLineContext.status=ambiguous.",
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
        "lineId": {
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
    "description": "Check whether a waiting InnerLife share fits the current context. Pass lineId for exact Shared Line context; provided context still works when Shared Line selection is ambiguous.",
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
        "lineId": {
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
  }
];

module.exports = {
  innerlifeShareToolDefinitions
};
