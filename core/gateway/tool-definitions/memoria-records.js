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
  memoriaRecordToolDefinitions
};
