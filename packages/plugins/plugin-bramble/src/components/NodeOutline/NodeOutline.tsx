//
// Copyright 2026 DXOS.org
//

import React from 'react';

import { useObject } from '@dxos/react-client/echo';

import { type Node } from '../../types';

export type NodeOutlineProps = { subject: Node; role?: string };

export const NodeOutline = ({ subject }: NodeOutlineProps) => {
  const [root] = useObject(subject);
  if (!root) {
    return null;
  }
  return (
    <div data-testid='bramble-outline' role='tree'>
      <div data-testid='bramble-header'>{root.text?.target?.content ?? ''}</div>
    </div>
  );
};
