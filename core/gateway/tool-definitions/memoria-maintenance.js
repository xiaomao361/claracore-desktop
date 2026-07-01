const memoriaMaintenanceToolDefinitions = [
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
  }
];

module.exports = {
  memoriaMaintenanceToolDefinitions
};
