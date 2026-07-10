const innerlifeDaemonToolDefinitions = [
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
    "description": "Run one due InnerLife daemon tick and create a waiting share when material is ready. Pass lineId for exact Shared Line context; pending inbox processing continues without Shared Line context when multiple lines are active.",
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
        "force": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  }
];

module.exports = {
  innerlifeDaemonToolDefinitions
};
