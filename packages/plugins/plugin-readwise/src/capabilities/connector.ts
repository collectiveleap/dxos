//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Capability } from '@dxos/app-framework';
import { Connector } from '@dxos/plugin-connector';

import { readwiseCredentialForm } from './readwise-credential-form';
import { READWISE_CONNECTOR_ID, READWISE_SOURCE } from '../constants';
import { ReadwiseOperation } from '../types';

/**
 * Contributes the Readwise `Connector` entry: a token credential form (no OAuth), a `materializeTarget`
 * op that creates the `Readwise` container, and the `sync` op. Registered on `SetupConnectors`.
 */
export default Capability.makeModule(
  Effect.fnUntraced(function* () {
    return Capability.contributes(Connector, [
      {
        id: READWISE_CONNECTOR_ID,
        source: READWISE_SOURCE,
        label: 'Readwise',
        credentialForm: readwiseCredentialForm,
        materializeTarget: ReadwiseOperation.MaterializeTarget,
        sync: ReadwiseOperation.Sync,
      },
    ]);
  }),
);
