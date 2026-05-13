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
  Editor,
  Graph,
  FieldGroups,
  OpenPaneContext,
  PredecessorNav,
  ZoomContext,
  getDisplayLabel,
  useBacklinks,
  useEnsureAllSupertagNodes,
  useNormalizeSupertagUniqueness,
} from '#components';
import { Bramble } from '#types';

// The article surface accepts either a `Bramble.Graph` (top-level Graph
// opened via the navigator) or a `Bramble.Node` (opened in a new pane via
// shift-click on a child bullet, per F-Open-Pane). Both render the same
// page UI: editable H1 header + breadcrumb + child tree + (when applicable)
// backlinks panel.
export type ArticleProps = AppSurface.ObjectArticleProps<Bramble.Graph | Bramble.Node>;

// Renders the Graph / sub-node as a Tana-style page. F-Page-Header:
// the page node (default = the pane's root) ALWAYS renders as an
// editable H1 at the top, with its children rendered as bullets below.
// Clicking a child's bullet makes that node the new page node within
// the pane; shift-clicking opens it in a new pane (F-Open-Pane).
export const Article = ({ role, subject, attendableId }: ArticleProps) => {
  // Subscribe to the subject for re-renders on top-level field changes
  // (e.g. graph.name). Snapshots from useObject are NOT extensible and
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

  // Subject can be a Bramble.Graph (has `root`) or a Bramble.Node (opened in a
  // new pane via F-Open-Pane). The pane's root is the graph's root
  // for graph subjects, or the subject itself for Node subjects.
  const isGraph = isBrambleGraph(subject);
  const liveGraph = isGraph ? (subject as Bramble.Graph) : null;
  const paneRootNode = (isGraph
    ? (subject as any).root?.target
    : (subject as Bramble.Node)) as Bramble.Node | null;

  // Subscribe to the pane root so a change to its content (e.g. typing
  // in the H1) re-renders this component (used by the rootLabel auto-sync).
  // Falls back to `subject` when paneRootNode is briefly null (e.g. a
  // graph whose root ref hasn't resolved yet) since useObject expects
  // a non-null reactive object.
  useObject(paneRootNode ?? subject);

  const { list, countByTargetId } = useBacklinks(isGraph ? (subject as Bramble.Graph) : undefined);

  // The "page node" within this pane is the current zoom target. `null`
  // means "at pane root".
  const [pageNodeId, setPageNodeId] = useState<string | null>(null);
  const pageNode = useMemo(() => {
    if (!paneRootNode) {
      return null;
    }
    if (!pageNodeId) {
      return paneRootNode;
    }
    const inTree = findNodeById(paneRootNode, pageNodeId);
    if (inTree) {
      return inTree;
    }
    // F-Supertag tag-node: a chip click can target a top-level Node
    // outside this pane's graph (e.g. the per-space `#Task` tag
    // Node). Fall back to a whole-DB lookup so cross-tree zoom
    // works. Falls all the way back to `paneRootNode` when the id
    // isn't anywhere in the space.
    const db = Obj.getDatabase(paneRootNode);
    const foreign = db?.getObjectById?.(pageNodeId) as Bramble.Node | undefined;
    return foreign ?? paneRootNode;
  }, [paneRootNode, pageNodeId]);

  // F-Supertag.eager-materialization: on each space the outliner
  // mounts in, find-or-create one supertag-node per qualifying
  // ECHO type (parented to the per-space Schema system node), and
  // subscribe to the schemaRegistry so new types registered later
  // also materialize live. Idempotent across panes via a shared
  // per-typename lock.
  useEnsureAllSupertagNodes(paneRootNode ? Obj.getDatabase(paneRootNode) : undefined);

  // F-Supertag.uniqueness: one-time-per-(db, session) normalisation
  // sweep — for every (instance, supertag) pair represented by more
  // than one node in the space, keep the lowest-`Node.id` node as
  // canonical and drop the supertag Ref from the rest. Idempotent
  // (guard via WeakMap) so concurrent panes are safe.
  useNormalizeSupertagUniqueness(paneRootNode ? Obj.getDatabase(paneRootNode) : undefined);

  const handleZoom = useCallback((nodeId: string) => {
    setPageNodeId(nodeId);
  }, []);

  // F-DAG.Phase3e.predecessor-nav-switch: select a predecessor from
  // the page-top control. The current pane swaps its page node to
  // the chosen predecessor; if that predecessor IS the pane root,
  // clear `pageNodeId` so the pane renders its natural root view.
  const handleSelectPredecessor = useCallback(
    (target: Bramble.Node) => {
      if (!paneRootNode) {
        return;
      }
      setPageNodeId(target.id === paneRootNode.id ? null : target.id);
    },
    [paneRootNode],
  );

  // F-Open-Pane: invoke `LayoutOperation.Open` with the pane's
  // `attendableId` as `pivotId` so the new pane lands as a sibling
  // plank to the right of THIS pane. The deck's open handler expects
  // a CANONICAL QUALIFIED PATH (`<root>/<spaceId>/types/<typename>/all/<id>`),
  // not a bare object id, so we derive the path from the live Node via
  // `getObjectPathFromObject`. The corresponding article surface
  // (registered for `Bramble.Node` in `react-surface.tsx`) picks the
  // Node up as the new pane's subject.
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
  // F-Zoom (node becomes the page node of the current pane), and
  // surface a toast that links to the Deck settings panel.
  const handleOpenPane = useCallback(
    async (target: Bramble.Node) => {
      if (!deckSettings?.enableDeck) {
        setPageNodeId(target.id);
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

  // F-Page-Header.5 (graph subject only): one-time migration — copy
  // `graph.name` into `root.content` if root is empty AND name is set.
  useEffect(() => {
    if (!liveGraph || !paneRootNode) {
      return;
    }
    if (hasContent(paneRootNode) || !liveGraph.name || liveGraph.name.length === 0) {
      return;
    }
    const initialName = liveGraph.name;
    Obj.update(paneRootNode, (mutable) => {
      (mutable as any).content = [{ kind: 'text', text: initialName }];
    });
    // Run once at mount per graph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // F-Page-Header.6 (graph subject only): keep `graph.name` in step
  // with `root.content`'s rendered text so the navigator label always
  // reflects what the user sees in the H1.
  const rootLabel = paneRootNode ? getDisplayLabel(paneRootNode) : '';
  useEffect(() => {
    if (!liveGraph || rootLabel.length === 0 || liveGraph.name === rootLabel) {
      return;
    }
    Obj.update(liveGraph, (mutable) => {
      (mutable as any).name = rootLabel;
    });
  }, [liveGraph, rootLabel]);

  return (
    <Panel.Root role={role}>
      <Panel.Content>
        {pageNode ? (
          // F-Scroll: outer Panel.Content has `overflow: hidden` —
          // the inner wrapper must establish its own scroll region
          // so long outlines / tall field groups / large backlink
          // panels are reachable, not silently clipped.
          <div className='p-4 h-full overflow-y-auto'>
            <PredecessorNav
              pageBlock={pageNode}
              onSelect={handleSelectPredecessor}
              onShiftSelect={handleOpenPane}
            />
            <PageHeader node={pageNode} />
            {/* F-Supertag Phase 3b: when the page node is itself a wrapper
                (carries `supertags`), surface its FieldGroups at the
                page level — they otherwise only mount as part of a
                Node child row, which never happens for a
                zoomed-in wrapper. */}
            <FieldGroups block={pageNode} />
            <BacklinkCountContext.Provider value={countByTargetId}>
              <ZoomContext.Provider value={handleZoom}>
                <OpenPaneContext.Provider value={handleOpenPane}>
                  <Graph rootBlock={pageNode} />
                </OpenPaneContext.Provider>
              </ZoomContext.Provider>
            </BacklinkCountContext.Provider>
            {isGraph && <BacklinksPanel backlinks={list} />}
          </div>
        ) : (
          <div className='p-4 text-sm opacity-60'>(loading…)</div>
        )}
      </Panel.Content>
    </Panel.Root>
  );
};

// Page-level header for the current `pageNode`. Branches by the
// Node's plugin-internal role:
// - tag node (`tagTypename` set): decorative amber `#` chip on the
//   left + editable Node content on the right. The `#` is UI
//   decoration only; it's NOT part of the Node's content (so the
//   stored label is "Task", not "#Task").
// - system node (`systemNode` set): read-only header — Schema /
//   Library aren't user-renameable.
// - any other Node: standard inline-editable H1 (current behaviour).
const PageHeader = ({ node }: { node: Bramble.Node }) => {
  const tagTypename = (node as any).tagTypename as string | undefined;
  const systemNode = (node as any).systemNode as string | undefined;

  if (systemNode) {
    return (
      <h1
        className='mt-2 mb-4 text-2xl font-bold text-neutral-500 dark:text-neutral-500 select-none'
        title={`System node (${systemNode})`}
      >
        {getDisplayLabel(node) || systemNode}
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
          <Editor block={node} headlineMode />
        </span>
      </h1>
    );
  }

  return (
    <h1 className='mt-2 mb-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100'>
      <Editor block={node} headlineMode />
    </h1>
  );
};

// True when `obj` is a Bramble.Graph (has a `root` field). Distinguishes
// graph subjects from raw Node subjects opened via F-Open-Pane.
const isBrambleGraph = (obj: any): boolean => Boolean(obj && 'root' in obj && obj.root);

const findNodeById = (root: Bramble.Node, id: string): Bramble.Node | null => {
  const stack: Bramble.Node[] = [root];
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

// True iff the Node has at least one renderable content segment.
const hasContent = (node: Bramble.Node): boolean => {
  const segments = (node.content ?? []) as readonly any[];
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

export default Article;
