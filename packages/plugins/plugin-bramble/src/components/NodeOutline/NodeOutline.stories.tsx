//
// Copyright 2026 DXOS.org
//

import { type Meta, type StoryObj } from '@storybook/react-vite';
import React, { useMemo } from 'react';
import { expect, within } from 'storybook/test';

import { useSpaces } from '@dxos/react-client/echo';
import { withClientProvider } from '@dxos/react-client/testing';
import { withLayout, withTheme } from '@dxos/react-ui/testing';
import { Text } from '@dxos/schema';

import { NodeOutline } from './NodeOutline';
import { createEdge } from '../../model/edges';
import { translations } from '../../translations';
import { Edge, Node, makeNode } from '../../types';

// Seeds Root → { a → a1, b } and renders the outline rooted at Root.
const NodeOutlineStory = () => {
  const [space] = useSpaces();
  const root = useMemo(() => {
    if (!space) {
      return undefined;
    }
    const db = space.db;
    const r = db.add(makeNode({ text: 'Root' }));
    const a = db.add(makeNode({ text: 'a' }));
    const a1 = db.add(makeNode({ text: 'a1' }));
    const b = db.add(makeNode({ text: 'b' }));
    void createEdge(db, r, a, 1);
    void createEdge(db, a, a1, 1);
    void createEdge(db, r, b, 2);
    return r;
  }, [space]);
  return root ? <NodeOutline subject={root} /> : null;
};

const meta = {
  title: 'plugins/plugin-bramble/NodeOutline',
  component: NodeOutlineStory,
  decorators: [
    withTheme(),
    withLayout({ layout: 'fullscreen' }),
    withClientProvider({ createIdentity: true, createSpace: true, types: [Text.Text, Node, Edge] }),
  ],
  parameters: { layout: 'fullscreen', translations },
} satisfies Meta<typeof NodeOutlineStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = await canvas.findByTestId('bramble-header');
    await expect(header).toHaveTextContent('Root');
  },
};
