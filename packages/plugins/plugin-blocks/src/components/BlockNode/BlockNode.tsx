//
// Copyright 2025 DXOS.org
//

import React, { useState } from 'react';

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

// Recursive renderer for a Block and its children. Tab/Shift+Tab/Enter
// handlers live here so they can close over the parent + grandparent context.
// Visual rules are owned by the Bullet and ExpandChevron sub-components below.
export const BlockNode = ({ block, parent, grandparent, focusId, setFocusId }: BlockNodeProps) => {
  const [snapshot] = useObject(block);
  // Per-row hover state — drives ExpandChevron visibility. Replaces a Tailwind
  // `group-hover:` approach that was lighting up multiple chevrons at once.
  const [rowHovered, setRowHovered] = useState(false);

  const childRefs = ((snapshot.children ?? []) as readonly any[]).filter((ref) => ref?.target);
  const parentChildren = (parent.children ?? []) as readonly any[];
  const siblingIndex = parentChildren.findIndex((ref) => ref?.target?.id === block.id);

  // F-V2: collapsed when state.expanded === false; default (undefined) is open.
  const expanded = (snapshot.state as any)?.expanded !== false;
  const hasChildren = childRefs.length > 0;

  // F-V6: a Block whose content is exactly one ref segment (no meaningful
  // text) is a "reference-only" Block. Its bullet renders with a dashed
  // outer ring, and its backlink count reflects the TARGET's count rather
  // than its own — visually it stands in for the target.
  const referenceOnly = isReferenceOnlyBlock(snapshot);
  const refTarget = referenceOnly ? getReferenceTarget(snapshot) : undefined;
  const backlinkLookupId = (refTarget as any)?.id ?? block.id;
  const backlinkCount = useBacklinkCount(backlinkLookupId);

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

  // F-Nav: arrow-key navigation between visible Blocks. Walks the rendered
  // DOM (which by construction matches the visible-tree order, since
  // collapsed children aren't mounted) to find the prev/next [data-block-id]
  // row and focuses its editor at the start. Scrolls the target into view
  // if it's outside the viewport. No-op at the top/bottom edge.
  const handleMoveUp = () => {
    moveToAdjacentVisibleBlock(block.id, 'up');
  };

  const handleMoveDown = () => {
    moveToAdjacentVisibleBlock(block.id, 'down');
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
      <div
        className='flex items-baseline gap-1'
        onMouseEnter={() => setRowHovered(true)}
        onMouseLeave={() => setRowHovered(false)}
      >
        <ExpandChevron
          hasChildren={hasChildren}
          expanded={expanded}
          visible={rowHovered && hasChildren}
          onToggle={toggleExpanded}
        />
        <Bullet
          hasChildren={hasChildren}
          expanded={expanded}
          referenceOnly={referenceOnly}
          onToggle={hasChildren ? toggleExpanded : undefined}
        />
        <div className='flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2'>
          {/* Editor wrapper sized to its content so the badge sits right
              next to the text rather than at the row's far edge. The
              [&_*]:inline-block / [&_p]:inline-block hack collapses
              ProseMirror's host div and its <p> to inline-block so the
              wrap-width (not the parent's max width) drives the column
              size, and flex-wrap can place the badge adjacent to the
              last line of text. */}
          <div className='min-w-0 max-w-full [&_.ProseMirror]:inline-block [&_p]:inline-block'>
            <BlockEditor
              block={block}
              autoFocus={focusId === block.id}
              onEnter={handleEnter}
              onIndent={handleIndent}
              onDedent={handleDedent}
              onCollapseRequest={hasChildren && expanded ? toggleExpanded : undefined}
              onExpandRequest={hasChildren && !expanded ? toggleExpanded : undefined}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          </div>
          {backlinkCount > 0 && (
            <span
              className='text-xs leading-none px-1.5 py-0.5 border border-neutral-300 dark:border-neutral-700 rounded text-neutral-600 dark:text-neutral-400 shrink-0'
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

// Walk all rendered [data-block-id] rows in DOM order, find the one matching
// `currentId`, and focus the previous/next sibling. The DOM order matches
// the visible-tree order because collapsed children aren't rendered. Scrolls
// the target into view if it's off-screen. Returns true if focus moved.
const moveToAdjacentVisibleBlock = (currentId: string, direction: 'up' | 'down'): boolean => {
  const all = Array.from(document.querySelectorAll('[data-block-id]')) as HTMLElement[];
  const currentIndex = all.findIndex((el) => el.dataset.blockId === currentId);
  if (currentIndex < 0) {
    return false;
  }
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= all.length) {
    return false;
  }
  const targetEl = all[targetIndex];
  const editable = targetEl.querySelector<HTMLElement>('[contenteditable="true"]');
  if (!editable) {
    return false;
  }
  editable.focus();
  // Place caret at the start of the target's editor.
  try {
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  } catch {
    /* selection setup is best-effort */
  }
  targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return true;
};

// Detects a Block whose content is exactly one ref segment with no meaningful
// text. Such Blocks are rendered as references to their target.
const isReferenceOnlyBlock = (block: any): boolean => {
  const content = (block?.content ?? []) as readonly any[];
  if (!Array.isArray(content) || content.length === 0) {
    return false;
  }
  let refCount = 0;
  let textChars = 0;
  for (const segment of content) {
    if (segment?.kind === 'ref') {
      refCount += 1;
    } else if (segment?.kind === 'text') {
      textChars += (segment.text ?? '').trim().length;
    }
  }
  return refCount >= 1 && textChars === 0;
};

const getReferenceTarget = (block: any): unknown => {
  const content = (block?.content ?? []) as readonly any[];
  for (const segment of content) {
    if (segment?.kind === 'ref') {
      return segment.target?.target;
    }
  }
  return undefined;
};

type ExpandChevronProps = {
  hasChildren: boolean;
  expanded: boolean;
  visible: boolean;
  onToggle: () => void;
};

// F-V2 Expand/Collapse control: a chevron set inside a bordered, lightly
// filled circle. Hidden by default; the parent BlockNode tracks its row's
// hover state via React and passes `visible`. Keyboard focus also reveals
// the control via `focus-visible`. For non-parents an empty same-width
// spacer reserves the slot so columns stay aligned. Tooltip surfaces the
// keyboard shortcut.
const ExpandChevron = ({ hasChildren, expanded, visible, onToggle }: ExpandChevronProps) => {
  if (!hasChildren) {
    return <span className='shrink-0 w-6' aria-hidden />;
  }
  return (
    <button
      type='button'
      onClick={onToggle}
      title={expanded ? 'Collapse  ⌘↑' : 'Expand  ⌘↓'}
      aria-label={expanded ? 'Collapse' : 'Expand'}
      className={
        'shrink-0 mt-0.5 w-6 h-6 inline-flex items-center justify-center rounded-full border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 transition-opacity hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer focus-visible:opacity-100 ' +
        (visible ? 'opacity-100' : 'opacity-0 pointer-events-none')
      }
    >
      <svg
        width='12'
        height='12'
        viewBox='0 0 12 12'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.75'
        strokeLinecap='round'
        strokeLinejoin='round'
        aria-hidden='true'
      >
        {expanded ? <path d='M3 5 L6 8 L9 5' /> : <path d='M5 3 L8 6 L5 9' />}
      </svg>
    </button>
  );
};

type BulletProps = {
  hasChildren: boolean;
  expanded: boolean;
  referenceOnly?: boolean;
  onToggle?: () => void;
};

// Block Bullet: always renders a small dark filled dot. State indicators:
// - Closed parent: dark dot with a shaded halo around it.
// - Open parent or leaf: dark dot alone.
// - Reference-only Block (F-V6): dark dot + shaded halo + dashed outer ring.
// Click toggles expanded state for parents; reference-only and leaf bullets
// are non-interactive.
const Bullet = ({ hasChildren, expanded, referenceOnly, onToggle }: BulletProps) => {
  const isInteractive = Boolean(onToggle) && !referenceOnly;
  const showHalo = referenceOnly || (hasChildren && !expanded);
  const showDashedRing = Boolean(referenceOnly);

  return (
    <button
      type='button'
      onClick={onToggle}
      disabled={!isInteractive}
      aria-label={
        referenceOnly
          ? 'Reference bullet'
          : isInteractive
            ? expanded
              ? 'Collapse children'
              : 'Expand children'
            : 'Bullet'
      }
      className={
        'shrink-0 mt-1 w-5 h-5 inline-flex items-center justify-center rounded-full transition-colors ' +
        (showDashedRing ? 'border border-dashed border-neutral-400 dark:border-neutral-500 ' : '') +
        (isInteractive ? 'cursor-pointer ' : '')
      }
    >
      <span
        className={
          'inline-flex items-center justify-center w-4 h-4 rounded-full ' +
          (showHalo ? 'bg-neutral-200 dark:bg-neutral-700' : '')
        }
      >
        <span className='inline-block w-2 h-2 rounded-full bg-neutral-500 dark:bg-neutral-400' />
      </span>
    </button>
  );
};
