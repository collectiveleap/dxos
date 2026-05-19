//
// Copyright 2025 DXOS.org
//

import React from 'react';

import { Obj } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { pendingRowFocusId, usePendingSlot } from '../backlinks';
import { Node, PendingChildRow } from '../Node';
import {
  addExistingAtSlot,
  createEdge,
  promotePendingAtSlot,
  useStructuralChildren,
} from '../Node/edges';

import { Bramble } from '#types';

export type GraphProps = {
  rootBlock: Bramble.Node;
  // F-Page-Header.7/.11/.12 + F-Nav: focusId is lifted to Article so the
  // H1 PageHeader and the body's first bullet can target each other for
  // arrow-nav crossings. Graph forwards it through to each Node child
  // unchanged.
  focusId: string | null;
  focusAtEnd: boolean;
  setFocusId: (id: string | null) => void;
  // setFocusIdAtEnd: like setFocusId but the new focus places the caret
  // at the end of the focused editor's content. Used by pending-child
  // promote so the user can continue typing from after the just-typed
  // character.
  setFocusIdAtEnd: (id: string | null) => void;
};

// Increment 3b: top-level component that walks `rootBlock.children` and
// renders a recursive Node for each. The `focusId` state lives at the
// Article level (so it can be shared with the H1 PageHeader); Graph
// passes it through and also drives setFocusId from its own
// pending-child promote handler.
export const Graph = ({ rootBlock, focusId, focusAtEnd, setFocusId, setFocusIdAtEnd }: GraphProps) => {
  // Subscribe to rootBlock so this Graph re-renders when its
  // top-level fields change (e.g. content edits to the pane
  // root's H1 via `F-Page-Header`).
  useObject(rootBlock);

  // The legacy I1/I2 migration that lived here used to demote a
  // rootBlock's `content` into a single child Bramble.Node whenever
  // the rootBlock had content but no children. That predated
  // F-No-Root + R-Bramble-Subject-Path. Under the current model
  // ANY Bramble.Node can be a pane root via F-Zoom, and the pane
  // root's content stays put — it renders in the H1 (per
  // F-Page-Header). The migration was actively harmful: every zoom
  // into a content-bearing leaf created a fresh empty wrapper Node
  // and moved the user's content into a child of it.
  // Removed 2026-05-18 alongside the F-Drag-Drop iteration.

  // F-DAG: structural children come from two sources during the
  // migration — the legacy `Block.children` array (for outline
  // bullets that haven't been ported) and the new `ChildEdge`
  // relations (currently used by the F-6 Phase 3b promote flow
  // under Library). The hook merges both and stays subscribed so
  // newly-added edges trigger a re-render.
  const childRefs = useStructuralChildren(rootBlock).filter((ref: any) => ref?.target);

  // Right-click on any bullet copies its DXN to the clipboard. Walks up to the
  // closest [data-block-id] so nested bullets work too.
  const handleContextMenu = (event: React.MouseEvent) => {
    const element = (event.target as HTMLElement).closest<HTMLElement>('[data-block-id]');
    if (!element) {
      return;
    }
    const blockId = element.dataset.blockId;
    if (!blockId) {
      return;
    }
    const block = findBlockById(rootBlock, blockId);
    if (!block) {
      return;
    }
    event.preventDefault();
    const dxn = Obj.getDXN(block).toString();
    void navigator.clipboard?.writeText(dxn);
    // eslint-disable-next-line no-console
    console.log('[plugin-blocks] copied DXN to clipboard:', dxn);
  };

  // F-Pending-Child.page-root: always render a page-root pending-child
  // at the END of the page body — after `childRefs.map` so it appears
  // below the last real child (giving a visible "add another" affordance
  // past the last bullet), or as the only body row when the page node
  // has no children. Independent of `rootBlock.state.expanded`.

  // R-Pending-Row-Is-The-Empty-Bullet: read the Article-level pending
  // sibling slot so this loop can inject a `PendingChildRow` at the
  // matching slot when a creation gesture (Shift+Enter, Cmd+Shift+
  // Enter, Enter-at-end-of-content) requested one adjacent to a
  // top-level child.
  const { pendingSlot, setPendingSlot } = usePendingSlot();

  return (
    <div className='space-y-1' onContextMenu={handleContextMenu}>
      {childRefs.map((ref) => {
        const child = ref.target as Bramble.Node;
        const slotBefore = pendingSlot?.nodeId === child.id && pendingSlot.position === 'before';
        const slotAfter = pendingSlot?.nodeId === child.id && pendingSlot.position === 'after';
        return (
          <React.Fragment key={child.id}>
            {slotBefore && (
              <PendingChildRow
                parent={rootBlock}
                setFocusId={setFocusId}
                focusId={focusId}
                rowFocusId={pendingRowFocusId(child.id, 'before')}
                onPromote={(initialText) =>
                  promotePendingAtSlot(rootBlock, child, 'before', initialText, setPendingSlot, setFocusIdAtEnd)
                }
                onAddExisting={(target) =>
                  addExistingAtSlot(rootBlock, child, 'before', target as Bramble.Node, setPendingSlot, setFocusId)
                }
              />
            )}
            <Node
              block={child}
              parent={rootBlock}
              focusId={focusId}
              focusAtEnd={focusAtEnd}
              setFocusId={setFocusId}
              setFocusIdAtEnd={setFocusIdAtEnd}
            />
            {slotAfter && (
              <PendingChildRow
                parent={rootBlock}
                setFocusId={setFocusId}
                focusId={focusId}
                rowFocusId={pendingRowFocusId(child.id, 'after')}
                onPromote={(initialText) =>
                  promotePendingAtSlot(rootBlock, child, 'after', initialText, setPendingSlot, setFocusIdAtEnd)
                }
                onAddExisting={(target) =>
                  addExistingAtSlot(rootBlock, child, 'after', target as Bramble.Node, setPendingSlot, setFocusId)
                }
              />
            )}
          </React.Fragment>
        );
      })}
      <PendingChildRow
        parent={rootBlock}
        setFocusId={setFocusId}
        onPromote={(initialText) => {
          const db = Obj.getDatabase(rootBlock);
          if (!db) {
            return;
          }
          // F-V2.12: new Nodes are created collapsed.
          const newChild = Bramble.makeNode({
            content: initialText.length > 0 ? [{ kind: 'text', text: initialText }] : [],
            state: { expanded: false },
          });
          db.add(newChild);
          createEdge(db, rootBlock, newChild);
          // The user just typed the first character into the pending-
          // child editable; the new bullet's caret needs to land AFTER
          // that character so the next keystroke appends. Without
          // `atEnd`, the caret lands at position 0 and subsequent
          // characters get inserted before the typed one (typing "1234"
          // produces "2341").
          setFocusIdAtEnd(newChild.id);
        }}
        onAddExisting={(target) => {
          const db = Obj.getDatabase(rootBlock);
          if (!db) {
            return;
          }
          createEdge(db, rootBlock, target as Bramble.Node);
          setFocusId((target as any).id ?? null);
        }}
      />
    </div>
  );
};

// Walk the tree from rootBlock to find a Block by id. Used by the contextmenu
// to look up the right Block when nested bullets are rendered.
const findBlockById = (rootBlock: Bramble.Node, id: string): Bramble.Node | undefined => {
  const stack: Bramble.Node[] = [rootBlock];
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
  return undefined;
};
