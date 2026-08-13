# ClaraCore Positioning

> ClaraCore does not try to understand the whole world.
> ClaraCore maintains the world that Clara and the user own together.

In the owner's words (2026-07-06):

> ClaraCore 的下一阶段，不是继续堆叠更多记忆，而是让记忆之间产生可维护、
> 可解释、可强化、可衰减的连接。因为 Clara 的世界不是一堆事实，而是一张
> 会随共同经历不断重组的关系网络。

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

页面表达统一遵循 [UI_DESIGN_LANGUAGE.md](./UI_DESIGN_LANGUAGE.md)：先定义人看完需要知道什么，再让模块的真实运作流程在页面上可见。

Every proposed feature must answer one question:

**Does this maintain the shared world, or does it just add capability?**

If it only adds capability, it belongs in the base model or in another tool,
not here. Prefer deepening connections over adding surfaces.

## Context delivery is part of maintaining the world

ClaraCore keeps the shared world richer than any one conversation should
receive. Preserving a complete Memory, Shared Line, or InnerLife history does
not mean transmitting it by default.

The delivery principle is:

> 默认最小充分，按明确范围逐层展开；显式请求仍然有界。

An ordinary read should provide enough state for the next safe decision and a
clear path to inspect more. Catalogs remain catalogs, one selected object may
be expanded deliberately, and large exports become artifacts rather than chat
payloads. This protects continuity and attention as the shared world grows.

The maintained engineering contract is
[Context Delivery](./CONTEXT_DELIVERY.md).
