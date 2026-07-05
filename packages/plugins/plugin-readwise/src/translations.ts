//
// Copyright 2026 DXOS.org
//

import { type Resource } from '@dxos/react-ui';

import { meta } from '#meta';

export const translations = [
  {
    'en-US': {
      [meta.profile.key]: {
        'plugin.name': 'Readwise',
        'sync-readwise.label': 'Sync Readwise',
        'sync-readwise-syncing.label': 'Syncing…',
        'loading.label': 'Loading…',
        'no-suggested-items.message': 'No candidate items found in this annotation.',
        'accept-item.label': 'Accept',
        'reject-item.label': 'Reject',
        'item-kind.label': 'Kind',
        'item-kind-comment.label': 'Comment',
        'item-kind-question.label': 'Question',
        'item-kind-todo.label': 'To-do',
        'sync.label': 'Sync',
        'connect.label': 'Connect Readwise',
        'empty.message': 'Connect a Readwise account to see your highlights.',
      },
    },
  },
] as const satisfies Resource[];
