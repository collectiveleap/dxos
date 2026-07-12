//
// Copyright 2026 DXOS.org
//

import { Config2 } from '@dxos/app-framework/config';
import { trim } from '@dxos/util';

export default Config2.make({
  plugin: {
    key: 'org.dxos.plugin.bramble',
    name: 'Bramble',
    author: 'DXOS',
    description: trim`
      A node-per-row outliner where every bullet is a first-class object, nested via real
      structural edges — a view onto a networked-notes DAG.
    `,
    icon: { key: 'ph--tree-structure--regular', hue: 'indigo' },
    tags: ['labs'],
  },
});
