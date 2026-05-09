//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { type AppSurface } from '@dxos/app-toolkit/ui';
import { useObject } from '@dxos/react-client/echo';
import { Panel } from '@dxos/react-ui';

import { BacklinksPanel, BlockTree } from '#components';
import type { BlockOutline } from '#types';

export type BlockArticleProps = AppSurface.ObjectArticleProps<BlockOutline.BlockOutline>;

// Increment 3+: renders the outline tree, with a backlinks panel below it
// listing other Blocks whose inline refs point into this outline's tree.
// The panel hides itself when there are no incoming refs.
export const BlockArticle = ({ role, subject }: BlockArticleProps) => {
  const [outline] = useObject(subject);
  const root = outline.root?.target;

  return (
    <Panel.Root role={role}>
      <Panel.Content>
        {root ? (
          <div className='p-4'>
            <BlockTree rootBlock={root} />
            <BacklinksPanel outline={subject} />
          </div>
        ) : (
          <div className='p-4 text-sm opacity-60'>(loading…)</div>
        )}
      </Panel.Content>
    </Panel.Root>
  );
};

export default BlockArticle;
