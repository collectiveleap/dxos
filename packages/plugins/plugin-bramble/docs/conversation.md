# Conversation: Evolving Sociotechnical Systems

This document captures the full conversation that led to the principles for an evolving sociotechnical substrate.

---

## Initial framing

**User:** Here's what I'm trying to accomplish

The job is to evolve sociotechnical systems from their current implementation to new implementations, likely based on newer technologies.

For instance:

there is a current sociotechical system where a patient receives an EOB and a bill from a provider, manually reconciles, manually compares against their policy and the current status of their deductibles and out-of-pocket maximum and then may take an action like requesting a refund due to finding an error.

an evolved version of that might automate the comparison of EOB and a bill

a subsequent evolution might automate comparing with policy

a subsequent evolution might automate taking action

etc.

I am looking for a formal, semi-formal way to describe the current version of that sociotechnical system then express what the next step(s) in their evolution should look like

**Claude:** This is a rich design problem. There are a few established formalisms that fit, and they cluster into three families depending on what you want to optimize for.

**Sociotechnical Systems (STS) modeling** is the closest match by name. The classic framework decomposes a system into the social subsystem (people, roles, norms, incentives) and the technical subsystem (tools, data, automation), then maps the *joint optimization* between them. For evolution specifically, look at Baxter & Sommerville's "Socio-technical Systems Engineering" or the more recent STS-MC (Method for Change). They give you a vocabulary — actors, artifacts, tasks, dependencies — but they're descriptive, not great at expressing "next step."

**Task allocation / function allocation models** are more useful for your evolution question. The key one is Parasuraman, Sheridan & Wickens' *Levels of Automation* (2000), which gives a 10-point scale from "human does everything" to "computer acts autonomously and ignores the human." You can pair this with their 4-stage model — information acquisition, information analysis, decision selection, action implementation — and grade each stage independently. Your EOB example maps cleanly: today the patient is at LOA 1 across all four stages; "automate the comparison" moves stages 1–2 to LOA 6 or 7 while leaving 3–4 at LOA 1. This is the most precise way I know to say "what the next step looks like."

**Process notations with automation annotations** are the semi-formal layer on top. BPMN with lanes for human vs system actors lets you draw the current flow and the target flow side by side; you can literally see swimlane responsibilities migrate. CMMN (Case Management Model and Notation) is better when the work is non-linear and judgment-driven, which healthcare reconciliation often is. For something more lightweight, Wardley Maps let you plot each component on a genesis→commodity axis and show evolution as arrows — useful for portfolio-level conversations about which capabilities are ready to automate.

If I were building this for real, I'd combine two layers: a BPMN or CMMN diagram of the current state with human/system swimlanes, annotated at each task with a Parasuraman LOA score per stage. The "next evolution" is then expressible as a diff — which tasks change swimlanes, which LOA scores increase, and what new artifacts (APIs, data contracts) the technical side must provide.

Want me to sketch what that combined notation would look like for your EOB example? It would make the abstraction concrete and you could judge whether it has the expressive power you need.

---

## Phoenix-style executable specification

**User:** An idealized use of this looks something like
- 1) capture the current system
- 2) describe the next evolution
   - use Phoenix Architecture-like specification to generate an implementation of an automated part
- 3)describe the next evolution
   - use Phoenix Architecture-like again for next automated part
- etc

Or additionally, use Phoenix Architecture-like at step 1) so that it generated an implementation of the whole current sociotechnical system so that what gets generated for all the manual parts (all in the case of step 1) are instructions for a human operator

Effectively this would be using Phoenix to pace the current implementation (at step 1) and incrementally migrate to more/full automation through evolutionary steps. All while the sociotechnical system continued to operate

**Claude:** This is a really interesting architectural pattern. Let me make sure I'm tracking, then push on it.

What you're describing is using a Phoenix-style executable specification as the *substrate* for the entire sociotechnical system, where "implementation" is polymorphic over human and machine executors. At step 1, every node in the spec compiles to either a runbook for a human operator or a service call; at each evolution step, you swap human-targeted nodes for machine-targeted ones without changing the spec's shape. The spec is the invariant; the executor mix is what evolves.

That's a strong idea, and I think it works — but only if the specification language treats human work as a first-class execution target rather than as "the gap where automation isn't yet." A few things have to be true for it to hold together:

**Uniform interface contracts.** Every step needs the same shape regardless of executor: typed inputs, typed outputs, preconditions, postconditions, idempotency semantics, failure modes, SLA. A human reconciling an EOB must produce the same output schema as the service that will eventually replace them. Otherwise migration is a rewrite, not a swap. This is the hardest part culturally — humans resist being asked to emit structured output — but it's what makes the substitution clean.

**Executor-agnostic orchestration.** The Phoenix-style runtime (workflow engine, saga coordinator, whatever) shouldn't care whether a step is fulfilled by a Lambda or a person clicking through a checklist. Temporal, Camunda, and Conductor all support this pattern explicitly — they call it "user tasks" or "human tasks" — and treat a human as just another worker that polls a queue, does work, and posts a result. That's exactly the primitive you want.

**Observability parity.** Every step emits the same telemetry: started, completed, duration, errors, output payload. When a human does it, the runbook UI captures this. When a service does it, the SDK does. This is what lets you measure the gain from each evolution step and detect regressions when you flip a step from human to machine.

**Reversibility.** Critical and under-discussed: you need to be able to *demote* a step back to human execution if the automation misbehaves. The substrate should support this as a config flag, not a code change. This is what makes the migration safe enough to do incrementally in production.

