# MCP Plugin — Clean-Room Reimplementation Spec

## About This Document

This spec is structured using principles from Chad Fowler's [Phoenix Architecture](https://aicoding.leaflet.pub/3majnyfydzs2y): systems designed to burn and be reborn without losing their identity. The four pillars of a regenerative system — **Specification**, **Evaluation**, **Context Boundary**, and **Provenance** — organize the content.

Each node is typed and cross-referenced:
- `[requirement]` R-n — what the system must do
- `[constraint]` C-n — architectural boundaries that must hold
- `[evaluation]` E-n — behavioral assertions that define correctness independently of code
- `[provenance]` L-n — learnings and decision records from the first implementation
- `[boundary]` B-n — durable interfaces the plugin connects through
- `[TODO]` — gaps that need resolution before or during implementation

**The spec is the identity that survives.** Code is the compilation artifact; this document is the source. An implementer should be able to regenerate a correct implementation from this spec alone, validated by the evaluations, without reference to any previous code.

## Purpose

This document drives a complete reimplementation from scratch in a codebase with no existing MCP plugin code. The implementer should design solutions against the actual codebase (at the clean baseline), not against the previous implementation.

Per DXOS conventions (`.agents/skills/composer-plugins/SKILL.md`), `PLUGIN.mdl` is the design document and must be written first. This spec provides the requirements and context from which a new `PLUGIN.mdl` should be authored.

## What the Plugin Does

Lets users configure MCP (Model Context Protocol) server connections on a per-space basis. When an MCP blueprint is enabled in a conversation, the plugin connects to the configured server(s), discovers tools dynamically, and makes them available to the AI assistant.

---

## Specification

### R-1: Server Configuration (per-space)
`[requirement]` `depends-on: none`

- User can add, edit, and remove MCP server entries via a space settings panel.
- Each entry has: name, description, URL, protocol (SSE or HTTP).
- Entries are persisted as ECHO objects in the space database.
- Servers configured in Space A are not visible in Space B.
- McpServer is a system type — it must not appear in the navtree or object explorer.

**Data model:**

```mdl
type McpServer (ECHO, typename: org.dxos.type.mcp-server, version: 0.1.0)
  fields:
    name: string                  # short label, becomes blueprint name
    description: string           # purpose statement, becomes blueprint description
    url: string                   # server endpoint URL
    protocol: sse | http          # transport protocol
  annotations:
    LabelAnnotation: ['name']
    IconAnnotation: { icon: 'ph--plugs-connected--regular', hue: 'indigo' }
    SystemTypeAnnotation: true    # hide from navtree/object explorer
```

**UI component:**

```mdl
component McpServersPanel
  desc: Per-space settings panel for managing MCP server connections.
  props:
    space: Space                  # the active ECHO space
  state:
    adding: boolean               # whether the add-server form is shown
  actions:
    handleAdd(form)               # creates McpServer + Blueprint ECHO objects in space.db
    handleDelete(server)          # removes McpServer + matching Blueprint from space.db
    handleUpdateField(server, field, value)  # auto-saves field changes on ECHO object; uses Obj.change()
  layout: |
    +-----------------------------------+
    | MCP Servers                       |
    +-----------------------------------+
    | List view (default):              |
    | +-------------------------------+ |
    | | Name         [__________]     | |
    | | Description  [__________]     | |
    | | Server URL   [__________]     | |
    | | Protocol     [HTTP v]         | |
    | | [Remove server]               | |
    | +-------------------------------+ |
    | ... (repeat per server)           |
    | [Add server]                      |
    +-----------------------------------+
    | Add form (when adding=true):      |
    | +-------------------------------+ |
    | | Form.Root + Form.FieldSet     | |
    | | [Save] [Cancel]               | |
    | +-------------------------------+ |
    +-----------------------------------+
```

### R-2: Blueprint Generation
`[requirement]` `depends-on: R-1`

- Each configured server produces a Blueprint object in the space database.
- Blueprint key is prefixed with `org.dxos.blueprint.mcp` and suffixed with server id.
- Blueprint includes name, description, and `mcpServers` array with URL and protocol.
- The blueprint is toggleable per-conversation via the existing blueprint system.
- Deleting a server removes its matching Blueprint from space.db.

### R-3: Dynamic Tool Discovery
`[requirement]` `depends-on: R-2`

