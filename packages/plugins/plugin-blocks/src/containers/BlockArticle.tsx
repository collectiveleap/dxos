//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { type AppSurface } from '@dxos/app-toolkit/ui';
import { useObject } from '@dxos/react-client/echo';
import { Panel } from '@dxos/react-ui';

import { BlockTree } from '#components';
import type { BlockOutline } from '#types';

export type BlockArticleProps = AppSurface.ObjectArticleProps<BlockOutline.BlockOutline>;

// Increment 3: renders a tree of bullets. The (invisible) root Block from
// outline.root holds the visible children; BlockTree walks them and renders
// one BlockEditor per child.
export const BlockArticle = ({ role, subject }: BlockArticleProps) => {
  const [outline] = useObject(subject);
  const root = outline.root?.target;

  return (
    <Panel.Root role={role}>
      <Panel.Content>
        {root ? (
          <BlockTree rootBlock={root} />
        ) : (
          <div className='p-4 text-sm opacity-60'>(loading…)</div>
        )}
      </Panel.Content>
    </Panel.Root>
  );
};

export default BlockArticle;