The closest things I've seen in practice: BPMN engines with user tasks are the conservative version, Temporal with human-in-the-loop activities is the modern version, and there's a small body of work on "human-as-a-service" patterns (Mechanical Turk's API was an early example — humans behind a REST endpoint with typed I/O). None of them are quite what you're describing, because they treat humans as an exception path, not as the default executor that automation gradually displaces.

The intellectually honest framing for what you're building: it's a *capability maturity migration framework* where the specification is stable and executors are pluggable. The Parasuraman LOA score I mentioned earlier becomes a per-step attribute in the spec, and "next evolution" is a diff that raises LOA on selected steps by substituting their executor binding.

One question worth pressuring: at step 1, when everything is human-executed, is the Phoenix-style spec actually *generating* the runbook, or is it just *documenting* what the runbook should contain? Those are very different. The first is powerful — you change the spec, the runbooks regenerate, training materials regenerate, the audit trail regenerates. The second is just architecture-as-documentation, which decays. If you want the full leverage of the pattern, you want the first: a single source of truth that compiles to human-readable procedures, machine-executable code, monitoring dashboards, and compliance artifacts simultaneously.

Does that match what you're reaching for, or are you thinking about it differently?

---

## Pace-and-lead with informality

**User:** Yes, this is getting close - step 1 (or maybe a step 0) has to be documenting whats done manually. Imagine using this in a legacy environment with a manual or mixed manual and automated implementation. The notion is to pace the current implementation the lead to to a better implementation (pace-and-lead ala NLP). So the system must capable of adapting to the informalities a human will produce - that can't be an error condition it has to be worked with

**Claude:** Yes — this is the crux, and it changes the architecture significantly. Let me reframe.

What you're describing is closer to *ethnographic capture compiled into executable form*, not specification-first design. The system has to ingest reality as it is — including informality, undocumented workarounds, the tacit knowledge that makes the current system actually function — and then progressively formalize it without ever rejecting input as malformed. That's a fundamentally different stance than most workflow tools, which start from a normative model and treat deviation as exception.

A few principles fall out of taking pace-and-lead seriously as an architectural commitment:

**Tolerant input, progressive structure.** Step 0 has to accept free-text descriptions, screenshots of spreadsheets, recorded screen-shares, "I usually just call Janice" as a valid step definition. The substrate's job at this stage is mostly to *witness* and assign stable identity to things — this step exists, it has these rough inputs and outputs, it's done by this role, it takes roughly this long. Schemas emerge from observation, not the other way around. Think Datalog-style "facts accumulate, structure crystallizes" rather than "define the type, then populate it."

**Variance as signal, not error.** When Janice does the reconciliation three different ways depending on the payer, that's not noise to be normalized away — it's the actual structure of the work, and it's what any future automation has to handle. The substrate should record variance and surface it, not suppress it. The pacing move is "I see you do this differently for Aetna; here's the pattern I noticed, does that match?" The leading move comes later: "should we encode that as a branch?"

**Confidence-graded execution.** Every step in the spec has a formalization level: pure narrative, semi-structured checklist, structured procedure with typed I/O, machine-executable. Steps can sit at any level indefinitely. Evolution is movement up this gradient, but the runtime doesn't require uniformity — a workflow can have one fully-automated step feeding a narrative step feeding a structured step. This is the part most workflow engines can't do; they require structural commitment up front.

**The system learns from execution.** Each run produces traces: what the human actually did, what inputs they actually consulted, what outputs they actually produced, where they deviated from the documented version. Those traces are the raw material for the next formalization pass. This is where LLMs become genuinely useful as part of the substrate — not to execute the work, but to propose structure from observed traces: "across 40 runs, this step always consults these three documents and produces output in one of these two shapes. Want to lift it to semi-structured?"

**Lead gently, with consent.** The system proposes the next formalization; the humans accept, modify, or reject. Rejected proposals are recorded — they're often the most informative data, because they reveal tacit constraints the system hadn't inferred. This is the NLP pacing move made architectural: match first, then suggest, then move only when the suggestion is accepted.

The conceptual ancestors worth mining: **CSCW's "articulation work"** literature (Suchman, Schmidt) has the best vocabulary for the informal labor that holds sociotechnical systems together and is usually invisible to formal models. **End-user development** and **programming-by-demonstration** research (Cypher, Lieberman) addresses the "watch what the human does, propose a generalization" loop directly. **Cognitive Work Analysis** (Vicente) gives you a way to model the constraints the work has to satisfy without prescribing how — which is exactly what you want when humans are still doing it their way. And on the runtime side, **event sourcing** is the right persistence model: append-only facts about what happened, with the current "spec" being a projection that can be recomputed as understanding improves.

The honest framing of what you're building, then: a substrate that treats the specification as a *living projection* over an event log of actual work, where formalization is a gradient rather than a binary, and where the system's job is to pace human practice closely enough to be useful today and lead it gradually toward forms that automation can take over. Phoenix-style generation happens continuously, but what gets generated at each level of formalization is different — runbooks and checklists at the low end, executable services at the high end, and the same spec produces both.

The hard research question buried in this: what's the *notation* that can express all formalization levels in one artifact? BPMN can't — it requires commitment. Temporal workflows can't — they require code. You probably need something new, or a layered notation where each layer is a refinement of the one below and the runtime knows how to execute partial specifications by falling back to human operators for the unfilled parts.

Is that closer? And if so — do you want to dig into the notation problem, or into the trace-to-proposal loop that drives the leading?

---

## Notation and runtime sketch

**User:** Yes that matches my pov

**Claude:** Good. Then the question is which thread to pull, because the notation problem and the trace-to-proposal loop are genuinely different design problems and they constrain each other.

My instinct is that the notation problem is upstream and worth attacking first, because the trace-to-proposal loop's output has to land somewhere — it proposes *changes to the spec*, so the spec's shape determines what proposals are even expressible. If the notation can't represent "this step is 60% structured with a narrative fallback for the Aetna case," then the loop can't propose that state, and you've quietly forced premature formalization through the back door.

Here's the sketch I'd start from for the notation, and then I want to hear where it breaks for your domain.

The core object is a **step**, and a step has a *formalization stack* rather than a single definition. At the bottom of the stack is always narrative — a human-readable description of intent, inputs, outputs, and known variance. Above that, optionally, sits a semi-structured layer: named inputs and outputs with example values, a checklist of substeps, decision points with observed branches. Above that, optionally, a structured layer: typed I/O schemas, explicit preconditions and postconditions, branch predicates. Above that, optionally, an executable layer: code or service binding that satisfies the structured contract.

The runtime executes the *highest available layer* for which it has an executor. If the executable layer exists and is enabled, it runs. If not, it falls through to structured, which renders as a form for a human. If not, semi-structured renders as a checklist. If not, narrative renders as "here's what this step is about, do your thing, tell me what happened." Crucially, a higher layer being present doesn't delete the lower layers — they remain as the fallback path and as the documentation that explains *why* the executable does what it does. Demotion is just "disable the executable layer," and you're back to humans with full context.

The spec as a whole is a graph of steps with dataflow and control-flow edges, where edges themselves have formalization levels — "after reconciliation, somehow the result gets to billing" is a valid narrative edge; "reconciliation.output flows to billing.input via this transform" is a structured edge.

Three properties this notation needs that conventional ones lack:

**Partial executability.** The runtime can execute a workflow where some steps are code, some are forms, some are checklists, some are "go figure it out and come back." This is mostly a workflow-engine concern — Temporal-ish — but the type system has to accept "unknown shape, will be narrated" as a legitimate value, which most type systems refuse.

**Variance as a first-class construct.** Not just branches with predicates, but *observed variants* that haven't yet been lifted to predicates. A step can declare "I have three observed variants, here's a narrative description of each, the system hasn't figured out which conditions trigger which." Execution picks a variant by asking the human or by a learned classifier once one exists. Predicates emerge from accumulated traces.

**Provenance everywhere.** Every element of the spec carries where it came from — observed from traces, proposed by the system and accepted, written by a human, inferred from a similar workflow. This is what makes the leading move legible and reversible. When something breaks, you can ask "who put this here and on what evidence."

If I had to point at the nearest existing thing, it's a blend of **literate programming** (Knuth's idea that prose and code are co-equal artifacts), **event-sourced CQRS** (the spec is a projection over a log), and **gradual typing** (formalization is opt-in per element, and the runtime handles the mixed state). None of those individually give you what you need, but the combination is suggestive.

