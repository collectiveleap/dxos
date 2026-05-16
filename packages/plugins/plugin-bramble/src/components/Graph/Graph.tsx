//
// Copyright 2025 DXOS.org
//

import React, { useEffect } from 'react';

import { Obj } from '@dxos/echo';
import { useObject } from '@dxos/react-client/echo';

import { Node, PendingChildRow } from '../Node';
import { createEdge, getStructuralChildren, useStructuralChildren } from '../Node/edges';

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
  const [snapshot] = useObject(rootBlock);

  // Migrate I1/I2 outlines: if root has content but no children, demote the
  // content into a single child Block. Also covers stale outlines lacking
  // any seeded child.
  //
  // F-6 Phase 3+: skip the migration for plugin-managed Blocks —
  // wrappers (`supertags`), tag nodes (`tagTypename`), system nodes
  // (`systemNode`), and query nodes (`queryRef`) all have an
  // intentional structure that the legacy outline migration must not
  // disturb. Without this guard, zooming into a wrapper wipes its
  // `content` ref to the linked instance and seeds an empty child.
  useEffect(() => {
    const isSpecialBlock = Boolean(
      ((snapshot as any).supertags ?? []).length > 0 ||
        (snapshot as any).tagTypename ||
        (snapshot as any).systemNode ||
        (snapshot as any).queryRef,
    );
    if (isSpecialBlock) {
      return;
    }
    const db = Obj.getDatabase(rootBlock);
    // F-DAG Phase 3a: use the merged structural view to decide
    // whether to seed — a freshly-created outline with neither
    // legacy `Block.children` entries nor ChildEdges should still
    // get its seed bullet. An outline that's already been used (
    // either representation) is left alone.
    const existingStructuralChildren = getStructuralChildren(db, rootBlock).filter((ref: any) => ref?.target);
    if (existingStructuralChildren.length > 0) {
      return;
    }
    const contentArr = (snapshot.content ?? []) as readonly unknown[];
    // I1/I2 migration only: if the rootBlock has content but no
    // children, demote the content into a single child Block. The
    // prior "always seed an empty bullet" behaviour was removed — for
    // empty rootBlocks, F-Pending-Child.page-root renders a faint
    // pending-child at the page body, which is the universal "where
    // to start typing" affordance (covers initial graph creation,
    // shift-click-into-leaf new panes, and same-pane zoom alike).
    if (contentArr.length === 0) {
      return;
    }
    // F-V2.12: new Nodes are created collapsed.
    const seed = Bramble.makeNode({ content: [...contentArr] as any, state: { expanded: false } });
    Obj.update(rootBlock, (rootBlock) => {
      (rootBlock as any).content = [];
    });
    if (db) {
      db.add(seed);
      createEdge(db, rootBlock, seed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <div className='space-y-1' onContextMenu={handleContextMenu}>
      {childRefs.map((ref) => {
        const child = ref.target as Bramble.Node;
        return (
          <Node
            key={child.id}
            block={child}
            parent={rootBlock}
            focusId={focusId}
            focusAtEnd={focusAtEnd}
            setFocusId={setFocusId}
            setFocusIdAtEnd={setFocusIdAtEnd}
          />
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
