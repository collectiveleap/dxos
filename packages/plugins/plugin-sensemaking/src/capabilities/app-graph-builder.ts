//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Capability } from '@dxos/app-framework';
import { AppCapabilities, AppNodeMatcher, Paths } from '@dxos/app-toolkit';
import { Filter } from '@dxos/echo';
import { GraphBuilder, Node } from '@dxos/plugin-graph';

import { meta } from '#meta';
import { Capture } from '#types';

import { INBOX_NODE_DATA, INBOX_NODE_TYPE } from '../constants';

export default Capability.makeModule(
  Effect.fnUntraced(function* () {
    const extension = yield* GraphBuilder.createExtension({
      id: 'sensemakingInbox',
      match: AppNodeMatcher.whenNavTreeGroup(Paths.GroupTypes.content),
      connector: (space, get) => {
        const captures = get(space.db.query(Filter.type(Capture.Capture)).atom);
        if (captures.length === 0) {
          return Effect.succeed([]);
        }
        return Effect.succeed([
          Node.make({
            id: 'inbox',
            type: INBOX_NODE_TYPE,
            data: INBOX_NODE_DATA,
            properties: {
              label: ['inbox.label', { ns: meta.profile.key }],
              icon: 'ph--tray--regular',
              space,
            },
          }),
        ]);
      },
    });

    return Capability.contributes(AppCapabilities.AppGraphBuilder, [extension]);
  }),
);
