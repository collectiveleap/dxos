//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { type AppSurface } from '@dxos/app-toolkit/ui';
import { useObject } from '@dxos/react-client/echo';
import { Panel } from '@dxos/react-ui';

import type { BlockOutline } from '#types';

export type BlockArticleProps = AppSurface.ObjectArticleProps<BlockOutline.BlockOutline>;

// Increment 1 placeholder. The editor and tree rendering land in subsequent
// increments. Subscribes via useObject so reactive updates land when later
// features start mutating the outline.
export const BlockArticle = ({ role, subject }: BlockArticleProps) => {
  const [outline] = useObject(subject);

  return (
    <Panel.Root role={role}>
      <Panel.Content>
        <div className='p-4 text-sm opacity-60'>
          (empty block outline{outline.name ? ` — ${outline.name}` : ''})
        </div>
      </Panel.Content>
    </Panel.Root>
  );
};

export default BlockArticle;
