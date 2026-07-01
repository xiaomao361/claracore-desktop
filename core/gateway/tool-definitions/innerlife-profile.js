const innerlifeProfileToolDefinitions = [
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
  }
];

module.exports = {
  innerlifeProfileToolDefinitions
};
