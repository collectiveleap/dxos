//
// Copyright 2025 DXOS.org
//

import { Plugin, PluginKey } from 'prosemirror-state';

// F-6 Phase 1: tracks an active "#-tag" trigger — the position of `#` in
// the current paragraph and the query text typed after it. Mirrors
// `mention-plugin.ts` (which does the same for `@`), but the `#`
// trigger fires ANYWHERE in the paragraph — the prior version
// required `#` at the start or after whitespace, but the user spec
// says `#` should always open the picker (matching Tana).
//
// Esc-dismissal: when the user presses Escape with the picker open we
// remember the absolute doc position of that `#`. While the cursor
// continues to track that exact same `#` (typing more query chars
// after it), the picker stays closed — typing another letter would
// otherwise immediately re-trigger the same `#`. Dismissal resets
// when the cursor moves before the dismissed `#` or that `#` is
// deleted (i.e. a different `#` becomes the trailing trigger, or
// none does).

export type HashState = {
  active: boolean;
  from: number; // position of `#` in the doc
  to: number; // current cursor position
  query: string; // text after `#`, excluding the `#` itself
  // -1 when no dismissal is in effect; otherwise the absolute doc
  // position of the `#` that was dismissed via Escape.
  dismissedAt: number;
};

const inactive: HashState = { active: false, from: 0, to: 0, query: '', dismissedAt: -1 };

export const hashKey = new PluginKey<HashState>('plugin-blocks-hash');

export const hashPlugin = new Plugin<HashState>({
  key: hashKey,
  state: {
    init: () => inactive,
    apply: (transaction, previous, _oldState, newState) => {
      const meta = transaction.getMeta(hashKey);
      if (meta === 'close') {
        // Dismissal: stash the from-pos of the currently-active `#` so
        // the next apply pass doesn't immediately re-open.
        return { ...inactive, dismissedAt: previous.active ? previous.from : -1 };
      }

      const cursor = newState.selection.$head;
      if (!cursor.parent.isTextblock) {
        return inactive;
      }

      const offsetInPara = cursor.parentOffset;
      const textBefore = cursor.parent.textBetween(0, offsetInPara, '', '');
      const lastHash = textBefore.lastIndexOf('#');
      if (lastHash < 0) {
        return inactive;
      }
      const queryText = textBefore.slice(lastHash + 1);
      if (/\s/.test(queryText)) {
        return inactive;
      }
      // No surrounding-context check: `#` triggers the picker no matter
      // what character precedes it in the paragraph (Tana convention).

      const paragraphContentStart = cursor.start();
      const fromAbs = paragraphContentStart + lastHash;

      // Honour an active dismissal: while the cursor still tracks the
      // dismissed `#`, keep the picker closed. Once the user navigates
      // before that `#` or deletes it (so a different `#` — or none —
      // becomes the trailing trigger), the dismissal clears.
      if (previous.dismissedAt === fromAbs) {
        return { ...inactive, dismissedAt: fromAbs };
      }

      return {
        active: true,
        from: fromAbs,
        to: cursor.pos,
        query: queryText,
        dismissedAt: -1,
      };
    },
  },
});
