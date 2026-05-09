//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { Obj, Ref } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { BlockEditor } from '../BlockEditor';

import { Block } from '#types';

export type BlockNodeProps = {
  block: Block.Block;
  // Block that owns `block` via its children array.
  parent: Block.Block;
  // Block that owns `parent` via its children array. Undefined at top level
  // (when `parent` is the outline's invisible root).
  grandparent?: Block.Block;
  focusId: string | null;
  setFocusId: (id: string | null) => void;
};

// Increment 3b: recursive renderer. One BlockEditor for this Block, then a
// nested column of BlockNodes for its children. Tab/Shift+Tab/Enter handlers
// live here so they can close over the parent + grandparent context.
export const BlockNode = ({ block, parent, grandparent, focusId, setFocusId }: BlockNodeProps) => {
  const [snapshot] = useObject(block);

  const childRefs = ((snapshot.children ?? []) as readonly any[]).filter((ref) => ref?.target);
  const parentChildren = (parent.children ?? []) as readonly any[];
  const siblingIndex = parentChildren.findIndex((ref) => ref?.target?.id === block.id);

  const handleEnter = (_beforeText: string, afterText: string) => {
    if (siblingIndex < 0) {
      return;
    }
    const newBlock = Block.make({
      content: afterText.length > 0 ? [{ kind: 'text', text: afterText }] : [],
    });
    const before = parentChildren.slice(0, siblingIndex + 1);
    const after = parentChildren.slice(siblingIndex + 1);
    Obj.update(parent, (parent) => {
      (parent as any).children = [...before, Ref.make(newBlock), ...after];
    });
    setFocusId(newBlock.id);
  };

  const handleIndent = () => {
    if (siblingIndex <= 0) {
      return;
    }
    const prevSibling = parentChildren[siblingIndex - 1]?.target as Block.Block | undefined;
    if (!prevSibling) {
      return;
    }
    const movedRef = parentChildren[siblingIndex];
    Obj.update(parent, (parent) => {
      const arr = ((parent as any).children ?? []) as readonly any[];
      (parent as any).children = arr.filter((_, i) => i !== siblingIndex);
    });
    Obj.update(prevSibling, (prevSibling) => {
      const arr = ((prevSibling as any).children ?? []) as readonly any[];
      (prevSibling as any).children = [...arr, movedRef];
    });
    setFocusId(block.id);
  };

  const handleDedent = () => {
    if (!grandparent || siblingIndex < 0) {
      return;
    }
    const grandparentChildren = (grandparent.children ?? []) as readonly any[];
    const parentIndex = grandparentChildren.findIndex((ref) => ref?.target?.id === parent.id);
    if (parentIndex < 0) {
      return;
    }
    const movedRef = parentChildren[siblingIndex];
    Obj.update(parent, (parent) => {
      const arr = ((parent as any).children ?? []) as readonly any[];
      (parent as any).children = arr.filter((_, i) => i !== siblingIndex);
    });
    Obj.update(grandparent, (grandparent) => {
      const arr = ((grandparent as any).children ?? []) as readonly any[];
      (grandparent as any).children = [...arr.slice(0, parentIndex + 1), movedRef, ...arr.slice(parentIndex + 1)];
    });
    setFocusId(block.id);
  };

  return (
    <div>
      <BlockEditor
        block={block}
        autoFocus={focusId === block.id}
        onEnter={handleEnter}
        onIndent={handleIndent}
        onDedent={handleDedent}
      />
      {childRefs.length > 0 && (
        <div className='ml-6 space-y-1'>
          {childRefs.map((ref) => {
            const child = ref.target as Block.Block;
            return (
              <BlockNode
                key={child.id}
                block={child}
                parent={block}
                grandparent={parent}
                focusId={focusId}
                setFocusId={setFocusId}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
