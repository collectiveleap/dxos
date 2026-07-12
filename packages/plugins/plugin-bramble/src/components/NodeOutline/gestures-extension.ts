//
// Copyright 2026 DXOS.org
//

import { Prec } from '@codemirror/state';
import { type Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';

import { type OutlineController } from './controller';

/** Per-row structural keymap. `nodeId` is the row this editor edits. */
export const brambleGestures = (controller: OutlineController, nodeId: string): Extension =>
  Prec.highest(
    keymap.of([
      {
        key: 'Enter',
        preventDefault: true,
        run: (view) => {
          void controller.createAfter(nodeId, view.state.selection.main.head);
          return true;
        },
      },
      {
        key: 'Backspace',
        run: (view) => {
          const { head, empty } = view.state.selection.main;
          if (head === 0 && empty) {
            void controller.mergeBackward(nodeId);
            return true; // consumed — the merge handles it
          }
          return false; // normal backspace within the line
        },
      },
      {
        key: 'ArrowUp',
        run: (view) => {
          const { head } = view.state.selection.main;
          if (view.state.doc.lineAt(head).number === 1) {
            void controller.focusAdjacent(nodeId, -1);
            return true;
          }
          return false;
        },
      },
      {
        key: 'ArrowDown',
        run: (view) => {
          const { head } = view.state.selection.main;
          if (view.state.doc.lineAt(head).number === view.state.doc.lines) {
            void controller.focusAdjacent(nodeId, 1);
            return true;
          }
          return false;
        },
      },
    ]),
  );
