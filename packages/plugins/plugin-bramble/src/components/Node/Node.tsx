//
// Copyright 2025 DXOS.org
//

import {
  type Instruction,
  attachInstruction,
  extractInstruction,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Obj, Relation } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';
import { TreeItem as ReactUiTreeItem } from '@dxos/react-ui';

import { pendingRowFocusId, useBacklinkCount, useOpenPane, usePendingSlot, useZoom } from '../backlinks';
import { Editor } from '../Editor';
import { findTagTypeByTypename } from '../Editor/tag-types';
import { MentionPicker } from '../MentionPicker';
import { PdfChip, findFileSupertag, isPdfFile } from '../PdfDrop';
import {
  addExistingAtSlot,
  childEdgesOf,
  createEdge,
  ensureMigratedChildren,
  findEdge,
  isFullyEmpty,
  moveNodeAsLastChild,
  moveNodeToSlot,
  orderBetween,
  promotePendingAtSlot,
  retireNode,
  setEdgeExpanded,
  useEdgeExpanded,
  useParentEdgeCount,
  useStructuralChildren,
} from './edges';
import { FieldGroups } from './FieldGroup';
import { QueryNodeView } from './QueryNodeView';
import { tagLabelOf, useTagBlock } from './tag-supertags';

import { Bramble } from '#types';

export type NodeProps = {
  block: Bramble.Node;
  // Block that owns `block` via its children array.
  parent: Bramble.Node;
  // Block that owns `parent` via its children array. Undefined at top level
  // (when `parent` is the outline's invisible root).
  grandparent?: Bramble.Node;
  focusId: string | null;
  focusAtEnd: boolean;
  setFocusId: (id: string | null) => void;
  // setFocusIdAtEnd: like setFocusId but the new focus places the
  // caret at the end of the focused editor's content. Used by
  // pending-child promote so the caret continues from after the
  // just-typed character.
  setFocusIdAtEnd: (id: string | null) => void;
};

