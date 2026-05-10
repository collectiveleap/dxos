//
// Copyright 2025 DXOS.org
//

import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { type Command, EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { DXN, Obj } from '@dxos/echo';

import { MentionPicker } from '../MentionPicker';

import type { Block } from '#types';

import { type MentionState, mentionKey, mentionPlugin } from './mention-plugin';
import { RefNodeView } from './RefNodeView';
import { schema } from './schema';
import { fromDoc, toDoc } from './serialize';

export type BlockEditorProps = {
  block: Block.Block;
  autoFocus?: boolean;
  onEnter?: (beforeText: string, afterText: string) => void;
  onIndent?: () => void;
  onDedent?: () => void;
  // Cmd+Up / Cmd+Down toggle expanded state when wired (only for parents).
  // When the corresponding callback is undefined, the key falls through.
  onCollapseRequest?: () => void;
  onExpandRequest?: () => void;
};

// Increment 4: editor gains an inline ref node. Typing `@` opens a picker;
// selecting a target inserts a ref into the doc and persists a real ECHO Ref
// into Block.content. The RefNodeView resolves the target's label live on
// every ProseMirror update().
export const BlockEditor = ({
  block,
  autoFocus,
  onEnter,
  onIndent,
  onDedent,
  onCollapseRequest,
  onExpandRequest,
}: BlockEditorProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onEnterRef = useRef(onEnter);
  const onIndentRef = useRef(onIndent);
  const onDedentRef = useRef(onDedent);
  const onCollapseRequestRef = useRef(onCollapseRequest);
  const onExpandRequestRef = useRef(onExpandRequest);
  onEnterRef.current = onEnter;
  onIndentRef.current = onIndent;
  onDedentRef.current = onDedent;
  onCollapseRequestRef.current = onCollapseRequest;
  onExpandRequestRef.current = onExpandRequest;

  // Mention picker UI state, derived from the editor's mention plugin state.
  // The cursor coords carry top + bottom so the picker can decide whether to
  // open below the line (default) or flip above when there's no room.
  const [mention, setMention] = useState<{
    state: MentionState;
    cursor: { left: number; top: number; bottom: number };
  } | null>(null);

  // Resolver used by both the NodeView (for label rendering) and serialize.fromDoc
  // (to mint a Ref<Obj.Unknown> from a DXN string). Uses the block's database
  // so the ref is bound and `.target` resolves.
  const db = Obj.getDatabase(block);
  const resolveRef = useCallback(
    (dxnString: string) => {
      if (!db) {
        return undefined;
      }
      try {
        return db.makeRef(DXN.parse(dxnString)).target;
      } catch {
        return undefined;
      }
    },
    [db],
  );

  const makeRef = useCallback(
    (dxnString: string) => {
      if (!db) {
        return undefined;
      }
      try {
        return db.makeRef(DXN.parse(dxnString));
      } catch {
        return undefined;
      }
    },
    [db],
  );

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const enterCommand: Command = (state, dispatch) => {
      // When the picker is open, swallow Enter so the editor doesn't split.
      // The user clicks an item to select; closing happens elsewhere.
      const mState = mentionKey.getState(state);
      if (mState?.active) {
        return true;
      }
      if (!onEnterRef.current) {
        return false;
      }
      const { $from } = state.selection;
      const text = $from.parent.textBetween(0, $from.parent.content.size, '', '');
      const cursor = $from.parentOffset;
      const beforeText = text.slice(0, cursor);
      const afterText = text.slice(cursor);

      if (dispatch) {
        const tr = state.tr.delete(state.selection.from, $from.end());
        dispatch(tr);
      }

      onEnterRef.current(beforeText, afterText);
      return true;
    };

    const tabCommand: Command = () => {
      onIndentRef.current?.();
      return true;
    };

    const shiftTabCommand: Command = () => {
      onDedentRef.current?.();
      return true;
    };

    // F-V2 keybindings: Cmd+Up collapses the current bullet if it's an open
    // parent; Cmd+Down expands it if it's a closed parent. When the parent
    // hasn't wired the corresponding callback (no children, or already in
    // the target state), the command returns false so default cursor
    // behaviour still fires.
    const collapseCommand: Command = () => {
      if (!onCollapseRequestRef.current) {
        return false;
      }
      onCollapseRequestRef.current();
      return true;
    };

    const expandCommand: Command = () => {
      if (!onExpandRequestRef.current) {
        return false;
      }
      onExpandRequestRef.current();
      return true;
    };

    const escapeCommand: Command = (state) => {
      const mState = mentionKey.getState(state);
      if (mState?.active) {
        viewRef.current?.dispatch(state.tr.setMeta(mentionKey, 'close'));
        return true;
      }
      return false;
    };

    const editorState = EditorState.create({
      doc: toDoc(block.content as any),
      schema,
      plugins: [
        mentionPlugin,
        history(),
        keymap({
          Enter: enterCommand,
          Tab: tabCommand,
          'Shift-Tab': shiftTabCommand,
          'Mod-ArrowUp': collapseCommand,
          'Mod-ArrowDown': expandCommand,
          Escape: escapeCommand,
          'Mod-z': undo,
          'Mod-y': redo,
          'Mod-Shift-z': redo,
        }),
        keymap(baseKeymap),
      ],
    });

    const view = new EditorView(hostRef.current, {
      state: editorState,
      nodeViews: {
        ref: (node, viewArg, getPos) => new RefNodeView(node, viewArg, getPos, resolveRef),
      },
      dispatchTransaction: (transaction) => {
        const next = view.state.apply(transaction);
        view.updateState(next);
        if (transaction.docChanged) {
          const content = fromDoc(next.doc, makeRef);
          Obj.update(block, (block) => {
            block.content = content;
          });
        }

        // Drive the picker UI from plugin state.
        const mState = mentionKey.getState(next);
        if (mState?.active) {
          const coords = view.coordsAtPos(mState.from);
          setMention({
            state: mState,
            cursor: { left: coords.left, top: coords.top, bottom: coords.bottom },
          });
        } else {
          setMention(null);
        }
      },
    });
    viewRef.current = view;

    if (autoFocus) {
      view.focus();
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [block, makeRef, resolveRef]);

  const handleSelectTarget = useCallback(
    (target: Obj.Any) => {
      const view = viewRef.current;
      if (!view || !mention) {
        return;
      }
      const dxn = Obj.getDXN(target).toString();
      const refNode = schema.nodes.ref.create({ dxn });
      const spaceNode = schema.text(' ');
      const tr = view.state.tr.replaceWith(mention.state.from, mention.state.to, [refNode, spaceNode]);
      tr.setMeta(mentionKey, 'close');
      view.dispatch(tr);
      view.focus();
    },
    [mention],
  );

  const handleClosePicker = useCallback(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch(view.state.tr.setMeta(mentionKey, 'close'));
    }
    setMention(null);
  }, []);

  return (
    <div className='relative'>
      <div ref={hostRef} data-block-id={block.id} className='outline-none' />
      {mention && (
        <MentionPicker
          db={Obj.getDatabase(block)}
          query={mention.state.query}
          cursor={mention.cursor}
          excludeId={block.id}
          onSelect={handleSelectTarget}
          onClose={handleClosePicker}
        />
      )}
    </div>
  );
};
