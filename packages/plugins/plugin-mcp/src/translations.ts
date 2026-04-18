//
// Copyright 2025 DXOS.org
//

import { type Resource } from '@dxos/react-ui';

import { meta } from '#meta';

export const translations = [
  {
    'en-US': {
      [meta.id]: {
        'plugin.name': 'MCP Servers',
        'add-server.label': 'Add server',
        'remove-server.label': 'Remove server',
        'server-name.placeholder': 'Server name',
        'server-url.placeholder': 'Server URL',
        'protocol.label': 'Protocol',
      },
    },
  },
] as const satisfies Resource[];
