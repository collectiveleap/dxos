//
// Copyright 2026 DXOS.org
//

import { type Extension, RangeSetBuilder, StateEffect } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';

import { type EchoDatabase } from '@dxos/echo-client';

/** Dispatch on the editor view to rebuild the chips when a label/edge set changes (labels are
 *  live, but a title change isn't a doc change — the caller fires this when the map updates). */
export const refreshChips = StateEffect.define<null>();

// An inline mention is a plain-text marker token that references the linked `Edge` by its id —
// NOT a target URL, NOT a markdown link (see design.md §1/§3 · design-references.md). A custom
// decoration (below) replaces each token with an atomic chip that resolves edge → target → label.
export const MARKER_RE = /\{\{ref:([0-9A-Za-z]+)\}\}/g;
export const makeMarker = (edgeId: string): string => `{{ref:${edgeId}}}`;
export const markerEdgeIds = (text: string): string[] => [...text.matchAll(MARKER_RE)].map((m) => m[1]);

/** The linked-edge ids whose marker is no longer present in `currentText` — their edges should be
 *  removed (the user deleted the mention). Keeps edges ↔ markers in sync. */
export const staleEdgeIds = (currentText: string, linkedEdgeIds: string[]): string[] => {
  const present = new Set(markerEdgeIds(currentText));
  return linkedEdgeIds.filter((id) => !present.has(id));
};

/** The rendered reference chip. `label` is the target's current title, resolved by the caller. */
class ChipWidget extends WidgetType {
  constructor(
    private readonly _edgeId: string,
    private readonly _label: string,
  ) {
    super();
  }

  override eq(other: ChipWidget) {
    return other._edgeId === this._edgeId && other._label === this._label;
  }

  override toDOM() {
    const el = document.createElement('dx-anchor');
    el.classList.add('dx-tag--anchor');
    el.textContent = this._label;
    el.setAttribute('data-edge-id', this._edgeId);
    return el;
  }

  override ignoreEvent() {
    return false;
  }
}

/**
 * Replace each `{{ref:<edgeId>}}` marker with an ATOMIC chip. `resolveLabel(edgeId)` returns the
 * current target title (the caller builds it from the node's linked edges, so no async in the
 * widget). Atomic: the cursor skips the token and a single backspace deletes the whole marker.
 */
export const mentionChips = ({
  resolveLabel,
}: {
  db?: EchoDatabase;
  resolveLabel: (edgeId: string) => string;
}): Extension => {
  const build = (view: EditorView): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    const text = view.state.doc.toString();
    for (const m of text.matchAll(MARKER_RE)) {
      const from = m.index!;
      const to = from + m[0].length;
      builder.add(from, to, Decoration.replace({ widget: new ChipWidget(m[1], resolveLabel(m[1])) }));
    }
    return builder.finish();
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: ViewUpdate) {
        const refreshed = update.transactions.some((tr) => tr.effects.some((e) => e.is(refreshChips)));
        if (update.docChanged || update.viewportChanged || refreshed) {
          this.decorations = build(update.view);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
      // Make each chip atomic: cursor jumps over it; backspace removes the whole token.
      provide: (plugin) =>
        EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
    },
  );
};
