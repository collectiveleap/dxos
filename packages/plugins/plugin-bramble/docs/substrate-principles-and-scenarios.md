# Principles for an Evolving Sociotechnical Substrate

## Purpose

This document describes the principles for a substrate that supports the gradual evolution of sociotechnical systems from informal, human-executed practice toward formal, partially or fully automated implementation. The substrate's goal is not to replace human work, but to *pace* it closely enough to be useful from the first day, and to *lead* it gradually toward forms that automation can take over — while preserving the option to return work to human execution at any point.

The substrate is general. It is not specific to any domain. Domain knowledge enters at runtime through use, through accumulated traces, and through LLM priors conditioned on the actual artifacts and behavior the substrate observes. The same substrate should be usable for personal medical reconciliation, for services-business operations, for legal case management, or for any other domain where work begins informally and incrementally yields to structure.

## Core stance

The substrate's core stance is *pace, then lead*. Pacing means matching the user's existing practice closely enough that the substrate is lower-cost to use than to work around. Leading means offering structure, automation, and improvement at a rhythm the user can accept. Pacing earns the right to lead. Leading without pacing is rejected.

This stance has implications throughout the architecture, but the most important one is that **the substrate must be valuable on day one with zero accumulated history and zero automation**. If the user has to invest effort before getting value, they will abandon the substrate before it becomes useful. Value comes first from being a better journal — a structured, queryable, navigable record of work — than the user had before. Automation is layered on top of that journal over time.

## Key terms

**Step.** A named piece of work. Steps are the only first-class unit of work in the substrate. Every piece of work — extracting a value, checking a condition, reconciling a line, reconciling a visit — is a step. Steps nest: a step's work may involve sub-steps, which are themselves steps with their own definitions, executors, and runs. There is one kind of thing, recursively composed.

**Run.** An instance of a step being executed. Runs are immutable records of what happened: when, by which executor, with what inputs and outputs, in what context. A run of a parent step may spawn child runs of its sub-steps; the parent-child relationship is recorded in the log.

**Context.** A first-class handle representing a coherent piece of work — a particular case, client, event, or other organizing entity. Runs, artifacts, and conversations associate with contexts. Contexts can overlap. Contexts emerge from use rather than being pre-declared.

**Artifact.** A file or text blob attached to runs and contexts. Artifacts may be classified into entity types (EOB, bill, superbill) as patterns emerge from use, but classification is optional and revisable.

**Refinement.** A change to a step that makes implicit work explicit — typically by creating sub-steps under it. When Steve articulates that reconciling a line involves extracting an amount, checking the charge code, comparing values, and noting discrepancies, those become sub-steps under the parent. Refinement does not change the work being done; it changes the substrate's awareness of the work. Refinement happens in response to demand.

**Executor.** A who or what that performs a step. Executors include humans (specific operators), LLMs (with specific prompts and models), classifiers (with specific training data), and encoded rules. Adding an executor to a step makes it available to do the work. Available executors are not automatically engaged.

**Engagement.** Whether an available executor is actively running on a given run, and what role it plays. Primary executors' output flows downstream; secondary executors' output is recorded alongside for comparison but does not affect downstream consumers unless the user resolves a disagreement in favor of a secondary. Different sub-steps of a parent step may have different executors engaged on the same run.

**Hand-off and hand-back.** Changing which executors are engaged on a step, or changing which is primary. Hand-off includes adding an executor as primary or secondary. Hand-back is the same operation in the direction of returning work to a previously-engaged executor. Hand-back is a normal substrate operation, not a regression.

**Primary and secondary.** When multiple executors are engaged on a step in parallel, the primary's output flows downstream. Secondaries run concurrently and their output is recorded for comparison. The primary designation can shift over time as comparison data accumulates.

**Translator.** An executor on an edge between steps, responsible for transforming upstream output into the shape downstream input expects. Translators may be no-ops (when shapes match), human-performed, LLM-performed, or rule-performed. Translators have the same executor type taxonomy and the same hand-off mechanics as step executors.

**Lens.** A named perspective on the substrate that maps its own vocabulary, property schemas, and visibility rules onto shared underlying identities. Different operators or roles may use different lenses; mappings between lenses are explicit and revisable. No lens is privileged; a "shared" or "common" lens is one option among many.

**Provenance.** Metadata recorded for every piece of substrate content — refinements, executor additions, structural changes, proposals, and decisions — indicating its source: who or what proposed it, what evidence supports it, when it was created, what it was derived from. Provenance supports calibrated trust and is surfaced when relevant.

