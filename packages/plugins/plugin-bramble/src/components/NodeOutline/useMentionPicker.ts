//
// Copyright 2026 DXOS.org
//

import { type EditorView } from '@codemirror/view';
import { useCallback } from 'react';

import { Filter, Query } from '@dxos/echo';
import { type EchoDatabase } from '@dxos/echo-client';
import { type EditorMenuGroup, type EditorMenuItem, useEditorMenu } from '@dxos/react-ui-editor';
import { insertAtCursor } from '@dxos/ui-editor';

import { makeMarker } from './mention-extension';
import { createLinkedEdge } from '../../model/edges';
import { Node } from '../../types';

const labelOf = (n: Node): string => n.text?.target?.content || '(untitled)';

/**
 * The in-flow `@`-picker. Reuses Composer's popover/menu UI + the object-query pattern — but on
 * select it does NOT insert a markdown URL: it creates a **linked `Edge`** (source → target) and
 * inserts an **edge-referencing marker** `{{ref:<edge.id>}}` at the cursor (rendered by
 * `mentionChips`). Returns the popover `extension` (add to the editor) + the `EditorMenuProvider`
 * props (wrap the editor's element).
 */
export const useMentionPicker = ({ db, sourceNode }: { db?: EchoDatabase; sourceNode: Node }) => {
  const getMenu = useCallback(
    async ({ text, trigger }: { text: string; trigger?: string }): Promise<EditorMenuGroup[]> => {
      if (trigger !== '@' || !db) {
        return [];
      }
      const q = (text?.startsWith('@') ? text.slice(1) : (text ?? '')).toLowerCase();
      const nodes = (await db.query(Query.select(Filter.type(Node))).run()) as Node[];
      const items: EditorMenuItem[] = nodes
        .filter((n) => n.id !== sourceNode.id)
        .filter((n) => labelOf(n).toLowerCase().includes(q))
        .slice(0, 10)
        .map((target) => ({
          id: target.id,
          label: labelOf(target),
          onSelect: ({ view, head }: { view: EditorView; head: number }) => {
            const edge = createLinkedEdge(db, sourceNode, target);
            insertAtCursor(view, head, makeMarker(edge.id));
          },
        }));
      return items.length > 0 ? [{ id: 'nodes', items }] : [];
    },
    [db, sourceNode],
  );

  const { groupsRef, extension, ...menuProps } = useEditorMenu({ trigger: '@', getMenu });
  return { extension, groupsRef, menuProps };
};
