const memoriaLinkToolDefinitions = [
  {
    "name": "memoria_link_create",
    "title": "Create Memory Link",
    "description": "Create or update a non-supersession link between two Memories. Use contradicts when the conflict is unresolved. Use memoria_supersede, not this tool, for a confirmed state replacement.",
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
          "enum": ["related", "causes", "evolved-from", "contradicts", "part-of", "supersedes"]
        },
        "limit": {
          "type": "number"
        }
      },
      "additionalProperties": false
    }
  },
  {
    "name": "memoria_supersede",
    "title": "Supersede Historical Memory",
    "description": "Atomically mark an old fact historical and link the confirmed current fact to it. Direction is currentMemoryId (new fact) -> historicalMemoryId (old fact). Search first; use contradicts instead when it is unclear which fact is current. History is preserved, not archived or deleted.",
    "inputSchema": {
      "type": "object",
      "required": ["currentMemoryId", "historicalMemoryId"],
      "properties": {
        "currentMemoryId": {
          "type": "string",
          "description": "The confirmed new/current fact. It must be active."
        },
        "historicalMemoryId": {
          "type": "string",
          "description": "The old fact that is no longer current. It remains available to historical recall."
        },
        "note": {
          "type": "string",
          "description": "Optional concise evidence or reason for the state replacement."
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