- When a conversation enables an MCP blueprint, the plugin connects to the MCP server and discovers its tools.
- Discovered tools are available to the AI assistant for that conversation turn.
- Tools must be re-resolved each turn (blueprints can change mid-conversation as the agent enables/disables them).
- MCP request timeout must be configurable; default 5 minutes (60s SDK default is too short for long-running tools like web scraping).
- Timeout should reset on progress for tool calls (`resetTimeoutOnProgress`).

`[TODO]` **Extension point gap:** The existing `GenericToolkitProvider` is synchronous and startup-time (see L-3, L-4). This requirement needs an async, per-turn toolkit contribution mechanism. The implementer must assess how to satisfy this need via C-5 (extension point assessment) before implementing. The solution must be generic (C-3) — not MCP-specific in core.

### R-4: Connection Failure Notification
`[requirement]` `depends-on: R-3`

- When an MCP server fails to connect during a conversation turn, the user sees a toast notification listing the unreachable server(s).
- The toast uses a warning icon and auto-dismisses after ~8 seconds.
- No error is injected into the AI system prompt.
- Connection failures must not crash the AI request — failed servers are silently filtered out and the conversation continues with whatever tools are available.

`[TODO]` **Communication channel assessment:** The implementer must determine how to deliver failure notifications from the agent process to the UI process. Options include ephemeral trace events (L-5), operations, or other mechanisms. The solution must satisfy C-1 (plugin isolation) and C-2 (no cross-plugin coupling) — the plugin must be able to react to its own failures without requiring changes to plugin-assistant.

### R-5: App Registration
`[requirement]` `depends-on: none`

- The plugin must be registered in the composer app (`plugin-defs.tsx`).
- The plugin is labs-gated: only enabled when `isDev || isLabs` is true.
- The plugin appears alongside other experimental features (AssistantPlugin, FeedPlugin, etc.).

---

## Architectural Constraints

These constraints were derived from analyzing violations in the initial implementation.

### C-1: Plugin isolation
`[constraint]` `informed-by: L-2`

All plugin-specific runtime logic must live within the plugin package. Core packages must not import plugin-specific dependencies or contain plugin-specific logic. If the plugin needs a capability that core doesn't provide, the plugin's requirements should drive the design of a generic extension point — but the extension point design is a separate concern from the plugin spec.

### C-2: No cross-plugin coupling
`[constraint]` `informed-by: L-2, L-5`

The plugin must not require changes to other plugins (e.g., plugin-assistant) for its features to work. If the plugin needs to surface information in the UI (like toast notifications), it must either use existing generic mechanisms or its requirements should drive the creation of new generic mechanisms that any plugin could use.

### C-3: Generic over specific in core
`[constraint]` `informed-by: L-2, L-3, L-4`

When the plugin identifies a gap in core capabilities, the requirement should be stated generically. For example:
- Need: "contribute toolkits that are resolved asynchronously per conversation turn"
- Not: "add an MCP toolkit provider to the conversation loop"
- Need: "show a notification to the user from the agent process"
- Not: "add MCP failure handling to the processor"

### C-4: Design against the clean codebase
`[constraint]` `informed-by: L-1, L-2`

The implementation should be designed against what the core codebase provides *before any MCP code was added* (i.e., the state at commit `90adae2d6d` or equivalent). This prevents the design from being anchored on the artifacts of the previous implementation.

### C-5: Extension point assessment
`[constraint]` `informed-by: L-3, L-4`

For each requirement that cannot be satisfied by existing core mechanisms, the implementer must:
1. State the need as a generic capability requirement.
2. Assess whether an existing extension point can satisfy it.
3. If not, propose a generic extension point design as a prerequisite.
4. Implement the plugin against that extension point.

### C-6: PLUGIN.mdl first
`[constraint]` `informed-by: SKILL.md`

Per DXOS conventions, `PLUGIN.mdl` is the first file written for any new plugin. It is the design document — no separate design doc. The spec must be reviewed and approved before any code is written. Tests derive from the spec's `feat`, `req`, and `test` blocks.

### C-7: Plugin directory conventions
`[constraint]` `informed-by: SKILL.md`

