const sharedLineToolDefinitions = [
  {
    "name": "shared_line_get",
    "title": "Get Shared Line",
    "description": "Read the current ClaraCore Desktop shared position and resume packet. By default the affective trace and position history are truncated to the most recent nodes plus protected (needs-review) nodes; pass fullArc to get the complete arc.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "lineId": {
          "type": "string"
        },
        "agentId": {
          "type": "string"
        },
        "model": {
          "type": "string"
        },
        "fullArc": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_list",
    "title": "List Shared Lines",
    "description": "List ClaraCore Desktop Shared Lines and identify the active line.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
          "type": "string"
        },
        "allAgents": {
          "type": "boolean"
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_create",
    "title": "Create Shared Line",
    "description": "Create a new ClaraCore Desktop Shared Line and optionally make it active.",
    "inputSchema": {
      "type": "object",
      "required": [
        "title"
      ],
      "properties": {
        "title": {
          "type": "string"
        },
        "agentId": {
          "type": "string"
        },
        "makeActive": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_activate",
    "title": "Activate Shared Line",
    "description": "Switch the active ClaraCore Desktop Shared Line.",
    "inputSchema": {
      "type": "object",
      "required": [
        "lineId"
      ],
      "properties": {
        "lineId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_rename",
    "title": "Rename Shared Line",
    "description": "Rename an active ClaraCore Desktop Shared Line.",
    "inputSchema": {
      "type": "object",
      "required": [
        "lineId",
        "title"
      ],
      "properties": {
        "lineId": {
          "type": "string"
        },
        "title": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_archive",
    "title": "Archive Shared Line",
    "description": "Archive an active ClaraCore Desktop Shared Line without deleting its history.",
    "inputSchema": {
      "type": "object",
      "required": [
        "lineId"
      ],
      "properties": {
        "lineId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_restore",
    "title": "Restore Shared Line",
    "description": "Restore an archived ClaraCore Desktop Shared Line.",
    "inputSchema": {
      "type": "object",
      "required": [
        "lineId"
      ],
      "properties": {
        "lineId": {
          "type": "string"
        },
        "makeActive": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_update",
    "title": "Update Shared Line",
    "description": "Update the current ClaraCore Desktop shared position.",
    "inputSchema": {
      "type": "object",
      "required": [
        "summary"
      ],
      "properties": {
        "agentId": {
          "type": "string"
        },
        "allAgents": {
          "type": "boolean"
        },
        "summary": {
          "type": "string"
        },
        "lineId": {
          "type": "string"
        },
        "model": {
          "type": "string"
        },
        "interpretationStatus": {
          "type": "string",
          "enum": [
            "draft",
            "confirmed",
            "active",
            "needs_review",
            "stale",
            "closed"
          ]
        },
        "factsUsed": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "visibility": {
          "type": "string",
          "enum": [
            "private",
            "shared"
          ]
        },
        "mode": {
          "type": "string"
        },
        "nextStep": {
          "type": "string"
        },
        "stateSummary": {
          "type": "string"
        },
        "currentInterpretation": {
          "type": "string"
        },
        "userConfirmed": {
          "type": "boolean"
        },
        "realityLine": {
          "type": "string"
        },
        "entryPosture": {
          "type": "string"
        },
        "confirmedGround": {
          "type": "string"
        },
        "provisionalRead": {
          "type": "string"
        },
        "boundaryNotes": {
          "type": "string"
        },
        "misreadRisks": {
          "type": "string"
        },
        "tags": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "affectiveTone": {
          "type": "string"
        },
        "affectiveValence": {
          "type": "string",
          "enum": [
            "positive",
            "negative",
            "mixed",
            "neutral",
            "unclear"
          ]
        },
        "affectiveSignals": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "affectiveIntensity": {
          "type": "string",
          "enum": [
            "low",
            "medium",
            "high"
          ]
        },
        "affectiveStability": {
          "type": "string",
          "enum": [
            "momentary",
            "session",
            "confirmed"
          ]
        },
        "affectiveNote": {
          "type": "string"
        },
        "affectiveNeedsReview": {
          "type": "boolean"
        },
        "confirmOverwrite": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_handoff_create",
    "title": "Create Shared Line Handoff",
    "description": "Create a formal handoff record from the current ClaraCore Desktop shared position.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "lineId": {
          "type": "string"
        },
        "objective": {
          "type": "string"
        },
        "completed": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "openItems": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "nextStep": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_agent_state",
    "title": "Shared Line Agent State",
    "description": "Read or update Continuity agent state for communication style, relationship position, preferences, boundaries, and stable patterns.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "agentId": {
          "type": "string"
        },
        "update": {
          "type": "object",
          "properties": {
            "communicationStyle": {
              "type": "string"
            },
            "relationshipPosition": {
              "type": "string"
            },
            "longTermPreferences": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "boundaries": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "stablePatterns": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "notes": {
              "type": "string"
            }
          },
          "additionalProperties": false
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_model_adjustment_list",
    "title": "List Shared Line Model Adjustments",
    "description": "List model-specific negative adjustments used in Shared Line resume packets.",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_model_adjustment_get",
    "title": "Get Shared Line Model Adjustment",
    "description": "Read model-specific negative adjustments for one model.",
    "inputSchema": {
      "type": "object",
      "required": [
        "model"
      ],
      "properties": {
        "model": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_model_adjustment_set",
    "title": "Set Shared Line Model Adjustment",
    "description": "Create or update model-specific negative adjustments used in Shared Line resume packets.",
    "inputSchema": {
      "type": "object",
      "required": [
        "model"
      ],
      "properties": {
        "model": {
          "type": "string"
        },
        "forbiddenPhrases": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "forbiddenPatterns": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "injectPrompt": {
          "type": "string"
        },
        "updatedBy": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_model_adjustment_delete",
    "title": "Delete Shared Line Model Adjustment",
    "description": "Delete model-specific negative adjustments.",
    "inputSchema": {
      "type": "object",
      "required": [
        "model"
      ],
      "properties": {
        "model": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "shared_line_compact",
    "title": "Compact Shared Line Arc",
    "description": "Compact a ClaraCore Desktop Shared Line by trimming its stored affective trace and position history to the most recent nodes. Protected needs-review affective nodes are always kept. Summary, interpretation status, history, and snapshots are not touched.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "lineId": {
          "type": "string"
        },
        "keepTrace": {
          "type": "integer",
          "minimum": 0,
          "maximum": 200
        },
        "keepHistory": {
          "type": "integer",
          "minimum": 0,
          "maximum": 200
        }
      },
      "additionalProperties": false
    }
  }
];

module.exports = {
  sharedLineToolDefinitions
};
