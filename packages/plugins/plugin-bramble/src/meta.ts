//
// Copyright 2025 DXOS.org
//

import { type Plugin } from '@dxos/app-framework';
import { trim } from '@dxos/util';

export const meta: Plugin.Meta = {
  id: 'org.dxos.plugin.bramble',
  name: 'Bramble',
  description: trim`
    Bramble — a property-graph plugin for the mess of human thought.
    Every bullet is a first-class ECHO Node; relations are typed
    Edges. See CONCEPTS.md for the substrate stance (Ackoff /
    Snowden / DSRP) and the Lenses roadmap.
  `,
  icon: 'ph--list-bullets--regular',
  iconHue: 'indigo',
  source: 'https://github.com/dxos/dxos/tree/main/packages/plugins/plugin-bramble',
};
