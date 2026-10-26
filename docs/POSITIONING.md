# Product direction

ClaraCore maintains the world a person and their agents share: the facts they
have confirmed, the work they can resume, and the sources they may revisit.
The workspace remains useful when conversations end or the chosen agent changes.

## A small set of responsibilities

- **Memoria** stores and recalls confirmed memory.
- **Continuity** preserves Shared Lines and their current positions.
- **InnerLife** can offer optional reflections without promoting them to facts.
- **Knowledge** keeps sourced Markdown readable, attributable, and searchable.
- **Gateway** routes access to these domains through a local interface.

Desktop is a companion to existing AI clients. It does not provide a primary
chat interface or require one conversational model. More tools are useful only
when they help maintain this shared workspace.

## Design principles

Keep everyday workflows small. Prefer clear ownership, explicit writes,
recoverable state, and truthful failure results. Rich storage should not force
rich delivery: send minimum-sufficient context, then let a caller request a
specific object or source section. Generated interpretations, source statements,
and user-confirmed facts must remain distinguishable.

The interface should make it easy to see the current position and the next
useful action. Deep history, diagnostics, and maintenance belong behind
explicit choices. See [Context delivery](CONTEXT_DELIVERY.md) and
[Design language](UI_DESIGN_LANGUAGE.md).
