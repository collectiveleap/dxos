//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { type Backlink } from '../backlinks';

export type BacklinksPanelProps = {
  backlinks: readonly Backlink[];
};

// F-5: presentational panel that lists incoming refs into this outline's tree.
// Data is supplied by the parent (which uses the useBacklinks hook). The panel
// renders nothing when there are no incoming refs.
export const BacklinksPanel = ({ backlinks }: BacklinksPanelProps) => {
  if (backlinks.length === 0) {
    return null;
  }

  return (
    <div className='mt-8 border-t border-neutral-200 dark:border-neutral-800 pt-4'>
      <h3 className='text-sm font-semibold opacity-60 mb-2'>
        Linked references ({backlinks.length})
      </h3>
      <ul className='space-y-1'>
        {backlinks.map((backlink, index) => (
          <li key={`${backlink.sourceId}-${index}`} className='text-sm flex gap-2 items-baseline'>
            <span className='opacity-60 truncate' title={backlink.sourceLabel}>
              {backlink.sourceLabel}
            </span>
            <span className='opacity-30 shrink-0'>→</span>
            <span className='truncate' title={backlink.targetLabel}>
              {backlink.targetLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
