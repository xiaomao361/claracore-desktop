const memoriaLinkToolDefinitions = [
  {
    "name": "memoria_link_create",
    "title": "Create Memory Link",
    "description": "Create or update a typed link between two Memories. Links are first-class connections in the shared world graph.",
    "inputSchema": {
      "type": "object",
      "required": [
        "fromMemoryId",
        "toMemoryId"
      ],
      "properties": {
        "fromMemoryId": {
          "type": "string"
        },
        "toMemoryId": {
          "type": "string"
        },
        "kind": {
          "type": "string",
          "enum": ["related", "causes", "evolved-from", "contradicts", "part-of"],
          "description": "Link kind. Defaults to 'related'."
        },
        "strength": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Connection strength between 0 and 1. Defaults to 0.5."
        },
        "source": {
          "type": "string",
          "enum": ["manual", "innerlife", "co-recall"],
          "description": "Where the link came from. Defaults to 'manual'."
        },
        "note": {
          "type": "string",
          "description": "Optional short note on why the two memories are connected."
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_link_list",
    "title": "List Memory Links",
    "description": "List Memory links, optionally filtered to one Memory's neighborhood or one link kind.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "memoryId": {
          "type": "string",
          "description": "Return links touching this Memory in either direction."
        },
        "kind": {
          "type": "string",
          "enum": ["related", "causes", "evolved-from", "contradicts", "part-of"]
        },
        "limit": {
          "type": "number"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_link_delete",
    "title": "Delete Memory Link",
    "description": "Delete a Memory link by link id. The linked Memories are not affected.",
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
  memoriaLinkToolDefinitions
};
