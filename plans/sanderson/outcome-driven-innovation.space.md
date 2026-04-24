# Outcome-Driven Innovation (ODI) — Conceptual Reference

## Core Concepts

### Core Functional Job
- The primary task a user is trying to accomplish — the reason they "hired" the product.
- Must be **solution-independent** and **long-lived**.
- Test: does it persist regardless of what tools/products are used?

### Consumption Chain Job
- Solution-specific activities performed *around* a product in service of core jobs.
- Ulwick's canonical types: purchase, receive, install & set up, learn to use, interface with, transport, clean, store, maintain, upgrade, repair, dispose.
- **Structure**: consumption chain jobs do NOT have their own 8-step job map. Each consumption chain job has a **flat set of desired outcomes** directly (no sub-steps).
- Typically **10–30 desired outcomes** per consumption chain job (vs. 50–150 for a core functional job).
- Same importance/satisfaction scoring and opportunity algorithm apply.
- Same desired outcome format: direction + metric + object of control.

### Job Map
- A visual depiction of the **core functional job** (not consumption chain jobs), deconstructed into discrete process steps.
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

**Opportunity algorithm** ([Ulwick, "The Path to Growth"](https://www.marketingjournal.org/the-path-to-growth-the-opportunity-algorithm-anthony-ulwick/); [Notes for Growth](https://notesforgrowth.github.io/Opportunity-Score/); [Jupiter 2018](https://medium.com/@AlexJupiter/outcome-driven-innovation-3377252aec15)):

```
opportunity = importance + max(importance - satisfaction, 0)
```

The inputs to this formula are **not** raw 1–5 Likert scores. They are **normalized scores on a 0–10 scale**, derived from survey data.

**Full scoring methodology** (from Ulwick's *What Customers Want*, [summarized in Jupiter 2018](https://medium.com/@AlexJupiter/outcome-driven-innovation-3377252aec15); [Notes for Growth](https://notesforgrowth.github.io/Opportunity-Score/)):

1. **Collect**: each respondent rates each outcome on a **1–5 scale**:
   - **Importance**: 1 = not important at all, 5 = critically important
   - **Satisfaction**: 1 = not satisfied at all, 5 = totally satisfied
2. **Normalize**: for each outcome, compute the **percentage of respondents who answered 4 or 5**. Divide by 10 to produce a **0–10 score** (e.g., 60% rating 4 or 5 → 6.0).
3. **Compute**: apply the opportunity algorithm to the normalized importance and satisfaction scores.

Score range: **0–20**.

**Opportunity score interpretation** (0–20 scale, [Jupiter 2018](https://medium.com/@AlexJupiter/outcome-driven-innovation-3377252aec15)):
- **> 15** → extreme opportunity, should not be ignored
- **12–15** → "low-hanging fruit" ripe for improvement
- **10–12** → worthy of consideration, especially in a broad market
- **< 10** → unattractive in most markets, diminishing returns

**Competitive analysis**: the same outcomes can be scored against multiple competing products. This produces a "value migration graph" ([Jupiter 2018](https://medium.com/@AlexJupiter/outcome-driven-innovation-3377252aec15)) showing where each product is strong or weak on important outcomes, enabling targeted improvement.

**Key framing**: Ulwick does not compare "old solution vs. new solution" directly. Instead:
1. Identify the **current solution** — whatever the customer uses today to get the job done
2. Measure **importance** and **satisfaction** of each desired outcome against that current solution
3. Find **underserved outcomes** — where importance is high but satisfaction is low
4. Any new solution that better satisfies those underserved outcomes represents the innovation opportunity

The current solution is simply called the **"solution currently available"** or **"current solution."** There is no special ODI term for a proposed new solution — the framework focuses on the outcomes, not on solution-to-solution comparison. The logic: if you know which outcomes are underserved, any solution that addresses them creates value.

### Single-Respondent Problem (N=1)

**The problem:** Ulwick's normalization step (step 2 above) computes the percentage of respondents who rated 4 or 5. For a single respondent, this percentage is binary — either 100% (the respondent rated 4 or 5) or 0% (they didn't). Normalized to 0–10, every outcome's importance and satisfaction become either **10** or **0**.

Applied to the opportunity algorithm, this produces only two possible scores:
- **20** — when importance ≥ 4 and satisfaction < 4 (normalized: imp=10, sat=0)
- **10** — when importance ≥ 4 and satisfaction ≥ 4 (normalized: imp=10, sat=10)

All differentiation within the raw scores is lost. A satisfaction rating of 1 ("not at all") and 3 ("moderately") both normalize to 0 and produce the same opportunity score of 20. The careful distinctions the respondent provided — which are the basis for clustering — collapse into two bins.

**Resolution-preserving adaptation for N=1:**

*Note: this adaptation is not from Ulwick. It is a principled extension to preserve the resolution of a single respondent's data so that the opportunity algorithm's output retains sufficient differentiation for clustering.*

The respondent's 1–5 rating is their complete data. Rather than applying a binary threshold that discards 3 of the 5 levels, **linearly rescale** the 1–5 Likert rating to the 0–10 input range the algorithm expects:

```
normalized = (raw - 1) × 2.5
```

| Raw (1–5) | Normalized (0–10) |
|---|---|
| 1 | 0.0 |
| 2 | 2.5 |
| 3 | 5.0 |
| 4 | 7.5 |
| 5 | 10.0 |

**Why this works:**
- The Likert scale's endpoints (1 = "not at all", 5 = "extremely") map to the algorithm's endpoints (0 and 10).
- The interior values preserve the respondent's expressed gradations proportionally.
- The opportunity algorithm's output falls on the 0–20 scale, so Ulwick's published thresholds (>15, 12–15, 10–12, <10) apply directly.
- For large samples, when many respondents each provide a 1–5 rating, the percentage who rate 4+ converges to a value on the 0–10 scale that reflects the population distribution. The linear rescaling of a single respondent's rating is the degenerate case of that population distribution — it is the single data point.

**Reference table (imp=5):**

| Raw Imp | Raw Sat | Norm Imp | Norm Sat | Opportunity | Interpretation |
|---|---|---|---|---|---|
| 5 | 1 | 10.0 | 0.0 | 20.0 | Extreme (>15) |
| 5 | 2 | 10.0 | 2.5 | 17.5 | Extreme (>15) |
| 5 | 3 | 10.0 | 5.0 | 15.0 | Low-hanging fruit (12–15) |
| 5 | 4 | 10.0 | 7.5 | 12.5 | Low-hanging fruit (12–15) |
| 5 | 5 | 10.0 | 10.0 | 10.0 | Worthy of consideration (10–12) |

**Reference table (imp=4):**

| Raw Imp | Raw Sat | Norm Imp | Norm Sat | Opportunity | Interpretation |
|---|---|---|---|---|---|
| 4 | 1 | 7.5 | 0.0 | 15.0 | Low-hanging fruit (12–15) |
| 4 | 2 | 7.5 | 2.5 | 12.5 | Low-hanging fruit (12–15) |
| 4 | 3 | 7.5 | 5.0 | 10.0 | Worthy of consideration (10–12) |
| 4 | 4 | 7.5 | 7.5 | 7.5 | Unattractive (<10) |
| 4 | 5 | 7.5 | 10.0 | 7.5 | Unattractive (<10) |

This produces 9 distinct opportunity scores across the full range of imp/sat combinations (vs. 2 with binary normalization), which is sufficient resolution for thematic clustering.

### Opportunity Landscape

A visualization plotting all desired outcomes by importance (x-axis) and satisfaction (y-axis) ([Ulwick, "The Path to Growth"](https://www.marketingjournal.org/the-path-to-growth-the-opportunity-algorithm-anthony-ulwick/); [Strategyn, "How To Discover Hidden Innovation Opportunity"](https://strategyn.com/outcome-driven-innovation/market-opportunity/)). Each dot is one outcome. Outcomes in the lower-right region (high importance, low satisfaction) are the underserved opportunities.

**Building the landscape:**
1. Score all outcomes (importance + satisfaction) against the current solution.
2. Plot each outcome as a dot on a 2D chart: importance on x-axis, satisfaction on y-axis.
3. The diagonal line from upper-left to lower-right separates overserved (above the line, where satisfaction exceeds importance) from underserved (below the line, where importance exceeds satisfaction).

**Clustering and segmentation:**

In full ODI practice, clustering is about **market segmentation** — grouping *customers* (not outcomes) into segments that share similar patterns of underserved/overserved outcomes:
1. Identify outcomes with the **greatest variance** across respondents — these are the segmentation criteria.
2. Run **cluster analysis** on those high-variance outcomes to find customer segments.
3. Profile each segment — each has a unique set of underserved outcomes.
4. "Market segments (groups who have unique sets of underserved or overserved outcomes) are then defined by aggregated opportunity groups."

This reveals: unique opportunities in mature markets, customer segments willing to pay more for enhanced solutions, and undesirable customer segments.

**For single-respondent / individual use**: since there is no population variance to segment on, the adaptation is to **cluster the outcomes themselves by theme** to identify actionable opportunity areas. Group outcomes that a single solution concept could address together. This produces opportunity clusters — coherent sets of underserved outcomes that point toward a specific innovation direction.

**From clusters to solution concepts**: each opportunity cluster suggests a solution direction. The cluster doesn't prescribe the solution — it defines the set of underserved outcomes the solution must address. Multiple solution concepts can be evaluated against the same cluster.

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
- [What Customers Want — Product Bookshelf review](https://www.productbookshelf.com/2012/06/creating-what-customers-want/) (clustering into market segments, segmentation criteria from high-variance outcomes)
- [Market Segmentation Process — Strategyn](https://strategyn.com/outcome-driven-innovation-process-2/market-segmentation-process/)
