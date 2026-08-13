const memoriaCoreToolDefinitions = [
  {
    "name": "memoria_list",
    "title": "List Memories",
    "description": "List bounded recent ClaraCore Desktop Memory summaries. Defaults to 10 rows; limit can explicitly request up to 50. Use memoria_get for one complete Memory.",
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
    "name": "memoria_search",
    "title": "Search Memories",
    "description": "Search ClaraCore Desktop memory records with keyword and vector search when available. Search before writing a potentially changed fact. Returns three bounded summaries by default; each result carries stateRole, supersedes, supersededBy, and a memoria_get detail reference. Defaults to current facts; use timeView=historical or all only when the question needs prior state.",
    "inputSchema": {
      "type": "object",
      "required": [
        "query"
      ],
      "properties": {
        "query": {
          "type": "string"
        },
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 25,
          "description": "Default 3. Raise it only when one read genuinely needs more candidates."
        },
        "timeView": {
          "type": "string",
          "enum": ["current", "historical", "all"],
          "description": "State view for recall. current (default) returns active facts, historical returns superseded facts, and all returns both."
        },
        "detail": {
          "type": "string",
          "enum": ["summary", "full"],
          "description": "summary (default) returns bounded previews. full returns whole bodies, related links, and embedding operational metadata."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_get",
    "title": "Get Memory",
    "description": "Get one ClaraCore Desktop memory record by id, including labels, status, sensitivity, and embedding state.",
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_create",
    "title": "Create Memory",
    "description": "Create a ClaraCore Desktop memory record. Search first. For a confirmed changed state, create the new fact and then call memoria_supersede; for unresolved conflict, use a contradicts link.",
    "inputSchema": {
      "type": "object",
      "required": [
        "body"
      ],
      "properties": {
        "title": {
          "type": "string"
        },
        "body": {
          "type": "string"
        },
        "labels": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ]
        },
        "sensitivity": {
          "type": "string",
          "enum": [
            "normal",
            "restricted"
          ]
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_update",
    "title": "Update Memory",
    "description": "Update an existing active Memory only when correcting or refining the same fact. Omitted title, labels, and sensitivity are preserved. When a confirmed new state replaces an old fact, create a new Memory and call memoria_supersede instead.",
    "inputSchema": {
      "type": "object",
      "required": [
        "id",
        "body"
      ],
      "properties": {
        "id": {
          "type": "string"
        },
        "title": {
          "type": "string"
        },
        "body": {
          "type": "string"
        },
        "labels": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ]
        },
        "sensitivity": {
          "type": "string",
          "enum": [
            "normal",
            "restricted"
          ]
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_tag",
    "title": "Tag Memory",
    "description": "Incrementally add or remove labels on an active ClaraCore Desktop memory record.",
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": "string"
        },
        "add": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ]
        },
        "remove": {
          "oneOf": [
            {
              "type": "string"
            },
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          ]
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_restricted_list",
    "title": "List Restricted Memories",
    "description": "List bounded restricted ClaraCore Desktop Memory summaries through an explicit restricted-content tool. Defaults to 10 rows; limit can explicitly request up to 50.",
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
    "name": "memoria_restrict",
    "title": "Restrict Memory",
    "description": "Move an active ClaraCore Desktop memory record out of normal list/search results.",
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_unrestrict",
    "title": "Unrestrict Memory",
    "description": "Restore a restricted ClaraCore Desktop memory record to normal list/search results.",
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_delete",
    "title": "Delete Memory",
    "description": "Soft-delete a ClaraCore Desktop memory record.",
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_restore",
    "title": "Restore Memory",
    "description": "Restore a soft-deleted ClaraCore Desktop memory record.",
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_archive",
    "title": "Archive Memory",
    "description": "Archive an active ClaraCore Desktop memory record so it leaves normal list/search results without being deleted.",
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_archived_list",
    "title": "List Archived Memories",
    "description": "List bounded archived ClaraCore Desktop Memory summaries. Defaults to 10 rows; limit can explicitly request up to 50. Use memoria_get for one complete Memory.",
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
    "name": "memoria_restore_archived",
    "title": "Restore Archived Memory",
    "description": "Restore an archived ClaraCore Desktop memory record to active status.",
    "inputSchema": {
      "type": "object",
      "required": [
        "id"
      ],
      "properties": {
        "id": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  }
];

module.exports = {
  memoriaCoreToolDefinitions
};