**Demand.** A felt need that calls for the substrate to respond. Demand can be a user's repeated need for a value (pull demand: "I keep needing to know the amount"), or a user's wish to delegate work (push demand: "I want someone else to do this for me"). Every addition to the substrate — every step, every refinement, every executor, every engagement change — exists because of a demand. In the absence of demand, the substrate does not add structure.

## Principles

### 1. Structure emerges from work in response to demand

Steps, sub-steps, entity types, relationships, and classifications do not pre-exist their first instance. The user begins by doing the work, capturing it loosely. Naming, articulation, and structure happen when demand for them surfaces — when the user repeatedly needs a value pulled out, when they want to delegate part of the work, when a new operator joins and needs to understand what's being done.

The substrate must support working with no declared structure at all. It must also support gradually adding structure as demand calls for it, without forcing migration of past work and without losing the informal record that preceded the structure.

### 2. Everything in the substrate is demand-driven

The substrate does not add structure, articulate work, or engage executors in the absence of demand. A step exists because someone needed the work done. A sub-step exists because the parent step's work involved a sub-need. An executor is added because there's demand for relief from doing the work manually. A refinement happens because the need for articulation has surfaced.

This means the substrate is fundamentally responsive, not prescriptive. It does not push the user toward more structure, more automation, or more formalization. It responds to demand as it surfaces — sometimes from the user directly, sometimes by the substrate noticing patterns that suggest demand. The user is always the arbiter of whether a demand is real and worth acting on.

Demand has two patterns worth distinguishing. **Pull demand** is when the user needs work articulated so they can do their work better — they keep needing the value, they keep doing the check, they keep handling the case. **Push demand** is when the user needs work articulated so they can delegate it to a different executor — they want to hand off, and the current articulation is too vague to delegate. Both are legitimate sources of refinement; the substrate makes clear which kind of demand a proposal is responding to.

The test for any addition to the substrate is: what demand is this responding to? If the answer is unclear, the addition is premature.

### 3. Refinement makes implicit work explicit; it does not add new work

A step at pure narrative form already has, in the operator's practice, all the sub-work that explicit refinement will later capture. Steve, when he reconciles a line in narrative form, already extracts the amount, checks the charge code, compares the values, and notes any discrepancy. He's just doing it implicitly, in his head, as part of "doing the step."

Refinement moves that implicit work into the substrate as sub-steps. The work itself does not change; the substrate's awareness of the work changes. This means refinement is mostly lossless from the operator's perspective — they don't lose flexibility, because override paths preserve their ability to do what they were doing before — but the substrate gains the ability to track sub-work separately, to engage different executors on different sub-steps, and to support automation later.

Refinement is also an act of discovery. When the operator tries to articulate sub-work, they sometimes find their tacit understanding was less clear than they thought, or different from what they'd have said abstractly. The articulation clarifies the work for the operator as well as for the substrate.

### 4. Formalization is a gradient, not a binary

Every step in the substrate sits on a gradient from pure narrative to fully refined with automated execution. The substrate must support all levels simultaneously, including within a single workflow.

The levels are roughly: a step exists with a narrative description and a human executor; the step's work is articulated into sub-steps as demand calls for it; sub-steps gain their own narratives, then their own sub-steps if needed; executors are added to sub-steps as demand for delegation surfaces; executors are engaged when the user is ready. Higher levels do not replace lower levels; they layer on top. The lower levels remain as fallback and as the basis for honest return to earlier states when later refinements or executors don't serve the work.

### 5. Three independent categories of change

Changes to a step fall into three categories that are independent of each other:

**Refinement changes** modify the step by creating sub-steps under it (or sub-steps under sub-steps, recursively). Refinement happens when demand for articulating the step's work surfaces — when the user repeatedly produces a value, repeatedly performs a check, repeatedly handles a case differently, or wants to delegate part of the work.

**Executor changes** modify which executors are available to a step (or sub-step). Adding an executor makes it available to do the work. Removing an executor takes it out of availability. The set of available executors is separate from which are currently running.

**Engagement changes** modify which available executors are actively running, and how they relate (which is primary, which are secondary). Engagement is the runtime question; the structure of available executors is independent of which ones are engaged on any given run. Different sub-steps of a parent step may have different executors engaged on the same run.

These three are independent. You can refine a step (by creating sub-steps) without touching executors. You can add an executor without engaging it. You can change engagement without modifying refinement or available executors. Operations on each category have their own mechanics, their own demand signals, and their own evidence requirements.

