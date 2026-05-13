# @dxos/plugin-bramble

Bramble — a property-graph plugin where every bullet is a first-class
ECHO `Node`, structural relations are typed `Edge`s, and the user
navigates the graph through (today) zoom + panes + supertag-
conditional rendering, with a first-class **Lenses** surface planned
(see `CONCEPTS.md` §8.2).

The product positioning is *honour the mess*: Ackoff's
non-decomposability and Snowden's anthro-complexity both apply —
human thought isn't tidy, and the tool's job is to support
navigation rather than impose order. See `CONCEPTS.md` for the
full substrate stance, the DSRP-on-triples data model, the three
naming stances, and why "Bramble".

The schema remains a faithful Tana Paste import target: every shape
Tana Paste can produce has a slot in `Bramble.Node`.

The existing [`@dxos/plugin-outliner`](../plugin-outliner) (markdown-
blob outliner) is unaffected.
