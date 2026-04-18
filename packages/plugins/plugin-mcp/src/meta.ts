//
// Copyright 2025 DXOS.org
//

import { type Plugin } from '@dxos/app-framework';
import { trim } from '@dxos/util';

export const meta: Plugin.Meta = {
  id: 'org.dxos.plugin.mcp',
  name: 'MCP Servers',
  description: trim`
    Connect user-configurable MCP servers.
    Each server appears as a toggleable blueprint in conversations.
  `,
  icon: 'ph--plug--regular',
};