The plugin must follow the standard DXOS plugin directory structure:
- `src/components/` — no app-framework deps
- `src/containers/` — surface components, lazy-loaded
- `src/capabilities/` — `Capability.lazy()` exports only
- `src/types/` — ECHO schema with namespace re-exports
- `src/operations/` — if needed
- `src/blueprints/` — if needed
- Standard wiring via `Plugin.define(meta).pipe()` with `addSurfaceModule`, `addSettingsModule`, etc.

---

## Evaluations

These define correctness independently of code. Each evaluation validates one or more requirements. An implementer can turn these directly into tests.

### E-1: Add server via form
`[evaluation]` `validates: R-1, R-2`

```mdl
test T-1: Add server via form
  given: space settings MCP panel is open with no servers configured
  when: user clicks "Add server", fills in name/description/url/protocol, clicks Save
  then:
    - a new McpServer ECHO object is created in space.db
    - a matching Blueprint ECHO object is created in space.db
    - the server appears in the list view
```

### E-2: Remove server entry
`[evaluation]` `validates: R-1, R-2`

```mdl
test T-2: Remove server entry
  given: space settings MCP panel shows one server
  when: user clicks "Remove server"
  then:
    - the McpServer ECHO object is removed from space.db
    - the matching Blueprint ECHO object is removed from space.db
```

### E-3: Edit server entry (auto-save)
`[evaluation]` `validates: R-1, R-2`

```mdl
test T-3: Edit server entry (auto-save)
  given: space settings MCP panel shows one server
  when: user changes the name, description, URL, or protocol fields
  then:
    - the McpServer ECHO object reflects the updated values immediately
    - the matching Blueprint is updated to reflect name/description/mcpServers changes
```

### E-4: Blueprint structure
`[evaluation]` `validates: R-2`

```mdl
test T-4: Blueprint structure
  given: an McpServer is created with name, description, url, protocol
  then:
    - Blueprint key matches org.dxos.blueprint.mcp.<server-id>
    - Blueprint name matches server name
    - Blueprint description matches server description
    - Blueprint mcpServers[0] contains the server url and protocol
```

### E-5: Per-space isolation
`[evaluation]` `validates: R-1`

```mdl
test T-5: Per-space isolation
  given: user adds a server in Space A
  when: user switches to Space B
  then: the server is not visible in Space B
```

### E-6: Connection failure toast
`[evaluation]` `validates: R-4`

```mdl
test T-6: Connection failure toast
  given: an MCP server is configured with an unreachable URL
  when: a conversation turn attempts to connect to the MCP server
  then:
    - a toast notification appears listing the unreachable server name
    - the toast uses a warning icon and auto-dismisses after ~8 seconds
    - no error text is appended to the AI system prompt
```

### E-7: Dynamic tool availability
`[evaluation]` `validates: R-3`

`[TODO]` **Missing evaluation — needs validation.** No acceptance test existed for dynamic tool discovery in the first implementation.

```mdl
test T-7: Dynamic tool availability
  given: an MCP server is running and exposes a tool named "my_tool"
  and: a Blueprint is configured pointing to that server
  when: the Blueprint is enabled in a conversation and a turn is processed
  then: "my_tool" is available in the assistant's toolkit for that turn
```

### E-8: Tool removal on blueprint disable
`[evaluation]` `validates: R-3`

`[TODO]` **Missing evaluation — needs validation.** No acceptance test for the negative case.

```mdl
test T-8: Tool removal on blueprint disable
  given: an MCP blueprint is enabled and its tools are available
  when: the Blueprint is disabled mid-conversation
  then: the MCP server's tools are NOT available on the next turn
```

### E-9: Connection failure does not crash request
`[evaluation]` `validates: R-4`

`[TODO]` **Missing evaluation — needs validation.**

```mdl
test T-9: Connection failure does not crash request
  given: a conversation has two MCP blueprints enabled — one reachable, one unreachable
  when: a conversation turn is processed
  then:
    - tools from the reachable server are available
    - a toast notification appears for the unreachable server
    - the AI request completes successfully (does not crash)
```

### E-10: McpServer hidden from navtree
`[evaluation]` `validates: R-1`

```mdl
test T-10: McpServer hidden from navtree
  given: an McpServer ECHO object exists in space.db
  then: the McpServer does not appear in the navigation tree or object explorer
```

### E-11: Plugin isolation verification
`[evaluation]` `validates: C-1, C-2`

`[TODO]` **Missing evaluation — needs enforcement mechanism.** Should assert:

