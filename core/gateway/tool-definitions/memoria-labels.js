const memoriaLabelToolDefinitions = [
  {
    "name": "memoria_label_alias",
    "title": "Memory Label Alias",
    "description": "Manage Memory label aliases with explicit action=list/upsert/delete. Upsert requires alias and canonicalLabel and merges existing alias labels into the canonical label. Delete removes the alias mapping only; Memory labels remain.",
    "inputSchema": {
      "type": "object",
      "required": [
        "action"
      ],
      "properties": {
        "action": {
          "type": "string",
          "enum": [
            "list",
            "upsert",
            "delete"
          ]
        },
        "alias": {
          "type": "string"
        },
        "canonicalLabel": {
          "type": "string"
        }
      },
      "oneOf": [
        {
          "properties": {
            "action": {
              "const": "list"
            }
          }
        },
        {
          "properties": {
            "action": {
              "const": "upsert"
            }
          },
          "required": [
            "alias",
            "canonicalLabel"
          ]
        },
        {
          "properties": {
            "action": {
              "const": "delete"
            }
          },
          "required": [
            "alias"
          ]
        }
      ],
      "additionalProperties": false
    }
  }
];

module.exports = { memoriaLabelToolDefinitions };
