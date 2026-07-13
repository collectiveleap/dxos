//
// Copyright 2026 DXOS.org
//

import { type Meta, type StoryObj } from '@storybook/react-vite';
import React, { useMemo } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

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

export const Tree: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = await canvas.findAllByTestId('bramble-row');
    // Root excluded; descendants are a, a1, b, depth-first.
    await expect(rows).toHaveLength(3);
    await expect(rows[0]).toHaveTextContent('a');
    await expect(rows[0]).toHaveAttribute('data-depth', '0');
    await expect(rows[1]).toHaveTextContent('a1');
    await expect(rows[1]).toHaveAttribute('data-depth', '1');
    await expect(rows[2]).toHaveTextContent('b');
    await expect(rows[2]).toHaveAttribute('data-depth', '0');

    // The row text renders through the editor (CodeMirror content), not a bare span.
    const editors = await canvas.findAllByTestId('bramble-node-name');
    await expect(editors[0].querySelector('.cm-content')).not.toBeNull();
    await expect(editors[0]).toHaveTextContent('a');
  },
};

export const Editable: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = await canvas.findAllByTestId('bramble-node-name');
    const content = rows[0].querySelector<HTMLElement>('.cm-content')!;
    content.focus();
    // place caret at end and type
    await userEvent.keyboard('{End} X');
    await expect(content).toHaveTextContent('a X');
  },
};

export const EnterCreatesRow: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const before = await canvas.findAllByTestId('bramble-row');
    const first = before[0].querySelector<HTMLElement>('.cm-content')!;
    first.focus();
    await userEvent.keyboard('{End}{Enter}newrow');
    const after = await canvas.findAllByTestId('bramble-row');
    await expect(after.length).toBe(before.length + 1);
    // focus landed in the new row and typing went there
    await expect(document.activeElement?.closest('[data-node-id]')).not.toBeNull();
  },
};

export const BackspaceMergesRow: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const before = await canvas.findAllByTestId('bramble-row');
    // focus the 2nd row (a leaf) and Backspace at its start
    const target = before.find((el) => el.getAttribute('data-depth') === '0' && el !== before[0])!;
    const content = target.querySelector<HTMLElement>('.cm-content')!;
    content.focus();
    await userEvent.keyboard('{Home}{Backspace}');
    await waitFor(async () => {
      const after = await canvas.findAllByTestId('bramble-row');
      await expect(after.length).toBe(before.length - 1);
    });
  },
};

export const IndentOutdent: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const before = await canvas.findAllByTestId('bramble-row');
    // 2nd top-level row (b, depth 0, not the first row)
    const target = before.find((el) => el.getAttribute('data-depth') === '0' && el !== before[0])!;
    const nodeId = target.querySelector('[data-node-id]')!.getAttribute('data-node-id')!;
    const findRow = async () => {
      const rows = await canvas.findAllByTestId('bramble-row');
      return rows.find((el) => el.querySelector(`[data-node-id="${nodeId}"]`))!;
    };

    target.querySelector<HTMLElement>('.cm-content')!.focus();
    await userEvent.keyboard('{Tab}');
    await waitFor(async () => {
      const row = await findRow();
      await expect(row).toHaveAttribute('data-depth', '1'); // nested under its preceding sibling
    });

    (await findRow()).querySelector<HTMLElement>('.cm-content')!.focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(async () => {
      const row = await findRow();
      await expect(row).toHaveAttribute('data-depth', '0'); // lifted back to top level
    });
  },
};

export const ArrowMovesBetweenRows: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = await canvas.findAllByTestId('bramble-row');
    const second = rows[1].querySelector<HTMLElement>('.cm-content')!;
    second.focus();
    await userEvent.keyboard('{Home}{ArrowUp}');
    const focusedId = document.activeElement?.closest('[data-node-id]')?.getAttribute('data-node-id');
    await expect(focusedId).toBe(rows[0].querySelector('[data-node-id]')?.getAttribute('data-node-id'));
  },
};
