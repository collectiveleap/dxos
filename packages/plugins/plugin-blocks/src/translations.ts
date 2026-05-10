//
// Copyright 2025 DXOS.org
//

import { Type } from '@dxos/echo';
import { type Resource } from '@dxos/react-ui';

import { meta } from '#meta';
import { BlockOutline } from '#types';

export const translations = [
  {
    'en-US': {
      [Type.getTypename(BlockOutline.BlockOutline)]: {
        'typename.label': 'Block Outline',
        'typename.label_zero': 'Block Outlines',
        'typename.label_one': 'Block Outline',
        'typename.label_other': 'Block Outlines',
        'object-name.placeholder': 'New block outline',
        'add-object.label': 'Add block outline',
        'rename-object.label': 'Rename block outline',
        'delete-object.label': 'Delete block outline',
        'object-deleted.label': 'Block outline deleted',
      },

      [meta.id]: {
        'plugin.name': 'Blocks',
        // F-Open-Pane.deck-disabled-fallback
        'open-pane.disabled.toast.title': 'Multi-pane disabled',
        'open-pane.disabled.toast.description':
          'Shift-click would open a new pane. Enable Deck mode in Settings to use this.',
        'open-pane.disabled.toast.action.label': 'Open Settings',
      },
    },
  },
] as const satisfies Resource[];
