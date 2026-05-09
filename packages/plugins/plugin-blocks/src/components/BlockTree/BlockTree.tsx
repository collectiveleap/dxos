//
// Copyright 2025 DXOS.org
//

import React, { useEffect, useState } from 'react';

import { Obj, Ref } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { BlockEditor } from '../BlockEditor';

import { Block } from '#types';

export type BlockTreeProps = {
  rootBlock: Block.Block;
};

// Increment 3: renders a flat list of bullets. The rootBlock is the (invisible)
// container; its `children` array holds the visible Blocks. Enter creates a
// new sibling after the current one. No nesting yet (Tab is deferred to I3b).
export const BlockTree = ({ rootBlock }: BlockTreeProps) => {
  const [snapshot] = useObject(rootBlock);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Migrate I1/I2 outlines: if root has content but no children, demote the
  // content into a single child Block. Also covers the new-outline case where
  // BlockOutline.make seeded a child but a stale outline might lack one.
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

  const handleEnter = (currentBlock: Block.Block, _beforeText: string, afterText: string) => {
    const newBlock = Block.make({
      content: afterText.length > 0 ? [{ kind: 'text', text: afterText }] : [],
    });
    const idx = childRefs.findIndex((ref) => ref?.target?.id === currentBlock.id);
    if (idx < 0) {
      return;
    }
    const before = childRefs.slice(0, idx + 1);
    const after = childRefs.slice(idx + 1);
    Obj.update(rootBlock, (rootBlock) => {
      (rootBlock as any).children = [...before, Ref.make(newBlock), ...after];
    });
    setFocusId(newBlock.id);
  };

  // Right-click on a bullet copies its DXN to the clipboard.
  const handleContextMenu = (event: React.MouseEvent) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-block-id]');
    if (!element) {
      return;
    }
    const blockId = element.dataset.blockId;
    const ref = childRefs.find((candidate) => candidate?.target?.id === blockId);
    const block = ref?.target;
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
    <div className='p-4 space-y-1' onContextMenu={handleContextMenu}>
      {childRefs.map((ref) => {
        const block = ref.target as Block.Block;
        return (
          <BlockEditor
            key={block.id}
            block={block}
            autoFocus={block.id === focusId}
            onEnter={(beforeText, afterText) => handleEnter(block, beforeText, afterText)}
          />
        );
      })}
    </div>
  );
};
