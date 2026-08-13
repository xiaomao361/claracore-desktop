const memoriaRecordToolDefinitions = [
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
    "description": "List typed ClaraCore Desktop structured memory record summaries. Defaults to 10 rows; limit can explicitly request up to 50. Full value and metadata are available one record at a time through memoria_record_get.",
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
    "name": "memoria_record_get",
    "title": "Get Structured Memory Record",
    "description": "Get one complete structured Memory record by id.",
    "inputSchema": {
      "type": "object",
      "required": ["id"],
      "properties": {
        "id": { "type": "string" }
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
  memoriaRecordToolDefinitions
};