```
  given: the plugin is implemented
  then:
    - no core package (e.g., @dxos/assistant) imports @dxos/mcp-client or plugin-mcp
    - no other plugin (e.g., plugin-assistant) imports plugin-mcp or contains MCP-specific logic
    - the plugin's package.json lists only its own dependencies
```

This could be enforced as a lint rule or dependency graph check.

### E-12: Labs gating
`[evaluation]` `validates: R-5`

```mdl
test T-12: Labs gating
  given: the composer app is running with isLabs=false and isDev=false
  then: the MCP plugin is not loaded
  given: the composer app is running with isLabs=true
  then: the MCP plugin is loaded and functional
```

---

## Context Boundaries

These are the durable interfaces the plugin connects through. Implementations change; these shapes persist.

### B-1: Settings surface
`[boundary]` `used-by: R-1`

The plugin contributes a `ReactSurface` for the `settings` role, scoped to a space. This is how the McpServersPanel reaches the UI.

Extension point: `Capability.contributes(Capabilities.ReactSurface, [...])`

### B-2: Schema registration
`[boundary]` `used-by: R-1`

The plugin registers its `McpServer` ECHO type so space.db can persist and query it.

Extension point: `addSchemaModule` in `Plugin.define(meta).pipe()`

### B-3: Blueprint creation (data)
`[boundary]` `used-by: R-2`

The plugin creates `Blueprint` ECHO objects in space.db using the existing `Blueprint.make()` API. The `mcpServers` field on Blueprint is the data contract — no new schema is needed.

Extension point: Direct ECHO object creation (data, not a capability slot).

### B-4: Toolkit contribution (per-turn)
`[boundary]` `used-by: R-3`

`[TODO]` **This boundary does not exist yet.** The plugin needs to contribute `GenericToolkit` instances asynchronously, per conversation turn, based on which blueprints are enabled. The existing `AppCapabilities.Toolkit` is synchronous and startup-time (L-3). The existing turn loop has no plugin intercept hook (L-4).

The implementer must design or request a generic extension point here. This is the most significant gap.

Possible shapes (non-prescriptive):
- An async `DynamicToolkitProvider` Effect service tag injected into the conversation turn loop
- A per-turn callback/middleware in `AiConversation`
- An Effect layer contributed via a new capability slot

Whatever shape is chosen, it must be generic (C-3) and not import MCP-specific code in core (C-1).

### B-5: Agent-to-UI notification
`[boundary]` `used-by: R-4`

`[TODO]` **Assess whether existing mechanisms suffice.** The plugin needs to communicate connection failures from the agent process to the UI process, then show a toast.

Known mechanisms:
- `Trace.EventType` with `isEphemeral: true` (L-5) — but subscribing to the ephemeral stream currently happens in plugin-assistant's processor, which would violate C-2 if MCP-specific handling is added there.
- `LayoutOperation.AddToast` (L-6) — available from any plugin, but requires being in the UI process.

The implementer must determine: can the plugin subscribe to its own ephemeral events and invoke `AddToast` itself? Or does this require a new generic mechanism (e.g., a generic "agent notification" capability)?

### B-6: Translations
`[boundary]` `used-by: R-1`

The plugin provides i18n resources keyed by `meta.id`. Standard pattern via `addTranslationsModule`.

### B-7: Capability activation ordering
`[boundary]` `used-by: R-1, R-2`

If capability modules have data dependencies (e.g., blueprint definition reads from settings), the plugin must declare `activatesAfter` constraints to guarantee ordering.

Extension point: `activatesAfter` parameter in capability module definitions.

---

## Provenance

These are factual observations from the first implementation, provided as context. Each learning links to the requirements and constraints it informs.

### L-1: `createToolkit(genericToolkits)` was correct
`[provenance]` `informs: C-4, R-3`

PR #10711 added a `genericToolkits` parameter to `createToolkit()` in `session/toolkit.ts`. This is a legitimate generic extension point — it accepts any `GenericToolkit[]` and merges them into the turn's toolkit. This parameter still exists and is usable.

### L-2: The toolkit *producer* was placed in the wrong package
`[provenance]` `informs: C-1, C-2, C-3`

`connectMcpServers()` was added directly to `conversation.ts` in `@dxos/assistant`, importing `McpToolkit` from `@dxos/mcp-client`. This created a hard dependency from the core assistant package on an MCP-specific library. This is the primary architectural violation that motivates the reimplementation.

