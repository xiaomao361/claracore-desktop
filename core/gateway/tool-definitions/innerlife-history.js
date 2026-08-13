const innerlifeHistoryToolDefinitions = [
  {
    "name": "innerlife_history",
    "title": "InnerLife History",
    "description": "List bounded previews of recent Desktop-owned InnerLife internal change events. Pass detail=full for the bounded page bodies.",
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
        },
        "detail": {
          "type": "string",
          "enum": ["summary", "full"]
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_experiences",
    "title": "InnerLife Experiences",
    "description": "List bounded previews of Desktop-owned InnerLife experiences. Pass detail=full for the bounded page bodies.",
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
        },
        "detail": {
          "type": "string",
          "enum": ["summary", "full"]
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "innerlife_summaries",
    "title": "InnerLife Summaries",
    "description": "List bounded stable Desktop-owned InnerLife digest summaries. Pass detail=full for the bounded page bodies.",
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
        },
        "detail": {
          "type": "string",
          "enum": ["summary", "full"]
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
