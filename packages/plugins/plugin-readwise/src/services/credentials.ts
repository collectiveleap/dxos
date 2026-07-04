//
// Copyright 2026 DXOS.org
//

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';

import { Database } from '@dxos/echo';
import { type Connection } from '@dxos/plugin-connector';

import { ReadwiseError } from '../errors';

/** Readwise credentials, sourced from the `AccessToken` referenced by a `Connection`. */
export class ReadwiseCredentials extends Context.Tag('@dxos/plugin-readwise/ReadwiseCredentials')<
  ReadwiseCredentials,
  { readonly token: string }
>() {
  /**
   * Loads the `AccessToken` referenced by `connection` and yields its `token`. Mirrors the
   * `LinearCredentials.fromConnection` / `Credentials.fromConnection` idiom (`plugin-linear`,
   * `plugin-bluesky`): every authenticated Readwise call pulls its token from this service
   * rather than threading it through as an explicit parameter.
   */
  static fromConnection = (connection: Connection.Connection): Layer.Layer<ReadwiseCredentials, ReadwiseError> =>
    Layer.effect(
      ReadwiseCredentials,
      Effect.gen(function* () {
        const accessToken = yield* Database.load(connection.accessToken).pipe(
          Effect.mapError(
            (cause) => new ReadwiseError({ message: 'Failed to load the Readwise access token.', cause }),
          ),
        );
        return { token: accessToken.token };
      }),
    );
}
