//
// Copyright 2025 DXOS.org
//

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { type AppSurface } from '@dxos/app-toolkit/ui';
import { LayoutOperation, SettingsOperation, getObjectPathFromObject } from '@dxos/app-toolkit';
import { useAtomCapability, useOperationInvoker } from '@dxos/app-framework/ui';
import { Obj } from '@dxos/echo';
import { DeckCapabilities } from '@dxos/plugin-deck/types';
import { useObject } from '@dxos/react-client/echo';
import { Panel, useTranslation } from '@dxos/react-ui';

import { meta } from '#meta';

import {
  BacklinkCountContext,
  BacklinksPanel,
  BlockEditor,
  BlockTree,
  FieldGroups,
  OpenPaneContext,
  PredecessorNav,
  ZoomContext,
  getDisplayLabel,
  useBacklinks,
} from '#components';
import { Block, type BlockOutline } from '#types';

// The article surface accepts either a `BlockOutline` (top-level outline
// opened via the navigator) or a `Block` (opened in a new pane via
// shift-click on a child bullet, per F-Open-Pane). Both render the same
// page UI: editable H1 header + breadcrumb + child tree + (when applicable)
// backlinks panel.
export type BlockArticleProps = AppSurface.ObjectArticleProps<BlockOutline.BlockOutline | Block.Block>;

