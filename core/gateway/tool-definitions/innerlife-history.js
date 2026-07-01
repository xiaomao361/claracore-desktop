const innerlifeHistoryToolDefinitions = [
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
  innerlifeHistoryToolDefinitions
};