Where I'd expect this to break in your healthcare domain specifically: regulatory and audit constraints probably demand that *some* steps be at the structured level or higher from day one, even if the humans are still executing them. PHI handling, consent capture, anything touching a clinical decision. So the notation needs a "minimum formalization level" annotation per step, set by policy rather than by evolution — and the runtime refuses to execute the step at a lower level even if that's what the trace suggests. The pacing has a floor.

Two questions back to you before I go further:

First, when you say the system has to adapt to informality without erroring — do you mean at the *capture* layer only (humans describe their work loosely and the system accepts it), or also at the *runtime* layer (a human executing a step today produces a loose output and downstream steps have to cope)? Those are very different problems. The first is a UX and ingestion problem. The second means every consumer of a step's output has to handle narrative input, which pushes a lot of complexity into the structured-layer code that has to bridge from "Janice wrote 'looks fine to me' in a text box" to a typed value.

Second, what's the failure mode you're most worried about — the system being too rigid and getting rejected by the humans who have to use it, or the system being too loose and never actually producing automation gains? Because the notation leans differently depending on which risk you're optimizing against.

---

## Runtime informality and lift edges

**User:** Re: regulatory and audit constraints: this is tuned to a specific environment For example
- i do this at home with my private content, any tooling i use is owned by me (e.g. open source i run in my own environment, local first so theres no transfer of liability)
- we do this with an existing company, they have a current solution that addresses compliance, it may or may not be credible; the tooling we use to do this might be a point of transferring liability (i.e. if they purchased this tool from a vendor and the tooling enabled lack of compliance then this might transfer liability; flag, but defer this issue)

Does system have to adapt to informality without erroring: must be also at runtime

Failure mode I'm most concerned with: system unable to co-work with the humans well enough to pace-then-lead

**Claude:** Good. The runtime-informality answer is the one that actually constrains the architecture, so let me work through it, and then the failure-mode answer tells me where to put the design weight.

Runtime informality means the output of any step can be lower-formality than the input the next step expects. That's the hard case. The wrong answer is to make every consumer parse narrative — that distributes the bridging logic everywhere and guarantees it'll be inconsistent. The right answer, I think, is to make *the edge* between steps a first-class object that carries its own formalization level, with explicit *lift* and *lower* operations.

Concretely: when Janice finishes reconciliation and types "looks fine, refund $43 to patient," that output lands on the edge as a narrative payload. The edge's job is to present that payload to the next step in whatever form the next step can consume. If the next step is also human, the narrative passes through untouched — humans are great at reading "looks fine, refund $43." If the next step is structured (say, an automated refund-initiation service that needs `{action: "refund", amount: 43.00, currency: "USD"}`), the edge has to *lift* the narrative to structured. That lift is itself a step in the graph, with its own formalization stack. Today it's a human ("hey, can you confirm: refund of $43?"). Tomorrow it's an LLM extraction with human confirmation. Eventually it's a learned extractor with confidence thresholds that only escalates ambiguous cases.

This matters because it relocates the messiness. The bridge between informal and formal is *explicit, named, and individually evolvable*, rather than smeared across every consumer. It also means the trace-to-proposal loop has something concrete to work on: every lift edge is a candidate for automation, and you can measure how often each one currently requires human intervention. The lift edges become the prioritization signal for where to invest in automation next.

The dual case — lowering, where structured output feeds a narrative-consuming step — is mostly trivial (render to text), but worth naming for symmetry.

A second runtime concern that falls out of this: **eventual structure**. A step can emit a narrative payload now and the edge can stay un-lifted indefinitely, but downstream there might be a step that *eventually* needs the structured form — say, the month-end audit report that aggregates refund amounts. The notation needs to express deferred lifts: "this narrative will need to become structured before the audit step runs, but not before." That gives humans slack to be informal in the moment while preserving the system's ability to produce formal artifacts when required. In practice this looks like a queue of pending lifts that get resolved lazily, by humans or by extractors, before any consumer that requires the structured form.

Now to your failure mode, which is the one I'd have picked too. "System unable to co-work with humans well enough to pace-then-lead" means the design weight goes on **legibility and consent**, not on automation throughput. Some implications:

The system has to be *visibly* learning *from* the humans rather than *replacing* them. Every proposal it makes ("I noticed you do this differently for Aetna — should I encode that?") needs to be traceable back to specific observed instances ("here are the 12 runs I'm basing this on, you can see them"). Opacity kills the relationship. This is where event-sourcing earns its keep architecturally — the system can always show its work.

Pacing has to be measured in *human comfort*, not in formalization level. The metric isn't "how many steps reached executable" but "how often does the human accept the system's proposals, and how often do they reject and why." Rejection rate going up is a signal to slow down, not push harder. A healthy system probably has a stable mix of formalization levels across its steps, with movement happening only where the humans are ready for it.

The system needs a *strong* "this is wrong, go back" affordance, available at every layer. Not just "demote this step from executable to structured," but "the structured schema you inferred is wrong, here's how it's actually shaped" and "the variant classifier is miscategorizing, stop using it." If those affordances are clumsy, humans will route around the system rather than correct it, and then you've lost the trace data that drives leading.

And — this is the subtle one — the system has to be willing to *un-formalize*. If a step was lifted to structured and the structure turns out to be wrong, you don't fix it by patching the schema, you demote back to narrative, accumulate more traces, and re-propose. Most workflow tools can't do this; their schemas are sticky because downstream consumers depend on them. Your notation has to make demotion as cheap as promotion, which is part of why the formalization stack keeps the lower layers around even when higher layers are active.

One last thing worth flagging because it sits at the intersection of your two answers: in the home/private case, you can iterate fast and absorb the cost of bad proposals because the only human being paced is you. In the company case, a bad proposal that gets accepted and runs in production can degrade trust across an organization in a way that's very hard to recover from. So the leading move probably needs an adjustable aggressiveness — at home you might let the system auto-promote on three consecutive accepted variants, at a company it might require explicit human approval per promotion plus a shadow period where the new executable runs alongside the human and outputs are compared before cutover. Same notation, different policies on top.

Where I'd want to go next, in priority order: sketch the lift-edge primitive in enough detail to know whether it actually composes (I suspect there are subtleties around partial lifts and confidence propagation that bite), and then figure out what the smallest viable runtime looks like — what an MVP substrate would have to support to run *one* real workflow end-to-end at step 0, with everything narrative, and earn the right to propose its first lift. The second is more concrete and probably more useful to ground the design.

Which one do you want to take first?

---

## Single-operator case and shadow execution

