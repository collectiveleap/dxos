//
// Copyright 2025 DXOS.org
//

import { type Plugin } from '@dxos/app-framework';
import { trim } from '@dxos/util';

export const meta: Plugin.Meta = {
  id: 'org.dxos.plugin.blocks',
  name: 'Blocks',
  description: trim`
    Block-based outliner where every bullet is a first-class ECHO object.
    Designed for round-trippable Tana Paste import.
  `,
  icon: 'ph--list-bullets--regular',
  iconHue: 'indigo',
  source: 'https://github.com/dxos/dxos/tree/main/packages/plugins/plugin-blocks',
};
