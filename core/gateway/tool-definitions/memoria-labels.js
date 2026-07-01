const memoriaLabelToolDefinitions = [
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
  }
];

module.exports = {
  memoriaLabelToolDefinitions
};