**User:** The initial, and simpler, case is a single person doing the whole EOB reconciliation for their family - not as a business. For instance, start with one person (e.g. me - Steve) doing it for a while, and then lifting it up over time; might evolve to have another person do one or more human steps (e.g. Kathy) therefore needing a bridge specific to Steve then a different bridge specific to Kathy (all still in the context of that 1 family).

The shadow / parallel promotion is like the architectural pattern to avoid a big-bang change where two systems are run at the same time (old and new) and comparisons on the outputs and eventual shifting from old to new based on the results

Keep going in the order you suggesed

**Claude:** Good. The single-operator case actually sharpens the design rather than simplifying it away, because it strips out the multi-stakeholder governance noise and forces you to confront the substrate's core mechanics. And the Kathy-as-second-operator evolution is exactly the right stress test — it's where you discover whether your "bridge" abstraction is really about person-specific adaptation or about something more fundamental.

Let me take the lift-edge primitive first, then the MVP runtime.

### The lift-edge primitive

The naive picture is that an edge between two steps carries a payload, and a lift is a transformation from a lower-formality payload to a higher-formality one. That's mostly right, but it papers over four things that turn out to matter.

**Lifts are partial.** When Steve types "looks fine, refund $43," the lift to `{action: "refund", amount: 43.00}` is pretty confident. When Steve types "the Aetna thing again, handled it," the lift might extract `{payer: "Aetna"}` and leave `action` and `amount` as unresolved holes. The edge has to carry partially-lifted payloads — some fields structured, some still narrative, some explicitly marked unknown. The downstream step then sees a payload with known shape but missing fields, and either it can proceed (if the missing fields aren't required for its current formalization level), or it triggers a *targeted* lift that asks Steve specifically about the missing fields rather than re-asking the whole thing. This is much more humane than "the extraction failed, please fill out this form."

**Lifts have provenance and confidence.** Each lifted field carries metadata: who or what produced it (Steve directly, an LLM extraction, a learned classifier, a default rule), what evidence supports it (the source narrative span, the prior runs it was inferred from), and how confident the producer is. Confidence isn't just a number — it's used downstream for routing decisions ("if any field is below 0.8, escalate to human review before the refund executes"). In the home case you might run wide-open with low thresholds; in a company case the thresholds are part of the policy layer.

**Lifts are reversible and revisable.** A lifted payload retains its original narrative form. If Steve later notices the lift extracted `$43` when he meant `$48`, he edits the narrative or the structured form, and the edge re-propagates downstream. This is event-sourcing showing up at the edge level: the payload has a history, not just a current value. It also means that when the system proposes a better extractor later, it can re-run lifts against historical narratives and show Steve "here's what I would have produced for the last 30 runs — does this look right?" That's a much stronger basis for promotion than testing against synthetic data.

**Lifts can be deferred.** As mentioned earlier, some downstream consumers don't need the structured form immediately. The edge marks the lift as pending, and the runtime resolves it lazily — either when a consumer that requires structure pulls on the edge, or on a schedule (nightly batch of pending lifts), or when the human happens to be in the system doing something adjacent. Deferral is what gives humans the slack to be informal in the moment.

Now the Kathy case. When Kathy starts doing reconciliation, the question is: does the *step* change, or does the *lift* change, or does something else change? My answer is that the step's contract — its narrative description, its inputs, its outputs — stays the same, because the work is the same. What changes is the *lift edge* downstream of Kathy's output, because Kathy's narrative idioms differ from Steve's. Steve writes "looks fine, refund $43"; Kathy writes "approved $43 patient refund." Same semantic content, different surface form. The lift edge needs operator-specific extraction.

This tells you the bridge isn't a separate concept — it's *parameterization of the lift*. Each lift has an operator dimension, and the system learns per-operator extraction patterns. When Kathy does the work for the first time, the lift falls back to a generic extractor (or asks her to confirm), and over time accumulates Kathy-specific patterns. When Steve does it, his patterns apply. This generalizes: when an LLM operator does it, the patterns are about LLM output idioms; when a service operator does it, the lift is the identity function because the output is already structured.

The implication is clean: **operators and lifts are co-evolving**. A step has multiple possible executors (Steve, Kathy, LLM, service), and each executor has its own associated lift to bring its output up to the edge's required formalization. Promoting a step from human to automated isn't "replace the step with code" — it's "add a new executor to the step, with its own lift, and shift traffic to it once the comparison shows parity."

This is also where the shadow/parallel pattern you mentioned slots in naturally. Shadow execution means: when a step runs, route the input to *both* the current executor and a candidate executor, compare their lifted outputs at the edge, and accumulate evidence. Only the current executor's output flows downstream; the candidate's output is just measured. Once the candidate's comparison metrics cross a policy-defined threshold, traffic shifts. Demotion is the same mechanism in reverse — if the candidate degrades after promotion, you can shadow the old executor and shift back. The lift-edge primitive makes this comparison meaningful, because both executors' outputs land in the same structured form regardless of whether they were produced from narrative or directly.

There's one subtle thing about Kathy worth flagging. If Steve has been doing the work for a year and the system has learned Steve-specific lift patterns, Kathy's first runs will have *worse* automation support than Steve's current runs, because the system doesn't know Kathy yet. The pacing has to be operator-aware: Kathy gets treated like a new operator at step 0, regardless of how mature Steve's path is. Otherwise you'll either make false-confident lifts on Kathy's narratives, or you'll annoy Kathy with confirmations the system doesn't need from Steve. The system has to model "how well do I know this operator on this step" separately from "how mature is this step overall."

### The MVP runtime

Now to grounding. The smallest thing you could build that lets Steve actually run his EOB reconciliation through this substrate, at step 0 with everything narrative, and earn the right to propose its first lift.

The minimum capabilities, I think, are:

A **step registry** where Steve can declare steps in pure narrative: a name, a description of intent, what triggers it, what it produces, who does it. No schemas required. Steps connect to other steps via narrative edges ("the output of this goes to that"). This is essentially a wiki with stable identities, but the identities are what let everything else accumulate.

An **execution log** that's append-only and event-sourced. When Steve runs a step, he opens it, sees the narrative description, does the work, types or pastes what he produced, and closes it. The log records: which step, when started, when finished, what inputs were available, what output was produced, any free-text notes. This is the raw material everything else feeds on. Critically, the log captures *what Steve actually consulted* — if he opened the EOB PDF and the bill PDF and his policy document, those are recorded as input artifacts to the run, even though at step 0 they're just attachments. Later, those become typed inputs.

A **runbook renderer** that turns the step's current formalization stack into something Steve actually uses. At step 0, this is "here's the narrative description, here's a text box for your output, here's an attachment area for any artifacts you used or produced." At higher formalization levels it renders forms, validations, etc. But the renderer is the same surface — Steve doesn't context-switch between "wiki mode" and "app mode" as steps mature. This matters more than it sounds, because the alternative is that early adoption uses a different tool from later adoption, and the migration cost between them kills the project.

A **trace viewer** where Steve can see his own history: "here are the last 20 reconciliations, here's how long they took, here's what you wrote each time." This is the feedback loop that makes the substrate feel valuable on day one even before any automation exists. It's also what makes proposals legible later — the system can highlight specific past runs as evidence for any structural suggestion.

A **proposal mechanism**, even if at MVP it's only manual. Steve can look at his traces and say "I notice I always write the EOB number in my output — let me lift that to a field." The system creates a semi-structured layer on the step with an `eob_number` field, and going forward the runbook renders a labeled input for that field alongside the free-text area. The free-text area never goes away. Historical narratives can be retroactively annotated with the new field, either by Steve doing a pass or by an extractor proposing values. Automated proposal — the system noticing patterns and suggesting lifts — is a later addition, but the *shape* of the mechanism has to be there from MVP because everything else depends on it.

What's pointedly *not* in the MVP: no scheduler, no triggers, no notifications, no automated executors of any kind, no integration with external systems, no multi-user concerns. Steve manually decides when to run a step, manually pulls in artifacts, manually advances state. The substrate is doing the minimum: giving stable identity to the work, recording what happens, and rendering whatever level of structure currently exists. Everything else is earned.

The reason I'd build it this thin is that it forces the question: does Steve actually use it? If the answer is yes — if even at this level it's better than the spreadsheet and folder of PDFs he had before — then you've validated that the substrate's core proposition (stable identity + accumulating structure + visible history) has value independent of automation. Every subsequent capability is then additive rather than load-bearing. If the answer is no, you've learned something cheap and early.

A test I'd apply: at MVP, can Steve add a new step to his workflow in under five minutes, and run it for the first time in under one minute? If those numbers blow out, the substrate is too heavy and humans will route around it. Pacing means the cost of being in the system is lower than the cost of doing the work outside it, even at step 0 when the system provides no automation.

The Kathy moment, when it comes, is the second forcing function. Can she be added as a second operator on selected steps without disrupting Steve's flow? Can her runbook view be tuned to her preferences without forking Steve's? Does the lift edge handle the dual-operator case cleanly? If yes, you've validated that the operator abstraction is right. If no, you've found the next thing to fix before you scale further.

Where I'd go next from here: probably either the policy layer (how aggressiveness, thresholds, and shadow durations get configured per step or per workflow, including your home-vs-company distinction), or the proposal generation loop in detail (what signals drive proposals, how they're scored, how they're presented). The policy layer is the boring-but-necessary one; the proposal loop is the interesting one. Which way?

---

## Granularity of real work: loops, nesting, discovery

**User:** Question: the manual reconciliation I've done looks something like this
- get bill or get EOB
- make sure i have super bill
- look at both docs and my history (e.g. 'when did we go to the ER' or 'when did I go to the doctor' or 'when did you have that procedure')
- now that I've got date of some procedure (visit, etc), look at EOB for that date and find the corresponding charge on super bill - for the charges on that single line are they correct (i.e. reconcile that 1 line)
- repeat for each line until completed for that procedure

Notice that there's lots of steps. How does MVP account for this

**Claude:** Good observation, and it gets at something the MVP design glossed over: the difference between *workflow granularity* and *step granularity*, and how the substrate handles work that's iterative, hierarchical, and dependent on memory across runs.

Let me work through your actual process and then say what the MVP needs to handle it.

What you described has at least three structural features that the four-step toy model didn't address:

**Loops with unknown cardinality.** "Repeat for each line until completed" — you don't know up front how many lines there are. The number is discovered as you do the work. This isn't a for-each over a known list; it's a while-loop with a human-judged termination condition.

**Nested work.** Reconciling one procedure contains within it reconciling each line of that procedure. There's a parent run ("reconcile the May ER visit") and child runs ("reconcile line 1: facility fee," "reconcile line 2: physician fee," etc.). The parent isn't complete until the children are, but the children's existence is discovered during the parent's execution.

**Cross-run memory and lookup.** "When did we go to the ER" — you're querying your own history, possibly across years, possibly across artifacts that aren't in the substrate at all (your memory, a text thread with Kathy, a calendar). The work involves *recall* as much as it involves processing the documents in front of you.

These aren't edge cases. They're the actual texture of reconciliation work, and any substrate that can't handle them will feel wrong from day one. So the MVP needs to address them, but in a way consistent with the pacing-first stance — meaning the substrate accommodates the structure without forcing Steve to formalize it before he's ready.

Here's how I'd handle each, staying within the MVP's spirit.

**Loops and nested work: runs can spawn child runs.** The data model needs one addition: a run can have a `parent_run_id`. That's it. When Steve is in the middle of running "reconcile the May ER visit" and realizes he needs to reconcile a specific line, he hits a button — "spawn child run" — picks the step type (could be the same step, "reconcile line," or a different one), and a child run opens. He does that work, completes it, and is returned to the parent. The parent run shows its children inline, and isn't marked complete until Steve says so.

This sidesteps the formalization question entirely. Steve doesn't have to declare upfront that "reconcile visit" contains a loop over "reconcile line." He just spawns children as needed.

Crucially, the substrate should not require Steve to define `reconcile_line` as a separate step ahead of time either. At MVP, "spawn child run" can let him create a step inline. The cost of adding structure is paid only when structure is needed.

**The discovery process: runs that are partly about finding inputs.** "Get bill or get EOB," "make sure I have superbill," "look at docs and my history to find the date" — these aren't really the *work* of reconciliation, they're the *setup* for reconciliation. The run executor surface includes an "inputs gathered" subsection where Steve can list, in free text, what he had to do to get the inputs together. This goes into the run's notes. Cost: 30 seconds of typing. Benefit: when the substrate later proposes to lift the work, this text is the raw material.

**Cross-run memory: the substrate as a queryable history.** "When did we go to the ER" is a question Steve asks his memory today, and he gets it wrong sometimes, which is part of why reconciliation is hard. The substrate has a unique opportunity here: if every visit, every EOB, every bill has been processed through it over time, then "when did we go to the ER" is a query, not a recall.

There's one subtle thing about "are these charges correct." That "are they correct" is doing a lot of work — it's not one check, it's at least four: is the charge code correct, is the billed amount what the provider charged, is the allowed amount correct per policy, is the patient responsibility correctly calculated. Over time, those four checks are independently liftable — the billed-amount check is the easiest to automate, the patient-responsibility check is the hardest.

---

## Emergent structure and identity

**User:** And the nested work will be more like: reconcile line 1: facility fee, line 2: another facility fee, line 3: a physician fee, line 4: another facility fee, line 5: a different physicians fee, etc.

Each of these will be discovered along the way

I may not know ahead of time there's such a step as 'reconcile line' - i might have to create it as i go (e.g. I might discover 'check if deductible is maxed out' mid-way through this, so it can't be pre-declared)

