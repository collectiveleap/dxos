//
// Copyright 2026 DXOS.org
//

import { EditorView } from '@codemirror/view';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { Filter, Query, Relation } from '@dxos/echo';
import { Doc } from '@dxos/echo-doc';
import { useQuery } from '@dxos/react-client/echo';
import { useThemeContext } from '@dxos/react-ui';
import { EditorMenuProvider, useTextEditor } from '@dxos/react-ui-editor';
import { createBasicExtensions, createDataExtensions, createThemeExtensions } from '@dxos/ui-editor';
import { mx } from '@dxos/ui-theme';

import { useOutlineController } from './controller';
import { brambleGestures } from './gestures-extension';
import { mentionChips, mentionClicks, refreshChips, staleEdgeIds } from './mention-extension';
import { useOpenBeside } from './OpenBeside';
import { useMentionPicker } from './useMentionPicker';
import { removeEdge } from '../../model/edges';
import { Edge, type Node } from '../../types';

import './node-outline.css';

type RowEditorProps = {
  node: Node;
  readOnly?: boolean;
  testId?: string;
  /** Applied to the wrapper div; distinguishes header-scale vs. row-scale chrome (see node-outline.css). */
  className?: string;
};

export const RowEditor = ({ node, readOnly = false, testId, className }: RowEditorProps) => {
  const { themeMode } = useThemeContext();
  const controller = useOutlineController();
  const text = node.text?.target;

  // The node's outgoing LINKED edges (mentions). Their targets' titles are the chip labels; a
  // stable `resolveLabel` (reading a ref) keeps the editor from re-initializing as they change,
  // and `refreshChips` rebuilds the decorations when the map does.
  const linkedEdges = (useQuery(controller?.db, Query.select(Filter.id(node.id)).sourceOf(Edge)) as Edge[]).filter(
    (e) => e.kind === 'linked',
  );
  const labelMap = useMemo(
    () => new Map(linkedEdges.map((e) => [e.id, (Relation.getTarget(e) as Node).text?.target?.content ?? '…'])),
    [linkedEdges],
  );
  const labelMapRef = useRef(labelMap);
  labelMapRef.current = labelMap;
  const resolveLabel = useCallback((edgeId: string) => labelMapRef.current.get(edgeId) ?? '…', []);

  // The `@`-picker (editable rows only): on select it creates a linked Edge + inserts a marker.
  const db = controller?.db;
  const canMention = !!text && !readOnly && !!db;
  const { extension: mentionPickerExt, groupsRef, menuProps } = useMentionPicker({ db, sourceNode: node });

  // Keep edges ↔ markers in sync: when the user deletes a mention's marker, remove its linked Edge.
  const linkedEdgesRef = useRef(linkedEdges);
  linkedEdgesRef.current = linkedEdges;

  // Shift-click a chip → open its target alongside (UP-5.open-beside). The handler comes from the
  // plugin's Surface (null outside it); refs keep the editor extension stable.
  const openBeside = useOpenBeside();
  const openBesideRef = useRef(openBeside);
  openBesideRef.current = openBeside;
  const syncExt = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        // Only user edits remove edges — a programmatic change (remote sync, a future undo) that
        // drops a marker must not silently delete the linked Edge.
        const userEdit = update.transactions.some((tr) => tr.isUserEvent('input') || tr.isUserEvent('delete'));
        if (!update.docChanged || !userEdit || !db) {
          return;
        }
        const edges = linkedEdgesRef.current;
        const stale = new Set(staleEdgeIds(update.state.doc.toString(), edges.map((e) => e.id)));
        edges.filter((e) => stale.has(e.id)).forEach((e) => removeEdge(db, e));
      }),
    [db],
  );

  const { parentRef, view } = useTextEditor(
    () => ({
      id: node.id,
      initialValue: text?.content ?? '',
      extensions: [
        ...(text
          ? [
              createDataExtensions({ id: node.id, text: Doc.createAccessor(text, ['content']) }),
              createBasicExtensions({ readOnly }),
              createThemeExtensions({ themeMode }),
              mentionChips({ resolveLabel }),
              mentionClicks({
                onExpand: (edgeId) => controller?.toggleMention(edgeId),
                onOpenBeside: (edgeId) => {
                  const edge = linkedEdgesRef.current.find((e) => e.id === edgeId);
                  if (edge) {
                    openBesideRef.current?.(Relation.getTarget(edge) as Node);
                  }
                },
              }),
            ]
          : [createBasicExtensions({ readOnly: true })]),
        // The `@`-picker's popover keymap and `brambleGestures` are both `Prec.highest`; ties break
        // by array order, so the picker must come FIRST — its Enter/Arrow handlers gate on an open
        // menu and fall through to the row gestures when closed.
        ...(canMention ? [mentionPickerExt, syncExt] : []),
        ...(controller && !readOnly ? [brambleGestures(controller, node.id)] : []),
      ],
    }),
    [node.id, text, themeMode, readOnly, controller, resolveLabel, canMention, mentionPickerExt, syncExt],
  );
  useEffect(() => (view && controller ? controller.register(node.id, view) : undefined), [view, controller, node.id]);
  useEffect(() => {
    view?.dispatch({ effects: refreshChips.of(null) });
  }, [view, labelMap]);
  // The caller owns the test id: rows tag `bramble-node-name`; the header leaves the
  // inner editor untagged (its `bramble-header` wrapper is the region target) so the two
  // never collide in findAllByTestId or in the visual-region selectors.
  const editorDiv = <div data-testid={testId} data-node-id={node.id} className={mx(className)} ref={parentRef} />;
  return canMention ? (
    <EditorMenuProvider getView={() => view} groups={groupsRef.current} {...menuProps}>
      {editorDiv}
    </EditorMenuProvider>
  ) : (
    editorDiv
  );
};