// Recursive renderer for a Block and its children. Tab/Shift+Tab/Enter
// handlers live here so they can close over the parent + grandparent context.
// Visual rules are owned by the Bullet and ExpandChevron sub-components below.
export const Node = ({ block, parent, grandparent, focusId, focusAtEnd, setFocusId, setFocusIdAtEnd }: NodeProps) => {
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

  const backlinkCount = useBacklinkCount(block.id);

  // F-Zoom: clicking the bullet zooms into this Block. The handler comes
  // from Article via context; default is a no-op when no provider is
  // mounted (e.g., storybook stories).
  const zoom = useZoom();
  // F-Open-Pane: shift-clicking the bullet opens the Block in a new pane
  // to the right.
  const openPane = useOpenPane();
  // R-Pending-Row-Is-The-Empty-Bullet: Article-level pending sibling
  // slot state. Creation gestures (Shift+Enter, Cmd+Shift+Enter,
  // Enter-at-end-of-content) set this rather than persisting an
  // empty real Node; the children render loop below injects a
  // PendingChildRow at the matching slot.
  const { pendingSlot, setPendingSlot } = usePendingSlot();

  // F-Drag-Drop: per-row drag/drop wiring using pragmatic-drag-and-
  // drop. `rowRef` anchors both the draggable (the Bullet, found via
  // selector inside the row) and the drop target (the row itself).
  // `dropInstruction` carries the active drop-position computed by
  // the tree-item hitbox per F-Drag-Drop.dropspot-rendering — one of
  // `'reorder-above'`, `'reorder-below'`, `'make-child'`, with
  // cursor-x indent discrimination handled by the hitbox.
  // `TreeDropIndicator` from `@dxos/react-ui` renders the visual
  // (blue line for sibling, box outline for child) using the same
  // primitive plugin-navtree uses, ensuring visual consistency.
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [dropInstruction, setDropInstruction] = useState<Instruction | null>(null);

  // F-Retire-Empty-Node: watch the transition from "carries
  // meaningful state on at least one axis" to "empty across every
  // axis." On that transition (e.g. user backspaces through the
  // last character of an otherwise-empty bullet) retire this Node
  // via incoming-edge removal; the renderer projects a pending row
  // at the vacated slot per R-Pending-Row-Is-The-Empty-Bullet.
  // Initial mount is treated as a baseline read — a Node that is
  // already empty on mount (legacy / test-space state) is NOT
  // retired retroactively per R-Greenfield-Stance.
  const wasEmptyRef = useRef<boolean | null>(null);
  useEffect(() => {
    const currentlyEmpty = isFullyEmpty(snapshot, childRefs);
    const previouslyEmpty = wasEmptyRef.current;
    wasEmptyRef.current = currentlyEmpty;
    if (previouslyEmpty === null) {
      // First render — establish baseline only; never retire on
      // initial mount.
      return;
    }
    if (previouslyEmpty || !currentlyEmpty || !parent) {
      return;
    }
    const db = Obj.getDatabase(block);
    if (!db) {
      return;
    }
    retireNode(db, block, parent, setPendingSlot, setFocusId, pendingRowFocusId);
  }, [snapshot, childRefs, parent, block, setPendingSlot, setFocusId]);

  // F-Drag-Drop: wire pragmatic-drag-and-drop on this row. The
  // Bullet `<button>` is the draggable handle (matches
  // F-Drag-Drop.click-drag-starts-drag — "click to drag on the
  // bullet"); the entire row is a drop target. `attachInstruction`
  // from the tree-item hitbox computes the active drop position
  // per F-Drag-Drop.dropspot-placement (sibling-above /
  // sibling-below / make-child / reparent based on cursor x/y
  // relative to the row); `extractInstruction` reads it back during
  // drag and drop. The drop handler maps the instruction to the
  // appropriate `moveNodeToSlot` / `moveNodeAsLastChild` helper
  // per F-Drag-Drop.drop-changes-edges.
  useEffect(() => {
    const rowEl = rowRef.current;
    if (!rowEl) {
      return;
    }
    const bulletEl = rowEl.querySelector<HTMLButtonElement>('button[aria-label*="Zoom"]');
    if (!bulletEl) {
      return;
    }
    const itemData = { id: block.id, parentId: parent.id, kind: 'bramble.node' as const };
    return combine(
      draggable({
        element: bulletEl,
        getInitialData: () => itemData,
      }),
      dropTargetForElements({
        element: rowEl,
        canDrop: ({ source }) => (source.data as any)?.kind === 'bramble.node' && (source.data as any)?.id !== block.id,
        getData: ({ input, element }) =>
          attachInstruction(itemData, {
            input,
            element,
            // TODO(claude): pass real `currentLevel` once the Node
            // component receives a `level` prop from Graph /
            // recursive Node's children render. For now level=0
            // means the indicator's indent is uniform regardless of
            // tree depth — visual indent is off, but the drop
            // mechanism is correct.
            indentPerLevel: 24,
            currentLevel: 0,
            mode: expanded && hasChildren ? 'expanded' : 'standard',
            block: [],
          }),
        onDrag: ({ self }) => {
          const next = extractInstruction(self.data);
          setDropInstruction(next ?? null);
        },
        onDragLeave: () => setDropInstruction(null),
        onDrop: ({ source, self }) => {
          const instruction = extractInstruction(self.data);
          setDropInstruction(null);
          if (!instruction) {
            return;
          }
          const db = Obj.getDatabase(parent);
          if (!db) {
            return;
          }
          const draggedId = (source.data as any)?.id as string | undefined;
          const fromParentId = (source.data as any)?.parentId as string | undefined;
          if (!draggedId || !fromParentId) {
            return;
          }
          const dragged = db.getObjectById?.(draggedId) as Bramble.Node | undefined;
          const fromParent = db.getObjectById?.(fromParentId) as Bramble.Node | undefined;
          if (!dragged || !fromParent) {
            return;
          }
          switch (instruction.type) {
            case 'reorder-above':
              moveNodeToSlot(db, dragged, fromParent, parent, block, 'before');
              break;
            case 'reorder-below':
              moveNodeToSlot(db, dragged, fromParent, parent, block, 'after');
              break;
            case 'make-child':
              moveNodeAsLastChild(db, dragged, fromParent, block);
              break;
            // 'reparent' and 'instruction-blocked' are handled by
            // the hitbox internally; no action taken on drop for
            // those cases in this iteration.
          }
        },
      }),
    );
  }, [block.id, parent.id, expanded, hasChildren]);

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
    // F-V2.12: new sibling Nodes are created collapsed.
    const newBlock = Bramble.makeNode({ content: initialContent, state: { expanded: false } });
    db.add(newBlock);
    const edgesNow = childEdgesOf(db, parent);
    const currentIndex = edgesNow.findIndex((edge: any) => (Relation.getTarget(edge) as any)?.id === block.id);
    const beforeEdge = currentIndex >= 0 ? edgesNow[currentIndex] : undefined;
    const afterEdge = currentIndex >= 0 ? edgesNow[currentIndex + 1] : undefined;
    createEdge(db, parent, newBlock, { order: orderBetween(beforeEdge, afterEdge) });
    setFocusId(newBlock.id);
  };

  const handleEnter = (_beforeText: string, afterText: string) => {
    if (afterText.length > 0) {
      // Non-empty after-cursor content: the new sibling carries
      // meaningful state at creation, so it's a real Bramble.Node per
      // R-Pending-Row-Is-The-Empty-Bullet.
      insertSiblingAfter([{ kind: 'text', text: afterText }]);
      return;
    }
    // Enter at end of content: the new sibling would carry zero
    // meaningful state at creation. Per
    // R-Pending-Row-Is-The-Empty-Bullet's creation-gestures corollary,
    // render a pending row at the sibling slot below instead.
    setPendingSlot({ nodeId: block.id, position: 'after' });
    setFocusId(pendingRowFocusId(block.id, 'after'));
  };

  // F-Shift-Enter: render a pending row at the sibling slot below per
  // R-Pending-Row-Is-The-Empty-Bullet. First meaningful input promotes
  // it to a real Bramble.Node at the slot.
  const handleShiftEnter = () => {
    setPendingSlot({ nodeId: block.id, position: 'after' });
    setFocusId(pendingRowFocusId(block.id, 'after'));
  };

  // F-Cmd-Shift-Enter: render a pending row at the sibling slot above
  // per R-Pending-Row-Is-The-Empty-Bullet. First meaningful input
  // promotes it to a real Bramble.Node at the slot.
  const handleShiftEnterAbove = () => {
    setPendingSlot({ nodeId: block.id, position: 'before' });
    setFocusId(pendingRowFocusId(block.id, 'before'));
  };

  const handleIndent = () => {
    if (siblingIndex <= 0) {
      return;
    }
    const prevSibling = parentChildren[siblingIndex - 1]?.target as Bramble.Node | undefined;
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
    const edge = findEdge(db, parent, block);
    if (edge) {
      db.remove(edge);
    }
    createEdge(db, prevSibling, block);
    // F-Indent.auto-expand-parent: ensure the new parent (prevSibling)
    // is expanded so the indented block remains visible. Per F-V2.12
    // new Nodes are collapsed by default — indenting under a freshly-
    // created sibling would otherwise hide the indented block.
    Obj.update(prevSibling, (node) => {
      (node as any).state = { ...((node as any).state ?? {}), expanded: true };
    });
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
    const prevSibling = parentChildren[siblingIndex - 1]?.target as Bramble.Node | undefined;
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
    if (findEdge(db, prevSibling, block)) {
      return;
    }
    createEdge(db, prevSibling, block);
    // F-Indent.auto-expand-parent: ensure the new parent (prevSibling)
    // is expanded so the linked occurrence remains visible (same
    // rationale as handleIndent — without this, linking under a
    // collapsed sibling hides the block).
    Obj.update(prevSibling, (node) => {
      (node as any).state = { ...((node as any).state ?? {}), expanded: true };
    });
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
    const blockEdge = findEdge(db, parent, block);
    if (blockEdge) {
      db.remove(blockEdge);
    }
    const parentEdge = findEdge(db, grandparent, parent);
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
    createEdge(db, grandparent, block, { order: orderBetween(parentEdge, nextEdge) });
    setFocusId(block.id);
  };

  return (
    <div>
      <div
        ref={rowRef}
        className='flex items-baseline gap-1 relative'
        onMouseEnter={() => setRowHovered(true)}
        onMouseLeave={() => setRowHovered(false)}
      >
        {/* F-Drag-Drop.dropspot-rendering: the active drop
            instruction renders as a TreeDropIndicator overlay —
            blue sibling line for reorder-above / reorder-below,
            outlined box for make-child. Accessed via
            `TreeItem.DropIndicator` (the public surface of the
            TreeDropIndicator primitive on @dxos/react-ui).
            Pointer-events-none so cursor passes through to the
            row's drop handler. */}
        {dropInstruction && <ReactUiTreeItem.DropIndicator instruction={dropInstruction} gap={2} />}
        <ExpandChevron
          expanded={expanded}
          visible={rowHovered}
          onToggle={toggleExpanded}
        />
        <Bullet
          hasChildren={hasChildren}
          expanded={expanded}
          onClick={() => zoom(block.id)}
          onShiftClick={() => openPane(block)}
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
          {/* F-DAG.Phase3a.add-existing-via-picker: when a Block's
              content is a single Ref (e.g. a wrapper Block produced
              by `promoteToWrapper`), the editor wrapper carries
              `data-naked-ref` so the in-editor RefNode renders as
              plain bullet text rather than the F-V3 blue inline link.
              CSS-only check via `:only-child` would also match inline
              refs with trailing whitespace as siblings (text nodes
              don't satisfy `:only-child`), so the classification is
              done here in JS off the live content array. */}
          <div
            className='min-w-0 max-w-full [&_.ProseMirror]:inline-block'
            data-naked-ref={isNakedRefContent((snapshot as any)?.content) ? 'true' : undefined}
          >
            <Editor
              block={block}
              autoFocus={focusId === block.id}
              autoFocusAtEnd={focusId === block.id && focusAtEnd}
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
          {/* F-PDF-Upload.chip-rendering: when this Node's supertags
              include a Wnfs.File that is a PDF, render the PDF chip
              (icon + label). The chip's label uses the Node's
              editable content when non-empty, falling back to the
              file's name per F-PDF-Upload.editable-label-preserves-
              attachment. Click opens the wrapped Wnfs.File inline. */}
          {(() => {
            const file = findFileSupertag(snapshot as any);
            return file && isPdfFile(file) ? <PdfChip wnfsFile={file} /> : null;
          })()}
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
            const child = ref.target as Bramble.Node;
            // R-Pending-Row-Is-The-Empty-Bullet: inject a
            // PendingChildRow at this child's slot if a creation
            // gesture (Shift+Enter, Cmd+Shift+Enter, Enter-at-end)
            // requested one adjacent to this child.
            const slotBefore = pendingSlot?.nodeId === child.id && pendingSlot.position === 'before';
            const slotAfter = pendingSlot?.nodeId === child.id && pendingSlot.position === 'after';
            return (
              <React.Fragment key={child.id}>
                {slotBefore && (
                  <PendingChildRow
                    parent={block}
                    setFocusId={setFocusId}
                    focusId={focusId}
                    rowFocusId={pendingRowFocusId(child.id, 'before')}
                    onPromote={(initialText) =>
                      promotePendingAtSlot(block, child, 'before', initialText, setPendingSlot, setFocusIdAtEnd)
                    }
                    onAddExisting={(target) =>
                      addExistingAtSlot(block, child, 'before', target as Bramble.Node, setPendingSlot, setFocusId)
                    }
                  />
                )}
                <Node
                  block={child}
                  parent={block}
                  grandparent={parent}
                  focusId={focusId}
                  focusAtEnd={focusAtEnd}
                  setFocusId={setFocusId}
                  setFocusIdAtEnd={setFocusIdAtEnd}
                />
                {slotAfter && (
                  <PendingChildRow
                    parent={block}
                    setFocusId={setFocusId}
                    focusId={focusId}
                    rowFocusId={pendingRowFocusId(child.id, 'after')}
                    onPromote={(initialText) =>
                      promotePendingAtSlot(block, child, 'after', initialText, setPendingSlot, setFocusIdAtEnd)
                    }
                    onAddExisting={(target) =>
                      addExistingAtSlot(block, child, 'after', target as Bramble.Node, setPendingSlot, setFocusId)
                    }
                  />
                )}
              </React.Fragment>
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
              setFocusId={setFocusId}
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
                // F-V2.12: new Nodes promoted from the pending-child row are
                // created collapsed.
                const newChild = Bramble.makeNode({
                  content: initialText.length > 0 ? [{ kind: 'text', text: initialText }] : [],
                  state: { expanded: false },
                });
                db.add(newChild);
                createEdge(db, block, newChild);
                // The user just typed the first character into the
                // pending-child editable; the new bullet's caret needs
                // to land AFTER that character so the next keystroke
                // appends. Without `atEnd`, the caret lands at
                // position 0 and subsequent characters get inserted
                // before the typed one (typing "1234" produces "2341").
                setFocusIdAtEnd(newChild.id);
              }}
              onAddExisting={(target) => {
                // F-DAG.Phase3a.add-existing-via-picker: when the user
                // selects an existing Block from the @ picker, add it
                // as a STRUCTURAL CHILD via `createEdge` — no
                // wrapper Block, no content-ref. Cycle prevention from
                // Phase 5 fires inside `createEdge`.
                const db = Obj.getDatabase(block);
                if (!db) {
                  return;
                }
                createEdge(db, block, target as Bramble.Node);
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
// `setFocusId` flips the target Editor's `autoFocus` prop, which in
// turn triggers the editor's autoFocus useEffect to set PM's selection at
// `TextSelection.atStart(doc)` and call `view.focus()`. PM then places the
// DOM caret inside the first text node (or, for an empty paragraph, past
// the zero-width-space widget injected by caret-fix-plugin).
// F-Nav.pending-child: the pending-child placeholder editable also
// counts as a navigation target so ArrowDown from a leaf bullet that's
// expanded (showing its pending-child) lands the caret in the
// pending-child instead of skipping past to the next sibling. Focusing
// the pending-child does NOT promote it to a real Node — the promote
// path only fires on `input` (the user typing a character).
//
// Multi-render note (F-DAG): a Node with multiple incoming edges
// renders in multiple places in the outline (the multi-parent badge
// surfaces on each occurrence). Each rendering carries the SAME
// `[data-block-id]` attribute, so finding "the user's current
// position" by id alone is ambiguous. We resolve the ambiguity using
// `document.activeElement`: the focused editor's closest
// `[data-block-id]` ancestor IS the rendering the user is in, so
// `indexOf(activeHost)` gives an unambiguous current index. We only
// fall back to id-match when the active element doesn't sit under
// any `[data-block-id]` matching `currentId` (defensive).
export const moveToAdjacentVisibleBlock = (
  currentId: string,
  direction: 'up' | 'down',
  setFocusId: (id: string | null) => void,
): boolean => {
  const all = queryFocusableElements();
  const currentIndex = findActiveOccurrenceIndex(all, currentId);
  if (currentIndex < 0) {
    return false;
  }
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= all.length) {
    return false;
  }
  focusFocusableElement(all[targetIndex], setFocusId);
  return true;
};

// Find the index of the rendering of `currentId` that the user is
// actually in, by checking `document.activeElement`. Falls back to
// the first id-match if focus is somewhere unexpected.
const findActiveOccurrenceIndex = (all: HTMLElement[], currentId: string): number => {
  const activeEl = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
  const activeHost = activeEl?.closest?.('[data-block-id]') as HTMLElement | null;
  if (activeHost && (activeHost as HTMLElement).dataset.blockId === currentId) {
    const idx = all.indexOf(activeHost);
    if (idx >= 0) {
      return idx;
    }
  }
  return all.findIndex((el) => el.dataset.blockId === currentId);
};

// F-Nav.pending-child: caller is the pending-child editable itself
// (no `[data-block-id]`). Walk the same combined list of focusable
// elements; navigate to the prev/next entry.
export const moveFromPendingChild = (
  pendingChildEl: HTMLElement,
  direction: 'up' | 'down',
  setFocusId: (id: string | null) => void,
): boolean => {
  const all = queryFocusableElements();
  const currentIndex = all.indexOf(pendingChildEl);
  if (currentIndex < 0) {
    return false;
  }
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= all.length) {
    return false;
  }
  focusFocusableElement(all[targetIndex], setFocusId);
  return true;
};

