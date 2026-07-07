# Workbench — queued changes (backlog)

- **Captured:** 2026-07-07 (by Steve, mid-Inc-1-closeout)
- **Status:** Not scheduled. A mix of one near-term fix, three features (Inc-2+), and one
  open design question to settle with the Pipeline increment.
- **Context:** the Workbench Inbox (`plugin-sensemaking`) fed by `plugin-readwise`. See
  `docs/superpowers/specs/2026-07-06-workbench-concept.md` for the arc and
  `2026-07-06-sensemaking-increment-1-design.md` for Inc-1.

---

## Near-term fix

### B-1 · Foot row: capture tags should share the row with `+ result`
In the Inbox, a capture's tag(s) currently render on a **separate line** from the `+ result`
control. The mockup (`2026-07-06-workbench-mockup.html`, `.foot`) puts the tag chips and
`+ result ▾` on **one foot row** (chips · `+ result ▾` · … · `→ triaged`). Bring them onto the same
row to match. Touch: `CaptureRow.tsx` / `HighlightCard.tsx` foot region. Verify with the
`visual-verification` skill.

---

## Features (Inc-2+)

### F · Filter the Inbox
A filter control on the Inbox surface, composing with the existing per-source clustering. Filters:
- only captures **with a note**
- only captures **from a given source** — **multi-select** across sources
- only captures **with results**
- only captures **with no results**

### F · Navigate to / zoom into a single document within the Inbox
Under the **Sources** nav, clicking a source document (e.g. "The Lean Startup") currently does not
render it Inbox-style. Desired: clicking a source opens a **single-document Inbox view** — that
document's captures with their triage controls — so Steve can focus one document at a time and
navigate between documents. (Ties into the "Sources" nav group the mockup shows but Inc-1 omitted.)

### F · Second origin link — the Readwise copy of the whole document
Today a capture links to the **original** article/source. Add a **second link that opens the whole
document in Readwise Reader**, so Steve can jump to the doc within Readwise itself. Readwise exposes a
per-document reader URL; the sync would need to capture it onto the source (Bookmark or Highlight)
if not already present.

---

## Open design question — Inbox lifecycle (what leaves the Inbox)

### Q · When does a capture / document leave the Inbox?
The Inbox is only a workable queue if things **leave** it; otherwise it grows without bound. Needs a
decision, ideally settled **with the Pipeline increment (2b)** since it defines "done":

- When a capture **has results** and/or **is in the Pipeline** — does it still show in the Inbox?
- When **all of a document's captures have results** — does the document still show in the Inbox?
- Is "triaged / done" a state that **removes** a capture from the Inbox, **moves** it, or just
  **marks** it (and filtering — see the filter feature above — hides it on demand)?

This is the Inbox-emptying / "done" semantics. Resolve before or during Pipeline.
