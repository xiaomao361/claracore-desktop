const memoriaCoreToolDefinitions = [
  {
    "name": "memoria_list",
    "title": "List Memories",
    "description": "List recent ClaraCore Desktop memory records.",
    "inputSchema": {
      "type": "object",
      "properties": {
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
    "name": "memoria_search",
    "title": "Search Memories",
    "description": "Search ClaraCore Desktop memory records with keyword and vector search when available.",
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
          "maximum": 100
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
    "description": "Create a ClaraCore Desktop memory record. Use factual, reviewable content.",
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
    "description": "Update an existing ClaraCore Desktop memory record.",
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
    "description": "List restricted ClaraCore Desktop memory records through an explicit restricted-content tool.",
    "inputSchema": {
      "type": "object",
      "properties": {
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
    "description": "List archived ClaraCore Desktop memory records.",
    "inputSchema": {
      "type": "object",
      "properties": {
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
