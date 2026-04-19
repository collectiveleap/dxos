# MCP Plugin — Demand Side

This document defines *what demand the MCP plugin serves* using Tony Ulwick's Outcome-Driven Innovation (ODI) framework. It sits above the [supply-side spec](./mcp-plugin-reimplementation.md) and provides the context for why the plugin exists and how to measure whether it succeeds.

---

## Why This Isn't a Core Functional Job

A core functional job is the primary task a user is trying to accomplish — the reason they "hired" the product in the first place. Examples of core functional jobs that Composer users perform:

- **Research a topic** — gather, synthesize, and organize information
- **Analyze a dataset** — explore data, identify patterns, draw conclusions
- **Write a document** — draft, edit, and refine written content
- **Manage a project** — track tasks, coordinate work, make decisions
- **Build software** — design, implement, test, and deploy code

MCP server configuration is not any of these jobs. Nobody opens Composer thinking "I need to configure an MCP server." Instead, MCP servers provide *tools* that help the AI assistant perform these core functional jobs better — a web scraping tool helps with research, a database tool helps with analysis, a code execution tool helps with software development.

The plugin itself is infrastructure. It doesn't do the user's work — it extends the assistant's ability to do the user's work. This places it squarely in the **consumption chain**: the set of jobs users must perform to acquire, set up, use, and maintain a product so it can help them with their core functional jobs.

---

## Consumption Chain Job Statement

> **Extend the AI assistant with external tool capabilities so it can perform specialized work on my behalf.**

This is a consumption chain job because:
1. It exists only in service of core functional jobs (research, analysis, writing, etc.)
2. Nobody wants to do it for its own sake — it's overhead
3. Its value is measured by how well it enables the core jobs, not by the configuration activity itself

---

## Where This Fits in Ulwick's Consumption Chain Taxonomy

