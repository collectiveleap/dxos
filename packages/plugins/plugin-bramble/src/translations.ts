//
// Copyright 2025 DXOS.org
//

import { Type } from '@dxos/echo';
import { type Resource } from '@dxos/react-ui';

import { meta } from '#meta';
import { Bramble } from '#types';

export const translations = [
  {
    'en-US': {
      [Type.getTypename(Bramble.Graph)]: {
        'typename.label': 'Bramble',
        'typename.label_zero': 'Brambles',
        'typename.label_one': 'Bramble',
        'typename.label_other': 'Brambles',
        'object-name.placeholder': 'New bramble',
        'add-object.label': 'Add bramble',
        'rename-object.label': 'Rename bramble',
        'delete-object.label': 'Delete bramble',
        'object-deleted.label': 'Bramble deleted',
      },

      [meta.id]: {
        'plugin.name': 'Bramble',
        // F-Open-Pane.deck-disabled-fallback
        'open-pane.disabled.toast.title': 'Multi-pane disabled',
        'open-pane.disabled.toast.description':
          'Shift-click would open a new pane. Enable Deck mode in Settings to use this.',
        'open-pane.disabled.toast.action.label': 'Open Settings',
      },
    },
  },
] as const satisfies Resource[];