there's problems a point at which operator recognizes two different steps are the same ('check deductible' and 'see if deductible applies') - human could do it, LLM could do it, etc. and there's some notion of combining them - and inverse - maybe what was a single step actually later breaks out into two different steps

Cost of adding structure, refining structure is just-in-time, not upfront - is right

Discovery following the same informal->formal lift/demotion is right - also stages the possibility for automation (e.g. automation scanned email, found EOB and added it to setup contents, automation scanned email found provider bill and asked Steve to send this request to provider to get super bill, automation scanned calendar and found mention of Dr. visit, automation asked for Steve to access mychart and find appointment history, automation accessed MyChart and found appointment history, etc.)

During a run it seems a useful mechanism for the runner to recognize context, e.g. i may invoke runner and resume reconcilation and it knows there's an EOB and a procedure reconciliations that are in progress (e.g. i go to ER and all the different lines in an EOB and super bill are spread over more than one EOB and super bills so the reconciliation may be against an EOB and/or against the ER visit - knowing which is useful, knowing what context I'm in Ala "i'm reconciling the EOB i got in email on date X" is useful)

BTW: stop adding in any dev build design time estimates - it's irrelevant now

re: charges on a line - that reads as if theres sub-sub steps (reconcile visit -> reconcile line -> reconcile deductible, make sure charge code matches, etc) - all this needs to emerge as it's happening not ahead of time

