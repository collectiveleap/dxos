//
// Copyright 2026 DXOS.org
//

import { type Meta, type StoryObj } from '@storybook/react-vite';
import React, { useMemo, useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { Obj } from '@dxos/echo';
import { useSpaces } from '@dxos/react-client/echo';
import { withClientProvider } from '@dxos/react-client/testing';
import { withLayout, withTheme } from '@dxos/react-ui/testing';
import { Text } from '@dxos/schema';

import { BacklinksPanel } from './BacklinksPanel';
import { NodeOutline } from './NodeOutline';
import { makeMarker } from './mention-extension';
import { OpenBesideContext } from './OpenBeside';
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
    // The marker renders as an atomic chip showing the target's live title.
    const chip = await waitFor(() => {
      const el = canvasElement.querySelector('[data-edge-id]');
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

// Manual verification: focus a row, type `@`, pick a Node → a linked Edge is created and its
// `{{ref:<edgeId>}}` marker (a chip) is inserted at the cursor. The popover does NOT open under the
// runner's synthetic keyboard events (confirmed: typing `@` never activates it), so there is no `play`
// (mirrors the `Drag` story). The default fixture (Root → a → a1, b) supplies pickable target Nodes.
//
// KEYBOARD note: the picker's popover keymap and `brambleGestures` are both `Prec.highest`, so the
// picker MUST be registered before the gestures (RowEditor) — otherwise Enter/Arrow, while the menu is
// open, fall through to the row gestures (new row / move rows) instead of confirming/navigating. The
// closed-menu fall-through (Enter → new row when NO menu is open) stays covered by `EnterCreatesRow`
// et al., which run on rows that now carry the picker extension first.
export const MentionPicker: Story = {};

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

// Seeds Root → Y only (Y mentions X via a LINKED edge). X is NOT a structural child — it has no row,
// so the outline has no reason to re-render when X changes. A button mutates X's text purely at the
// substrate level (`Obj.update`, no editor), reproducing "X edited elsewhere / remotely". Y's chip must
// still update live (IX-immediate) — the case a same-outline re-render would otherwise mask.
// Root → { X, Y }: X ("hello world") is an EDITABLE row and Y ("begin <chip> end") mentions X. Editing X
// through its own row editor must update Y's chip live — the real per-keystroke path.
const MentionLiveStory = () => {
  const [space] = useSpaces();
  const root = useMemo(() => {
    if (!space) {
      return undefined;
    }
    const db = space.db;
    const r = db.add(makeNode({ text: 'Root' }));
    const x = db.add(makeNode({ text: 'hello world' }));
    const y = db.add(makeNode({ text: 'begin  end' }));
    void createEdge(db, r, x, 1); // X is its own editable row...
    void createEdge(db, r, y, 2); // ...and Y (below it) mentions X
    const linked = createLinkedEdge(db, y, x);
    const yText = y.text?.target;
    if (yText) {
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

export const MentionLive: Story = {
  render: () => <MentionLiveStory />,
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = () => canvasElement.querySelector('[data-edge-id]');
    // The chip starts at X's title.
    await waitFor(() => {
      if (chip()?.textContent !== 'hello world') {
        throw new Error('chip not at initial label yet');
      }
    });
    // Edit X through its OWN row editor — the real per-keystroke path (NOT a programmatic Obj.update, which
    // gave a false pass in I3c and let BR-4 through). X is the first body row; type at its end.
    const rows = await canvas.findAllByTestId('bramble-node-name');
    const xEditor = rows[0].querySelector<HTMLElement>('.cm-content')!;
    xEditor.focus();
    await userEvent.keyboard('{End}y');
    // Y's chip must reflect the edit live — no manual refresh, no Enter (BR-4 / IX-immediate).
    await waitFor(() => {
      if (chip()?.textContent !== 'hello worldy') {
        throw new Error('chip did not update live on a per-keystroke editor edit');
      }
    });
    await expect(chip()).toHaveTextContent('hello worldy');
  },
};

// Seeds Root → Y (Y mentions X; X has a structural child X1). Option-clicking Y's chip expands X's
// outline inline below the row — the target's own subtree (X and X1), live + edit-through (UP-5 inline).
const MentionExpandStory = () => {
  const [space] = useSpaces();
  const root = useMemo(() => {
    if (!space) {
      return undefined;
    }
    const db = space.db;
    const r = db.add(makeNode({ text: 'Root' }));
    const x = db.add(makeNode({ text: 'target X' }));
    const x1 = db.add(makeNode({ text: 'child of X' }));
    const y = db.add(makeNode({ text: 'begin  end' }));
    void createEdge(db, r, y, 1); // Y is the only row under root
    void createEdge(db, x, x1, 1); // X has a structural child
    const linked = createLinkedEdge(db, y, x); // Y mentions X
    const yText = y.text?.target;
    if (yText) {
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

const altMouseDown = (el: Element) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, altKey: true }));

export const MentionExpand: Story = {
  render: () => <MentionExpandStory />,
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await waitFor(() => {
      const el = canvasElement.querySelector('[data-edge-id]');
      if (!el || el.textContent !== 'target X') {
        throw new Error('chip not resolved');
      }
      return el as HTMLElement;
    });
    // No secondary view before expansion.
    await expect(canvasElement.querySelector('[data-testid="bramble-secondary"]')).toBeNull();
    // Option-click expands: the target's outline (X and its child X1) renders inline.
    altMouseDown(chip);
    const secondary = await canvas.findByTestId('bramble-secondary');
    await expect(secondary).toHaveTextContent('target X');
    await expect(secondary).toHaveTextContent('child of X');
    // BR-6: the embedded outline is COMPACT — its header is not the 29px page-title scale.
    // BR-6: the expansion renders BELOW the mention's row line (its own line), not beside it to the right.
    const rowLine = secondary.closest('[data-testid="bramble-row"]')!.querySelector('.bramble-outline-row-line')!;
    await expect(secondary.getBoundingClientRect().top).toBeGreaterThanOrEqual(rowLine.getBoundingClientRect().bottom - 1);
    // PX-embed: match Tana's captured values (implementations/tana/visual-spec.md) — a 1px rounded border box,
    // 7.5px corners, 24px content inset, content at normal 15px row scale (no title emphasis).
    const secCS = getComputedStyle(secondary);
    await expect(secCS.borderTopLeftRadius).toBe('7.5px');
    await expect(secCS.paddingLeft).toBe('24px');
    await expect(parseFloat(secCS.borderTopWidth)).toBeLessThanOrEqual(1);
    const embHeader = secondary.querySelector<HTMLElement>('.bramble-outline-header .cm-content');
    await expect(embHeader).not.toBeNull();
    await expect(getComputedStyle(embHeader!).fontSize).toBe('15px');
    // Option-click again collapses.
    altMouseDown(canvasElement.querySelector('[data-edge-id]')!);
    await waitFor(() => {
      if (canvasElement.querySelector('[data-testid="bramble-secondary"]')) {
        throw new Error('secondary view still present');
      }
    });
  },
};

// Seeds Root → A, where A mentions ROOT — an ancestor on the expansion path. Expanding it must show a
// cycle stub, never recurse into the ancestor (IP-3.may-cycle).
const MentionCycleStory = () => {
  const [space] = useSpaces();
  const root = useMemo(() => {
    if (!space) {
      return undefined;
    }
    const db = space.db;
    const r = db.add(makeNode({ text: 'Root' }));
    const a = db.add(makeNode({ text: 'begin  end' }));
    void createEdge(db, r, a, 1);
    const linked = createLinkedEdge(db, a, r); // A mentions ROOT
    const aText = a.text?.target;
    if (aText) {
      Obj.update(aText, (aText) => {
        aText.content = `begin ${makeMarker(linked.id)} end`;
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

export const MentionExpandCycle: Story = {
  render: () => <MentionCycleStory />,
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await waitFor(() => {
      const el = canvasElement.querySelector('[data-edge-id]');
      if (!el || el.textContent !== 'Root') {
        throw new Error('chip not resolved');
      }
      return el as HTMLElement;
    });
    // Expanding a mention of an ancestor-subject (Root) shows a cycle stub, not a nested outline.
    altMouseDown(chip);
    await canvas.findByTestId('bramble-secondary-cycle');
    await expect(canvasElement.querySelector('[data-testid="bramble-secondary"]')).toBeNull();
  },
};

const shiftMouseDown = (el: Element) => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, shiftKey: true }));

// Root → Y (Y mentions X). Shift-clicking Y's chip calls the OpenBeside handler with X — the in-plugin
// half of open-beside (UP-5). The handler is a spy that records the opened Node's title.
const OpenBesideStory = () => {
  const [space] = useSpaces();
  const [opened, setOpened] = useState<string>('');
  const root = useMemo(() => {
    if (!space) {
      return undefined;
    }
    const db = space.db;
    const r = db.add(makeNode({ text: 'Root' }));
    const x = db.add(makeNode({ text: 'target X' }));
    const y = db.add(makeNode({ text: 'begin  end' }));
    void createEdge(db, r, y, 1);
    const linked = createLinkedEdge(db, y, x);
    const yText = y.text?.target;
    if (yText) {
      Obj.update(yText, (yText) => {
        yText.content = `begin ${makeMarker(linked.id)} end`;
      });
    }
    return r;
  }, [space]);
  return root ? (
    <OpenBesideContext.Provider value={(target) => setOpened(target.text?.target?.content ?? '')}>
      <div role='none' className='grow overflow-auto' style={{ backgroundColor: 'var(--surface-bg)' }}>
        <div data-testid='opened-beside'>{opened}</div>
        <NodeOutline subject={root} />
      </div>
    </OpenBesideContext.Provider>
  ) : null;
};

export const OpenBeside: Story = {
  render: () => <OpenBesideStory />,
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await waitFor(() => {
      const el = canvasElement.querySelector('[data-edge-id]');
      if (!el || el.textContent !== 'target X') {
        throw new Error('chip not resolved');
      }
      return el as HTMLElement;
    });
    await expect(canvas.getByTestId('opened-beside')).toHaveTextContent('');
    shiftMouseDown(chip);
    await waitFor(() => {
      if (canvas.getByTestId('opened-beside').textContent !== 'target X') {
        throw new Error('open-beside handler not called with the target');
      }
    });
    await expect(canvas.getByTestId('opened-beside')).toHaveTextContent('target X');
  },
};

// The mention lives in the HEADER (the zoom-root's own text), which renders via RowEditor directly, not
// an OutlineRow. Option-clicking it must still expand — the header renders its own MentionExpansions.
const HeaderMentionStory = () => {
  const [space] = useSpaces();
  const root = useMemo(() => {
    if (!space) {
      return undefined;
    }
    const db = space.db;
    const r = db.add(makeNode({ text: 'begin  end' }));
    const x = db.add(makeNode({ text: 'target X' }));
    const linked = createLinkedEdge(db, r, x); // ROOT (the header) mentions X
    const rText = r.text?.target;
    if (rText) {
      Obj.update(rText, (rText) => {
        rText.content = `begin ${makeMarker(linked.id)} end`;
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

export const HeaderMentionExpand: Story = {
  render: () => <HeaderMentionStory />,
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await waitFor(() => {
      const el = canvasElement.querySelector('[data-edge-id]');
      if (!el || el.textContent !== 'target X') {
        throw new Error('chip not resolved');
      }
      return el as HTMLElement;
    });
    await expect(canvasElement.querySelector('[data-testid="bramble-secondary"]')).toBeNull();
    altMouseDown(chip);
    const secondary = await canvas.findByTestId('bramble-secondary');
    await expect(secondary).toHaveTextContent('target X');
  },
};

// A Node T with an inbound STRUCTURAL edge (P is T's parent — "appears under") and an inbound LINKED
// edge (A mentions T — "mentioned in"). The panel shows both, grouped + distinguished (UP-2). Clicking
// an entry opens it beside (reuses the I3b-2 handler).
const BacklinksStory = () => {
  const [space] = useSpaces();
  const [opened, setOpened] = useState<string>('');
  const t = useMemo(() => {
    if (!space) {
      return undefined;
    }
    const db = space.db;
    const target = db.add(makeNode({ text: 'the target T' }));
    const p = db.add(makeNode({ text: 'parent P' }));
    const a = db.add(makeNode({ text: 'mentioner A' }));
    void createEdge(db, p, target, 1); // structural: T appears under P
    createLinkedEdge(db, a, target); // linked: A mentions T
    return target;
  }, [space]);
  return t ? (
    <OpenBesideContext.Provider value={(node) => setOpened(node.text?.target?.content ?? '')}>
      <div role='none' className='grow overflow-auto' style={{ backgroundColor: 'var(--surface-bg)' }}>
        <div data-testid='opened-beside'>{opened}</div>
        <BacklinksPanel subject={t} />
      </div>
    </OpenBesideContext.Provider>
  ) : null;
};

export const Backlinks: Story = {
  render: () => <BacklinksStory />,
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Structural group shows P under "Appears under"; linked group shows A under "Mentioned in".
    const structural = await canvas.findByTestId('bramble-backlinks-structural');
    await expect(structural).toHaveTextContent('Appears under');
    await expect(structural).toHaveTextContent('parent P');
    const linked = await canvas.findByTestId('bramble-backlinks-linked');
    await expect(linked).toHaveTextContent('Mentioned in');
    await expect(linked).toHaveTextContent('mentioner A');
    // The two kinds are distinguished (separate groups), not collapsed.
    await expect(structural).not.toHaveTextContent('mentioner A');
    // Clicking a backlink entry opens it beside.
    await userEvent.click(within(linked).getByText('mentioner A'));
    await waitFor(() => {
      if (canvas.getByTestId('opened-beside').textContent !== 'mentioner A') {
        throw new Error('entry did not open beside');
      }
    });
  },
};

// Regression: a linked edge survives after its source Node is deleted (db.remove has no relation
// cascade), so Relation.getSource throws. The panel must SKIP the dangling edge, not crash.
const BacklinksDanglingStory = () => {
  const [space] = useSpaces();
  const t = useMemo(() => {
    if (!space) {
      return undefined;
    }
    const db = space.db;
    const target = db.add(makeNode({ text: 'the target T' }));
    const a = db.add(makeNode({ text: 'mentioner A' }));
    createLinkedEdge(db, a, target); // A mentions T
    db.remove(a); // A deleted; the A→T edge now dangles (unresolvable source)
    return target;
  }, [space]);
  return t ? (
    <div role='none' className='grow overflow-auto' style={{ backgroundColor: 'var(--surface-bg)' }}>
      <BacklinksPanel subject={t} />
    </div>
  ) : null;
};

export const BacklinksDangling: Story = {
  render: () => <BacklinksDanglingStory />,
  tags: ['test'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The dangling edge is skipped — the panel renders (no crash) and shows no backlinks.
    await canvas.findByTestId('bramble-backlinks-empty');
    await expect(canvasElement.querySelector('[data-testid="bramble-backlinks-linked"]')).toBeNull();
  },
};
