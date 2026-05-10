//
// Copyright 2025 DXOS.org
//

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { type AppSurface } from '@dxos/app-toolkit/ui';
import { Obj } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';
import { Panel } from '@dxos/react-ui';

import {
  BacklinkCountContext,
  BacklinksPanel,
  BlockContent,
  BlockEditor,
  BlockTree,
  ZoomContext,
  getDisplayLabel,
  useBacklinks,
} from '#components';
import { Block, type BlockOutline } from '#types';

export type BlockArticleProps = AppSurface.ObjectArticleProps<BlockOutline.BlockOutline>;

// Renders the outline as a Tana-style page: an editable H1 header (the
// current "page block", default = root) with the page block's children
// rendered as bullets below, and a Linked-references panel below those.
// F-Zoom + F-Page-Header: clicking a child bullet makes that block the
// new page block (its content becomes the H1, its own children render
// below). A "← {parent label}" breadcrumb above the H1 climbs back up
// the parent chain one level per click; it's hidden at the root.
export const BlockArticle = ({ role, subject }: BlockArticleProps) => {
  const [outline] = useObject(subject);
  const root = outline.root?.target;
  const { list, countByTargetId } = useBacklinks(subject);

  // The "page block" is the current zoom target. `null` means "at root".
  const [pageBlockId, setPageBlockId] = useState<string | null>(null);
  const pageBlock = useMemo(() => {
    if (!root) {
      return null;
    }
    if (!pageBlockId) {
      return root;
    }
    return findBlockById(root, pageBlockId) ?? root;
  }, [root, pageBlockId]);

  // Parent of the page block in the outline tree (null when page block === root).
  const parentBlock = useMemo(() => {
    if (!root || !pageBlock || pageBlock.id === root.id) {
      return null;
    }
    return findParent(root, pageBlock.id);
  }, [root, pageBlock]);

  const handleZoom = useCallback((blockId: string) => {
    setPageBlockId(blockId);
  }, []);

  const handleZoomToParent = useCallback(() => {
    if (!root || !parentBlock) {
      return;
    }
    // Climb one level. If parent is the root, drop back to the implicit
    // root view (pageBlockId = null) so the breadcrumb hides.
    setPageBlockId(parentBlock.id === root.id ? null : parentBlock.id);
  }, [root, parentBlock]);

  // F-Page-Header.5: one-time migration — if `root.content` is empty AND
  // `outline.name` was set on creation, copy `name` into `root.content` so
  // existing outlines render the previous name in the new H1 position.
  // Mutations go through the LIVE entity (`subject`, `subject.root?.target`)
  // since the snapshots returned by `useObject` are not extensible.
  useEffect(() => {
    const liveRoot = subject.root?.target;
    if (!outline || !liveRoot) {
      return;
    }
    if (hasContent(liveRoot) || !outline.name || outline.name.length === 0) {
      return;
    }
    const initialName = outline.name;
    Obj.update(liveRoot, (mutable) => {
      (mutable as any).content = [{ kind: 'text', text: initialName }];
    });
    // Run once at mount per outline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // F-Page-Header.6: keep `outline.name` in step with `root.content`'s
  // rendered text so the navigator label always reflects what the user
  // sees in the H1.
  const rootLabel = root ? getDisplayLabel(root) : '';
  useEffect(() => {
    if (!outline || rootLabel.length === 0 || outline.name === rootLabel) {
      return;
    }
    Obj.update(subject, (mutable) => {
      (mutable as any).name = rootLabel;
    });
  }, [subject, outline, rootLabel]);

  return (
    <Panel.Root role={role}>
      <Panel.Content>
        {pageBlock ? (
          <div className='p-4'>
            {parentBlock && (
              <button
                type='button'
                onClick={handleZoomToParent}
                className='inline-flex items-baseline gap-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer'
              >
                <span>←</span>
                <span>
                  {hasContent(parentBlock) ? <BlockContent block={parentBlock} /> : '(unnamed)'}
                </span>
              </button>
            )}
            <h1 className='mt-2 mb-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100'>
              <BlockEditor block={pageBlock} headlineMode />
            </h1>
            <BacklinkCountContext.Provider value={countByTargetId}>
              <ZoomContext.Provider value={handleZoom}>
                <BlockTree rootBlock={pageBlock} />
              </ZoomContext.Provider>
            </BacklinkCountContext.Provider>
            <BacklinksPanel backlinks={list} />
          </div>
        ) : (
          <div className='p-4 text-sm opacity-60'>(loading…)</div>
        )}
      </Panel.Content>
    </Panel.Root>
  );
};

const findBlockById = (root: Block.Block, id: string): Block.Block | null => {
  const stack: Block.Block[] = [root];
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
  return null;
};

// Walks the outline tree to find the Block whose `children` includes a
// child whose id matches `id`. Returns null if no parent is found (e.g.
// when `id` IS the root, or `id` is not present in the tree).
const findParent = (root: Block.Block, id: string): Block.Block | null => {
  const stack: Block.Block[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const childRefs = (current.children ?? []) as readonly any[];
    for (const ref of childRefs) {
      const child = ref?.target;
      if (child?.id === id) {
        return current;
      }
      if (child) {
        stack.push(child);
      }
    }
  }
  return null;
};

// True iff the Block has at least one renderable content segment.
const hasContent = (block: Block.Block): boolean => {
  const segments = (block.content ?? []) as readonly any[];
  return segments.some((segment) => {
    if (segment?.kind === 'text') {
      return (segment.text ?? '').length > 0;
    }
    if (segment?.kind === 'ref') {
      return !!segment.target;
    }
    return false;
  });
};

export default BlockArticle;
