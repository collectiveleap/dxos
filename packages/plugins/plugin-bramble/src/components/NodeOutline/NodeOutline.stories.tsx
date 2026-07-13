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
  // Render on the theme's base surface. The shared `withLayout({ layout: 'fullscreen' })`
  // decorator wraps stories in a hardcoded `bg-black`, illegible in light theme (the
  // outline's text is theme-adaptive but its own background is transparent). In real
  // Composer the outline sits on the themed deck surface; this reproduces that so both
  // themes are legible here and in the visual gate. `--surface-bg` is the theme's
  // light-dark() base surface (Tailwind `bg-*` utilities aren't compiled in this story
  // context, so the var is set directly).
  return root ? (
    <div role='none' className='grow overflow-auto' style={{ backgroundColor: 'var(--surface-bg)' }}>
      <NodeOutline subject={root} />
    </div>
  ) : null;
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

// Perceptual lightness of a computed colour (oklch L directly; relative luminance for
// rgb) — enough to detect a text/background pair with near-zero contrast, which is the
// illegible-theme failure mode. Used by the `LegibleInBothThemes` gate below.
const lightness = (color: string): number | null => {
  const okl = color.match(/oklch\(\s*([0-9.]+)/i);
  if (okl) {
    return parseFloat(okl[1]);
  }
  const rgb = color.match(/rgba?\(([^)]+)\)/i);
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').slice(0, 3).map((s) => parseFloat(s) / 255);
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  return null;
};

// The first painted (non-transparent) background behind an element.
const ambientBackground = (el: Element): string => {
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    const bg = getComputedStyle(cur).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      return bg;
    }
  }
  return getComputedStyle(document.body).backgroundColor;
};

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
    // Focus must survive the reparent — rows are edge.id-keyed, so a reparent (which
    // replaces the edge) remounts the row's editor; the controller re-places the caret
    // explicitly (see `indent`/`outdent` in controller.ts) after the swap.
    await expect(document.activeElement?.closest('[data-node-id]')?.getAttribute('data-node-id')).toBe(nodeId);

    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(async () => {
      const row = await findRow();
      await expect(row).toHaveAttribute('data-depth', '0'); // lifted back to top level
    });
    await expect(document.activeElement?.closest('[data-node-id]')?.getAttribute('data-node-id')).toBe(nodeId);
  },
};

export const ReorderRows: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const before = await canvas.findAllByTestId('bramble-row');
    // 2nd top-level row (b, depth 0, not the first row) — move it up past a.
    const target = before.find((el) => el.getAttribute('data-depth') === '0' && el !== before[0])!;
    const beforeIds = before.map((el) => el.querySelector('[data-node-id]')!.getAttribute('data-node-id'));

    target.querySelector<HTMLElement>('.cm-content')!.focus();
    // CodeMirror's `Mod-` resolves off `navigator.platform`: Meta on Mac, Ctrl elsewhere — and
    // that varies by *where this suite runs* (a Mac dev machine vs. a Linux CI runner), so pick
    // the modifier at runtime rather than hardcoding one.
    const modKey = /Mac/.test(navigator.platform) ? 'Meta' : 'Control';
    await userEvent.keyboard(`{${modKey}>}{Shift>}{ArrowUp}{/Shift}{/${modKey}}`);
    await waitFor(async () => {
      const after = await canvas.findAllByTestId('bramble-row');
      const afterIds = after.map((el) => el.querySelector('[data-node-id]')!.getAttribute('data-node-id'));
      await expect(afterIds).not.toEqual(beforeIds); // order changed
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

// PX-theme legibility gate. The visual-diff gate checks each region's text *colour* but
// not its contrast against the ambient background — which let an illegible light theme
// (theme-adaptive dark text on a hardcoded `bg-black` story wrapper) pass. This asserts
// the outline text keeps a real contrast gap in BOTH themes: it toggles the root theme
// class + color-scheme (which drive the `light-dark()` surface and text vars) and
// re-measures. A dark-on-dark / light-on-light regression collapses the gap toward 0.
export const LegibleInBothThemes: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = await canvas.findByTestId('bramble-header');
    const text = header.querySelector<HTMLElement>('.cm-content')!;
    const root = document.documentElement;
    const orig = { cls: root.className, cs: root.style.colorScheme };
    try {
      for (const theme of ['light', 'dark'] as const) {
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        root.style.colorScheme = theme;
        void root.offsetHeight; // reflow so light-dark() re-resolves
        const textL = lightness(getComputedStyle(text).color);
        const bgL = lightness(ambientBackground(text));
        await expect(textL, `${theme}: text lightness`).not.toBeNull();
        await expect(bgL, `${theme}: background lightness`).not.toBeNull();
        const gap = Math.abs((textL as number) - (bgL as number));
        await expect(gap, `${theme} theme text/background contrast gap`).toBeGreaterThan(0.3);
      }
    } finally {
      root.classList.remove('light', 'dark');
      if (orig.cls) {
        root.className = orig.cls;
      }
      root.style.colorScheme = orig.cs;
    }
  },
};