// Both `[data-block-id]` (real Node editors) AND
// `.block-pending-child-editable` (the placeholder editable in
// F-Pending-Child) count as F-Nav targets in document order.
const queryFocusableElements = (): HTMLElement[] => {
  return Array.from(document.querySelectorAll('[data-block-id], .block-pending-child-editable')) as HTMLElement[];
};

// When the target is a real Node, route through `setFocusId` so the
// Editor's `autoFocus` mechanism mounts the caret correctly AND
// directly focus the inner ProseMirror editor. The direct focus is
// load-bearing for two cases:
//
//   1) "Round-trip back to a previously-focused bullet": when
//      `focusId` is already the target's id (because the user just
//      arrowed away from it into a pending-child), `setFocusId` is a
//      no-op for the autoFocus useEffect (no prop change → no useEffect
//      re-run → no `view.focus()` call), so focus would stay stuck in
//      the pending-child without the direct call.
//
//   2) "Multi-render F-DAG node": a Node with multiple incoming edges
//      is rendered in multiple places (one per occurrence). All
//      renderings share the same `[data-block-id]` and the same
//      `autoFocus={focusId === block.id}` derivation, so `setFocusId`
//      flips `autoFocus` true on ALL of them and ALL their F-Caret
//      useEffects call `view.focus()` — the LAST-rendered occurrence
//      wins, which is rarely the one the user navigated to. The
//      direct `.focus()` must therefore run AFTER React commits, so
//      we defer it via `setTimeout(0)`. That places our call last in
//      the macrotask queue (after React's microtask-flushed effects),
//      so the SPECIFIC target wins regardless of how many other
//      occurrences also re-focused.
//
// When the target is a pending-child placeholder, focus its editable
// directly — no Node id, no Node creation. The `scrollIntoView`
// keeps the target in view for both kinds.
const focusFocusableElement = (el: HTMLElement, setFocusId: (id: string | null) => void): void => {
  const blockId = el.dataset.blockId;
  if (blockId) {
    setFocusId(blockId);
    const editor = el.querySelector<HTMLElement>('.ProseMirror');
    // Defer to after React commits + its autoFocus useEffects fire,
    // so our explicit target wins the focus race on multi-render
    // nodes (see case (2) above).
    setTimeout(() => editor?.focus(), 0);
  } else {
    el.focus();
  }
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

// True when a Block's content is exactly one Ref segment with no
// adjacent text — i.e. the bullet IS a reference to a target, rather
// than a bullet that CONTAINS a reference inside its text. Wrapper
// Blocks materialised via `promoteToWrapper` are the canonical case.
// The PendingChildRow `@`-picker can also surface such Blocks when
// the user selects an existing wrapper as a structural child.
const isNakedRefContent = (content: unknown): boolean => {
  if (!Array.isArray(content) || content.length !== 1) {
    return false;
  }
  const segment = content[0] as any;
  return segment?.kind === 'ref';
};

type ExpandChevronProps = {
  expanded: boolean;
  visible: boolean;
  onToggle: () => void;
};

// F-V2 Expand/Collapse control (revised in F-Pending-Child): a chevron set
// inside a bordered, lightly filled circle. Hidden by default; the
// parent Node tracks its row's hover state via React and passes
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
  // F-Zoom: clicking the bullet zooms into the Block. Toggle is no longer
  // bound to bullet click — that lives on the chevron and Cmd+Up/Down.
  onClick?: () => void;
  // F-Open-Pane: shift-click opens the Block in a new pane.
  onShiftClick?: () => void;
};

