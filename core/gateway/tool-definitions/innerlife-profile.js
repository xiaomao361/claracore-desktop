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
    "description": "Delete one agent's Desktop-owned InnerLife profile and all InnerLife data for that agent. targetAgentId names the profile to delete; it is never inferred from the caller's identity, so deleting your own profile also requires passing it explicitly.",
    "inputSchema": {
      "type": "object",
      "required": [
        "targetAgentId"
      ],
      "properties": {
        "targetAgentId": {
          "type": "string",
          "minLength": 1
        }
      },
      "additionalProperties": false
    }
  }
];

module.exports = {
  innerlifeProfileToolDefinitions
};
