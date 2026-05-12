//
// Copyright 2025 DXOS.org
//

import React, { useMemo, useRef, useState } from 'react';

import { Obj, Relation } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { useBacklinkCount, useOpenPane, useZoom } from '../backlinks';
import { BlockEditor } from '../BlockEditor';
import { TAG_TYPES } from '../BlockEditor/tag-types';
import { MentionPicker } from '../MentionPicker';
import {
  childEdgesOf,
  createChildEdge,
  ensureMigratedChildren,
  findChildEdge,
  orderBetween,
  setEdgeExpanded,
  useEdgeExpanded,
  useParentEdgeCount,
  useStructuralChildren,
} from './child-edges';
import { FieldGroups } from './FieldGroup';
import { QueryNodeView } from './QueryNodeView';
import { tagLabelOf, useTagBlock } from './tag-supertags';

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

  // F-DAG Phase 2: structural children are read via the merge hook
  // so that ChildEdges-out-of-this-Block (e.g. tag-node → query
  // child) participate. Called BEFORE the queryRef early return to
  // keep hooks order stable; query nodes don't read `childRefs`
  // anyway because they hand off to `<QueryNodeView>`.
  const mergedChildren = useStructuralChildren(block);

  // F-DAG Phase 3e: parent count — how many structural parents
  // (ChildEdges fanning IN) point at this Block. >1 means the Block
  // is multi-parent and renders with a badge near the bullet.
  const parentEdgeCount = useParentEdgeCount(block);

  // F-6 Phase 3b: a Block carrying a `queryRef` marker is rendered as
  // a live query result list instead of the standard bullet + content
  // + children layout. The dispatch happens AFTER hooks so the rules
  // of hooks are respected; the rest of this component's mutation
  // handlers don't matter for query nodes since they aren't reached.
  if ((snapshot as any).queryRef) {
    return <QueryNodeView block={snapshot} />;
  }

  const childRefs = mergedChildren.filter((ref: any) => ref?.target);
  // F-DAG Phase 3b: sibling reads also go through the merge so
  // `siblingIndex` reflects the post-migration position of this
  // Block among its siblings (legacy `parent.children` entries
  // first, then ChildEdges sorted by `order`). Insert/indent/dedent
  // writers use this index to find adjacent siblings for ordering.
  const parentChildren = useStructuralChildren(parent);
  const siblingIndex = parentChildren.findIndex((ref: any) => ref?.target?.id === block.id);

  // F-DAG Phase 4: per-occurrence collapse. `expanded` lives ON the
  // edge `parent → block`, so a Block that's been Cmd+Tab-linked
  // into a second parent has independent collapse state in each
  // place. The hook falls back to the legacy `block.state.expanded`
  // when no edge exists yet (pre-Phase-3a outlines).
  const expanded = useEdgeExpanded(parent, block);
  const hasChildren = childRefs.length > 0;

  // F-V6: a Block whose content is exactly one ref segment (no meaningful
  // text) is a "reference-only" Block. Its bullet renders with a dashed
  // outer ring, and its backlink count reflects the TARGET's count rather
  // than its own — visually it stands in for the target.
  const referenceOnly = isReferenceOnlyBlock(snapshot);
  const refTarget = referenceOnly ? getReferenceTarget(snapshot) : undefined;
  const backlinkLookupId = (refTarget as any)?.id ?? block.id;
  const backlinkCount = useBacklinkCount(backlinkLookupId);

  // F-Zoom: clicking the bullet zooms into this Block. The handler comes
  // from BlockArticle via context; default is a no-op when no provider is
  // mounted (e.g., storybook stories).
  const zoom = useZoom();
  // F-Open-Pane: shift-clicking the bullet opens the Block in a new pane
  // to the right. For reference-only Blocks, the TARGET is what gets
  // opened (per F-Open-Pane.ref-only).
  const openPane = useOpenPane();

  const toggleExpanded = () => {
    // F-DAG Phase 4: persist collapse on the edge `parent → block`
    // so the toggle affects ONLY this occurrence of the Block. The
    // helper falls back to `block.state.expanded` if no edge exists
    // (purely defensive — Phase 3d's read-side migration ensures
    // an edge is in place by the time any user gesture reaches us).
    const db = Obj.getDatabase(parent);
    if (!db) {
      return;
    }
    setEdgeExpanded(db, parent, block, !expanded);
  };

  const insertSiblingAfter = (initialContent: any[]) => {
    if (siblingIndex < 0) {
      return;
    }
    // F-DAG Phase 3b: migrate the parent's legacy `Block.children`
    // (if any) onto ChildEdges with sequential `order`s, then
    // attach the new sibling via a fractional `order` placed
    // between this Block's edge and the next one. After this
    // first edit, the parent is edge-only forever.
    const db = Obj.getDatabase(parent);
    if (!db) {
      return;
    }
    ensureMigratedChildren(db, parent);
    const newBlock = Block.make({ content: initialContent });
    db.add(newBlock);
    const edgesNow = childEdgesOf(db, parent);
    const currentIndex = edgesNow.findIndex((edge: any) => (Relation.getTarget(edge) as any)?.id === block.id);
    const beforeEdge = currentIndex >= 0 ? edgesNow[currentIndex] : undefined;
    const afterEdge = currentIndex >= 0 ? edgesNow[currentIndex + 1] : undefined;
    createChildEdge(db, parent, newBlock, { order: orderBetween(beforeEdge, afterEdge) });
    setFocusId(newBlock.id);
  };

  // F-Cmd-Shift-Enter: insert a new empty sibling BEFORE this one
  // (visually above). Mirror of insertSiblingAfter; chooses the
  // adjacent-sibling pair on the OTHER side of `block`'s edge.
  const insertSiblingBefore = (initialContent: any[]) => {
    if (siblingIndex < 0) {
      return;
    }
    const db = Obj.getDatabase(parent);
    if (!db) {
      return;
    }
    ensureMigratedChildren(db, parent);
    const newBlock = Block.make({ content: initialContent });
    db.add(newBlock);
    const edgesNow = childEdgesOf(db, parent);
    const currentIndex = edgesNow.findIndex((edge: any) => (Relation.getTarget(edge) as any)?.id === block.id);
    const beforeEdge = currentIndex > 0 ? edgesNow[currentIndex - 1] : undefined;
    const afterEdge = currentIndex >= 0 ? edgesNow[currentIndex] : undefined;
    createChildEdge(db, parent, newBlock, { order: orderBetween(beforeEdge, afterEdge) });
    setFocusId(newBlock.id);
  };

  const handleEnter = (_beforeText: string, afterText: string) => {
    insertSiblingAfter(afterText.length > 0 ? [{ kind: 'text', text: afterText }] : []);
  };

  // F-Shift-Enter: create an empty sibling Block AFTER this one without
  // splitting the current bullet's content. Cursor moves to the new sibling.
  const handleShiftEnter = () => {
    insertSiblingAfter([]);
  };

  // F-Cmd-Shift-Enter: create an empty sibling Block BEFORE this one
  // (visually above) without splitting current content. Cursor moves
  // to the new sibling.
  const handleShiftEnterAbove = () => {
    insertSiblingBefore([]);
  };

  const handleIndent = () => {
    if (siblingIndex <= 0) {
      return;
    }
    const prevSibling = parentChildren[siblingIndex - 1]?.target as Block.Block | undefined;
    if (!prevSibling) {
      return;
    }
    const db = Obj.getDatabase(parent);
    if (!db) {
      return;
    }
    // F-DAG Phase 3c: indent = move the edge `parent → block` to
    // `prevSibling → block`. Both endpoints get migrated onto
    // ChildEdges on first touch; the new edge is appended at the
    // end of prevSibling's children (default order = max + 1).
    ensureMigratedChildren(db, parent);
    ensureMigratedChildren(db, prevSibling);
    const edge = findChildEdge(db, parent, block);
    if (edge) {
      db.remove(edge);
    }
    createChildEdge(db, prevSibling, block);
    setFocusId(block.id);
  };

  // F-DAG Phase 3e: LINK (Cmd+Tab) — same target as indent (prev
  // sibling becomes a new parent), but the existing `parent → block`
  // edge is PRESERVED. Block becomes multi-parent: it renders both
  // under `parent` and under `prevSibling`, with the multi-parent
  // badge surfacing on every occurrence.
  const handleLink = () => {
    if (siblingIndex <= 0) {
      return;
    }
    const prevSibling = parentChildren[siblingIndex - 1]?.target as Block.Block | undefined;
    if (!prevSibling) {
      return;
    }
    const db = Obj.getDatabase(parent);
    if (!db) {
      return;
    }
    // Migrate both endpoints so all edges are explicit.
    ensureMigratedChildren(db, parent);
    ensureMigratedChildren(db, prevSibling);
    // If an edge prevSibling → block already exists, no-op (link
    // is idempotent — pressing Cmd+Tab twice doesn't pile up
    // duplicate edges).
    if (findChildEdge(db, prevSibling, block)) {
      return;
    }
    createChildEdge(db, prevSibling, block);
    // Note: we do NOT remove the existing parent → block edge.
    setFocusId(block.id);
  };

  // F-Nav: arrow-key navigation between visible Blocks. Walks the rendered
  // DOM (which by construction matches the visible-tree order, since
  // collapsed children aren't mounted) to find the prev/next [data-block-id]
  // row and focuses its editor at the start. Scrolls the target into view
  // if it's outside the viewport. No-op at the top/bottom edge.
  const handleMoveUp = () => {
    moveToAdjacentVisibleBlock(block.id, 'up', setFocusId);
  };

  const handleMoveDown = () => {
    moveToAdjacentVisibleBlock(block.id, 'down', setFocusId);
  };

  const handleDedent = () => {
    if (!grandparent || siblingIndex < 0) {
      return;
    }
    const db = Obj.getDatabase(parent);
    if (!db) {
      return;
    }
    // F-DAG Phase 3c: dedent = move the edge `parent → block` to
    // `grandparent → block`, with `order` placed between parent's
    // edge (in grandparent) and parent's next sibling. Both
    // endpoints get migrated first so all relevant edges have
    // explicit orders.
    ensureMigratedChildren(db, parent);
    ensureMigratedChildren(db, grandparent);
    const blockEdge = findChildEdge(db, parent, block);
    if (blockEdge) {
      db.remove(blockEdge);
    }
    const parentEdge = findChildEdge(db, grandparent, parent);
    if (!parentEdge) {
      // grandparent no longer parents this parent — bail out
      // rather than create an orphan edge.
      return;
    }
    const grandparentEdges = childEdgesOf(db, grandparent);
    const parentIndex = grandparentEdges.findIndex(
      (edge: any) => (Relation.getTarget(edge) as any)?.id === parent.id,
    );
    const nextEdge = parentIndex >= 0 ? grandparentEdges[parentIndex + 1] : undefined;
    createChildEdge(db, grandparent, block, { order: orderBetween(parentEdge, nextEdge) });
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
          expanded={expanded}
          visible={rowHovered}
          onToggle={toggleExpanded}
        />
        <Bullet
          hasChildren={hasChildren}
          expanded={expanded}
          referenceOnly={referenceOnly}
          onClick={referenceOnly ? undefined : () => zoom(block.id)}
          onShiftClick={() => openPane((refTarget as Block.Block | undefined) ?? block)}
        />
        {parentEdgeCount > 1 && (
          <span
            className='shrink-0 self-baseline text-[10px] leading-none px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
            title={`Appears in ${parentEdgeCount} places`}
          >
            {parentEdgeCount}
          </span>
        )}
        <div className='flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2'>
          {/* Editor wrapper sized to its content so the badge sits right
              next to the text rather than at the row's far edge. The
              `[&_.ProseMirror]:inline-block` collapses ProseMirror's host
              div to inline-block so the wrap-width (not the parent's max
              width) drives the column size, and flex-wrap can place the
              badge adjacent to the last line of text.

              F-Caret: we deliberately do NOT make the inner `<p>`
              inline-block. PM auto-injects `<br class="ProseMirror-trailingBreak">`
              into empty textblocks; for an inline-block `<p>` Safari
              renders that as a 2-line-tall element and paints two
              carets (one per line). Keeping `<p>` block-level inside
              the inline-block `.ProseMirror` constrains the empty
              paragraph to a single line height and yields one caret. */}
          <div className='min-w-0 max-w-full [&_.ProseMirror]:inline-block'>
            <BlockEditor
              block={block}
              autoFocus={focusId === block.id}
              onEnter={handleEnter}
              onIndent={handleIndent}
              onDedent={handleDedent}
              onLink={handleLink}
              onCollapseRequest={expanded ? toggleExpanded : undefined}
              onExpandRequest={!expanded ? toggleExpanded : undefined}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onShiftEnter={handleShiftEnter}
              onShiftEnterAbove={handleShiftEnterAbove}
            />
          </div>
          <TagChips block={snapshot} />
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
      {expanded && (
        <div className='ml-6 space-y-1 border-l border-neutral-200 dark:border-neutral-800 pl-2'>
          {/* F-6 Phase 2: typed-field rows for each applied supertag,
              rendered above the children. Sits inside the same
              indented column so the field group visually belongs to
              the tagged bullet without taking a bullet of its own.
              Pass the LIVE block (not the snapshot) so the FieldGroup
              can mutate ref-target instances via Obj.update — snapshots
              are frozen. */}
          <FieldGroups block={block} />
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
          {/* F-Pending-Child: leaves with no real children render a faint
              placeholder row at the end. First keystroke promotes it
              to a real child Block (no persistence until typed into),
              after which the pending row disappears (this branch only
              fires while there are no children). Parents do NOT get a
              pending row — per spec, only leaves. */}
          {!hasChildren && (
            <PendingChildRow
              parent={block}
              onPromote={(initialText) => {
                // F-DAG Phase 3a: the pending-child placeholder only
                // shows on LEAVES (parent has no real children), so
                // there are no existing siblings to consider — append
                // exactly one new child via a fresh ChildEdge. Parent
                // `Block.children` stays empty.
                const db = Obj.getDatabase(block);
                if (!db) {
                  return;
                }
                const newChild = Block.make({
                  content: initialText.length > 0 ? [{ kind: 'text', text: initialText }] : [],
                });
                db.add(newChild);
                createChildEdge(db, block, newChild);
                setFocusId(newChild.id);
              }}
              onAddExisting={(target) => {
                // F-DAG.Phase3a.add-existing-via-picker: when the user
                // selects an existing Block from the @ picker, add it
                // as a STRUCTURAL CHILD via `createChildEdge` — no
                // wrapper Block, no content-ref. Cycle prevention from
                // Phase 5 fires inside `createChildEdge`.
                const db = Obj.getDatabase(block);
                if (!db) {
                  return;
                }
                createChildEdge(db, block, target as Block.Block);
                setFocusId((target as any).id ?? null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

// Walk all rendered [data-block-id] rows in DOM order, find the one matching
// `currentId`, and focus the previous/next sibling. The DOM order matches
// the visible-tree order because collapsed children aren't rendered. Scrolls
// the target into view if it's off-screen. Returns true if focus moved.
//
// F-Caret: focusing is routed through `setFocusId` rather than calling
// `editable.focus()` + setting a DOM Range directly. The previous DOM-level
// approach placed the selection at `editable, 0` (BEFORE the `<p>`), which
// has no caret rect — so the cursor was invisible after every arrow nav.
// `setFocusId` flips the target BlockEditor's `autoFocus` prop, which in
// turn triggers the editor's autoFocus useEffect to set PM's selection at
// `TextSelection.atStart(doc)` and call `view.focus()`. PM then places the
// DOM caret inside the first text node (or, for an empty paragraph, past
// the zero-width-space widget injected by caret-fix-plugin).
const moveToAdjacentVisibleBlock = (
  currentId: string,
  direction: 'up' | 'down',
  setFocusId: (id: string | null) => void,
): boolean => {
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
  const targetId = targetEl.dataset.blockId;
  if (!targetId) {
    return false;
  }
  setFocusId(targetId);
  targetEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return true;
};

// Detects a Block whose content is exactly one ref segment with no meaningful
// text. Such Blocks are rendered as references to their target.
//
// F-6 Phase 3b: a "wrapper" Block (created by `promoteToWrapper`)
// also has content of just a Ref to an instance, but it carries a
// non-empty `supertags` array — that's what makes it a WRAPPER, not
// a mention. Wrappers should render with the normal bullet so the
// FieldGroup attaches; reference-only treatment (dashed outer ring,
// non-zoomable) is reserved for plain mentions.
const isReferenceOnlyBlock = (block: any): boolean => {
  const content = (block?.content ?? []) as readonly any[];
  if (!Array.isArray(content) || content.length === 0) {
    return false;
  }
  const supertags = (block?.supertags ?? []) as readonly any[];
  if (supertags.length > 0) {
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
  expanded: boolean;
  visible: boolean;
  onToggle: () => void;
};

// F-V2 Expand/Collapse control (revised in F-Pending-Child): a chevron set
// inside a bordered, lightly filled circle. Hidden by default; the
// parent BlockNode tracks its row's hover state via React and passes
// `visible`. Keyboard focus also reveals the control via
// `focus-visible`. ALWAYS rendered now — leaves get a chevron too so
// they can be expanded to reveal the pending-child placeholder
// (F-Pending-Child) and field groups (F-6 Phase 2).
const ExpandChevron = ({ expanded, visible, onToggle }: ExpandChevronProps) => {
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
  // F-Zoom: clicking the bullet zooms into the Block. Toggle is no longer
  // bound to bullet click — that lives on the chevron and Cmd+Up/Down.
  // For reference-only Blocks, regular click is suppressed (the user should
  // click the target's bullet instead).
  onClick?: () => void;
  // F-Open-Pane: shift-click opens the Block in a new pane. Always wired,
  // including for reference-only Blocks (the parent maps it to the target).
  onShiftClick?: () => void;
};

// Block Bullet: always renders a small dark filled dot. State indicators:
// - Closed parent: dark dot with a shaded halo around it.
// - Open parent or leaf: dark dot alone.
// - Reference-only Block (F-V6): dark dot + shaded halo + dashed outer ring.
// Click zooms into the Block (F-Zoom). Shift-click opens it in a new pane
// (F-Open-Pane). Reference-only Blocks accept shift-click but not click.
const Bullet = ({ hasChildren, expanded, referenceOnly, onClick, onShiftClick }: BulletProps) => {
  const canClick = Boolean(onClick) && !referenceOnly;
  const canShiftClick = Boolean(onShiftClick);
  const isInteractive = canClick || canShiftClick;
  const showHalo = referenceOnly || (hasChildren && !expanded);
  const showDashedRing = Boolean(referenceOnly);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey && onShiftClick) {
      event.preventDefault();
      onShiftClick();
      return;
    }
    if (canClick) {
      onClick?.();
    }
  };

  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={!isInteractive}
      aria-label={
        referenceOnly
          ? canShiftClick
            ? 'Reference bullet (shift-click to open in pane)'
            : 'Reference bullet'
          : canClick
            ? 'Zoom into block (shift-click to open in pane)'
            : 'Bullet'
      }
      title={
        canClick
          ? 'Zoom (shift+click to open in new pane)'
          : referenceOnly && canShiftClick
            ? 'Shift+click to open in new pane'
            : undefined
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

// F-6 Phase 1+3: render one chip per entry in `block.supertags`.
// Each chip routes through the per-space "tag Block" (materialized
// lazily on first encounter via `useTagBlock`), so the chip's
// displayed label comes from the tag Block's renameable `content`
// (with `#` prefix). Clicking the chip zooms into the tag Block;
// shift-clicking opens it in a new pane. Field editing of the linked
// typed instance lives in the FieldGroup (Phase 2).
const TagChips = ({ block }: { block: any }) => {
  const supertags = ((block?.supertags ?? []) as readonly any[]).filter((ref) => ref?.target);
  if (supertags.length === 0) {
    return null;
  }
  return (
    <>
      {supertags.map((ref, index) => {
        const target = ref.target as any;
        const typename = Obj.getTypename(target);
        return <TagChip key={target?.id ?? index} typename={typename} db={Obj.getDatabase(target)} />;
      })}
    </>
  );
};

// One chip. Subscribes to the per-space tag Block so renaming its
// `content` (e.g. "Task" → "Job") updates every chip with that
// typename live. Materializes the tag Block on first encounter via
// `useTagBlock`. Click → zoom into the tag Block; shift-click → open
// it in a new pane. Mirrors the bullet's click/shift-click pattern.
const TagChip = ({ typename, db }: { typename: string | undefined; db: any }) => {
  // Schema-declared title as the initial label for the tag Block
  // (and the fallback when the tag Block hasn't materialized yet).
  const schemaTitle = useMemo(() => {
    const entry = TAG_TYPES.find((tag) => tag.typename === typename);
    return entry?.title ?? typename ?? 'tag';
  }, [typename]);
  const tagBlock = useTagBlock(db, typename, schemaTitle);
  const [snapshot] = useObject(tagBlock as any);
  const label = tagLabelOf(snapshot as any) ?? schemaTitle;

  const zoom = useZoom();
  const openPane = useOpenPane();

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!tagBlock) {
      return;
    }
    if (event.shiftKey) {
      event.preventDefault();
      openPane(tagBlock as Block.Block);
      return;
    }
    zoom(tagBlock.id);
  };

  return (
    <button
      type='button'
      onClick={handleClick}
      disabled={!tagBlock}
      className='inline-flex items-baseline gap-0.5 text-xs leading-none px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 shrink-0 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40'
      title={`${typename ?? 'tag'} — click to zoom, shift+click to open in pane`}
    >
      <span className='opacity-60'>#</span>
      <span>{label}</span>
    </button>
  );
};

// F-Pending-Child: a faint placeholder row rendered as the only child of
// an expanded leaf. Visual only — no Block exists until the user types
// any character into the editable area, at which point `onPromote` is
// called with the typed text and the parent BlockNode persists a real
// child Block.
//
// F-DAG.Phase3a.add-existing-via-picker: typing `@` opens the
// MentionPicker so the user can ADD AN EXISTING Block as a structural
// child (instead of creating a wrapper Block with content =
// `[Ref(target)]`, which would render with the F-V6 dashed bullet).
// Picker selection routes through `onAddExisting`; the BlockNode
// parent's handler calls `createChildEdge(parent, target)` directly.
const PendingChildRow = ({
  parent,
  onPromote,
  onAddExisting,
}: {
  parent: Block.Block;
  onPromote: (initialText: string) => void;
  onAddExisting: (target: any) => void;
}) => {
  const editableRef = useRef<HTMLDivElement | null>(null);
  const [pickerState, setPickerState] = useState<
    { query: string; cursor: { left: number; top: number; bottom: number } } | null
  >(null);

  const db = Obj.getDatabase(parent);

  const focusEditable = () => {
    editableRef.current?.focus();
  };

  const closePicker = () => {
    setPickerState(null);
    if (editableRef.current) {
      editableRef.current.textContent = '';
      focusEditable();
    }
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const editable = event.currentTarget.querySelector<HTMLElement>('[contenteditable]');
    editable?.focus();
  };

  const handleInput = (event: React.FormEvent<HTMLDivElement>) => {
    const text = event.currentTarget.textContent ?? '';
    if (text.length === 0) {
      // Empty — close picker if open.
      if (pickerState) {
        setPickerState(null);
      }
      return;
    }
    // `@` prefix → open / refresh the picker; the typed `@` and any
    // characters after it form the picker's query (after stripping
    // the leading `@`).
    if (text.startsWith('@')) {
      const rect = event.currentTarget.getBoundingClientRect();
      setPickerState({
        query: text.slice(1),
        cursor: { left: rect.left, top: rect.top, bottom: rect.bottom },
      });
      return;
    }
    // Any other input → existing F-Pending-Child promote flow:
    // turn the placeholder into a real Block with the typed text.
    if (pickerState) {
      setPickerState(null);
    }
    event.currentTarget.textContent = '';
    onPromote(text);
  };

  return (
    <div className='flex items-baseline gap-1 cursor-text' onClick={handleClick}>
      <span className='shrink-0 w-6' aria-hidden />
      <span className='shrink-0 mt-1 w-5 h-5 inline-flex items-center justify-center'>
        <span className='inline-block w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-700' />
      </span>
      {/* F-Pending-Child.cursor-alignment: inline-block with explicit
          line-height matches `.ProseMirror`'s `<p>` line-box so the
          caret sits on the same baseline as a real bullet's editor
          (default block-level empty contenteditable starts the caret
          at the line-box top, which renders above the bullet). */}
      <div
        ref={editableRef}
        className='block-pending-child-editable inline-block min-w-[1rem] outline-none text-neutral-400 dark:text-neutral-600 leading-6'
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
      />
      {pickerState && (
        <MentionPicker
          db={db}
          query={pickerState.query}
          cursor={pickerState.cursor}
          excludeId={parent.id}
          onSelect={(target) => {
            setPickerState(null);
            if (editableRef.current) {
              editableRef.current.textContent = '';
            }
            onAddExisting(target);
          }}
          onClose={closePicker}
        />
      )}
    </div>
  );
};
