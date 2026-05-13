//
// Copyright 2025 DXOS.org
//

import React, { useEffect, useState } from 'react';

import { Obj } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { BlockNode } from '../BlockNode';
import { createEdge, getStructuralChildren, useStructuralChildren } from '../BlockNode/child-edges';

import { Bramble } from '#types';

export type BlockTreeProps = {
  rootBlock: Bramble.Node;
};

// Increment 3b: top-level component that walks `rootBlock.children` and
// renders a recursive BlockNode for each. Owns `focusId` (preserved across
// re-parenting on Tab/Shift+Tab) and the contextmenu listener that copies
// a bullet's DXN to the clipboard.
export const BlockTree = ({ rootBlock }: BlockTreeProps) => {
  const [snapshot] = useObject(rootBlock);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Migrate I1/I2 outlines: if root has content but no children, demote the
  // content into a single child Block. Also covers stale outlines lacking
  // any seeded child.
  //
  // F-6 Phase 3+: skip the migration for plugin-managed Blocks —
  // wrappers (`supertags`), tag nodes (`tagTypename`), system nodes
  // (`systemNode`), and query nodes (`queryRef`) all have an
  // intentional structure that the legacy outline migration must not
  // disturb. Without this guard, zooming into a wrapper wipes its
  // `content` ref to the linked instance and seeds an empty child.
  useEffect(() => {
    const isSpecialBlock = Boolean(
      ((snapshot as any).supertags ?? []).length > 0 ||
        (snapshot as any).tagTypename ||
        (snapshot as any).systemNode ||
        (snapshot as any).queryRef,
    );
    if (isSpecialBlock) {
      return;
    }
    const db = Obj.getDatabase(rootBlock);
    // F-DAG Phase 3a: use the merged structural view to decide
    // whether to seed — a freshly-created outline with neither
    // legacy `Block.children` entries nor ChildEdges should still
    // get its seed bullet. An outline that's already been used (
    // either representation) is left alone.
    const existingStructuralChildren = getStructuralChildren(db, rootBlock).filter((ref: any) => ref?.target);
    if (existingStructuralChildren.length > 0) {
      return;
    }
    const contentArr = (snapshot.content ?? []) as readonly unknown[];
    const seed = Bramble.makeNode(contentArr.length > 0 ? { content: [...contentArr] as any } : {});
    if (contentArr.length > 0) {
      Obj.update(rootBlock, (rootBlock) => {
        (rootBlock as any).content = [];
      });
    }
    if (db) {
      db.add(seed);
      createEdge(db, rootBlock, seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // F-DAG: structural children come from two sources during the
  // migration — the legacy `Block.children` array (for outline
  // bullets that haven't been ported) and the new `ChildEdge`
  // relations (currently used by the F-6 Phase 3b promote flow
  // under Library). The hook merges both and stays subscribed so
  // newly-added edges trigger a re-render.
  const childRefs = useStructuralChildren(rootBlock).filter((ref: any) => ref?.target);

  // Right-click on any bullet copies its DXN to the clipboard. Walks up to the
  // closest [data-block-id] so nested bullets work too.
  const handleContextMenu = (event: React.MouseEvent) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-block-id]');
    if (!element) {
      return;
    }
    const blockId = element.dataset.blockId;
    if (!blockId) {
      return;
    }
    const block = findBlockById(rootBlock, blockId);
    if (!block) {
      return;
    }
    event.preventDefault();
    const dxn = Obj.getDXN(block).toString();
    void navigator.clipboard?.writeText(dxn);
    // eslint-disable-next-line no-console
    console.log('[plugin-blocks] copied DXN to clipboard:', dxn);
  };

  return (
    <div className='space-y-1' onContextMenu={handleContextMenu}>
      {childRefs.map((ref) => {
        const child = ref.target as Bramble.Node;
        return (
          <BlockNode
            key={child.id}
            block={child}
            parent={rootBlock}
            focusId={focusId}
            setFocusId={setFocusId}
          />
        );
      })}
    </div>
  );
};

// Walk the tree from rootBlock to find a Block by id. Used by the contextmenu
// to look up the right Block when nested bullets are rendered.
const findBlockById = (rootBlock: Bramble.Node, id: string): Bramble.Node | undefined => {
  const stack: Bramble.Node[] = [rootBlock];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.id === id) {
      return current;
    }
    const childRefs = (current.children ?? []) as readonly any[];
    for (const ref of childRefs) {
      const child = ref?.target;
      if (child) {
        stack.push(child);
      }
    }
  }
  return undefined;
};