### 6. The terrain accumulates; the path is chosen at runtime

Refinements and executor additions shape the substrate's terrain — the space of paths that any given run can take through a workflow. Each run chooses its actual path through that terrain at runtime, based on the situation, the engaged executors, user choices in the moment, and policy. The existence of refinements or available executors does not compel their use on any particular run.

This is what allows the substrate to absorb informality without losing accumulated capacity. A run that needs to fall back to narrative because the articulated sub-steps don't fit the case can do so without damaging the refinement; the refinement remains available for the next run that does fit. A step with multiple available executors can have any subset of them engaged for a given run, with the choice depending on the situation. A sub-step that exists can be skipped when it doesn't apply.

### 7. Hand-off and hand-back must both be cheap

The substrate must make engagement changes cheap in both directions. Handing work off to a new executor — whether human, LLM, classifier, or encoded rule — is easy because users will do it often. Handing work back to a previous executor is equally easy, because any engagement can turn out to be wrong, and the substrate must support honest return when the current arrangement is not serving the work.

A step where work was handed off to an LLM but is now misbehaving must allow handing back to a human operator with a configuration change, not a rewrite. The substrate does not treat any executor type as a destination; it treats all of them as roles that can be filled, vacated, and refilled as demand requires.

### 8. The substrate supports three operating patterns naturally

A **fully-human run**, where every step's engaged executors are human operators. The substrate provides journaling, organization, context, and history; no automation is engaged. This is the default starting state and remains valid indefinitely.

A **mixed-executor run**, where different steps and sub-steps have different engaged executors. Some are human-executed, some are handled by LLMs, some by encoded rules. The substrate orchestrates the run across executor types without privileging any of them. Within a single parent step, different sub-steps may have different executors engaged.

A **parallel-engagement run**, where a single step has multiple engaged executors running simultaneously — one primary, one or more secondaries. The primary's output flows downstream; secondary outputs are recorded for comparison. This is not exclusively a transitional state; some work benefits from continued comparison as a check, and the substrate supports this as a stable configuration if the user chooses.

### 9. Executor types form a determinism gradient with distinct failure modes

Humans, LLMs, classifiers, and encoded rules differ on a determinism axis. Same input produces different output for humans, similar output for LLMs, identical output for classifiers within their distribution, and exactly identical output for rules. These differences determine what verification methods are meaningful, what monitoring is appropriate, and what failure modes to watch for.

The substrate must treat executor type as a first-class attribute and adjust its handling — replay, confidence capture, monitoring, hand-back triggers — based on the type. The substrate does not assume work will move in any particular direction along the gradient. Some work moves from human to LLM and stays there. Some work moves through several executor types and back to human. Some work is best served by parallel engagement across multiple executor types indefinitely.

### 10. Identity is mutable and consensual; the substrate retains its history

Identities for steps, entity types, contexts, lenses, and other substrate elements are not permanent keys. They can be renamed, merged with other identities (n-ary), split into multiple identities (n-ary), aliased under multiple names, and otherwise revised as the user's understanding of their own work evolves.

Identity operations are first-class events in the substrate's log, and they are non-destructive: a merge does not erase the merged-from identities; it records that they were folded together. A split preserves the original identity's history and partitions its runs across the resulting identities (or leaves some unassigned, attached to the original as legacy). A rename adds a new name as an alias rather than overwriting the old one.

More broadly, the substrate forbids destructive migration. Structural changes are always additive — recorded as new events on top of the immutable log — never destructive. Any prior state is reconstructable, any change is reversible by appending corrective events, and mistakes are correctable without loss. The cost is monotonically growing storage and the need for incremental projection strategies; the benefit is honesty about history, low-risk experimentation with change, and auditability by construction.

Genuine data deletion (for privacy, legal, or other reasons that require actual removal of information rather than retirement) is supported as a separately-considered, explicitly audited operation, distinct from the substrate's normal structural-change mechanics.

### 11. Lenses are first-class; unified language is one option, not the default

Different operators, roles, and contexts may have different vocabularies for the same underlying substrate elements. The substrate supports this through lenses — named perspectives that map their own vocabulary, their own property schemas, and their own visibility rules onto shared underlying identities.

Lenses can map one-to-one, one-to-many, many-to-one, or partially. Translations between lenses are explicit and visible operations. A "shared" or "common" lens is one valid lens among many; it is not privileged. The substrate does not force vocabulary unification on its users; it lets each operator or role retain their fluency while supporting cross-lens communication when needed.

