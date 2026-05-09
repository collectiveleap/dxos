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
      },
    },
  },
] as const satisfies Resource[];