### L-3: `GenericToolkitProvider` exists but is synchronous and startup-time
`[provenance]` `informs: C-5, B-4`

`AppCapabilities.Toolkit` lets plugins contribute `GenericToolkit` instances at startup. These are collected by the compute runtime via `capabilities.getAll(AppCapabilities.Toolkit)` and merged into a `GenericToolkitProvider`. However:
- `getToolkit()` is synchronous — cannot do async network connections.
- It's called once at runtime construction, not per-turn.
- MCP connections are async and must happen per-turn (blueprints change).

### L-4: The conversation turn loop has no plugin intercept hook
`[provenance]` `informs: C-5, B-4`

The turn loop in `AiConversation.createRequest()` is hardcoded. There is no callback, middleware, or injectable service for plugins to contribute toolkits per-turn. The only per-turn toolkit injection is the hardcoded `connectMcpServers()` call.

### L-5: Ephemeral trace events bridge agent-to-UI communication
`[provenance]` `informs: R-4, B-5`

The `Trace.EventType` system with `isEphemeral: true` is the mechanism for the agent process to communicate with the UI process. The processor in `plugin-assistant` subscribes to the ephemeral stream and currently handles `PartialBlock` events. This is the channel through which notifications (like connection failures) can flow.

### L-6: Toast notifications use `LayoutOperation.AddToast`
`[provenance]` `informs: R-4, B-5`

The existing toast system uses `LayoutOperation.AddToast` with properties: `id`, `title`, `description`, `icon`, `duration`. Multiple plugins already use this (plugin-pwa, plugin-script, plugin-observability). It accepts plain strings or i18n tuples.

### L-7: Blueprint data model includes `mcpServers`
`[provenance]` `informs: R-2, B-3`

The `Blueprint` schema already has an `mcpServers` field (`Array<{ url, protocol }>`). This was used by the previous implementation's `connectMcpServers()` to know which servers to connect to. This field exists in core regardless of the plugin.

### L-8: The `@dxos/mcp-client` package exists independently
`[provenance]` `informs: R-3`

`McpToolkit.make({ url, kind })` creates a `GenericToolkit` from an MCP server URL. This package is independent of the plugin and can be used as a dependency.

### L-9: ECHO objects require `Obj.change()` for mutations
`[provenance]` `informs: R-1`

Direct property assignment on ECHO objects throws at runtime. All mutations must be wrapped in `Obj.change(obj, (mutable) => { ... })`. This was discovered as a runtime error in the first implementation and fixed in commit `7257dafa31`.

### L-10: `Effect.sandbox` needed before `Effect.either` for MCP connections
`[provenance]` `informs: R-4`

`Effect.either` only catches checked failures (`Fail`), not defects (`Die`). MCP connection errors throw `Die` (from `TypeError` in fetch), which propagated through `either` and crashed the entire AI request. The fix was to use `Effect.sandbox` to convert defects to checked failures before `either`, so failed MCP connections are silently filtered out. Discovered in commit `e7da85de3b`.

### L-11: System prompt injection for failures was tried and rejected
`[provenance]` `informs: R-4`

The first approach to connection failure notification (commit `18ad7ed3af`) appended failure information to the AI system prompt. This was rejected because: (a) it used AI tokens for infrastructure concerns, (b) the AI's response to failures was unpredictable, and (c) a toast notification is a more direct, reliable user experience. Replaced by ephemeral trace event + toast approach in commit `c0a71b1de8`.

### L-12: Capability module activation ordering matters
`[provenance]` `informs: B-7`

The blueprint definition module may read from settings capabilities. If settings haven't been contributed yet, the blueprint module fails silently. The fix (commit `d20a783acd`) was to add an `activatesAfter` constraint on `SetupSettings` to guarantee the settings module runs before the blueprint definition module.

### L-13: MCP SDK default timeout is too short
`[provenance]` `informs: R-3`

The MCP SDK defaults to 60-second timeouts for `listTools` and `callTool`. This is too short for long-running tools (e.g., web scraping). Commit `a55fba66b0` increased the timeout to 5 minutes and enabled `resetTimeoutOnProgress` for tool calls. This is a `@dxos/mcp-client` configuration concern, not a plugin concern, but the plugin should be aware of it.

### L-14: Spec evolved through three versions
`[provenance]` `informs: C-6`

