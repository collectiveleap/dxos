//
// Copyright 2025 DXOS.org
//

import React, { useEffect, useState } from 'react';

import { Obj, Ref } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { BlockNode } from '../BlockNode';

import { Block } from '#types';

export type BlockTreeProps = {
  rootBlock: Block.Block;
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
  useEffect(() => {
    const contentArr = (snapshot.content ?? []) as readonly unknown[];
    const childrenArr = (snapshot.children ?? []) as readonly unknown[];
    if (childrenArr.length === 0) {
      const seed = Block.make(contentArr.length > 0 ? { content: [...contentArr] as any } : {});
      Obj.update(rootBlock, (rootBlock) => {
        (rootBlock as any).content = [];
        (rootBlock as any).children = [Ref.make(seed)];
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const childRefs = ((snapshot.children ?? []) as readonly any[]).filter((ref) => ref?.target);

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
        const child = ref.target as Block.Block;
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
const findBlockById = (rootBlock: Block.Block, id: string): Block.Block | undefined => {
  const stack: Block.Block[] = [rootBlock];
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
