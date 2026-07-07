//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import React from 'react';

import { Capabilities, Capability } from '@dxos/app-framework';
import { Surface } from '@dxos/app-framework/ui';
import { AppSurface } from '@dxos/app-toolkit/ui';
import { isSpace } from '@dxos/react-client/echo';

import { Inbox } from '../containers';
import { INBOX_NODE_DATA } from '../constants';

export default Capability.makeModule(() =>
  Effect.succeed(
    Capability.contributes(Capabilities.ReactSurface, [
      Surface.create({
        id: 'sensemakingInbox',
        filter: Surface.makeFilter(
          AppSurface.Article,
          (data) => data.subject === INBOX_NODE_DATA && isSpace(data.properties?.space),
        ),
        component: ({ data }) => {
          const space = isSpace(data.properties?.space) ? data.properties.space : undefined;
          return space ? <Inbox space={space} /> : null;
        },
      }),
    ]),
  ),
);