// Block Bullet: always renders a small dark filled dot. State indicators:
// - Closed parent: dark dot with a shaded halo around it.
// - Open parent or leaf: dark dot alone.
// Click zooms into the Block (F-Zoom). Shift-click opens it in a new pane
// (F-Open-Pane).
const Bullet = ({ hasChildren, expanded, onClick, onShiftClick }: BulletProps) => {
  const canClick = Boolean(onClick);
  const canShiftClick = Boolean(onShiftClick);
  const isInteractive = canClick || canShiftClick;
  const showHalo = hasChildren && !expanded;

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
      aria-label={canClick ? 'Zoom into block (shift-click to open in pane)' : 'Bullet'}
      title={canClick ? 'Zoom (shift+click to open in new pane)' : undefined}
      className={
        'shrink-0 mt-1 w-5 h-5 inline-flex items-center justify-center rounded-full transition-colors ' +
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
//
// Exported so the page-level Article surface can render chips next
// to the H1 (so the user can see when they're on a `#Step` / `#Run`
// page).
export const TagChips = ({ block }: { block: any }) => {
  const supertags = ((block?.supertags ?? []) as readonly any[]).filter((ref) => ref?.target);
  if (supertags.length === 0) {
    return null;
  }
  return (
    <>
      {supertags.map((ref, index) => {
        const target = ref.target as any;
        const typename = Obj.getTypename(target);
        return (
          <TagChip
            key={target?.id ?? index}
            typename={typename}
            db={Obj.getDatabase(target)}
            instance={target}
          />
        );
      })}
    </>
  );
};

// One chip. Subscribes to the per-space tag Block so renaming its
// `content` (e.g. "Task" → "Job") updates every chip with that
// typename live. Materializes the tag Block on first encounter via
// `useTagBlock`. Click → zoom into the tag Block; shift-click → open
// it in a new pane. Mirrors the bullet's click/shift-click pattern.
const TagChip = ({
  typename,
  db,
  instance,
}: {
  typename: string | undefined;
  db: any;
  instance: any;
}) => {
  // F-Supertag.types-shown: schema-declared title resolves from
  // the live schemaRegistry by typename (no hardcoded allowlist),
  // with the typename string as the fallback when the schema isn't
  // registered in this space yet.
  const schemaTitle = useMemo(() => {
    return findTagTypeByTypename(db, typename)?.title ?? typename ?? 'tag';
  }, [db, typename]);
  const tagBlock = useTagBlock(db, typename, schemaTitle);
  const [snapshot] = useObject(tagBlock as any);
  const label = tagLabelOf(snapshot as any) ?? schemaTitle;

  const zoom = useZoom();
  const openPane = useOpenPane();

  // F-Supertag.chip-gestures: chip click navigates to the supertag
  // node (browse all #T in this space). Shift+click opens the
  // supertag node in a new pane. The typed instance behind this
  // chip is reached via the adjacent OpenInstanceControl (`↗`).
  const handleChipClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!tagBlock) {
      return;
    }
    if (event.shiftKey) {
      event.preventDefault();
      openPane(tagBlock as Bramble.Node);
      return;
    }
    zoom(tagBlock.id);
  };

  // F-Supertag.open-instance-control: shift+click opens the typed
  // instance behind this chip in a new pane (F-Open-Pane). Regular
  // click would ideally swap the current pane to the typed
  // instance's article surface, but cross-typename current-pane
  // navigation requires a separate `LayoutOperation.Open` plumbing
  // through the article context — both gestures route through
  // `openPane` for v1.
  const handleOpenInstance = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!instance) {
      return;
    }
    openPane(instance as Bramble.Node);
  };

  return (
    <span className='inline-flex items-baseline gap-0.5 shrink-0'>
      <button
        type='button'
        onClick={handleChipClick}
        disabled={!tagBlock}
        className='inline-flex items-baseline gap-0.5 text-xs leading-none px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/40'
        title={`${typename ?? 'tag'} — click to browse all in this space, shift+click to open in pane`}
      >
        <span className='opacity-60'>#</span>
        <span>{label}</span>
      </button>
      <button
        type='button'
        onClick={handleOpenInstance}
        disabled={!instance}
        className='inline-flex items-baseline text-xs leading-none px-1 py-0.5 rounded text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer'
        title={`Open ${label} — opens the typed instance in a new pane`}
        aria-label={`Open ${label}`}
      >
        ↗
      </button>
    </span>
  );
};