For single-operator use, the lens mechanism is lightweight (essentially per-user name preferences). For multi-operator or organizational use, lenses become substantial, and the substrate's value as a coherence mechanism — without imposing a single vocabulary — becomes its central organizational benefit.

### 12. Structure has two sources: bottom-up observation and top-down priors

Structure can emerge from accumulated observation of actual work (bottom-up). Structure can also be proposed from LLM training data and other priors, conditioned on the artifacts and behavior the substrate observes (top-down). Both sources produce suggestions, not declarations. Both are subject to the same validation — acceptance, rejection, or modification by the user — and the same refinement by subsequent use.

Top-down priors give the substrate immediate value on novel artifacts and in unfamiliar domains. They are starting points, not commitments. Bottom-up observation corrects, refines, and personalizes the structure over time. The substrate's job is to blend the two sources gracefully, with the user always in control.

In both cases, the proposed structure is offered in response to inferred demand — the substrate isn't proposing structure for its own sake; it's proposing because it has reason to believe a demand exists that the structure would satisfy.

### 13. Provenance is captured everywhere, displayed when relevant

Every piece of substrate content carries its source: who or what proposed it, what evidence supports it, when it was created, what it was derived from. Provenance is the basis for calibrated trust — an LLM prior with no observation behind it is more questionable than a refinement that has been verified across many runs.

Provenance is captured for all substrate content but not always surfaced. The user sees provenance when it matters: when confidence is low, when something seems wrong, when conflicts arise, when audit is required. Routine use does not require attention to provenance, but provenance is always available when needed.

### 14. The system proposes; the user disposes

The substrate must never silently add refinement, add or remove executors, change engagement, or alter behavior without user consent. Every proposal — a suggested refinement, a suggested merge, a suggested executor change, a suggested association — is presented to the user for acceptance, rejection, or modification. Proposals frame the demand they're responding to, so the user can judge whether the demand applies. Rejected proposals are recorded; they are often the most informative signals about tacit constraints the substrate hadn't inferred, or about demands the substrate inferred wrongly.

Proposals are offers, not gates. The user can ignore them and continue working as before. Forcing the user to answer proposal questions before they can continue is a pacing failure.

When the substrate proposes parallel engagement — adding a second executor alongside an existing one for comparison — the user controls the duration, the comparison criteria, and the resolution. Parallel engagements do not auto-resolve. The comparison data accumulates, the substrate may surface what it observes, and the user decides whether to keep the parallel arrangement, change the primary, or end the parallel arrangement.

The system's aggressiveness — how often it proposes, how confident it must be before proposing, whether it requires explicit approval for each engagement change or can act on accumulated evidence — is a policy parameter that varies by context. Personal use may accept lighter-weight proposals; organizational use typically requires explicit approval and parallel-engagement periods before any change affects downstream work.

### 15. The event log is the source of truth

The substrate's state is an append-only log of events: runs starting and completing, refinements being added or retired, executors being added or removed, engagement changing, identities being merged or split, artifacts being uploaded or reclassified, proposals being made and resolved. All current views — the list of steps, the in-progress work, the history of a particular context — are projections over this log.

This is what makes the substrate honest about its own history. Decisions can be traced. Mistakes can be undone by appending corrective events, not by mutating prior state. The substrate's understanding of its own work is reconstructable from its log, which is the most fundamental form of auditability and the basis for trust over time.

### 16. The substrate captures context, not just content

Work happens in contexts: a particular case, a particular client, a particular event. Contexts are first-class — stable handles that runs, artifacts, and conversations associate with. The substrate's primary view is organized by context, showing the user what is in flight and what is outstanding within each one. Resuming work means selecting a context and seeing immediately what has been done, what artifacts are attached, what remains.

Contexts can overlap (a single piece of work may belong to multiple contexts). Contexts emerge from use; they need not be pre-declared. The substrate may propose context membership when new artifacts arrive, but assignment is always confirmable, revisable, and refusable.

### 17. The substrate must be useful as a journal alone

If the substrate provides no value before automation arrives, users will abandon it before automation arrives. The MVP must therefore be valuable as a structured, queryable, navigable record of work — better than spreadsheets, folders, or memory — independently of any automation. Automation is additive; the substrate's foundational value is journaling and organization.

The test: would a user continue using the substrate for six months even if no automation were ever added? If yes, the substrate has earned the right to pace and lead. If no, the substrate is selling a future that may never arrive.

