//
// Copyright 2025 DXOS.org
//

import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { type Command, EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { useEffect, useRef } from 'react';

import { Obj } from '@dxos/echo';

import type { Block } from '#types';

import { schema } from './schema';
import { fromDoc, toDoc } from './serialize';

export type BlockEditorProps = {
  block: Block.Block;
  autoFocus?: boolean;
  // Called when the user presses Enter. Returns before/after-cursor text in the
  // current paragraph; the parent is responsible for creating a new sibling
  // Block with `afterText`. The current editor's after-cursor text is removed
  // synchronously here so the user sees the split immediately.
  onEnter?: (beforeText: string, afterText: string) => void;
};

// Increment 3: same single-paragraph editor as I2, plus an Enter callback
// surfaced to the parent so it can splice a new Block into the parent's
// children. The host carries data-block-id for context-menu targeting.
export const BlockEditor = ({ block, autoFocus, onEnter }: BlockEditorProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Keep onEnter in a ref so the editor isn't torn down each render.
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const enterCommand: Command = (state, dispatch) => {
      if (!onEnterRef.current) {
        return false;
      }
      const { $from } = state.selection;
      const text = $from.parent.textContent;
      const cursor = $from.parentOffset;
      const beforeText = text.slice(0, cursor);
      const afterText = text.slice(cursor);

      if (dispatch) {
        // Strip after-cursor text from the current paragraph so the editor
        // shows the "before" half. The dispatchTransaction below picks this
        // up and writes the trimmed content into Block.content via ECHO.
        const tr = state.tr.delete(state.selection.from, $from.end());
        dispatch(tr);
      }

      onEnterRef.current(beforeText, afterText);
      return true;
    };

    const state = EditorState.create({
      doc: toDoc(block.content as any),
      schema,
      plugins: [
        history(),
        keymap({
          Enter: enterCommand,
          'Mod-z': undo,
          'Mod-y': redo,
          'Mod-Shift-z': redo,
        }),
        keymap(baseKeymap),
      ],
    });

    const view = new EditorView(hostRef.current, {
      state,
      dispatchTransaction: (transaction) => {
        const next = view.state.apply(transaction);
        view.updateState(next);
        if (transaction.docChanged) {
          const content = fromDoc(next.doc);
          Obj.update(block, (block) => {
            block.content = content;
          });
        }
      },
    });

    if (autoFocus) {
      view.focus();
    }

    return () => {
      view.destroy();
    };
  }, [block]);

  return <div ref={hostRef} data-block-id={block.id} className='outline-none' />;
};
