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
    "description": "List bounded Desktop-owned InnerLife agent profile summaries. Defaults to 10 rows; limit can explicitly request up to 50. Use innerlife_profile_get for one complete profile and state.",
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
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_profile_get",
    "title": "Get InnerLife Profile",
    "description": "Get one complete Desktop-owned InnerLife profile and state without creating it.",
    "inputSchema": {
      "type": "object",
      "required": ["agentId"],
      "properties": {
        "agentId": { "type": "string" }
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
