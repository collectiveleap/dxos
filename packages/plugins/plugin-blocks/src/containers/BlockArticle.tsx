//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { type AppSurface } from '@dxos/app-toolkit/ui';
import { useObject } from '@dxos/react-client/echo';
import { Panel } from '@dxos/react-ui';

import { BacklinkCountContext, BacklinksPanel, BlockTree, useBacklinks } from '#components';
import type { BlockOutline } from '#types';

export type BlockArticleProps = AppSurface.ObjectArticleProps<BlockOutline.BlockOutline>;

// Increment 3 + F-5 + F-V4: renders the outline tree with a Linked-references
// panel below it. The backlink scan runs once via useBacklinks; the count map
// flows through React context to each BlockNode for the per-bullet badge,
// while the flat list goes to the panel.
export const BlockArticle = ({ role, subject }: BlockArticleProps) => {
  const [outline] = useObject(subject);
  const root = outline.root?.target;
  const { list, countByTargetId } = useBacklinks(subject);

  return (
    <Panel.Root role={role}>
      <Panel.Content>
        {root ? (
          <div className='p-4'>
            <BacklinkCountContext.Provider value={countByTargetId}>
              <BlockTree rootBlock={root} />
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

export default BlockArticle;