**Claude:** Right. You've named several things that fundamentally reshape the substrate, not just decorate the MVP.

The through-line is this: **structure emerges during execution, not before it**. Steps, sub-steps, sub-sub-steps, prerequisites, edges, even the recognition that two things are the same thing — all of it crystallizes from doing the work, not from modeling the work in advance.

**Steps don't pre-exist their first instance.** In a conventional workflow system, you define a step, then you run it. The definition is prior. What you're describing is closer to: you start doing something, you give it a name partway through, you finish, and *now* the step exists — defined by what you just did. The first run is what creates the step definition, retroactively.

A run can exist without a pre-existing step definition. It has a name (which Steve types when he starts or when he names it later), a narrative description (which can be filled in during or after), and the actual work captured as it happens. When the run completes, the step definition is a *projection over the runs that share its identity*, not an artifact that was authored upfront.

**Mid-run discovery is a first-class operation.** Steve is in the middle of reconciling line 3 and realizes "wait, I need to check whether the deductible is maxed out." This is not "spawn a pre-defined child step." It's "I'm doing something new right now, give me a place to do it and we'll figure out what it was later."

The runner needs a "start a sub-activity" affordance that doesn't require naming, categorizing, or defining anything. Steve hits a button, gets a fresh space attached as a child of the current run, does the work, comes back. The sub-activity is captured. Later — maybe immediately after, maybe weeks later when reviewing — Steve (or the system) can name it, recognize it as a recurring pattern, recognize it as the same as something else, or leave it nameless if it was genuinely one-off.

**Step identity is contested and revisable.** "Check deductible" and "see if deductible applies" might be the same step or different steps. Two operations are first-class:

**Merge**: two step identities are declared to be the same. All runs that referenced either one now reference the merged identity. The merged step has a combined history.

**Split**: a single step identity is declared to actually be two. Past runs are partitioned between the two new identities.

**Sub-sub-step depth is unbounded and emergent.** When the system proposes lifts, it can propose them at any level of the hierarchy independently. `check_deductible` might lift to "LLM reads the policy doc and current claims, produces deductible state" long before `reconcile_visit` lifts at all.

**Context awareness during a run.** When Steve invokes the runner, it should show him "you have three reconciliations in progress — the May ER visit (started two weeks ago, 4 of 7 lines done), the March dental work, and a standalone reconciliation of the EOB you got in email last Tuesday. Which one are you working on?"

This argues for a substrate entity I hadn't included: **contexts** as a first-class concept. A context is something like "the May ER visit" or "the EOB from May 14, 2026" — a stable handle that runs can be associated with. Contexts can overlap.

**Automation's progression in setup, not just execution.** Setup work is just more steps, with their own evolution paths. `find_eob_for_visit` is a step. Today Steve runs it by checking his email manually. Tomorrow an automation watches his email and proposes "I found this PDF, looks like an EOB, want me to attach it to a context?"

---

## N-ary merge/split, lenses, and LLM-driven priors

**User:** A split or merge may be triggered when a new operator brings in their POV (e.g. Kathy);
Split might split into more than 2 parts
Merge might merge more than 2 parts