Ulwick defines [consumption chain jobs](https://www.marketingjournal.org/how-to-engineer-micro-moments-using-jobs-to-be-done-anthony-ulwick/) as the activities customers perform *around* a product — not the primary reason they purchased it. The canonical types are:

| Consumption Chain Job | Definition |
|---|---|
| Purchase | Decide to acquire the product |
| Receive | Obtain the product after purchase |
| Install & set up | Prepare the product for use |
| Learn to use | Acquire knowledge to operate the product |
| Interface with | Ongoing interaction with the product |
| Transport | Move the product |
| Clean | Maintain product cleanliness |
| Store | Organize and keep the product |
| Maintain | Routine upkeep |
| Upgrade | Enhance or improve the product |
| Repair | Fix broken or degraded function |
| Dispose | Remove the product at end-of-life |

**The MCP plugin maps primarily to "Install & set up" and "Maintain"** — with elements of "Learn to use" and "Repair":

- **Install & set up**: Discovering, configuring, and connecting MCP servers so the assistant gains new tool capabilities. This is the dominant job.
- **Maintain**: Updating server configurations as URLs change, servers are added/removed, or needs evolve.
- **Learn to use**: Understanding what tools a configured server provides and how they become available in conversations (via blueprints).
- **Repair**: Diagnosing and resolving connection failures when a configured server becomes unreachable.

The "product" being installed/maintained is not the plugin itself — it's the *AI assistant's extended capability*. The plugin is the mechanism through which the user performs these consumption chain jobs.

---

## Consumption Chain Steps and Desired Outcomes

Each step below represents a discrete task within the consumption chain job. Desired outcomes follow Ulwick's format: **[direction] + [metric] + [object of control]**.

### Step 1: Identify Need
*Realize the assistant lacks a capability required for the core job.*

| # | Desired Outcome |
|---|---|
| 1.1 | Minimize the time it takes to determine whether the assistant can perform a specific task |
| 1.2 | Minimize the likelihood that the user attempts a task the assistant cannot perform |
| 1.3 | Minimize the effort required to understand what capabilities the assistant currently has |

`[TODO]` The plugin does not directly address Step 1. The user must already know they need an MCP server. This step is currently served (or underserved) by the assistant's natural language responses ("I don't have access to that tool") and the blueprint system's visibility of available capabilities.

### Step 2: Find a Tool Source
*Discover an MCP server that provides the needed capability.*

| # | Desired Outcome |
|---|---|
| 2.1 | Minimize the time it takes to find an MCP server that provides the needed tools |
| 2.2 | Minimize the likelihood of connecting to a server that doesn't actually provide the needed tools |
| 2.3 | Minimize the effort required to evaluate whether a server's tools match the need |

`[TODO]` The plugin does not address Step 2. There is no discovery mechanism, registry, or marketplace. The user must know the server URL in advance. This is a significant underserved area — but intentionally out of scope for the current implementation (see Non-Requirements in the supply-side spec).

### Step 3: Configure the Connection
*Set up the MCP server entry with the correct parameters.*

| # | Desired Outcome |
|---|---|
| 3.1 | Minimize the time it takes to configure a new MCP server connection |
| 3.2 | Minimize the likelihood of entering incorrect configuration (wrong URL, wrong protocol) |
| 3.3 | Minimize the number of steps required to go from "I have a server URL" to "the assistant can use its tools" |
| 3.4 | Minimize the effort required to understand what configuration fields are needed |

**Served by:** R-1 (Server Configuration), E-1 (Add server via form). The add form with explicit fields and Save/Cancel addresses 3.1, 3.2, and 3.4. Outcome 3.3 involves the full path from configuration through blueprint enablement to tool availability — the number of discrete user actions required.

### Step 4: Validate the Connection
*Confirm that the configured server is reachable and its tools are available.*

| # | Desired Outcome |
|---|---|
| 4.1 | Minimize the time it takes to confirm that configured tools are available to the assistant |
| 4.2 | Minimize the likelihood of believing the connection works when it doesn't |
| 4.3 | Minimize the effort required to determine which specific tools a server provides |

`[TODO]` **Partially served.** R-4 (Connection Failure Notification) addresses 4.2 by showing a toast when connection fails. But there is no proactive "test connection" action (4.1) and no tool listing/preview (4.3). The user's only way to validate is to start a conversation, enable the blueprint, and see if it works — or wait for a failure toast.

**Potential gap:** A "test connection" button or a tool preview on the settings panel would serve 4.1 and 4.3. Not in current scope but worth noting as an underserved outcome.

### Step 5: Enable for Conversation
*Make the server's tools available in a specific conversation context.*

| # | Desired Outcome |
|---|---|
| 5.1 | Minimize the time it takes to enable a tool source for a conversation |
| 5.2 | Minimize the likelihood of forgetting to enable a needed tool source |
| 5.3 | Minimize the effort required to understand which tool sources are active in a conversation |

**Served by:** R-2 (Blueprint Generation). The blueprint system provides the enable/disable toggle (5.1), and blueprint visibility in conversations addresses 5.3. Outcome 5.2 is partially addressed by the blueprint being available — but the user must still manually enable it.

### Step 6: Use During Conversation
*Have the assistant invoke the MCP server's tools during a conversation turn.*

| # | Desired Outcome |
|---|---|
| 6.1 | Minimize the time it takes for the assistant to discover and invoke the right tool |
| 6.2 | Minimize the likelihood that the assistant fails to use an available tool when it would help |
| 6.3 | Minimize the time the user waits for tool execution to complete |
| 6.4 | Minimize the likelihood that a tool execution error disrupts the conversation |

**Served by:** R-3 (Dynamic Tool Discovery), R-4 (Connection Failure Notification). The per-turn tool resolution (6.1), graceful failure handling (6.4), and timeout configuration (6.3 via L-13) address these outcomes. Outcome 6.2 depends on the AI model's tool selection, which is outside the plugin's control.

### Step 7: Monitor Health
*Know when tool sources are working and when they aren't.*

| # | Desired Outcome |
|---|---|
| 7.1 | Minimize the time it takes to learn that a tool source has become unavailable |
| 7.2 | Minimize the likelihood of discovering a tool source is broken only when it's urgently needed |
| 7.3 | Minimize the effort required to understand why a tool source failed |

**Partially served by:** R-4 (Connection Failure Notification) — the toast addresses 7.1 at the moment of failure during a conversation turn. But 7.2 is underserved (no proactive health monitoring) and 7.3 is underserved (the toast shows name + URL but not the failure reason).

### Step 8: Update Configuration
*Modify server settings as needs or infrastructure change.*

| # | Desired Outcome |
|---|---|
| 8.1 | Minimize the time it takes to update a server's configuration |
| 8.2 | Minimize the likelihood that updating a configuration breaks existing conversations |
| 8.3 | Minimize the effort required to update multiple fields at once |

**Served by:** R-1 (auto-save editing), E-3 (Edit server entry). The auto-save pattern addresses 8.1 and 8.3. The ECHO-based persistence with Blueprint sync addresses 8.2 — changes propagate to the blueprint, which is re-resolved on the next conversation turn.

### Step 9: Remove a Tool Source
*Clean up servers that are no longer needed.*

| # | Desired Outcome |
|---|---|
| 9.1 | Minimize the time it takes to remove a server and its associated data |
| 9.2 | Minimize the likelihood that removing a server leaves orphaned data (blueprints, references) |
| 9.3 | Minimize the likelihood of accidentally removing a server that's still in use |

**Served by:** R-1, R-2 (delete cascades to blueprint), E-2 (Remove server entry). Outcome 9.2 is addressed by the coupled McpServer + Blueprint deletion. Outcome 9.3 is not addressed — there's no confirmation dialog or "in use" indicator.

---

## Outcome Satisfaction Map

Summary of which outcomes are served, underserved, or unaddressed by the current supply-side spec:

| Step | Outcome | Status | Served By |
|---|---|---|---|
| 1. Identify need | 1.1–1.3 | **Unaddressed** | Outside plugin scope |
| 2. Find tool source | 2.1–2.3 | **Unaddressed** | Outside plugin scope (intentionally) |
| 3. Configure | 3.1–3.4 | **Served** | R-1, E-1 |
| 4. Validate | 4.1 | **Underserved** | No "test connection" action |
| 4. Validate | 4.2 | **Served** | R-4, E-6 |
| 4. Validate | 4.3 | **Underserved** | No tool listing/preview |
| 5. Enable | 5.1–5.3 | **Served** | R-2 (blueprint system) |
| 6. Use | 6.1, 6.3, 6.4 | **Served** | R-3, R-4 |
| 6. Use | 6.2 | **Outside control** | Depends on AI model |
| 7. Monitor | 7.1 | **Served** | R-4, E-6 |
| 7. Monitor | 7.2 | **Underserved** | No proactive health check |
| 7. Monitor | 7.3 | **Underserved** | Toast shows name/URL, not failure reason |
| 8. Update | 8.1–8.3 | **Served** | R-1, E-3 |
| 9. Remove | 9.1–9.2 | **Served** | R-1, R-2, E-2 |
| 9. Remove | 9.3 | **Underserved** | No confirmation or "in use" indicator |

---

## Implications for the Supply Side

The demand-side analysis reveals several things about the current spec:

1. **The spec covers Steps 3, 5, 6, 8, 9 well.** Configuration, enablement, use, update, and removal are the core loop — and the requirements address them.

2. **Step 4 (Validate) is the most significant gap within scope.** A user configures a server and has no way to know it works until they start a conversation and either see tools or get a failure toast. A "test connection" action and/or tool listing would directly serve outcomes 4.1 and 4.3.

3. **Step 7 (Monitor) is partially served but reactive.** The user only learns about failures during conversation turns. There's no proactive monitoring, and failure diagnostics are minimal.

4. **Steps 1 and 2 (Identify need, Find tool source) are intentionally unaddressed.** This is appropriate for v1 — but they represent the largest underserved area in the consumption chain. A future MCP server registry or tool catalog would serve these.

5. **Outcome 9.3 (accidental removal) is a minor gap.** A confirmation dialog before deletion would address it at low cost.

These gaps don't necessarily mean the spec should change — some are intentionally deferred. But they should be visible as *known underserved outcomes* so the implementer and product owner can make informed scope decisions.

---

## Sources

- [Jobs-to-be-Done: A Framework for Customer Needs — Tony Ulwick](https://jobs-to-be-done.com/jobs-to-be-done-a-framework-for-customer-needs-c883cbf61c90)
- [How to Engineer Micro-Moments using Jobs-to-be-Done — Anthony Ulwick](https://www.marketingjournal.org/how-to-engineer-micro-moments-using-jobs-to-be-done-anthony-ulwick/)
- [Outcome-Driven Innovation — Wikipedia](https://en.wikipedia.org/wiki/Outcome-Driven_Innovation)
