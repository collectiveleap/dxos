//
// Copyright 2025 DXOS.org
//

import React, { Fragment } from 'react';

import { useObject } from '@dxos/react-client/echo';

import { Bramble } from '#types';

import { getDisplayLabel } from './labels';

export type BlockContentProps = {
  block: Bramble.Node;
};

// F-Headline: renders a Block's content (text + inline refs) as React
// elements, mirroring the editor's inline rendering but read-only.
// Used by BlockArticle to render the zoomed headline so that ref
// segments don't disappear (which is what `getDisplayLabel`'s
// text-only join used to do).
//
// Each ref segment is rendered via a `RefLabel` child that subscribes
// to the target via `useObject`, so a rename of the target propagates
// to the rendered label without any local edit.
export const BlockContent = ({ block }: BlockContentProps) => {
  const [snapshot] = useObject(block);
  const segments = ((snapshot?.content ?? []) as readonly any[]).filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === 'text') {
          return <Fragment key={index}>{segment.text ?? ''}</Fragment>;
        }
        if (segment.kind === 'ref') {
          const target = segment.target?.target;
          if (!target) {
            return null;
          }
          return <RefLabel key={index} target={target} />;
        }
        return null;
      })}
    </>
  );
};

// Subscribes to the ref's resolved target via useObject so a rename
// re-renders the label live. F-V3 styling matches inline refs.
const RefLabel = ({ target }: { target: any }) => {
  const [snapshot] = useObject(target);
  const label = snapshot ? getDisplayLabel(snapshot) : '';
  return (
    <span className='block-ref text-blue-600 dark:text-blue-400 hover:underline cursor-pointer'>
      {label || '…'}
    </span>
  );
};
