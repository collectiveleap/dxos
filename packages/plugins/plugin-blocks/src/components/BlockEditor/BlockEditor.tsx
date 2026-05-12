//
// Copyright 2025 DXOS.org
//

import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { type Command, EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { DXN, Obj, Ref } from '@dxos/echo';

import { MentionPicker } from '../MentionPicker';
import { TagPicker } from '../TagPicker';

import type { Block } from '#types';

import './block-editor.css';

import { caretFixPlugin } from './caret-fix-plugin';
import { type HashState, hashKey, hashPlugin } from './hash-plugin';
import { type MentionState, mentionKey, mentionPlugin } from './mention-plugin';
import { RefNodeView } from './RefNodeView';
import { schema } from './schema';
import { fromDoc, toDoc } from './serialize';
import { initialPropsForTag, type TagTypeEntry } from './tag-types';

export type BlockEditorProps = {
  block: Block.Block;
  autoFocus?: boolean;
  onEnter?: (beforeText: string, afterText: string) => void;
  onIndent?: () => void;
  onDedent?: () => void;
  // F-DAG Phase 3e: Cmd+Tab = "link" — same prev-sibling target as
  // indent, but the OLD parent edge is preserved (Block becomes
  // multi-parent). Tab still means MOVE (single edge). When this
  // callback is undefined, Cmd+Tab falls through to the default
  // (no-op for ProseMirror in our config).
  onLink?: () => void;
  // Cmd+Up / Cmd+Down toggle expanded state when wired (only for parents).
  // When the corresponding callback is undefined, the key falls through.
  onCollapseRequest?: () => void;
  onExpandRequest?: () => void;
  // ArrowUp / ArrowDown move the cursor to the previous / next visible
  // Block. The parent BlockNode walks the rendered tree to find the
  // adjacent visible row and focuses its editor. Always consumed so the
  // browser doesn't scroll on no-op edge cases.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  // Shift+Enter creates an empty sibling Block after the current one
  // without splitting current content. Cursor moves to the new sibling.
  onShiftEnter?: () => void;
  // Cmd+Shift+Enter (Mod+Shift+Enter) creates an empty sibling Block
  // BEFORE the current one (visually above it). Mirror of onShiftEnter.
  onShiftEnterAbove?: () => void;
  // F-Page-Header: when true, the editor is the H1 page header. Enter,
  // Shift+Enter, Cmd+Shift+Enter, Tab, and Shift+Tab are all consumed
  // without splitting content or invoking callbacks — the header has
  // no parent in the outline tree, so sibling-creation and indent/dedent
  // semantics don't apply. Body bullets keep their normal handlers.
  headlineMode?: boolean;
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
  onLink,
  onCollapseRequest,
  onExpandRequest,
  onMoveUp,
  onMoveDown,
  onShiftEnter,
  onShiftEnterAbove,
  headlineMode,
}: BlockEditorProps) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onEnterRef = useRef(onEnter);
  const onIndentRef = useRef(onIndent);
  const onDedentRef = useRef(onDedent);
  const onLinkRef = useRef(onLink);
  const onCollapseRequestRef = useRef(onCollapseRequest);
  const onExpandRequestRef = useRef(onExpandRequest);
  const onMoveUpRef = useRef(onMoveUp);
  const onMoveDownRef = useRef(onMoveDown);
  const onShiftEnterRef = useRef(onShiftEnter);
  const onShiftEnterAboveRef = useRef(onShiftEnterAbove);
  const headlineModeRef = useRef(headlineMode);
  onEnterRef.current = onEnter;
  onIndentRef.current = onIndent;
  onDedentRef.current = onDedent;
  onLinkRef.current = onLink;
  onCollapseRequestRef.current = onCollapseRequest;
  onExpandRequestRef.current = onExpandRequest;
  onMoveUpRef.current = onMoveUp;
  onMoveDownRef.current = onMoveDown;
  onShiftEnterRef.current = onShiftEnter;
  onShiftEnterAboveRef.current = onShiftEnterAbove;
  headlineModeRef.current = headlineMode;

  // Mention picker UI state, derived from the editor's mention plugin state.
  // The cursor coords carry top + bottom so the picker can decide whether to
  // open below the line (default) or flip above when there's no room.
  const [mention, setMention] = useState<{
    state: MentionState;
    cursor: { left: number; top: number; bottom: number };
  } | null>(null);

  // F-6 Phase 1: tag picker UI state — same shape as mention, driven by
  // hash-plugin (`#`) instead of mention-plugin (`@`).
  const [tag, setTag] = useState<{
    state: HashState;
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
      // F-Page-Header: header consumes Enter without splitting or callbacks
      // (the header has no parent in the outline tree, so sibling-creation
      // via Enter doesn't apply).
      if (headlineModeRef.current) {
        return true;
      }
      if (!onEnterRef.current) {
        return false;
      }
      const { $from } = state.selection;
      const text = $from.parent.textBetween(0, $from.parent.content.size, '', '');
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
      // F-Page-Header: header has no parent, indent is a no-op (consumed).
      if (headlineModeRef.current) {
        return true;
      }
      onIndentRef.current?.();
      return true;
    };

    const shiftTabCommand: Command = () => {
      // F-Page-Header: header has no parent, dedent is a no-op (consumed).
      if (headlineModeRef.current) {
        return true;
      }
      onDedentRef.current?.();
      return true;
    };

    // F-DAG Phase 3e: Cmd+Tab = LINK. Same target as indent (the
    // previous sibling) but the OLD parent edge is preserved, so
    // the Block becomes multi-parent. Consumed even when no
    // handler is wired so the browser doesn't trap focus.
    const linkCommand: Command = () => {
      if (headlineModeRef.current) {
        return true;
      }
      onLinkRef.current?.();
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

    // Shift+Enter creates an empty sibling Block AFTER the current one
    // without splitting the current bullet's content. Distinct from Enter
    // which splits at the cursor.
    const shiftEnterCommand: Command = () => {
      // F-Page-Header: header consumes Shift+Enter (no parent → no sibling).
      if (headlineModeRef.current) {
        return true;
      }
      if (!onShiftEnterRef.current) {
        return false;
      }
      onShiftEnterRef.current();
      return true;
    };

    // Cmd+Shift+Enter (Mod+Shift+Enter) creates an empty sibling Block
    // BEFORE the current one (visually above). Mirror of Shift+Enter.
    const shiftEnterAboveCommand: Command = () => {
      // F-Page-Header: header consumes Cmd+Shift+Enter (no parent → no sibling).
      if (headlineModeRef.current) {
        return true;
      }
      if (!onShiftEnterAboveRef.current) {
        return false;
      }
      onShiftEnterAboveRef.current();
      return true;
    };

    // ArrowUp / ArrowDown move to the previous / next VISIBLE Block
    // unconditionally — single-line bullets don't need within-paragraph
    // line navigation. Always returns true so the browser doesn't scroll
    // on no-op edge cases (top/bottom of outline).
    const arrowUpCommand: Command = () => {
      onMoveUpRef.current?.();
      return true;
    };

    const arrowDownCommand: Command = () => {
      onMoveDownRef.current?.();
      return true;
    };

    const escapeCommand: Command = (state) => {
      const mState = mentionKey.getState(state);
      if (mState?.active) {
        viewRef.current?.dispatch(state.tr.setMeta(mentionKey, 'close'));
        return true;
      }
      const hState = hashKey.getState(state);
      if (hState?.active) {
        viewRef.current?.dispatch(state.tr.setMeta(hashKey, 'close'));
        return true;
      }
      return false;
    };

    const editorState = EditorState.create({
      doc: toDoc(block.content as any),
      schema,
      plugins: [
        caretFixPlugin,
        mentionPlugin,
        hashPlugin,
        history(),
        keymap({
          Enter: enterCommand,
          'Shift-Enter': shiftEnterCommand,
          'Mod-Shift-Enter': shiftEnterAboveCommand,
          Tab: tabCommand,
          'Shift-Tab': shiftTabCommand,
          'Mod-Tab': linkCommand,
          'Mod-ArrowUp': collapseCommand,
          'Mod-ArrowDown': expandCommand,
          ArrowUp: arrowUpCommand,
          ArrowDown: arrowDownCommand,
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
        // F-DAG.Phase3e.multi-occurrence-edit-sync: external-sync
        // transactions reapply `block.content` from ECHO after
        // another BlockEditor instance wrote to the same Block.
        // Skip the write-back so the sync doesn't loop or trample
        // the content we just received.
        if (transaction.docChanged && !transaction.getMeta('externalSync')) {
          const content = fromDoc(next.doc, makeRef);
          Obj.update(block, (block) => {
            block.content = content;
          });
          // F-Supertag.title-sync (steady-state, write path):
          // propagate the node's plain text into each supertag's
          // typed instance via `Obj.setLabel`. ECHO requires writes
          // to flow through `Obj.update`, so the setLabel call is
          // wrapped accordingly. Wrapped in try/catch per the spec
          // — schemas with no usable `LabelAnnotation` degrade to
          // no-op rather than throwing.
          const plainText = next.doc.textContent;
          const supertags = ((block as any).supertags ?? []) as readonly any[];
          for (const ref of supertags) {
            const instance = ref?.target;
            if (!instance) {
              continue;
            }
            try {
              if (Obj.getLabel(instance) !== plainText) {
                Obj.update(instance, (instance) => {
                  Obj.setLabel(instance, plainText);
                });
              }
            } catch {
              /* schema declares no usable LabelAnnotation — no-op */
            }
          }
        }

        // Drive the picker UI from plugin state. Mention (`@`) and tag
        // (`#`) pickers are mutually exclusive — only one trigger can
        // be active at a time per the plugin definitions.
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
        const hState = hashKey.getState(next);
        if (hState?.active) {
          const coords = view.coordsAtPos(hState.from);
          setTag({
            state: hState,
            cursor: { left: coords.left, top: coords.top, bottom: coords.bottom },
          });
        } else {
          setTag(null);
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

  // F-Caret: when autoFocus flips to true on an already-mounted editor (e.g.
  // F-Nav arrow navigation flipping focusId on the BlockTree), the mount
  // effect does NOT re-run, so view.focus() is never called. Wire a
  // dedicated effect that focuses the view AND places the PM selection at
  // the start of the doc so the caret has a paintable position. The
  // caret-fix decoration handles the case where the doc is empty.
  useEffect(() => {
    if (!autoFocus) {
      return;
    }
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const tr = view.state.tr.setSelection(TextSelection.atStart(view.state.doc));
    view.dispatch(tr);
    view.focus();
  }, [autoFocus]);

  // F-DAG.Phase3e.multi-occurrence-edit-sync: in a DAG-shaped outline
  // the same Block can be rendered by two or more BlockEditor
  // instances at once (multi-predecessor Blocks, side-by-side panes,
  // the same Block reachable via more than one structural edge).
  // When the user types into ONE of those editors, the local PM
  // transaction round-trips through `Obj.update(block, ...)`; every
  // OTHER editor bound to the same Block needs to re-sync its PM doc
  // from the new `block.content`.
  //
  // Approach: subscribe to the Block via `Obj.subscribe`. On each
  // callback, compute the expected PM doc from `block.content` and
  // compare against the editor's current doc with `Node.eq`. If they
  // already match (the source editor's own write just round-tripped)
  // no-op. Otherwise dispatch a `replaceWith` transaction tagged with
  // a `externalSync` meta flag — `dispatchTransaction` above checks
  // that flag and SKIPS the write-back, otherwise the sync would loop.
  useEffect(() => {
    const unsubscribe = Obj.subscribe(block, () => {
      const view = viewRef.current;
      if (!view) {
        return;
      }
      const expected = toDoc((block as any).content as any);
      if (expected.eq(view.state.doc)) {
        return;
      }
      const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, expected.content);
      tr.setMeta('externalSync', true);
      view.dispatch(tr);
    });
    return () => {
      unsubscribe?.();
    };
  }, [block]);

  // F-Supertag.title-sync (steady-state, read path): when ANY
  // supertag's typed instance has its label changed by an external
  // writer (FieldGroup form input, a dedicated Composer surface,
  // another plugin, an import), propagate the new label back into
  // `block.content` as a single text segment. The multi-occurrence-
  // edit-sync subscriber above then handles the PM-level update.
  //
  // Re-binds instance subscribers whenever the supertags array
  // changes (subscribed via the block itself), so adding/removing a
  // `#`-tag swaps the active set of instance-watchers without a
  // remount.
  useEffect(() => {
    let instanceSubs: Array<() => void> = [];
    const bindInstanceSubs = () => {
      for (const unsub of instanceSubs) {
        try {
          unsub();
        } catch {
          /* noop */
        }
      }
      instanceSubs = [];
      const supertags = ((block as any).supertags ?? []) as readonly any[];
      for (const ref of supertags) {
        const instance = ref?.target;
        if (!instance) {
          continue;
        }
        const unsub = Obj.subscribe(instance, () => {
          let label: string;
          try {
            const got = Obj.getLabel(instance);
            if (typeof got !== 'string') {
              return;
            }
            label = got;
          } catch {
            return;
          }
          const currentText = (((block as any).content ?? []) as readonly any[])
            .map((segment: any) => (segment?.kind === 'text' ? (segment.text ?? '') : ''))
            .join('');
          if (currentText === label) {
            return;
          }
          Obj.update(block, (block: any) => {
            block.content = [{ kind: 'text', text: label }];
          });
        });
        instanceSubs.push(unsub);
      }
    };
    bindInstanceSubs();
    const blockSub = Obj.subscribe(block, () => bindInstanceSubs());
    return () => {
      try {
        blockSub?.();
      } catch {
        /* noop */
      }
      for (const unsub of instanceSubs) {
        try {
          unsub();
        } catch {
          /* noop */
        }
      }
    };
  }, [block]);

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

  // F-6 Phase 1: applying a tag — create a new instance of the selected
  // type, add it to the block's database, append a Ref to
  // `Block.supertags`, then strip the `#`-and-query trigger text from
  // the editor (no inline marker — the chip lives outside the
  // contenteditable, rendered by BlockNode).
  const handleSelectTag = useCallback(
    (entry: TagTypeEntry) => {
      const view = viewRef.current;
      if (!view || !tag || !db) {
        return;
      }
      const instance = Obj.make(entry.schema as any, initialPropsForTag(entry.schema) as any);
      db.add(instance);
      Obj.update(block, (mutable) => {
        const previous = ((mutable as any).supertags ?? []) as readonly any[];
        (mutable as any).supertags = [...previous, db.makeRef(Obj.getDXN(instance))];
      });
      const tr = view.state.tr.delete(tag.state.from, tag.state.to);
      tr.setMeta(hashKey, 'close');
      view.dispatch(tr);
      view.focus();
    },
    [tag, db, block],
  );

  const handleCloseTagPicker = useCallback(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch(view.state.tr.setMeta(hashKey, 'close'));
    }
    setTag(null);
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
      {tag && (
        <TagPicker
          query={tag.state.query}
          cursor={tag.cursor}
          db={db}
          onSelect={handleSelectTag}
          onClose={handleCloseTagPicker}
        />
      )}
    </div>
  );
};
