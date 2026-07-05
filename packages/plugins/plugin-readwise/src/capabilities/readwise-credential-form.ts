//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

import { Obj, Ref } from '@dxos/echo';
import { Connection, type CredentialForm } from '@dxos/plugin-connector';
import { AccessToken } from '@dxos/types';

import { READWISE_SOURCE } from '../constants';
import { validateToken } from '../services';

const ReadwiseCredentialFormSchema = Schema.Struct({
  token: Schema.String.annotations({
    title: 'API token',
    description: 'Your Readwise access token (from readwise.io/access_token).',
  }),
});

type ReadwiseCredentialFormValues = Schema.Schema.Type<typeof ReadwiseCredentialFormSchema>;

/**
 * Manual-token connector form for Readwise (no OAuth). Mirrors `plugin-inbox`'s JMAP form: a single
 * secret field, a live validation against `GET /auth/`, and an `onSubmit` that builds the durable
 * `AccessToken` + `Connection`. The connect UI and dialog are provided by the Connector framework.
 */
export const readwiseCredentialForm: CredentialForm<ReadwiseCredentialFormValues> = {
  schema: ReadwiseCredentialFormSchema,
  defaultValues: { token: '' },
  onValidate: ({ values }) =>
    Effect.gen(function* () {
      const token = values.token.trim();
      if (token.length === 0) {
        return yield* Effect.fail(new Error('API token is required.'));
      }
      yield* validateToken(token).pipe(Effect.mapError((error) => new Error(error.message)));
    }),
  onSubmit: ({ values, connector }) =>
    Effect.gen(function* () {
      const token = values.token.trim();
      const accessToken = Obj.make(AccessToken.AccessToken, { source: READWISE_SOURCE, token });
      const connection = Connection.make({
        name: connector.label ?? 'Readwise',
        connectorId: connector.id,
        accessToken: Ref.make(accessToken),
      });
      return { kind: 'complete' as const, accessToken, connection };
    }),
};
