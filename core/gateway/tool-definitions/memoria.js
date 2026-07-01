const memoriaToolDefinitions = [
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
  },
  {
    "name": "memoria_archive_suggestions",
    "title": "Memory Archive Suggestions",
    "description": "List dormant active non-restricted Memory records that are candidates for archive.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 50
        },
        "olderThanDays": {
          "type": "number",
          "minimum": 1,
          "maximum": 3650
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_archive_dormant",
    "title": "Archive Dormant Memories",
    "description": "Archive dormant active non-restricted Memory records from the suggestion list.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 50
        },
        "olderThanDays": {
          "type": "number",
          "minimum": 1,
          "maximum": 3650
        },
        "dryRun": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_stats",
    "title": "Memory Stats",
    "description": "Read ClaraCore Desktop memory counts, embedding status counts, and active label counts.",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_graph",
    "title": "Memory Graph",
    "description": "Read a bounded ClaraCore Desktop Memory graph of memories, labels, and Shared Line fact references.",
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
    "name": "memoria_maintenance_check",
    "title": "Memory Maintenance Check",
    "description": "Check ClaraCore Desktop Memory maintenance issues such as missing embeddings, failed embeddings, orphan labels, and alias labels.",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_maintenance_run",
    "title": "Run Memory Maintenance",
    "description": "Repair ClaraCore Desktop Memory maintenance issues without touching old service data.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "dryRun": {
          "type": "boolean"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_maintenance_audit",
    "title": "Memory Maintenance Audit",
    "description": "Read a review-oriented Memory audit report with maintenance issues, merge/archive candidates, failed embeddings, duplicate titles, and label aliases.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 50
        },
        "olderThanDays": {
          "type": "number",
          "minimum": 1,
          "maximum": 3650
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_export",
    "title": "Export Memory JSON",
    "description": "Export ClaraCore Desktop Memory data to a portable JSON file without creating a full database backup.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "targetPath": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_import",
    "title": "Import Memory JSON",
    "description": "Import a ClaraCore Desktop Memory JSON file by adding missing records and skipping existing IDs.",
    "inputSchema": {
      "type": "object",
      "required": [
        "filePath"
      ],
      "properties": {
        "filePath": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_merge_suggestions",
    "title": "Memory Merge Suggestions",
    "description": "List conservative merge suggestions for active non-restricted ClaraCore Desktop Memory records.",
    "inputSchema": {
      "type": "object",
      "properties": {
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
    "name": "memoria_merge",
    "title": "Merge Memories",
    "description": "Merge a source Memory into a target Memory, keep the target, and soft-delete the source.",
    "inputSchema": {
      "type": "object",
      "required": [
        "targetId",
        "sourceId"
      ],
      "properties": {
        "targetId": {
          "type": "string"
        },
        "sourceId": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_label_alias_list",
    "title": "List Memory Label Aliases",
    "description": "List ClaraCore Desktop Memory label aliases.",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_label_alias_create",
    "title": "Create Memory Label Alias",
    "description": "Create or update a Memory label alias and merge existing alias labels into the canonical label.",
    "inputSchema": {
      "type": "object",
      "required": [
        "alias",
        "canonicalLabel"
      ],
      "properties": {
        "alias": {
          "type": "string"
        },
        "canonicalLabel": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_label_alias_delete",
    "title": "Delete Memory Label Alias",
    "description": "Delete a Memory label alias without deleting existing Memory labels.",
    "inputSchema": {
      "type": "object",
      "required": [
        "alias"
      ],
      "properties": {
        "alias": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_record_create",
    "title": "Create Structured Memory Record",
    "description": "Create a typed ClaraCore Desktop structured memory record such as a fitness, metric, or recurring log entry.",
    "inputSchema": {
      "type": "object",
      "required": [
        "recordType"
      ],
      "properties": {
        "userId": {
          "type": "string"
        },
        "recordType": {
          "type": "string"
        },
        "title": {
          "type": "string"
        },
        "value": {
          "type": "object",
          "additionalProperties": true
        },
        "occurredAt": {
          "type": "string"
        },
        "timezone": {
          "type": "string"
        },
        "schemaVersion": {
          "type": "number"
        },
        "note": {
          "type": "string"
        },
        "source": {
          "type": "string"
        },
        "sourceAgent": {
          "type": "string"
        },
        "sourceRunId": {
          "type": "string"
        },
        "dedupeKey": {
          "type": "string"
        },
        "metadata": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_record_list",
    "title": "List Structured Memory Records",
    "description": "List typed ClaraCore Desktop structured memory records.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "userId": {
          "type": "string"
        },
        "recordType": {
          "type": "string"
        },
        "localDate": {
          "type": "string"
        },
        "start": {
          "type": "string"
        },
        "end": {
          "type": "string"
        },
        "limit": {
          "type": "number",
          "minimum": 1,
          "maximum": 100
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
    "name": "memoria_record_summary",
    "title": "Structured Memory Record Summary",
    "description": "Summarize fitness structured memory records by user, date, or time range.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "userId": {
          "type": "string"
        },
        "recordType": {
          "type": "string"
        },
        "localDate": {
          "type": "string"
        },
        "start": {
          "type": "string"
        },
        "end": {
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_record_stats",
    "title": "Structured Memory Record Stats",
    "description": "Read structured Memory record counts by type.",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  }
];

module.exports = {
  memoriaToolDefinitions
};
