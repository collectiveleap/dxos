//
// Copyright 2026 DXOS.org
//

import { Config2 } from '@dxos/app-framework/config';
import { trim } from '@dxos/util';

export default Config2.make({
  plugin: {
    key: 'org.dxos.plugin.sensemaking',
    name: 'Sensemaking',
    author: 'DXOS',
    source: 'https://github.com/dxos/dxos/tree/main/packages/plugins/plugin-sensemaking',
    description: trim`
      Flag items from anywhere in Composer into an Inbox, then triage them into the rest of your
      space.
    `,
    icon: { key: 'ph--flag--regular', hue: 'amber' },
    tags: ['labs'],
  },
  publish: {
    buildCommand: 'vite build',
    outputDirectory: 'dist',
  },
});
