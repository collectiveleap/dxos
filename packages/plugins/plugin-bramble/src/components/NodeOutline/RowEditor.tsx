//
// Copyright 2026 DXOS.org
//

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
import { mentionChips, refreshChips } from './mention-extension';
import { useMentionPicker } from './useMentionPicker';
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
  const canMention = !!text && !readOnly && !!controller?.db;
  const { extension: mentionPickerExt, groupsRef, menuProps } = useMentionPicker({ db: controller?.db, sourceNode: node });

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
            ]
          : [createBasicExtensions({ readOnly: true })]),
        ...(controller && !readOnly ? [brambleGestures(controller, node.id)] : []),
        ...(canMention ? [mentionPickerExt] : []),
      ],
    }),
    [node.id, text, themeMode, readOnly, controller, resolveLabel, canMention, mentionPickerExt],
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
