//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { Obj, Ref } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { useBacklinkCount } from '../backlinks';
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
  // F-V4: number of inline refs from elsewhere pointing AT this Block.
  const backlinkCount = useBacklinkCount(block.id);

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
      <div className='flex items-baseline gap-1 group'>
        <ExpandChevron
          hasChildren={hasChildren}
          expanded={expanded}
          onToggle={toggleExpanded}
        />
        <Bullet
          hasChildren={hasChildren}
          expanded={expanded}
          onToggle={hasChildren ? toggleExpanded : undefined}
        />
        <div className='flex-1 min-w-0 flex items-baseline gap-2'>
          <div className='flex-1 min-w-0'>
            <BlockEditor
              block={block}
              autoFocus={focusId === block.id}
              onEnter={handleEnter}
              onIndent={handleIndent}
              onDedent={handleDedent}
              onCollapseRequest={hasChildren && expanded ? toggleExpanded : undefined}
              onExpandRequest={hasChildren && !expanded ? toggleExpanded : undefined}
            />
          </div>
          {backlinkCount > 0 && (
            <span
              className='text-[10px] leading-none px-1 py-0.5 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-600 dark:text-neutral-400 shrink-0 mt-1'
              title={`${backlinkCount} reference${backlinkCount === 1 ? '' : 's'}`}
            >
              {backlinkCount}
            </span>
          )}
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

type ExpandChevronProps = {
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
};

// F-V2 Expand/Collapse control: a chevron set inside a bordered, lightly
// filled circle. Hidden by default; revealed only while any part of the
// Block's row is hovered (group-hover) or while the chevron itself is
// focused. For non-parents, an empty same-width spacer reserves the slot so
// columns stay aligned. Tooltip surfaces the keyboard shortcut.
const ExpandChevron = ({ hasChildren, expanded, onToggle }: ExpandChevronProps) => {
  if (!hasChildren) {
    return <span className='shrink-0 w-5' aria-hidden />;
  }
  return (
    <button
      type='button'
      onClick={onToggle}
      title={expanded ? 'Collapse  ⌘↑' : 'Expand  ⌘↓'}
      aria-label={expanded ? 'Collapse' : 'Expand'}
      className='shrink-0 mt-1 w-5 h-5 inline-flex items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-[11px] leading-none text-neutral-500 dark:text-neutral-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer'
    >
      {expanded ? '▾' : '▸'}
    </button>
  );
};

type BulletProps = {
  hasChildren: boolean;
  expanded: boolean;
  onToggle?: () => void;
};

// F-V2 Block Bullet: always renders a small dark filled dot. When the Block
// has children AND is collapsed, a shaded ring (halo) surrounds the dot —
// the lone signal that hidden children exist. Open parents and leaves render
// as the dot alone. Click toggles expanded state for parents; for leaves the
// bullet is non-interactive.
const Bullet = ({ hasChildren, expanded, onToggle }: BulletProps) => {
  const isInteractive = Boolean(onToggle);
  const showCollapsedHalo = hasChildren && !expanded;

  return (
    <button
      type='button'
      onClick={onToggle}
      disabled={!isInteractive}
      aria-label={
        isInteractive ? (expanded ? 'Collapse children' : 'Expand children') : 'Bullet'
      }
      className={
        'shrink-0 mt-1 w-4 h-4 inline-flex items-center justify-center rounded-full transition-colors ' +
        (showCollapsedHalo ? 'bg-neutral-200 dark:bg-neutral-700' : '') +
        (isInteractive ? ' cursor-pointer' : '')
      }
    >
      <span className='inline-block w-2 h-2 rounded-full bg-neutral-500 dark:bg-neutral-400' />
    </button>
  );
};
