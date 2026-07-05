//
// Copyright 2026 DXOS.org
//

import { Config2 } from '@dxos/app-framework/config';
import { trim } from '@dxos/util';

export default Config2.make({
  plugin: {
    key: 'org.dxos.plugin.readwise',
    name: 'Readwise',
    author: 'DXOS',
    source: 'https://github.com/dxos/dxos/tree/main/packages/plugins/plugin-readwise',
    description: trim`
      Triage Readwise highlights and notes into Composer. Reviewed items become Tasks or
      Messages already queryable in a space, ready to organize alongside everything else.
    `,
    icon: { key: 'ph--highlighter--regular', hue: 'amber' },
    spec: 'PLUGIN.mdl',
    tags: ['labs', 'integration'],
  },
});