The PLUGIN.mdl went through three versions reflecting design evolution:
- **v0.1.0** (scaffold): localStorage/KVS storage, simple `McpServerEntry` type with id/name/url/protocol, `McpSettings` component with `onSettingsChange` prop pattern.
- **v0.2.0** (per-space refactor): ECHO objects in space.db, `McpServer` type with ECHO annotations + description field, `McpServersPanel` with Space prop, explicit add form with Save/Cancel vs. auto-save for edits, Blueprint ECHO objects created alongside servers.
- **v0.3.0** (connection failure): Added F-4 (Connection Failure Notification) with requirements and T-6 acceptance test.

Each version reflected a deeper understanding of the correct storage and interaction model. The reimplementation should start at the v0.2.0/v0.3.0 level of understanding.

### L-15: McpServer must be a system type
`[provenance]` `informs: R-1`

Without the system type annotation, McpServer objects appear in the navigation tree and object explorer alongside user content, which is confusing. Commit `600ff4b8a7` added the system type marker to hide them. The reimplementation should include this from the start.

---

## Reference: Existing Extension Points

These are the mechanisms currently available for plugins to contribute behavior (as of the clean codebase, before MCP was added):

| Extension Point | What it does | Timing |
|---|---|---|
| `AppCapabilities.Toolkit` | Contribute a `GenericToolkit` | Startup (once) |
| `AppCapabilities.BlueprintDefinition` | Define blueprint templates | Startup (once) |
| `Capability.contributes(Capabilities.OperationHandler, ...)` | Handle operations | Startup (once) |
| `Capability.contributes(Capabilities.ReactSurface, ...)` | Provide UI surfaces | Startup (once) |
| `Blueprint.mcpServers` field | Data on blueprints | Per-blueprint (data) |
| `Trace.EventType` (ephemeral) | Agent-to-UI communication | Runtime (per-event) |
| `LayoutOperation.AddToast` | Show toast notification | Runtime (per-invocation) |
| `activatesAfter` | Capability module ordering | Startup (ordering) |

---

## Non-Requirements

Items explicitly excluded, with rationale.

- **Connection pooling or persistent MCP connections across turns.** MCP connections are stateless per-turn. The complexity of lifecycle management (reconnection, health checks, cleanup) outweighs the latency savings for the current use case. Per-turn connections are simpler and align with the blueprint-can-change-per-turn model.

- **MCP server authentication.** No current MCP servers in use require authentication. Adding auth would require credential storage, UI for auth configuration, and per-protocol auth flows. Defer until a concrete need arises.

- **MCP resource/prompt support (tools only).** The MCP protocol supports resources and prompts, but the current AI assistant infrastructure only consumes tools via `GenericToolkit`. Resource and prompt support would require new extension points in the assistant. Scope to tools only for now.

- **Changes to the MCP protocol itself.** The plugin consumes MCP via `@dxos/mcp-client`. Protocol changes are out of scope for the plugin.

---

## TODO Summary

These are the open items that must be resolved before or during implementation:

1. **[B-4] Per-turn toolkit contribution mechanism.** The most significant gap. No existing extension point supports async, per-turn toolkit injection from a plugin. The implementer must design a generic solution (C-3, C-5) and propose it as a prerequisite to the plugin.

2. **[B-5] Agent-to-UI notification channel for plugin use.** Can the plugin subscribe to its own ephemeral trace events and invoke `AddToast`? Or does the current architecture require changes to plugin-assistant to handle new event types (violating C-2)? The implementer must assess the existing mechanisms and determine if a new generic capability is needed.

3. **[E-7] Evaluation for dynamic tool availability.** No acceptance test existed for the core feature (R-3). Must be authored and validated.

4. **[E-8] Evaluation for tool removal on blueprint disable.** No acceptance test for the negative case. Must be authored.

5. **[E-9] Evaluation for connection failure resilience.** Must verify that one failed server doesn't crash the request when other servers succeed.

6. **[E-11] Plugin isolation verification.** How to enforce C-1/C-2 durably — lint rule, dependency graph check, or CI assertion?

7. **PLUGIN.mdl authoring.** The new `PLUGIN.mdl` should be written from this spec before any code, per C-6. It should incorporate the types, components, features, and evaluations defined here, adapted to whatever the implementer discovers about extension points.
