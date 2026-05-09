//
// Copyright 2025 DXOS.org
//

import { Plugin, PluginKey } from 'prosemirror-state';

// Tracks an active "@-mention" trigger: the position of `@` in the current
// paragraph and the query text typed after it. The plugin computes its state
// purely from the current selection and document — no side effects.

export type MentionState = {
  active: boolean;
  from: number; // position of `@` in the doc
  to: number; // current cursor position
  query: string; // text after `@`, excluding the `@` itself
};

const inactive: MentionState = { active: false, from: 0, to: 0, query: '' };

export const mentionKey = new PluginKey<MentionState>('plugin-blocks-mention');

export const mentionPlugin = new Plugin<MentionState>({
  key: mentionKey,
  state: {
    init: () => inactive,
    apply: (transaction, _previous, _oldState, newState) => {
      const meta = transaction.getMeta(mentionKey);
      if (meta === 'close') {
        return inactive;
      }

      const cursor = newState.selection.$head;
      if (!cursor.parent.isTextblock) {
        return inactive;
      }

      // textBetween with placeholder chars keeps positions aligned with the
      // doc — atomic ref nodes contribute one char to the string.
      const offsetInPara = cursor.parentOffset;
      const textBefore = cursor.parent.textBetween(0, offsetInPara, '', '');
      const lastAt = textBefore.lastIndexOf('@');
      if (lastAt < 0) {
        return inactive;
      }
      const queryText = textBefore.slice(lastAt + 1);
      if (/\s/.test(queryText)) {
        return inactive;
      }
      // Trigger only when `@` is at start or preceded by whitespace.
      if (lastAt > 0) {
        const charBefore = textBefore[lastAt - 1];
        if (!/\s/.test(charBefore)) {
          return inactive;
        }
      }

      const paragraphContentStart = cursor.start();
      return {
        active: true,
        from: paragraphContentStart + lastAt,
        to: cursor.pos,
        query: queryText,
      };
    },
  },
});
