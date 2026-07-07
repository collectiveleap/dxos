//
// Copyright 2026 DXOS.org
//

import { Type } from '@dxos/echo';
import { type Resource } from '@dxos/react-ui';

import { meta } from '#meta';
import { Capture } from '#types';

export const translations = [
  {
    'en-US': {
      [Type.getTypename(Capture.Capture)]: {
        'typename.label': 'Capture',
        'typename.label_other': 'Captures',
      },
      [meta.profile.key]: {
        'plugin.name': 'Sensemaking',
        'inbox.label': 'Inbox',
      },
    },
  },
] as const satisfies Resource[];