// Renders the outline / sub-block as a Tana-style page. F-Page-Header:
// the page block (default = the pane's root) ALWAYS renders as an
// editable H1 at the top, with its children rendered as bullets below.
// Clicking a child's bullet makes that block the new page block within
// the pane; shift-clicking opens it in a new pane (F-Open-Pane).
export const BlockArticle = ({ role, subject, attendableId }: BlockArticleProps) => {
  // Subscribe to the subject for re-renders on top-level field changes
  // (e.g. outline.name). Snapshots from useObject are NOT extensible and
  // cannot be passed to other useObject calls or to Obj.update — always
  // pipe the LIVE entity (`subject`, `subject.root?.target`) to anything
  // downstream. The snapshot is only here to trigger React re-renders.
  useObject(subject);
  const { invokePromise } = useOperationInvoker();
  const { t } = useTranslation(meta.id);
  // F-Open-Pane.deck-disabled-fallback: read the deck-mode toggle so we
  // can detect when shift-click would silently fail (Composer's
  // `DeckContent` reverts any multi-mode transition while
  // `enableDeck === false`) and fall back to F-Zoom + a toast.
  const deckSettings = useAtomCapability(DeckCapabilities.Settings);

  // Subject can be a BlockOutline (has `root`) or a Block (opened in a
  // new pane via F-Open-Pane). The pane's root is the outline's root
  // for outline subjects, or the subject itself for Block subjects.
  const isOutline = isBlockOutline(subject);
  const liveOutline = isOutline ? (subject as BlockOutline.BlockOutline) : null;
  const paneRootBlock = (isOutline
    ? (subject as any).root?.target
    : (subject as Block.Block)) as Block.Block | null;

  // Subscribe to the pane root so a change to its content (e.g. typing
  // in the H1) re-renders this component (used by the rootLabel auto-sync).
  // Falls back to `subject` when paneRootBlock is briefly null (e.g. an
  // outline whose root ref hasn't resolved yet) since useObject expects
  // a non-null reactive object.
  useObject(paneRootBlock ?? subject);

  const { list, countByTargetId } = useBacklinks(isOutline ? (subject as BlockOutline.BlockOutline) : undefined);

  // The "page block" within this pane is the current zoom target. `null`
  // means "at pane root".
  const [pageBlockId, setPageBlockId] = useState<string | null>(null);
  const pageBlock = useMemo(() => {
    if (!paneRootBlock) {
      return null;
    }
    if (!pageBlockId) {
      return paneRootBlock;
    }
    const inTree = findBlockById(paneRootBlock, pageBlockId);
    if (inTree) {
      return inTree;
    }
    // F-6.Phase3.tag-node: a chip click can target a top-level Block
    // outside this pane's outline (e.g. the per-space `#Task` tag
    // Block). Fall back to a whole-DB lookup so cross-tree zoom
    // works. Falls all the way back to `paneRootBlock` when the id
    // isn't anywhere in the space.
    const db = Obj.getDatabase(paneRootBlock);
    const foreign = db?.getObjectById?.(pageBlockId) as Block.Block | undefined;
    return foreign ?? paneRootBlock;
  }, [paneRootBlock, pageBlockId]);

  const handleZoom = useCallback((blockId: string) => {
    setPageBlockId(blockId);
  }, []);

  // F-DAG.Phase3e.predecessor-nav-switch: select a predecessor from
  // the page-top control. The current pane swaps its page block to
  // the chosen predecessor; if that predecessor IS the pane root,
  // clear `pageBlockId` so the pane renders its natural root view.
  const handleSelectPredecessor = useCallback(
    (target: Block.Block) => {
      if (!paneRootBlock) {
        return;
      }
      setPageBlockId(target.id === paneRootBlock.id ? null : target.id);
    },
    [paneRootBlock],
  );

  // F-Open-Pane: invoke `LayoutOperation.Open` with the pane's
  // `attendableId` as `pivotId` so the new pane lands as a sibling
  // plank to the right of THIS pane. The deck's open handler expects
  // a CANONICAL QUALIFIED PATH (`<root>/<spaceId>/types/<typename>/all/<id>`),
  // not a bare object id, so we derive the path from the live Block via
  // `getObjectPathFromObject`. The corresponding article surface
  // (registered for `Block.Block` in `react-surface.tsx`) picks the
  // Block up as the new pane's subject.
  //
  // Solo→multi transition keeps the current pane: when the deck is in
  // solo mode, `SetLayoutMode { mode: 'multi' }` clears the solo entry
  // without adding it back to `active` (the unsolo path in
  // `plugin-deck/operations/adjust.ts` re-opens it explicitly). So we
  // pass BOTH the current pane's id AND the new path to `Open` and
  // pivot off the current id, so the current pane is restored to
  // `active` and the new pane lands as a sibling to its right.
  //
  // F-Open-Pane.deck-disabled-fallback: when Composer's deck-mode
  // toggle is OFF (`settings.enableDeck === false`), `DeckContent`
  // reverts any multi-mode transition immediately, so a new pane
  // would never appear. Detect that case up-front, fall back to
  // F-Zoom (block becomes the page block of the current pane), and
  // surface a toast that links to the Deck settings panel.
  const handleOpenPane = useCallback(
    async (target: Block.Block) => {
      if (!deckSettings?.enableDeck) {
        setPageBlockId(target.id);
        await invokePromise?.(LayoutOperation.AddToast, {
          id: `${meta.id}/open-pane-disabled/${target.id}`,
          title: t('open-pane.disabled.toast.title'),
          description: t('open-pane.disabled.toast.description'),
          actionLabel: t('open-pane.disabled.toast.action.label'),
          onAction: () => {
            void invokePromise?.(SettingsOperation.Open, { plugin: 'org.dxos.plugin.deck' });
          },
        });
        return;
      }
      const path = getObjectPathFromObject(target);
      await invokePromise?.(LayoutOperation.SetLayoutMode, { mode: 'multi' });
      // Pause briefly so the SetLayoutMode atom update propagates before
      // Open reads `deck.solo` again — without this, Open observes the
      // stale (solo-set) state and `computeActiveUpdates` re-establishes
      // solo with `outline_path`, undoing the multi-mode switch.
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      await invokePromise?.(LayoutOperation.Open, {
        subject: [attendableId, path],
        pivotId: attendableId,
        navigation: 'immediate',
      });
    },
    [invokePromise, attendableId, deckSettings?.enableDeck, t],
  );

  // F-Page-Header.5 (outline subject only): one-time migration — copy
  // `outline.name` into `root.content` if root is empty AND name is set.
  useEffect(() => {
    if (!liveOutline || !paneRootBlock) {
      return;
    }
    if (hasContent(paneRootBlock) || !liveOutline.name || liveOutline.name.length === 0) {
      return;
    }
    const initialName = liveOutline.name;
    Obj.update(paneRootBlock, (mutable) => {
      (mutable as any).content = [{ kind: 'text', text: initialName }];
    });
    // Run once at mount per outline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // F-Page-Header.6 (outline subject only): keep `outline.name` in step
  // with `root.content`'s rendered text so the navigator label always
  // reflects what the user sees in the H1.
  const rootLabel = paneRootBlock ? getDisplayLabel(paneRootBlock) : '';
  useEffect(() => {
    if (!liveOutline || rootLabel.length === 0 || liveOutline.name === rootLabel) {
      return;
    }
    Obj.update(liveOutline, (mutable) => {
      (mutable as any).name = rootLabel;
    });
  }, [liveOutline, rootLabel]);

  return (
    <Panel.Root role={role}>
      <Panel.Content>
        {pageBlock ? (
          <div className='p-4'>
            <PredecessorNav
              pageBlock={pageBlock}
              onSelect={handleSelectPredecessor}
              onShiftSelect={handleOpenPane}
            />
            <PageHeader block={pageBlock} />
            {/* F-6 Phase 3b: when the page block is itself a wrapper
                (carries `supertags`), surface its FieldGroups at the
                page level — they otherwise only mount as part of a
                BlockNode child row, which never happens for a
                zoomed-in wrapper. */}
            <FieldGroups block={pageBlock} />
            <BacklinkCountContext.Provider value={countByTargetId}>
              <ZoomContext.Provider value={handleZoom}>
                <OpenPaneContext.Provider value={handleOpenPane}>
                  <BlockTree rootBlock={pageBlock} />
                </OpenPaneContext.Provider>
              </ZoomContext.Provider>
            </BacklinkCountContext.Provider>
            {isOutline && <BacklinksPanel backlinks={list} />}
          </div>
        ) : (
          <div className='p-4 text-sm opacity-60'>(loading…)</div>
        )}
      </Panel.Content>
    </Panel.Root>
  );
};

// Page-level header for the current `pageBlock`. Branches by the
// Block's plugin-internal role:
// - tag node (`tagTypename` set): decorative amber `#` chip on the
//   left + editable Block content on the right. The `#` is UI
//   decoration only; it's NOT part of the Block's content (so the
//   stored label is "Task", not "#Task").
// - system node (`systemNode` set): read-only header — Schema /
//   Library aren't user-renameable.
// - any other Block: standard inline-editable H1 (current behaviour).
const PageHeader = ({ block }: { block: Block.Block }) => {
  const tagTypename = (block as any).tagTypename as string | undefined;
  const systemNode = (block as any).systemNode as string | undefined;

  if (systemNode) {
    return (
      <h1
        className='mt-2 mb-4 text-2xl font-bold text-neutral-500 dark:text-neutral-500 select-none'
        title={`System node (${systemNode})`}
      >
        {getDisplayLabel(block) || systemNode}
      </h1>
    );
  }

  if (tagTypename) {
    return (
      <h1 className='mt-2 mb-4 flex items-center gap-3 text-2xl font-bold text-neutral-900 dark:text-neutral-100'>
        <span
          aria-hidden
          className='shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-3xl leading-none select-none'
          title={tagTypename}
        >
          #
        </span>
        <span className='flex-1 min-w-0'>
          <BlockEditor block={block} headlineMode />
        </span>
      </h1>
    );
  }

  return (
    <h1 className='mt-2 mb-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100'>
      <BlockEditor block={block} headlineMode />
    </h1>
  );
};

// True when `obj` is a BlockOutline (has a `root` field). Distinguishes
// outline subjects from raw Block subjects opened via F-Open-Pane.
const isBlockOutline = (obj: any): boolean => Boolean(obj && 'root' in obj && obj.root);

const findBlockById = (root: Block.Block, id: string): Block.Block | null => {
  const stack: Block.Block[] = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.id === id) {
      return current;
    }
    const childRefs = (current.children ?? []) as readonly any[];
    for (const ref of childRefs) {
      const child = ref?.target;
      if (child) {
        stack.push(child);
      }
    }
  }
  return null;
};

// True iff the Block has at least one renderable content segment.
const hasContent = (block: Block.Block): boolean => {
  const segments = (block.content ?? []) as readonly any[];
  return segments.some((segment) => {
    if (segment?.kind === 'text') {
      return (segment.text ?? '').length > 0;
    }
    if (segment?.kind === 'ref') {
      return !!segment.target;
    }
    return false;
  });
};

export default BlockArticle;
