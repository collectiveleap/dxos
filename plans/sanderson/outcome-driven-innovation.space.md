# Outcome-Driven Innovation (ODI) — Conceptual Reference

## Core Concepts

### Core Functional Job
- The primary task a user is trying to accomplish — the reason they "hired" the product.
- Must be **solution-independent** and **long-lived**.
- Test: does it persist regardless of what tools/products are used?

### Consumption Chain Job
- Solution-specific activities performed *around* a product in service of core jobs.
- Ulwick's canonical types: purchase, receive, install & set up, learn to use, interface with, transport, clean, store, maintain, upgrade, repair, dispose.

### Job Map
- A visual depiction of the core functional job, deconstructed into discrete process steps.
- All jobs consist of some or all of **eight universal steps**: define, locate, prepare, confirm, execute, monitor, modify, conclude.
- Purpose: serves as a framework for capturing desired outcomes at each step.

### Job Steps vs. Solutions
- **Job steps must be universal and solution-independent.**
- Ulwick's test: "Does the step apply universally for any customer executing the job, or does it depend on how a particular customer does the job?"
- If it depends on *how*, it's a **solution**, not a step.
- Example: "find potential opportunities" is a job step [locate]. "Scan job boards" and "outreach to colleagues" are solutions for accomplishing that step.
- Different approaches/methods for accomplishing a step are NOT sub-steps — they are solution variations that belong on the supply side.

### Desired Outcomes
- Metrics customers use to measure success at each job step.
- Format: **[direction] + [metric] + [object of control]** (e.g., "Minimize the time it takes to identify a relevant opportunity").
- Must be: devoid of solutions, stable over time, measurable, controllable, structured for reliable prioritization.
- Typically 5-10 outcomes per job step, 100+ total for a core job.
- Outcomes apply regardless of which solution is used — the outcome is the same; the solution differs.

### Structure

```
Core Functional Job
  └── Job Step 1 [define]
        └── Desired Outcome 1.1
        └── Desired Outcome 1.2
  └── Job Step 2 [locate]
        └── Desired Outcome 2.1
        └── Desired Outcome 2.2
  └── ... (prepare, confirm, execute, monitor, modify, conclude)
```

### Opportunity Algorithm and Solution Evaluation

Ulwick measures desired outcomes on two dimensions: **importance** and **satisfaction** (given the current solution). A customer need is unmet when it is important but not well satisfied with the solutions currently available.

- **Opportunity algorithm**: `opportunity = importance + max(importance - satisfaction, 0)`

**Scoring methodology** (from Ulwick's *What Customers Want*, summarized in Jupiter 2018):

1. Survey participants rate each outcome on a **1–5 scale**:
   - **Importance**: 1 = not important at all, 5 = critically important
   - **Satisfaction**: 1 = not satisfied at all, 5 = totally satisfied
2. Compute the **percentage of respondents who answered 4 or 5** for each question.
3. **Normalize** those percentages to a 0–10 scale (e.g., 95% rating 4 or 5 → importance score of 9.5).
4. Apply the opportunity algorithm to the normalized scores.

**Opportunity score interpretation** (on the normalized 0–20 scale):
- **> 15** → extreme opportunity, should not be ignored
- **12–15** → "low-hanging fruit" ripe for improvement
- **10–12** → worthy of consideration, especially in a broad market
- **< 10** → unattractive in most markets, diminishing returns

**For individual (non-survey) use**: the raw 1–5 scores can be used directly to assess relative priority. The exact opportunity score thresholds above apply to the normalized scale, but the directional logic holds: outcomes where importance >> satisfaction are underserved.

**Competitive analysis**: the same outcomes can be scored against multiple competing products. This produces a "value migration graph" showing where each product is strong or weak on important outcomes, enabling targeted improvement.

**Key framing**: Ulwick does not compare "old solution vs. new solution" directly. Instead:
1. Identify the **current solution** — whatever the customer uses today to get the job done
2. Measure **importance** and **satisfaction** of each desired outcome against that current solution
3. Find **underserved outcomes** — where importance is high but satisfaction is low
4. Any new solution that better satisfies those underserved outcomes represents the innovation opportunity

The current solution is simply called the **"solution currently available"** or **"current solution."** There is no special ODI term for a proposed new solution — the framework focuses on the outcomes, not on solution-to-solution comparison. The logic: if you know which outcomes are underserved, any solution that addresses them creates value.

**Opportunity landscape**: A visualization plotting all desired outcomes by importance (y-axis) and satisfaction (x-axis). Each dot is one outcome. Outcomes in the upper-left quadrant (high importance, low satisfaction) are the underserved opportunities.

### Personal vs. Brand Network (from Greg Bear)
- **Personal network**: people known directly through professional relationships.
- **Brand network**: people connected through the work itself — community, content, reputation (e.g., gregslist, Practical Founder).
- Relevant when analyzing network maintenance as a core functional job.

## Sources
- [The Path to Growth: The Opportunity Algorithm — Anthony Ulwick](https://www.marketingjournal.org/the-path-to-growth-the-opportunity-algorithm-anthony-ulwick/)
- [How To Discover Hidden Innovation Opportunity — Strategyn](https://strategyn.com/outcome-driven-innovation/market-opportunity/)
- [Outcome-Driven Innovation — Wikipedia](https://en.wikipedia.org/wiki/Outcome-Driven_Innovation)
- [What is the Opportunity Score? — Notes for Growth](https://notesforgrowth.github.io/Opportunity-Score/) (details on 1–5 scale, percentage normalization)
- [Outcome-Driven Innovation (critique) — Alex Jupiter, Medium](https://medium.com/@AlexJupiter/outcome-driven-innovation-3377252aec15) (1–5 scale anchors, opportunity score thresholds >15/12–15/10–12/<10, competitive analysis via value migration graph, based on Ulwick's *What Customers Want*)
- [How to Map a Customer Job — Anthony Ulwick](https://www.marketingjournal.org/how-to-map-a-customer-job-anthony-ulwick/)
- [Mapping the Job-to-be-Done — Tony Ulwick](https://jobs-to-be-done.com/mapping-the-job-to-be-done-45336427b3bc)
- [Jobs to Be Done: The Original Framework — Strategyn](https://strategyn.com/jobs-to-be-done/)
- [Jobs-to-be-Done: A Framework for Customer Needs — Tony Ulwick](https://jobs-to-be-done.com/jobs-to-be-done-a-framework-for-customer-needs-c883cbf61c90)
- [How to Engineer Micro-Moments using Jobs-to-be-Done — Anthony Ulwick](https://www.marketingjournal.org/how-to-engineer-micro-moments-using-jobs-to-be-done-anthony-ulwick/)