### 18. Pacing is measured by acceptance, not by throughput

The substrate's success is not measured by how many steps have reached executable form, or how much human work has been handed off to automation. It is measured by whether the user continues to find the substrate useful, whether they accept the substrate's proposals, and whether they trust the substrate enough to let it lead.

When acceptance rate drops, the substrate should pace more carefully, not push harder. When the user rejects a class of proposals repeatedly, the substrate should learn from that and adjust. The relationship between substrate and user is collaborative, and the substrate's job is to maintain that collaboration over time.

## Test for any design decision

For any architectural choice, schema decision, or implementation approach, ask:

- What demand does this respond to? If none, the addition is premature.
- Does it require structure to be declared before work happens, or does it allow structure to emerge from work?
- Does it preserve informality at every level of refinement, or does it eventually force refinement?
- Does it treat the three categories of change (refinement, executor, engagement) as independent, or does it conflate them?
- Does it make hand-off and hand-back equally cheap, or does it bias toward irreversible engagement changes?
- Does it support multiple operating patterns (fully-human, mixed-executor, parallel-engagement) as equally valid, or does it privilege one?
- Does it accommodate multiple lenses on the same underlying substrate, or does it force vocabulary unification?
- Does it capture provenance for every piece of content, or does it lose the source of decisions?
- Does it let the user dispose of every proposal, or does it impose change silently?
- Does it produce value as a journal alone, or does it require automation to be useful?
- Does it measure success by acceptance, or by automation throughput?

A design decision that fails any of these tests is off-substrate. It may produce something useful, but it will not produce the system this document describes.

## What this substrate is not

This substrate is not a workflow engine in the conventional sense. Conventional workflow engines start from declared process definitions and treat deviation as exception. This substrate starts from actual practice and treats refinement as emergent and demand-driven.

This substrate is not a domain-specific tool. Domain knowledge enters through priors, traces, and user input — never through hardcoded models. The same substrate serves home medical reconciliation, services-business operations, legal case management, and any other domain where work begins informally.

This substrate is not an automation platform first. It is a journal first, an organizational system second, a proposal mechanism third, and an automation platform fourth. The ordering matters.

This substrate is not a replacement for human judgment. Humans are first-class executors throughout. Automation is the substrate's gradually-earned ability to take over specific, well-understood, well-bounded pieces of work — never the whole.

---

# Scenarios

The following scenarios illustrate the principles using a concrete example: Steve reconciling EOB lines for his family's medical claims. Each scenario shows one step at one moment in time, what's true about it, and what kind of change is occurring.

## Scenario 1: Initial step exists

Steve creates a step called `reconcile_line`. Its description is one paragraph of prose: "Look at the line on the EOB, find the matching line on the superbill, check that the charge code, billed amount, allowed amount, and patient responsibility all make sense. Write down what you find."

When Steve runs the step, the substrate shows him the description and a text box. He types: "Line 3, facility fee, looks fine, $450 matches superbill, allowed amount per my plan is correct."

- **Step state:** narrative description only, no sub-steps
- **Executors:** Steve
- **Engagement:** Steve, sole executor
- **Demand driving the change:** Steve needed a place to track this work
- **Change from prior:** initial creation

## Scenario 2: Refinement — sub-step added for amount

After 20 runs, Steve realizes he always extracts an amount from the EOB and writes it in his output. He creates a sub-step under `reconcile_line` called `extract_amount`. Its description: "Find the amount on the EOB line."

When Steve runs `reconcile_line` now, the substrate shows him the parent description, and within it, the `extract_amount` sub-step is visible. He fills in the amount as part of doing the parent.

- **Step state:** narrative description + one sub-step (`extract_amount`)
- **Executors on parent:** Steve
- **Executors on sub-step:** Steve
- **Engagement:** Steve, on both
- **Demand driving the change:** pull demand — Steve keeps needing amount, wants it tracked as its own piece
- **Change from prior:** refinement (sub-step added)

## Scenario 3: Refinement — sub-step gets more articulation

Steve refines `extract_amount` itself. He adds a note that the amount should be a number, and that he's specifically looking at the "billed amount" column of the EOB. The sub-step now has a tighter description.

Nothing else has changed. Steve still does the work. But the sub-step is now articulated enough that someone else (or something else) could plausibly do it.

