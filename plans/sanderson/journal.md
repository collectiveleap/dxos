# Journal

## 2026-04-23

### How we got here

Started with a concrete goal: create an MCP plugin to use a locally running LinkedIn MCP server so that, as I shift to using Composer, I can set up an automated workflow that enriches info on a person and their organization.

Using Claude Code, I created an MCP plugin that worked. However, reviewing the final code I saw it had violated a design assumption: architecturally, changes need to stay within the new plugin, not leak into existing core code or other plugins. So I started to refactor.

During the refactor, I realized I was thinking about how Chad Fowler's Phoenix Architecture applied — that it'd be a great learning to try and build out the specs so I could burn down and regenerate a new implementation iteratively. So I used the existing implementation to enrich the existing PLUGIN.md spec and set that implementation aside for reference.

In this process, I added some mission creep: while Phoenix Architecture treats the spec as durable and code as regenerable, I was also treating the core functional job-to-be-done as durable and the solution choices as regenerable. Specifically, I believed that providing an ODI-like description of the job-to-be-done would help in regenerating the code and in improving the spec.

From there, Claude and I created a description of the job-to-be-done for the MCP plugin. However, that job is a "consumption chain" job (per ODI) and not the core functional job. Since it's the core functional job that's durable, and since it's the core functional jobs that I want to hire Composer to do — Claude and I developed the core functional jobs and repositioned the MCP job-to-be-done as one of several consumption chain jobs.

### What we built today

- Defined two core functional jobs: (1) secure new professional engagements, (2) maintain professional network.
- Built an ODI job map for Job 1 with 8 steps.
- Developed desired outcomes for Job 1 Step 2 [locate] and scored importance/satisfaction (all importance = 5, biggest gaps at 2.4 and 2.7 with gap = 4).
- Defined five consumption chain jobs (set daily agenda, triage incoming communications, manual scan of job boards, organize actions into projects, decide what to work on next) with desired outcomes and importance/satisfaction scores for each.
- Mapped possible solutions (MCP, Composer) to specific underserved outcomes across both core job and consumption chain jobs.
- Created outcome-driven-innovation.space.md as a conceptual reference for ODI methodology (scoring, opportunity algorithm, job steps vs. solutions, consumption chain structure).
- Renamed demand.md to demand-and-supply.md to reflect that it now covers both sides.

### Key insight

There are two layers of durability at play:
1. **ODI layer**: core functional jobs are durable, solutions are regenerable. The demand side persists; the supply side can be swapped.
2. **Phoenix Architecture layer**: specs are durable, code is regenerable. The PLUGIN.md persists; the implementation can be burned down and rebuilt.

These two layers compose: the ODI demand side informs *what* to build (which outcomes to serve), and Phoenix Architecture informs *how* to build it (spec-first, regenerable code). The demand-and-supply.md feeds into PLUGIN.md which feeds into implementation.

### What's next

- Build out an ODI opportunity landscape from Steve's importance/satisfaction scores.
- Desired outcomes for remaining Job 1 steps (1, 3–8).
- Job map and outcomes for Job 2 (maintain professional network).
- Build out the spec for the MCP plugin using Phoenix Architecture + PLUGIN.md, informed by the underserved outcomes identified here.
- Ultimately: other to-be-built solutions spec'd via the same pattern.

## 2026-04-24

### What we did today

Steve described a struggle: projects and actions are being created in multiple places — Tana, Claude Code for DXOS, Claude Code for "Alright. What's next?" — and he can't see them all together to decide what to work on next. Pipelines (outreach, content) span across these systems.

We worked through whether this was a consumption chain job or a core functional job:
- Researched Ulwick's ODI framework deeply on the distinction.
- Concluded there are **two things tangled together**: (1) a core functional job — allocating time and attention across competing commitments, and (2) consumption chain overhead — the tool-specific friction of performing that job across fragmented systems.
- The core functional job passes all three of Ulwick's tests (stable over time, no geographical boundaries, solution agnostic). It would exist even with one perfect tool.

### What changed in demand-and-supply.md

- **Added Job 3: Allocate time and attention across competing commitments so the right things get done.** Full job map (8 steps) and 28 desired outcomes (3.1.1–3.8.3).
- **Promoted three consumption chain jobs to Job 3 steps**: "Set the daily agenda" → Steps 2–3. "Organize actions into projects" → Step 1. "Decide what to work on next" → Step 4. These were always core functional job steps masquerading as tool overhead.
- **Added current solutions for Job 3**: Tana, two Claude Code environments, manual daily review, mental integration. Documented the cross-system pipeline problem.
- **Updated Cluster C** from "Centralized action management" to "Attention allocation across fragmented systems" — now anchored on Job 3's 28 outcomes.
- **Cleaned up old IDs** (A1.x, O1.x, D1.x) from the opportunity landscape and solution mappings, replacing with Job 3 outcome references.
- **Updated Possible Solutions** section to reference Job 3 outcomes.

### Key insight

The three activities that seemed like consumption chain jobs (daily agenda, organizing actions, deciding what's next) were actually steps in an unidentified core functional job. The tool fragmentation (Tana + two Claude Code envs) made them *feel* like tool overhead, but the underlying job — deciding where to allocate attention — is solution-independent and would exist even with a single system. This is a genuine gap in Ulwick's published ODI taxonomy: meta-coordination jobs that sit upstream of all other core functional jobs.

### What's next

- Score Job 3's 28 desired outcomes for importance and satisfaction against current solutions.
- Rebuild the opportunity landscape with scored Job 3 outcomes.
- Desired outcomes for remaining Job 1 steps (1, 3–8).
- Job map and outcomes for Job 2 (maintain professional network).
