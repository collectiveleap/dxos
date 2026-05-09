//
// Copyright 2025 DXOS.org
//

import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { useEffect, useRef } from 'react';

import { Obj } from '@dxos/echo';

import type { Block } from '#types';

import { schema } from './schema';
import { fromDoc, toDoc } from './serialize';

export type BlockEditorProps = {
  block: Block.Block;
};

// Increment 2: mounts ProseMirror over a single Block and writes Block.content
// on every doc-changing transaction. External mutations into the editor are
// deferred to a later increment — this is one-way (editor → ECHO).
export const BlockEditor = ({ block }: BlockEditorProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const state = EditorState.create({
      doc: toDoc(block.content as any),
      schema,
      plugins: [
        history(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
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

    return () => {
      view.destroy();
    };
  }, [block]);

  return <div ref={hostRef} className='p-4 outline-none' />;
};