- **Step state:** parent narrative + one sub-step with tighter narrative
- **Executors on parent:** Steve
- **Executors on sub-step:** Steve
- **Engagement:** Steve, on both
- **Demand driving the change:** push demand — Steve is thinking about delegating, the sub-step needs to be clear enough
- **Change from prior:** refinement (sub-step's narrative tightened)

## Scenario 4: Executor added but not engaged

Steve's son writes a script that extracts billed amounts from EOB PDFs. They add it as an available executor on the `extract_amount` sub-step. Nothing changes about how runs happen — Steve still does the extraction by hand. The script exists as an option the substrate knows about, available for engagement later.

- **Step state:** unchanged
- **Executors on parent:** Steve
- **Executors on sub-step:** Steve, script
- **Engagement:** Steve, sole executor on both
- **Demand driving the change:** push demand — Steve wants the option to delegate, even before committing to use it
- **Change from prior:** executor added (no engagement change)

## Scenario 5: Executor engaged as secondary

Steve engages the script as a secondary executor on `extract_amount`. Now when he runs `reconcile_line`, the sub-step has both executors running: Steve does the extraction (primary), the script does it too (secondary). The substrate records both outputs and shows the comparison. Steve's value flows into the parent step's output; the script's value is observed.

He does this for 30 runs. The script agrees with him 28 times. On the two disagreements, he was right once and the script was right once.

- **Step state:** unchanged
- **Executors on sub-step:** Steve (primary), script (secondary)
- **Engagement:** parallel
- **Demand driving the change:** push demand — Steve wants to see if the script is reliable before trusting it
- **Change from prior:** engagement change (parallel engagement initiated)

## Scenario 6: Primary swapped

Steve flips the designation on `extract_amount`. The script now runs first and produces the value; Steve reviews and corrects when needed. The script's output flows into the parent step by default; Steve's role on this sub-step is oversight.

- **Step state:** unchanged
- **Executors on sub-step:** script (primary), Steve (secondary)
- **Engagement:** parallel, with swapped primary
- **Demand driving the change:** push demand — comparison data justified the swap, Steve wants relief from doing the extraction
- **Change from prior:** engagement change (primary swapped)

## Scenario 7: Hand-back

A new carrier sends EOBs in a different layout. The script can't read them and produces garbage. Steve flips back: he's primary again on `extract_amount`, the script is secondary or disengaged.

The sub-step's articulation is unchanged. The script is still an available executor. Just not the one driving outputs right now.

- **Step state:** unchanged
- **Executors on sub-step:** Steve (primary), script (secondary or disengaged)
- **Engagement:** Steve primary; secondary either still observing or off
- **Demand driving the change:** pull demand — Steve needs the work done correctly, the current arrangement isn't doing that
- **Change from prior:** engagement change (hand-back)

## Scenario 8: Sub-step retired

After a year, Steve realizes he no longer needs `extract_amount` as a separate sub-step. The script has been disengaged for months; he just writes the amount into his parent step's notes when it's relevant, and most of the time it isn't. He retires the sub-step.

Past runs that referenced `extract_amount` retain their values in the log. New runs of `reconcile_line` no longer show the sub-step. If it turns out to matter again later, it can be unretired.

- **Step state:** sub-step retired (preserved in log)
- **Executors on retired sub-step:** still recorded in log (Steve, script)
- **Engagement:** N/A on retired sub-step
- **Demand driving the change:** the demand that prompted the sub-step has subsided
- **Change from prior:** refinement (sub-step retired)

## Looking across the eight scenarios

The three categories of change are visible cleanly:

- **Refinement changes** (scenarios 2, 3, 8): creating or refining or retiring sub-steps. Each one responds to a specific demand — pull demand for tracking, push demand for delegation, or a demand subsiding.
- **Executor changes** (scenario 4): adding an available executor without engaging it. Push demand for future delegation.
- **Engagement changes** (scenarios 5, 6, 7): which executors are running, and which is primary. Some respond to push demand (engaging the script), some to pull demand (handing back when reliability is needed).

Every change has a clear answer to "what demand drove this?" If a scenario couldn't articulate the demand, it would be premature.

The recursion is uniform. If Steve wanted to refine `extract_amount` further — say, into `find_billed_amount_column` and `read_value_from_column` — that's just more sub-steps under it. Same vocabulary, same operations.

Engagement-per-sub-step works naturally. A single run of `reconcile_line` might have Steve doing the parent-level reconciliation judgment, the script doing `extract_amount`, and a rule eventually doing `verify_charge_code`. Each sub-step has its own executor engagement; the parent step aggregates the work.
