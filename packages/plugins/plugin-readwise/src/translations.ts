//
// Copyright 2026 DXOS.org
//

import { Type } from '@dxos/echo';
import { type Resource } from '@dxos/react-ui';

import { meta } from '#meta';
import { Readwise } from '#types';

export const translations = [
  {
    'en-US': {
      [Type.getTypename(Readwise.Readwise)]: {
        'typename.label': 'Readwise',
        'typename.label_zero': 'Readwise accounts',
        'typename.label_one': 'Readwise',
        'typename.label_other': 'Readwise accounts',
      },
      [meta.profile.key]: {
        'plugin.name': 'Readwise',
        'readwise-section.label': 'Readwise',
        'sources.label': 'Sources',
        'highlights.label': 'Highlights',
        'loading.label': 'Loading…',
        'no-suggested-items.message': 'No candidate items found in this annotation.',
        'accept-item.label': 'Accept',
        'reject-item.label': 'Reject',
        'item-kind.label': 'Kind',
        'item-kind-comment.label': 'Comment',
        'item-kind-question.label': 'Question',
        'item-kind-todo.label': 'To-do',
        'sync.label': 'Sync',
        'sync-syncing.label': 'Syncing…',
        'connect.label': 'Connect Readwise',
        'connected.label': 'Connected',
        'highlights-synced.label': '{{count}} highlights synced',
        'open-inbox.label': 'Your reading is in the Inbox.',
        'empty.message': 'Connect a Readwise account to see your highlights.',
        'open-origin.label': 'See in Readwise',
        'open-referent.label': 'Read the original',
      },
    },
  },
] as const satisfies Resource[];