// F-Pending-Child: a faint placeholder row rendered as the only child of
// an expanded leaf. Visual only — no Block exists until the user types
// any character into the editable area, at which point `onPromote` is
// called with the typed text and the parent Node persists a real
// child Block.
//
// F-DAG.Phase3a.add-existing-via-picker: typing `@` opens the
// MentionPicker so the user can ADD AN EXISTING Block as a structural
// child via a `ChildEdge` (no wrapper Block). Picker selection routes
// through `onAddExisting`; the Node parent's handler calls
// `createEdge(parent, target)` directly.
export const PendingChildRow = ({
  parent,
  onPromote,
  onAddExisting,
  setFocusId,
  focusId,
  rowFocusId,
}: {
  parent: Bramble.Node;
  onPromote: (initialText: string) => void;
  onAddExisting: (target: any) => void;
  // F-Nav.pending-child: when the user presses ArrowUp/ArrowDown from
  // inside the pending-child editable (and no picker is intercepting
  // the keystroke), we navigate to the prev/next focusable element in
  // the DOM walk. Real-Node targets route through `setFocusId`;
  // pending-child targets get focused directly via the helper.
  setFocusId?: (id: string | null) => void;
  // R-Pending-Row-Is-The-Empty-Bullet: when this pending row is
  // rendered at a sibling slot (rather than as a leaf-row-end /
  // page-root affordance), `rowFocusId` is the deterministic id
  // assigned by `pendingRowFocusId(anchorId, position)` and
  // `focusId` is the current Article focus target. When they match,
  // the editable area auto-focuses on mount so the user lands on it
  // immediately after the gesture (Shift+Enter, Cmd+Shift+Enter,
  // Enter-at-end-of-content).
  focusId?: string | null;
  rowFocusId?: string;
}) => {
  const editableRef = useRef<HTMLDivElement | null>(null);
  const [pickerState, setPickerState] = useState<
    { query: string; cursor: { left: number; top: number; bottom: number } } | null
  >(null);

  const db = Obj.getDatabase(parent);

  const focusEditable = () => {
    editableRef.current?.focus();
  };

  // R-Pending-Row-Is-The-Empty-Bullet: auto-focus the editable area
  // when this row's deterministic focus id matches the Article's
  // current focus target. Mounting after a Shift+Enter / Cmd+Shift+
  // Enter / Enter-at-end-of-content gesture lands the caret here
  // without an extra click.
  React.useEffect(() => {
    if (rowFocusId && focusId === rowFocusId) {
      focusEditable();
    }
  }, [focusId, rowFocusId]);

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
    <div
      className='flex items-baseline gap-1 cursor-text'
      onClick={handleClick}
      // F-PDF-Upload.drop-target-per-row: the pending-child placeholder
      // is a recognised drop site. The drop overlay's hit-test reads
      // `data-bramble-pending-child` to identify the parent whose
      // last-child slot the cursor is over.
      data-bramble-pending-child={parent.id}
    >
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
        onKeyDown={(event) => {
          // F-Nav.pending-child: ArrowUp/ArrowDown navigate to the
          // prev/next focusable element (real Node or another pending-
          // child). When MentionPicker is open it intercepts these
          // keys via window-capture, so this branch only fires while
          // the picker is closed.
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
            return;
          }
          if (!setFocusId || !editableRef.current) {
            return;
          }
          const direction = event.key === 'ArrowUp' ? 'up' : 'down';
          const moved = moveFromPendingChild(editableRef.current, direction, setFocusId);
          if (moved) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
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
