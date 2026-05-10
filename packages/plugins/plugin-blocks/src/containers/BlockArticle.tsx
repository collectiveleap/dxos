//
// Copyright 2025 DXOS.org
//

import React, { useCallback, useMemo, useState } from 'react';

import { type AppSurface } from '@dxos/app-toolkit/ui';
import { useObject } from '@dxos/react-client/echo';
import { Panel } from '@dxos/react-ui';

import {
  BacklinkCountContext,
  BacklinksPanel,
  BlockContent,
  BlockTree,
  ZoomContext,
  useBacklinks,
} from '#components';
import { Block, type BlockOutline } from '#types';

export type BlockArticleProps = AppSurface.ObjectArticleProps<BlockOutline.BlockOutline>;

// Renders the outline tree with a Linked-references panel below it.
// F-Zoom: when zoomedBlockId is set, the article renders the zoomed Block
// as a header at the top of the page and its descendant tree below it.
// Clicking the bullet on a Block zooms into it. The "← Outline" link
// returns to the full outline view.
export const BlockArticle = ({ role, subject }: BlockArticleProps) => {
  const [outline] = useObject(subject);
  const root = outline.root?.target;
  const { list, countByTargetId } = useBacklinks(subject);

  const [zoomedBlockId, setZoomedBlockId] = useState<string | null>(null);
  const zoomedBlock = useMemo(() => {
    if (!zoomedBlockId || !root) {
      return null;
    }
    return findBlockById(root, zoomedBlockId);
  }, [root, zoomedBlockId]);

  const handleZoom = useCallback(
    (blockId: string) => {
      setZoomedBlockId(blockId);
    },
    [],
  );

  const handleZoomOut = useCallback(() => {
    setZoomedBlockId(null);
  }, []);

  const treeRoot = zoomedBlock || root;

  return (
    <Panel.Root role={role}>
      <Panel.Content>
        {treeRoot ? (
          <div className='p-4'>
            {zoomedBlock && (
              <div className='mb-4'>
                <button
                  type='button'
                  onClick={handleZoomOut}
                  className='text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer'
                >
                  ← Outline
                </button>
                <h1 className='mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100'>
                  {hasContent(zoomedBlock) ? <BlockContent block={zoomedBlock} /> : '(empty)'}
                </h1>
              </div>
            )}
            <BacklinkCountContext.Provider value={countByTargetId}>
              <ZoomContext.Provider value={handleZoom}>
                <BlockTree rootBlock={treeRoot} />
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

// True iff the Block has at least one renderable content segment (text
// with characters or a ref). Drives the headline's '(empty)' fallback.
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
