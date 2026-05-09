//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { type AppSurface } from '@dxos/app-toolkit/ui';
import { useObject } from '@dxos/react-client/echo';
import { Panel } from '@dxos/react-ui';

import { BlockEditor } from '#components';
import type { BlockOutline } from '#types';

export type BlockArticleProps = AppSurface.ObjectArticleProps<BlockOutline.BlockOutline>;

// Increment 2: resolves the outline's root Block and mounts the BlockEditor.
// Hierarchy, refs, backlinks land in subsequent increments.
export const BlockArticle = ({ role, subject }: BlockArticleProps) => {
  const [outline] = useObject(subject);
  const root = outline.root?.target;

  return (
    <Panel.Root role={role}>
      <Panel.Content>
        {root ? (
          <BlockEditor block={root} />
        ) : (
          <div className='p-4 text-sm opacity-60'>(loading…)</div>
        )}
      </Panel.Content>
    </Panel.Root>
  );
};

export default BlockArticle;
