//
// Copyright 2026 DXOS.org
//

import { Type } from '@dxos/echo';
import { type Resource } from '@dxos/react-ui';

import { meta } from '#meta';
import { Capture, Result } from '#types';

export const translations = [
  {
    'en-US': {
      [Type.getTypename(Capture.Capture)]: {
        'typename.label': 'Capture',
        'typename.label_other': 'Captures',
      },
      [Type.getTypename(Result.Result)]: {
        'typename.label': 'Result',
        'typename.label_other': 'Results',
      },
      [meta.profile.key]: {
        'plugin.name': 'Sensemaking',
        'inbox.label': 'Inbox',
        'uncategorized.label': 'Uncategorized',
        'inbox-empty.message': 'No captures yet — sync a source to fill your Inbox.',
      },
    },
  },
] as const satisfies Resource[];
