//
// Copyright 2026 DXOS.org
//

import { type Meta, type StoryObj } from '@storybook/react-vite';
import React, { useMemo } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { Obj } from '@dxos/echo';
import { useSpaces } from '@dxos/react-client/echo';
import { withClientProvider } from '@dxos/react-client/testing';
import { withLayout, withTheme } from '@dxos/react-ui/testing';
import { Text } from '@dxos/schema';

import { NodeOutline } from './NodeOutline';
import { makeMarker } from './mention-extension';
import { createEdge, createLinkedEdge } from '../../model/edges';
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

// Seeds Root → Y, where Y's text is `begin {{ref:<edgeId>}} end` and a LINKED edge Y→X targets
// X ("hello world"). Proves the marker token renders as a live atomic chip (I3a Task 2 de-risk).
const MentionStory = () => {
  const [space] = useSpaces();
  const root = useMemo(() => {
    if (!space) {
      return undefined;
    }
    const db = space.db;
    const r = db.add(makeNode({ text: 'Root' }));
    const x = db.add(makeNode({ text: 'hello world' }));
    const y = db.add(makeNode({ text: 'begin  end' }));
    void createEdge(db, r, y, 1); // structural: y under root
    const linked = createLinkedEdge(db, y, x); // linked: y mentions x
    const yText = y.text?.target;
    if (yText) {
      // marker references the edge id, not a URL
      Obj.update(yText, (yText) => {
        yText.content = `begin ${makeMarker(linked.id)} end`;
      });
    }
    return r;
  }, [space]);
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

export const Mention: Story = {
  render: () => <MentionStory />,
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The marker renders as an atomic `dx-anchor` chip showing the target's live title.
    const chip = await waitFor(() => {
      const el = canvasElement.querySelector('dx-anchor[data-edge-id]');
      if (!el || el.textContent !== 'hello world') {
        throw new Error('mention chip not resolved yet');
      }
      return el as HTMLElement;
    });
    await expect(chip).toHaveTextContent('hello world');
    // The raw `{{ref:...}}` token is replaced by the chip — not shown as text.
    const row = await canvas.findByTestId('bramble-row');
    await expect(row).not.toHaveTextContent('{{ref:');
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

export const Collapse: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const before = await canvas.findAllByTestId('bramble-row');
    await expect(before).toHaveLength(3); // a, a1, b
    // Hover 'a' to reveal its chevron, then click it to collapse.
    const aRow = before[0];
    await userEvent.hover(aRow);
    const chevron = within(aRow).getByTestId('bramble-chevron');
    await userEvent.click(chevron);
    await waitFor(async () => {
      const after = await canvas.findAllByTestId('bramble-row');
      await expect(after).toHaveLength(2); // a1 hidden; a and b remain
    });
    // Click again to expand.
    await userEvent.hover(aRow);
    await userEvent.click(within(await (async () => (await canvas.findAllByTestId('bramble-row'))[0])()).getByTestId('bramble-chevron'));
    await waitFor(async () => {
      await expect(await canvas.findAllByTestId('bramble-row')).toHaveLength(3);
    });
  },
};

// Manual-only: pointer drag is not reliably synthesizable in the test runner, so this story
// has no `play` function. Renders the same multi-row fixture (a → a1, b) as `Collapse`/`Zoom`
// so a human can drag a bullet in the Storybook UI to reorder or nest rows.
export const Drag: Story = {
  name: 'Drag (manual: drag a bullet to reorder / nest)',
  tags: ['test'],
};

export const Zoom: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Zoom into 'a' (which has child a1) by clicking its bullet.
    const aRow = (await canvas.findAllByTestId('bramble-row'))[0];
    await userEvent.click(within(aRow).getByTestId('bramble-bullet'));
    await waitFor(async () => {
      // Header now shows 'a'; the outline shows only a's subtree (a1), not b.
      await expect(await canvas.findByTestId('bramble-header')).toHaveTextContent('a');
      const rows = await canvas.findAllByTestId('bramble-row');
      await expect(rows).toHaveLength(1);
      await expect(rows[0]).toHaveTextContent('a1');
    });
  },
};

export const ZoomOutAndKeyboard: Story = {
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // CodeMirror's `Mod-` resolves off `navigator.platform` (see `ReorderRows` above).
    const modKey = /Mac/.test(navigator.platform) ? 'Meta' : 'Control';

    const aRow = (await canvas.findAllByTestId('bramble-row'))[0];
    aRow.querySelector<HTMLElement>('.cm-content')!.focus();
    // Keyboard zoom-in on the focused row (a).
    await userEvent.keyboard(`{${modKey}>}]{/${modKey}}`); // Mod-]
    await waitFor(async () => {
      await expect(await canvas.findByTestId('bramble-header')).toHaveTextContent('a');
    });
    // Escape zooms back out.
    await userEvent.keyboard('{Escape}');
    await waitFor(async () => {
      await expect(await canvas.findByTestId('bramble-header')).toHaveTextContent('Root');
      await expect(await canvas.findAllByTestId('bramble-row')).toHaveLength(3);
    });
    // Keyboard collapse on the focused row ('a' — re-query since the zoom round-trip
    // unmounts/remounts it: it briefly became the header and is no longer the same
    // React-reconciled row instance).
    const aRowAgain = (await canvas.findAllByTestId('bramble-row'))[0];
    aRowAgain.querySelector<HTMLElement>('.cm-content')!.focus();
    await userEvent.keyboard(`{${modKey}>}.{/${modKey}}`); // Mod-.
    await waitFor(async () => {
      await expect(await canvas.findAllByTestId('bramble-row')).toHaveLength(2);
    });
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
