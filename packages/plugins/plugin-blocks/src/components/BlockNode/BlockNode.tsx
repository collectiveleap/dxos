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

// Increment 3b + F-V2: recursive renderer with a clickable bullet marker.
// One Bullet + BlockEditor for this Block, then a nested column of BlockNodes
// for its children when expanded. Tab/Shift+Tab/Enter handlers live here so
// they can close over the parent + grandparent context.
export const BlockNode = ({ block, parent, grandparent, focusId, setFocusId }: BlockNodeProps) => {
  const [snapshot] = useObject(block);

  const childRefs = ((snapshot.children ?? []) as readonly any[]).filter((ref) => ref?.target);
  const parentChildren = (parent.children ?? []) as readonly any[];
  const siblingIndex = parentChildren.findIndex((ref) => ref?.target?.id === block.id);

  // F-V2: collapsed when state.expanded === false; default (undefined) is open.
  const expanded = (snapshot.state as any)?.expanded !== false;
  const hasChildren = childRefs.length > 0;

  const toggleExpanded = () => {
    Obj.update(block, (block) => {
      const mutable = block as any;
      mutable.state = { ...(mutable.state ?? {}), expanded: !expanded };
    });
  };

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
      <div className='flex items-baseline gap-2'>
        <Bullet
          hasChildren={hasChildren}
          expanded={expanded}
          childCount={childRefs.length}
          onToggle={hasChildren ? toggleExpanded : undefined}
        />
        <div className='flex-1 min-w-0'>
          <BlockEditor
            block={block}
            autoFocus={focusId === block.id}
            onEnter={handleEnter}
            onIndent={handleIndent}
            onDedent={handleDedent}
          />
        </div>
      </div>
      {hasChildren && expanded && (
        <div className='ml-6 space-y-1 border-l border-neutral-200 dark:border-neutral-800 pl-2'>
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

type BulletProps = {
  hasChildren: boolean;
  expanded: boolean;
  childCount: number;
  onToggle?: () => void;
};

// F-V1 + F-V2 visual: small clickable bullet glyph. Filled circle by default,
// outlined when a parent is collapsed; a count badge of hidden children
// appears next to a collapsed parent. Click toggles expanded state.
const Bullet = ({ hasChildren, expanded, childCount, onToggle }: BulletProps) => {
  const isInteractive = Boolean(onToggle);
  const showCollapsed = hasChildren && !expanded;

  return (
    <span className='flex shrink-0 items-center gap-1 mt-2'>
      <button
        type='button'
        onClick={onToggle}
        disabled={!isInteractive}
        aria-label={
          isInteractive ? (expanded ? 'Collapse children' : `Expand ${childCount} children`) : 'Bullet'
        }
        className={
          'inline-block w-2 h-2 rounded-full transition-colors ' +
          (showCollapsed
            ? 'border border-neutral-500 bg-transparent'
            : 'bg-neutral-400 dark:bg-neutral-500') +
          (isInteractive ? ' cursor-pointer hover:bg-neutral-700 dark:hover:bg-neutral-300' : '')
        }
      />
      {showCollapsed && childCount > 0 && (
        <span className='text-[10px] leading-none px-1 py-0.5 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-600 dark:text-neutral-400'>
          {childCount}
        </span>
      )}
    </span>
  );
};
