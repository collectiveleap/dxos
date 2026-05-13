//
// Copyright 2025 DXOS.org
//

import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

// F-Caret: empty paragraph caret-visibility indicator.
//
// Editor wraps each Block's editor in an `inline-block` shell so the
// backlinks badge can sit next to the text (per F-V4.placement). For
// non-empty paragraphs this works fine — the `<p>` takes the text's
// width and the caret renders inside the text node.
//
// For an EMPTY paragraph, ProseMirror renders
// `<p><br class="ProseMirror-trailingBreak"></p>`. Inside the
// inline-block context the empty `<p>` collapses to 0 width and the
// browser computes no caret rect at `<p>, 0` / `<p>, 1` — even with
// pseudo-elements, min-width, or floated `::before` content, the
// browser refuses to paint a caret at element-boundary positions.
// PM enforces that DOM selection sits at PM-positions, so manually
// moving the DOM caret into a real text node gets clobbered on the
// next sync.
//
// Pragmatic fix: tag empty paragraphs with the
// `block-empty-paragraph` class. CSS in `block-editor.css` then
// renders a CSS-only blinking line via `::after` whenever the
// editor has focus. The real PM caret stays invisible, but the user
// sees a stand-in indicator. Typing flows through PM normally; on
// first input the paragraph is no longer empty and the real caret
// renders inside the new text node.
export const caretFixPlugin = new Plugin({
  props: {
    decorations: (state) => {
      const decorations: Decoration[] = [];
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'paragraph' && node.content.size === 0) {
          decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'block-empty-paragraph' }));
        }
      });
      return DecorationSet.create(state.doc, decorations);
    },
  },
});
