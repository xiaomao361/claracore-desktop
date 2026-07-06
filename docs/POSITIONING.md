# ClaraCore Positioning

> ClaraCore does not try to understand the whole world.
> ClaraCore maintains the world that Clara and the user own together.

## What this means

Base models (GPT, Claude, ...) already carry a world model: physics, common
sense, culture, public knowledge. ClaraCore will never compete there and must
not try.

What a base model can never carry is the private, co-owned layer:

- who the user is, in this relationship
- why ClaraCore and its parts exist and were designed this way
- where the last conversation stopped
- which ideas were formed together, and how they evolved
- which experiences are shared history

That layer is the product. Everything in this repo exists to keep that layer
alive across sessions, model swaps, and agent changes.

## Understanding is a network, not a dictionary

A concept is not a definition; it is a region in a relation network. What
matters is not the nodes but the connections between them — connections that
can strengthen, weaken, re-attach, and grow. Recalling one memory should light
up its neighborhood, not return an isolated row.

The three modules are three maintenance duties over one network:

| Module | Maintains |
|--------|-----------|
| Memoria | the stable nodes: facts, preferences, formed knowledge |
| Continuity | the currently active region: the shared position, what is live between agent and user |
| InnerLife | the offline evolution: new connections that form even without new input |

They are not three features. They are one world, maintained at three layers.

## Design filter

Every proposed feature must answer one question:

**Does this maintain the shared world, or does it just add capability?**

If it only adds capability, it belongs in the base model or in another tool,
not here. Prefer deepening connections over adding surfaces.
