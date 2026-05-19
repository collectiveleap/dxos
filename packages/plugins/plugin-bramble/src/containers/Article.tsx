//
// Copyright 2025 DXOS.org
//

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { type AppSurface } from '@dxos/app-toolkit/ui';
import { LayoutOperation, SettingsOperation, getObjectPathFromObject } from '@dxos/app-toolkit';
import { useAtomCapability, useOperationInvoker } from '@dxos/app-framework/ui';
import { Obj } from '@dxos/echo';
import { DeckCapabilities } from '@dxos/plugin-deck';
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
  type PendingSlot,
  PendingSlotContext,
  PredecessorNav,
  RunExecutionView,
  RunLensShell,
  RunNav,
  StepActions,
  StepRunsList,
  TagChips,
  ZoomContext,
  childEdgesOf,
  createEdge,
  ensureMigratedChildren,
  getDisplayLabel,
  hasSupertagOfTypename,
  moveToAdjacentVisibleBlock,
  orderBetween,
  useBacklinks,
  useEnsureAllSupertagNodes,
  useNormalizeSupertagUniqueness,
  usePdfDropTarget,
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

  // F-No-Root: subject is always a Bramble.Node (the Bramble.Graph
  // object is no longer directly viewable). The pane's "root Node"
  // is just the subject itself — the focused Node for this pane.
  const paneRootNode = subject as Bramble.Node | null;

  // Subscribe to the pane root so a change to its content (e.g. typing
  // in the H1) re-renders this component.
  useObject(paneRootNode ?? subject);

  const { list, countByTargetId } = useBacklinks(paneRootNode ?? undefined);

  // F-Run-Lens (Iteration 2c.5): per-pane Lens activation state.
  // Default false; "+ New Run" sets it to true (the user is about
  // to do the work). Stop / Done deactivates. Resume re-activates.
  // Not persisted to ECHO yet — per-session state per F-Run-Lens.
  const [runLensActive, setRunLensActive] = useState<boolean>(false);
  // R-Bramble-Subject-Path: the pane subject is the single source
  // of truth for "which Node the pane is on." `pageNode` equals
  // `paneRootNode` (the resolved subject). No per-pane local
  // zoom state — F-Zoom, F-Run-Lens "+ New Run", F-DAG.Phase3e
  // predecessor-nav, and the F-Open-Pane deck-disabled fallback
  // all navigate via `LayoutOperation.Open` with the target's
  // canonical path (see handleZoom / handleCreateRun /
  // handleSelectPredecessor / handleOpenPane below).
  const pageNode = paneRootNode;

  // F-Supertag.eager-materialization: on each space the outliner
  // mounts in, find-or-create one supertag-node per qualifying
  // ECHO type (parented to the per-space Schema system node), and
  // subscribe to the schemaRegistry so new types registered later
  // also materialize live. Idempotent across panes via a shared
  // per-typename lock.
  useEnsureAllSupertagNodes(paneRootNode ? Obj.getDatabase(paneRootNode) : undefined);

  // F-No-Root: the prior mount-time today-resolver effect lived here.
  // Removed — F-No-Root.create-navigates-to-today now lands the user
  // on today's Node at Bramble-creation time (via BramblePlugin's
  // createObject callback) and F-Bramble-Nav.today-opens-todays-day-
  // node handles every subsequent return-to-today navigation. The
  // Article's subject is always a Bramble.Node now; there is no
  // "mount of a Graph" path needing a today-resolver.

  // F-Supertag.uniqueness: one-time-per-(db, session) normalisation
  // sweep — for every (instance, supertag) pair represented by more
  // than one node in the space, keep the lowest-`Node.id` node as
  // canonical and drop the supertag Ref from the rest. Idempotent
  // (guard via WeakMap) so concurrent panes are safe.
  useNormalizeSupertagUniqueness(paneRootNode ? Obj.getDatabase(paneRootNode) : undefined);

  // F-Page-Header.7 + F-Page-Header.11/12: focusId is lifted here so
  // BOTH the H1 PageHeader and the body Graph can target each other
  // for arrow-nav crossings (Up from first body bullet → H1; Down from
  // H1 → first body bullet) and so the H1's autofocus is reactive to
  // setFocusId rather than to a separate `autoFocus` derivation.
  // The H1 Editor reads `autoFocus={focusId === pageNode.id}` and the
  // useEffect below sets `focusId` to `pageNode.id` whenever the page
  // node is empty (replacing the prior `autoFocusHeader` derivation).
  // Focus is tracked as { id, atEnd }: `atEnd === true` places the
  // caret at the END of the focused editor's content (used after the
  // pending-child promote path, since the user just typed the first
  // character into the pending-child and expects to keep typing after
  // it). The default `atEnd === false` puts the caret at the START
  // (correct for Enter-split, F-Nav arrow nav, empty-page autofocus).
  const [focusId, setFocusIdState] = useState<string | null>(null);
  const [focusAtEnd, setFocusAtEnd] = useState<boolean>(false);

  // R-Pending-Row-Is-The-Empty-Bullet: single locus per Article for
  // the currently-rendered sibling pending row. Set when a creation
  // gesture (Shift+Enter, Cmd+Shift+Enter, Enter at end of content)
  // requests a pending row at a sibling slot; cleared when the row
  // promotes (typed input, mention commit) or is dismissed. Consumed
  // by Node / Graph children loops to inject a PendingChildRow at
  // the matching slot.
  const [pendingSlot, setPendingSlotState] = useState<PendingSlot | null>(null);
  const setPendingSlot = useCallback((slot: PendingSlot | null) => {
    setPendingSlotState(slot);
  }, []);
  const pendingSlotValue = useMemo(
    () => ({ pendingSlot, setPendingSlot }),
    [pendingSlot, setPendingSlot],
  );
  // `setFocusId(id)` always places the caret at the START — same
  // semantics it had before this refactor. Callers that need the
  // caret at the END (currently: pending-child promote) call
  // `setFocusIdAtEnd(id)` instead.
  const setFocusId = useCallback((id: string | null) => {
    setFocusIdState(id);
    setFocusAtEnd(false);
  }, []);
  const setFocusIdAtEnd = useCallback((id: string | null) => {
    setFocusIdState(id);
    setFocusAtEnd(true);
  }, []);
  useEffect(() => {
    if (pageNode && !hasContent(pageNode)) {
      setFocusId(pageNode.id);
    }
  }, [pageNode, setFocusId]);

  // F-Page-Header.8: Enter on the H1 splits at the caret. The before-cursor
  // segments stay in `pageNode.content` (the editor's own dispatch deletes
  // the after-cursor range before this fires). We create a new first child
  // Z with the `afterText` as a single text segment, attach it via an Edge
  // whose `order` slots in BEFORE every existing child's order, and move
  // focus to Z.
  const handleHeaderEnter = useCallback(
    (_beforeText: string, afterText: string) => {
      if (!pageNode) {
        return;
      }
      const db = Obj.getDatabase(pageNode);
      if (!db) {
        return;
      }
      ensureMigratedChildren(db, pageNode);
      const newChild = Bramble.makeNode({
        content: afterText.length > 0 ? [{ kind: 'text', text: afterText }] : [],
        state: { expanded: false },
      });
      db.add(newChild);
      const edgesNow = childEdgesOf(db, pageNode);
      createEdge(db, pageNode, newChild, { order: orderBetween(undefined, edgesNow[0]) });
      setFocusId(newChild.id);
    },
    [pageNode],
  );

  // F-Page-Header.9: Shift+Enter on the H1 is a no-op. The H1 is the
  // zoomed-in view of the page node; sibling-creation gestures
  // (which Shift+Enter and Cmd+Shift+Enter are per F-Shift-Enter.1 /
  // F-Cmd-Shift-Enter.1) have no visible target in this frame —
  // the page node's siblings in the wider DAG are reached via
  // predecessor-nav, not from the H1 (matches F-Page-Header.10's
  // existing Cmd+Shift+Enter no-op).
  const handleHeaderShiftEnter = useCallback(() => {
    // No-op per F-Page-Header.9.
  }, []);

  // F-Page-Header.11: ArrowDown on the H1 moves the caret into the first
  // visible body bullet via the same F-Nav DOM walk body bullets use.
  // ArrowUp on the H1 is a no-op (handled by moveToAdjacentVisibleBlock
  // returning false when there's no previous `[data-block-id]`).
  const handleHeaderMoveDown = useCallback(() => {
    if (!pageNode) {
      return;
    }
    moveToAdjacentVisibleBlock(pageNode.id, 'down', setFocusId);
  }, [pageNode]);
  const handleHeaderMoveUp = useCallback(() => {
    if (!pageNode) {
      return;
    }
    moveToAdjacentVisibleBlock(pageNode.id, 'up', setFocusId);
  }, [pageNode]);

  // F-Zoom + R-Bramble-Subject-Path: zoom navigates the pane to
  // the target Node by changing the pane subject. Replaces the
  // prior `setPageNodeId(nodeId)` local-state mechanism so that
  // the pane subject is the single source of truth for "which
  // Node the pane is on" — gives back / forward / share /
  // navtree-highlighting consistency for free, and means that
  // navigating to a different subject (e.g. clicking Today per
  // `F-Bramble-Nav.today-resets-zoom`) naturally replaces the
  // zoomed view because the subject changes.
  const handleZoom = useCallback(
    (nodeId: string) => {
      if (!paneRootNode) {
        return;
      }
      const db = Obj.getDatabase(paneRootNode);
      if (!db) {
        return;
      }
      const target = (db.getObjectById?.(nodeId) ?? undefined) as Bramble.Node | undefined;
      if (!target) {
        return;
      }
      void invokePromise(LayoutOperation.Open, {
        subject: [getObjectPathFromObject(target)],
      });
    },
    [paneRootNode, invokePromise],
  );

  // F-Run-Lens (2c.5): "+ New Run" navigates to the new Run AND
  // activates the Lens — the user just asked to do the work, so
  // the wizard should be on.
  // R-Bramble-Subject-Path: navigate via subject change so pane
  // state stays anchored to the deck's source of truth.
  const handleCreateRun = useCallback(
    (runNodeId: string) => {
      if (!paneRootNode) {
        return;
      }
      const db = Obj.getDatabase(paneRootNode);
      if (!db) {
        return;
      }
      const target = (db.getObjectById?.(runNodeId) ?? undefined) as Bramble.Node | undefined;
      if (!target) {
        return;
      }
      void invokePromise(LayoutOperation.Open, {
        subject: [getObjectPathFromObject(target)],
      });
      setRunLensActive(true);
    },
    [paneRootNode, invokePromise],
  );

  // F-Run-Lens (2c.5): Stop / Done exit the Lens but leave the
  // user on the same Run page (so they can review what they did,
  // or click Resume to re-enter).
  const handleExitRunLens = useCallback(() => {
    setRunLensActive(false);
  }, []);

  const handleResumeRunLens = useCallback(() => {
    setRunLensActive(true);
  }, []);

  // F-DAG.Phase3e.predecessor-nav-switch + R-Bramble-Subject-Path:
  // select a predecessor from the page-top control. Navigate via
  // subject change — the pane's subject becomes the picked
  // predecessor's canonical path. If the picked predecessor IS
  // the pane's current subject, the deck treats the Open as a
  // no-op, which is the right behavior (the user is already on
  // that Node).
  const handleSelectPredecessor = useCallback(
    (target: Bramble.Node) => {
      void invokePromise(LayoutOperation.Open, {
        subject: [getObjectPathFromObject(target)],
      });
    },
    [invokePromise],
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
        // R-Bramble-Subject-Path: fallback navigates the current
        // pane to the target via subject change (same path the
        // F-Zoom click takes).
        await invokePromise(LayoutOperation.Open, {
          subject: [getObjectPathFromObject(target)],
        });
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

  // F-PDF-Upload: wire the drop-target onto the article's scroll
  // container. The hook returns DragEvent handlers (spread onto the
  // scroll div) and a visual overlay (rendered inside the same
  // container) — the editor underneath keeps its normal pointer
  // events; only DragEnter/Over/Leave/Drop hit the wrapper. The
  // current focused Node is the default drop-site parent.
  const pdfDrop = usePdfDropTarget({ pageNode });

  // F-No-Root: the prior F-Page-Header.5/.6 graph.name <-> root.content
  // sync effects lived here. Removed — under F-No-Root the Bramble.Graph
  // carries name only as metadata and the subject is always a
  // Bramble.Node (no `liveGraph` to sync with). If a "Bramble rename"
  // gesture is added later, it operates directly on the Graph's name
  // field, not via root-content reflection.

  return (
    <Panel.Root role={role}>
      <Panel.Content>
        {pageNode ? (
          // F-Scroll: outer Panel.Content has `overflow: hidden` —
          // the inner wrapper must establish its own scroll region
          // so long outlines / tall field groups / large backlink
          // panels are reachable, not silently clipped.
          <div
            className='relative p-4 h-full overflow-y-auto'
            // F-PDF-Upload: drop-target handlers. The container is
            // `position: relative` so the absolute overlay positions
            // against it.
            onDragEnter={pdfDrop.dragHandlers.onDragEnter}
            onDragOver={pdfDrop.dragHandlers.onDragOver}
            onDragLeave={pdfDrop.dragHandlers.onDragLeave}
            onDrop={pdfDrop.dragHandlers.onDrop}
          >
            {pdfDrop.overlay}
            <PredecessorNav
              pageBlock={pageNode}
              onSelect={handleSelectPredecessor}
              onShiftSelect={handleOpenPane}
            />
            <PageHeader
              node={pageNode}
              focused={focusId === pageNode.id}
              focusedAtEnd={focusId === pageNode.id && focusAtEnd}
              onEnter={handleHeaderEnter}
              onShiftEnter={handleHeaderShiftEnter}
              onMoveUp={handleHeaderMoveUp}
              onMoveDown={handleHeaderMoveDown}
            />
            {/* F-6 Phase 1+3: render `#Step` / `#Run` / other supertag
                chips alongside the H1 so the user can see what KIND of
                page they're on (without needing to zoom out to the bullet
                view). Chips click-navigate to the per-space tag-Node;
                shift-click opens it in a new pane. */}
            <div className='-mt-2 mb-3 flex flex-wrap items-center gap-2'>
              <TagChips block={pageNode} />
            </div>
            {/* F-Run-Nav (Iteration 2c.2 follow-up): when the page Node
                is a Run, surface its outgoing navigable edges
                (`'is-run-of'` → Step, `'parent-run'` → parent Run) as
                inline navigation controls. Closes the back-nav gap
                Runs otherwise have — they have no `'child'` predecessors
                so `PredecessorNav` doesn't fire for them. */}
            {hasSupertagOfTypename(pageNode, Bramble.Run.typename) && (
              <RunNav
                runNode={pageNode}
                onSelect={handleSelectPredecessor}
                onShiftSelect={handleOpenPane}
              />
            )}
            {/* F-Supertag Phase 3b: when the page node is itself a wrapper
                (carries `supertags`), surface its FieldGroups at the
                page level — they otherwise only mount as part of a
                Node child row, which never happens for a
                zoomed-in wrapper. */}
            <FieldGroups block={pageNode} />
            {/* F-New-Run-On-Step (Iteration 2c.1): when the page Node
                carries `#Step`, render a "+ New Run" action between
                supertag fields and the body bullets. The button
                creates a parent Run-Node + recursive child Runs +
                'is-run-of' / 'parent-run' edges, then zooms the
                pane into the parent Run. */}
            <StepActions node={pageNode} onCreateRun={handleCreateRun} />
            {/* F-Step-Runs-List (Iteration 2d): on `#Step` pages,
                surface every Run linked to this Step via an
                `'is-run-of'` edge. Click a Run row → zoom into its
                F-Run-Execution-View. Principle #17 payoff — the
                substrate's journal value made visible. */}
            {hasSupertagOfTypename(pageNode, Bramble.Step.typename) && (
              <StepRunsList
                stepNode={pageNode}
                onSelect={handleSelectPredecessor}
                onShiftSelect={handleOpenPane}
              />
            )}
            {/* F-Run-Execution-View (2c.2, revised 2c.5) + F-Run-Lens
                (2c.5). Three render branches:
                  - page is `#Run` AND Lens is active → RunLensShell
                    wraps the runbook walkthrough with the wizard
                    banner (Start / Next / Previous / Stop / Done).
                  - page is `#Run` AND Lens is INactive → plain
                    runbook view + a "Resume in Run Lens" button so
                    the user can re-enter the wizard.
                  - otherwise → the standard outline body.
                All branches share the Zoom / OpenPane /
                BacklinkCount providers because the nested Graphs
                inside RunExecutionView / RunLensShell depend on
                them. */}
            <BacklinkCountContext.Provider value={countByTargetId}>
              <ZoomContext.Provider value={handleZoom}>
                <OpenPaneContext.Provider value={handleOpenPane}>
                  <PendingSlotContext.Provider value={pendingSlotValue}>
                  {hasSupertagOfTypename(pageNode, Bramble.Run.typename) ? (
                    runLensActive ? (
                      <RunLensShell
                        runNode={pageNode}
                        focusId={focusId}
                        focusAtEnd={focusAtEnd}
                        setFocusId={setFocusId}
                        setFocusIdAtEnd={setFocusIdAtEnd}
                        onExit={handleExitRunLens}
                      />
                    ) : (
                      <div>
                        <div className='mb-3'>
                          <button
                            type='button'
                            onClick={handleResumeRunLens}
                            className='inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-900/60 transition-colors select-none'
                            data-action='resume-run-lens'
                          >
                            <span aria-hidden>▶</span>
                            <span>Resume in Run Lens</span>
                          </button>
                        </div>
                        <RunExecutionView
                          runNode={pageNode}
                          focusId={focusId}
                          focusAtEnd={focusAtEnd}
                          setFocusId={setFocusId}
                          setFocusIdAtEnd={setFocusIdAtEnd}
                        />
                      </div>
                    )
                  ) : (
                    <Graph
                      rootBlock={pageNode}
                      focusId={focusId}
                      focusAtEnd={focusAtEnd}
                      setFocusId={setFocusId}
                      setFocusIdAtEnd={setFocusIdAtEnd}
                    />
                  )}
                  </PendingSlotContext.Provider>
                </OpenPaneContext.Provider>
              </ZoomContext.Provider>
            </BacklinkCountContext.Provider>
            <BacklinksPanel backlinks={list} />
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
type PageHeaderProps = {
  node: Bramble.Node;
  // F-Page-Header.7: when true, the H1 editor receives autofocus on
  // mount or when this prop flips false→true. Article derives this
  // from `focusId === node.id`.
  focused?: boolean;
  // When true (paired with `focused`), the autofocus places the caret
  // at the END of the editor's content. Default places at the start.
  focusedAtEnd?: boolean;
  // F-Page-Header.8/.9: split-on-Enter / empty-Shift-Enter handlers
  // make the H1 behave as a regular node-in-page (Enter creates a
  // new first child of `node`, Shift+Enter creates an empty first
  // child).
  onEnter?: (beforeText: string, afterText: string) => void;
  onShiftEnter?: () => void;
  // F-Page-Header.11/.12: arrow nav crossings between the H1 and
  // the body's topmost bullet.
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

const PageHeader = ({ node, focused, focusedAtEnd, onEnter, onShiftEnter, onMoveUp, onMoveDown }: PageHeaderProps) => {
  // F-Page-Header.4: re-render this header on `node.content` mutations so
  // the "Untitled" placeholder appears/disappears live as the user types.
  // The parent Article subscribes to the pane-root / subject but doesn't
  // necessarily subscribe to a zoomed-in sub-node — subscribe locally here.
  useObject(node);
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
          <Editor
            block={node}
            headlineMode
            autoFocus={focused}
            autoFocusAtEnd={focusedAtEnd}
            onEnter={onEnter}
            onShiftEnter={onShiftEnter}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
        </span>
      </h1>
    );
  }

  // F-Page-Header.4: when `node.content` is empty, render a muted
  // "Untitled" overlay aligned to the same baseline as the editor's
  // first character. `pointer-events: none` + `aria-hidden` keep the
  // overlay purely visual — clicks and focus pass through to the
  // editor underneath, so the user can immediately start typing.
  const empty = !hasContent(node);

  return (
    <h1 className='relative mt-2 mb-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100'>
      {empty && (
        <span
          aria-hidden
          className='pointer-events-none absolute inset-0 text-neutral-400 dark:text-neutral-600 select-none'
        >
          Untitled
        </span>
      )}
      <Editor
        block={node}
        headlineMode
        autoFocus={focused}
        autoFocusAtEnd={focusedAtEnd}
        onEnter={onEnter}
        onShiftEnter={onShiftEnter}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
      />
    </h1>
  );
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