the relational structure between things (EOB, bill, super bill, procedure (ER visit), etc) has to be discovered in-flight, not pre-defined; however, structure might be proposed when the the system gets an artifacts (e.g. just uploaded an EOB it is probably related at least 1 or more procedures here…, uploaded a super bill it's probably related to one or more EOBs and procedures…)

**Claude:** Yes, and these three points each push on a different part of the architecture.

**N-ary merge and split, and operator-triggered identity revision.** A merge can fold three or more identities into one. A split can fan one identity into three or more. The data model and the operations have to be n-ary from the start.

The Kathy-triggered case surfaces something important: **identity is operator-relative until it's reconciled**. Steve has been doing reconciliation for two years and has settled into a vocabulary. Kathy joins and starts doing some of the same work, but she calls things differently.

If the substrate forces Kathy into Steve's vocabulary, you've broken pacing for her. If it lets her create parallel identities freely, you've fragmented the history. The right answer is to let her create her own identities and then *propose reconciliation*.

**Relational structure emerges, but with proposals on artifact arrival.** You're describing a substrate where the *entity model itself* — what kinds of things exist, how they relate — isn't pre-declared. When Steve uploads an EOB, the system says "this looks like an EOB; EOBs you've worked with before have related to procedures and to bills; want to associate this with one of your open procedure contexts?"

---

## Lenses as first-class

**User:** An interesting side effect of adding 2nd+ human operators and the split/merge is that a shared language would/could emerge (or could be captured because it exists outside the system already)

Imagine an entirely different use when this tool is in a services business and as more people (in different roles) join the system then the different perspectives a sales person has vs a marketing person has vs an client operations has could produce both a shared language AND/OR translations from different POV/lenses between people/roles (this has been a problem in many companies: coherence is lost as more people join, language specializes in a silo, failed translations between silos - e.g. each silo has their own idea of what to do, what a problem is). It's worth considering whether we a) drive to a unified language or b) enable different lenses on the same 'stuff' so that per-person / per-silo has their own language & it promotes lenses as 1st class items

Also an LLM is capable of suggesting schema, relationships against a PDF that is identified as an EOB given its existing training data (i.e. don't need to wait for runtime usage for this to emerge, can leverage information in the environment to suggest) - candidate suggestions that are validated by use, not in-advance declaration; same with steps - there can be some pre-seeding as the system recognizes what's being done, it might use its existing training data to suggest steps but not pre-define them. In all cases usage might start free-form and lift over time - but in parallel there might be suggestions informed from LLM training data

**Claude:** Both of these are significant.

**Lenses as first-class, not unification.** You've put your finger on a real failure mode in organizational software. The "drive to a unified language" path is the one most enterprise tools take, and it's why they fail in interesting ways.

The lens-first stance is the right answer. The underlying substrate has *things* — runs, contexts, artifacts, relationships — each with stable identity. A lens is a way of viewing and naming those things. Steve's lens calls something `reconcile_line`; Kathy's lens calls the same thing `check_one_thing`. Both names are valid. Both refer to the same underlying identity.

For the services-business case, lenses can support one-to-one mapping, one-to-many mapping, many-to-one mapping, partial mapping, lens-specific properties, and translations between lenses.

The shared language emerges, when it emerges, as a *separate lens* — a "common" lens that bridges between role-specific lenses, with mappings to and from each.

**LLM-driven schema and step suggestion: priors as scaffolding.** You're observing that the substrate's emptiness problem — the cold start where it knows nothing — is not actually a problem the substrate has to solve from observed traces alone. LLMs carry enormous prior knowledge. That prior should be available to the substrate immediately.

This reframes the substrate's relationship to formalization. There are now two sources of structure:

**Bottom-up**: structure that emerges from observed runs, accumulated patterns, operator behavior.

**Top-down**: structure suggested from training-data priors, applied to the current state of the substrate.

The critical move is that **both sources produce proposals, not declarations**.

---

## Philosophy document first

**User:** Let's do philosophy document / principles first. Then I'll use this conversation and the document within an existing (separate) project that has the initial implementation of a journaling-like tool (think of a Tana clone) and see if it's worth building on that

**Claude:** [Drafts initial principles document — see final version in the principles file.]

---

## Hand-off vs promotion/demotion

**User:** Promotion to automation and demotion to human lead is the wrong emotional frame. Give me some options to represent this range without the valence associated with promoting and demoting.

**Claude:** Good catch. "Promotion" and "demotion" import an unwanted hierarchy. Several options:

- **Movement along the gradient.** Neutral but slightly clinical.
- **Hand-off and hand-back.** Work *hands off* from human to automation, and *hands back* from automation to human. Frames both directions as collaborative transitions.
- **Delegation and reclamation.** The user *delegates* work; they *reclaim* it when needed.
- **Engaging and releasing.** An automated executor is *engaged* for a step; it can be *released*.
- **Binding and unbinding.** Technical, matches the data-model reality.
- **Activating and deactivating.** Neutral and symmetric.

**My recommendation: hand-off and hand-back.** They're symmetric, have warmth without sentimentality, emphasize the collaborative relationship between human and automation.

---

## Three scenarios for executor patterns

**User:** let's use hand-off and hand-back - and let's make sure the language envisions these scenarios
* a run goes through multiple steps, each step is human
* another run goes through multiple steps, some steps are human, some are LLM based, some are rules in code
* another run goes through multiple steps and at one step it splits - both the human and the LLM operators do the step and the comparison between the two is used to inform - so the handoff was actually to two operators in parallel

**Claude:** [Revises principles to support fully-human, mixed-executor, and parallel-engagement patterns. Introduces primary/shadow terminology, later replaced with primary/secondary.]

---

## Primary/secondary, non-destructive migration, defining lift

**User:** primary & secondary instead

principle 7: what if destructive migration was forbidden, what does this change?

is "lift" defined, can we define it?

**Claude:** Three things.

**Primary and secondary.** Clean swap. Better than primary/shadow.

**Forbidding destructive migration.** Yes, forbid it — and the consequences are significant but mostly positive. The substrate becomes honest about its history. Mistakes are correctable by appending corrective events, not by mutating. Time-travel queries become meaningful. Trust over time becomes possible.

The costs: storage grows monotonically, mental model overhead (deletion is retirement), some operations are slower (need caching), privacy considerations get harder (genuine erasure must be a separate, audited operation).

**Defining lift.** Two senses:

**Lift (structural).** Adding a layer to the formalization stack — narrative, semi-structured, structured, executable.

**Lift (runtime).** Transforming a payload from a lower formalization level to a higher one at runtime, on an edge between steps.

---

## Triggers, use, and relationship to hand-off

**User:** structural lift: what triggers it occuring? once created is it always used? how does it's use relate to hand-off and hand-back?

**Claude:** [Explores triggers (user-initiated, pattern-derived, prior-derived, demand-driven, friction-derived), explains that lifts create capability without compelling use, and clarifies the relationship to hand-off — structural lifts create the conditions for non-human executors to be possible, but hand-off is a separate operation.]

---

## The pachinko machine

**User:** so "structural lift" create a new capability and at runtime the decision is made whether the path is through (using) that capability? (I'm envisioning a downhill ski run or a pachinko machine where the path through varies)

**Claude:** Yes, exactly. The substrate is a *terrain*. Structural lifts add features to the terrain — new routes, new contours, new options. They don't determine the path; they shape the space of possible paths. Each run is a traversal of the terrain, and the path that traversal takes is decided at runtime based on the situation at hand.

The pachinko image captures the *combinatorial* nature: at each step, there are multiple paths the run can take. Each pin is a decision point. The pins exist because structural lifts created them. The ball's path is determined by which side of each pin it lands on at runtime.

This led to a new principle: **the terrain accumulates; the path is chosen at runtime**.

---

## Critique of "lift" terminology

**User:** i'm not wild about a) overloading list - structural vs runtime and b) the implication that lifting (structural lift from narrative to formal structure, runtime lift from narrative to structured data) has value - I think we're saying

* when conditions are right, we create an executor thats more deterministic (structural lift)?
* when needed to translate / connect between two steps that don't have the same level of specificity (narrative vs scheme-backed data) then conditions are set to create a connector/translator

critique this pov - is it consistent/coherent with what we have so far?

**Claude:** Critique:

**The overloading critique is correct.** Using "lift" for two different things was a vocabulary failure.

**The value-neutrality critique is partly correct.** "Lift" carries upward valence — same problem as "promotion."

**"Connector/translator" for the edge case is consistent with the substrate's principles.** Naming it as a translator/connector emphasizes that it's a *bridge* between forms.

**But "when conditions are right, we create an executor that's more deterministic" is *not* quite what structural lift was.** Structural lift was about *adding capability to an element* — making it possible for the element to be executed by a more deterministic executor, but not yet doing so.

Your reframing collapses three things — defining the contract, binding an executor, engaging the executor — into one move. That's potentially fine, but it loses important distinctions.

---

## Concrete scenarios

**User:** i'm unable to process all this output, so break it into smaller increments. Let's focus on "structural lift"
take your recommendations and give me concrete scenarios that demonstrate it - regardless of terminilogy

**Claude:** [Provides eight scenarios with `reconcile_line` as the running example, showing pure narrative, named outputs, typed outputs, executor bound but not engaged, engaged as secondary, primary swap, hand-back, retirement.]

**User:** Scenario 4: how is Steve watching the new small script "how it does for a while before trusting it" if it is not running in parallel as a secondary (as described in Scenario 5)?

Does this match the picture I'm holding? yes. Restate the 8 scenarios with meta-data showing the different kinds of changes in that scenario

**Claude:** [Fixes the inconsistency in scenario 4 and adds metadata. Identifies three categories: structure changes, binding changes, engagement changes.]

---

## Vocabulary refinement

**User:** these are good. now let's formalize language to describe changes - "structure" is an overloaded term - so let's lean on history and call it data or soemthing like that; isn't binding change an adding of capability? binding implies bringing two things together, but binding changes appears to be the addition or removal of a capability; engagement changes is about enabling or engaging with some existing capability

**Claude:** Suggests "shape" (or "data shape") for the first category, "capability/add/remove" for the second.

**User:** shape is nice but without context it's not clear what is being shaped. is it data shape?

let's use capability/add/remove
does a step need to say it has executors or just say it has capabilities - what's the benefit of this indirection?

**Claude:** Settles on "data shape" and works through the executor/capability distinction. Concludes: **the verb is "add a capability"** (because that captures what's changing — the step's range of how it can be done has expanded), **but the noun for the thing being added is "an executor"**.

---

## Predicates, preconditions, variants

**User:** on shape - give me scenarios that have/don't have predicates, preconditions, postcondtions, and observed variants

**Claude:** Provides six scenarios (A-F) illustrating these refinements. Concludes that "shape" only works for the data side; the broader category (covering preconditions, postconditions, predicates, variants) is something like "refinements." Suggests using "refinement" as the broad category name.

---

## Implicit knowledge becomes explicit

**User:** checking: a step may start at total narrative, with implied (or absent) condtions, rules, variants, etc. and then progressively refine to make the explicit?

**Claude:** Yes, exactly. A step at pure narrative has all of those things — preconditions, postconditions, predicates, variants — but they exist *only in the operator's head*. Refinement is the act of *moving knowledge from the operator's head into the substrate*.

This means refinement doesn't add constraints; it makes implicit constraints explicit. The work doesn't get harder; it gets more inspectable.

---

## Untangling capability terminology

**User:** didn't we write about structural lift about creating new capability in the landscape? if so, then how does this fit "Capabilities can be more general than specific executors. 'Extract line items from EOB' is a capability. It might be fulfilled by a specific LLM with a specific prompt today, by a different LLM tomorrow, by a rule-based parser the day after. The capability is the ability to do something; the executor is the current implementation of that ability."

was the intent that structural lift a)create a new capability or b) create a new executor for an existing capability?

**Claude:** You've found a real inconsistency. I was using "capability" in three different senses:
1. Anything that expands what the substrate can do
2. An available executor on a step
3. A role-level abstraction that executors implement

Refinement creates *roles that executors could fill*. Adding executors fills roles. The cleaner framing: refinement creates roles; adding executors is a separate move that may happen later.

The honest answer to "was the intent (a) or (b)?": **(c) refine the step in a way that creates new roles that could be filled by executors of various kinds — without itself adding any specific executor.**

---

## Roles or sub-steps?

**User:** in refinement changes for principle 4, explain what a refinement creates a role (give examples)
in executor changes for principle 4, does this envision that in a step a human can do some role and an LLM some other role? how does this fit with engagement changes
Is this actually hiding that there's sub-steps?

**Claude:** Roles are *specific sub-pieces of the step's work that have been articulated enough to be separately assigned*. Engagement is per-role, not per-step.

The question about sub-steps is sharp: roles and sub-steps differ in whether the work has independent identity. A role lives inside a step's contract; a sub-step has its own runs separately recorded. The boundary is fluid — roles can be promoted to sub-steps when they take on independent meaning.

**User:** the purpose of making a substep independent is for reuse - a problem I don't care about now. The question is: whats clearer or more confusing for the human - 1) "steps all the way down and someday maybe reuse steps" or 2) "steps -> roles but roles are like steps but in the narrow context of this parent step"

1 is clearer - 2 is more confusing

**Claude:** You're right. Option 1 is clearer. The "roles" concept I introduced was solving a problem (reuse) that isn't on the table. Steps-all-the-way-down is mentally simpler.

When Steve refines `reconcile_line` by adding sub-checks, what he's actually doing is creating sub-steps under `reconcile_line`. Each sub-step has its own identity, its own runs, its own narrative, and its own potential to be refined or have executors added independently.

The trade-off: refinements come in two flavors. Work-shaped refinements become sub-steps. Shape-only refinements (typed outputs, preconditions) might stay at the parent step level.

---

## Demand-driven, and the field as work

**User:** the origin of adding a typed field is roughly: "hey, I always need to know amount so whenever I work on this i need to pull amount out of the pdf and write it in a spreadsheet" this work is a step

**Claude:** Yes. This collapses what I'd been treating as two flavors of refinement into one. A "typed output field" on a parent step is really just the *output of a sub-step that produces that value*. The sub-step is the unit of work; the field is how its output is surfaced.

The entire refinement category collapses to: **refinement is creating sub-steps**. Some sub-steps produce values that show up as fields. Some sub-steps check conditions and gate the parent. Some sub-steps compose other sub-steps' outputs.

**User:** a useful frame is it's demand driven - i pulled out amount because i need it, now someone else execute this for me. that test should apply to all teh steps - they're demand driven

**Claude:** Yes. Demand-driven is the right frame, and it's load-bearing.

Every step exists because someone needed it. The need came first; the step is the substrate's response to the need. This applies recursively. A parent step exists because someone demanded the work it does. Its sub-steps exist because the parent's work involved sub-demands.

Two demand patterns worth distinguishing:

**Pull demand**: I need this articulated so I can do my work better.
**Push demand**: someone else needs this articulated so they can take over.

The demand-driven frame guards against a real failure mode: the substrate could become a system that *encourages* refinement and automation as ends in themselves. With demand-driven framing, the question is always: *what need are we responding to?* If there isn't one, don't refine.

---

## Final consolidation

**User:** ok, now the scenarios

**Claude:** [Provides the final eight scenarios with new vocabulary — see scenarios in the principles file.]

The three categories of change are visible cleanly:
- Refinement changes: creating, refining, or retiring sub-steps
- Executor changes: adding available executors without engaging
- Engagement changes: which executors are running, which is primary

Every change has a clear answer to "what demand drove this?" The recursion is uniform. Engagement-per-sub-step works naturally.

What's gone from the prior version:
- No "shape" or "data shape" category. The typed-output thing is just a sub-step now.
- No "roles" concept. Different executors on different sub-steps within a parent is the natural pattern.
- No conflation between adding an executor and engaging it.

---

## End of conversation

The conversation produced a consolidated principles document and a set of eight scenarios that demonstrate the principles in action.
