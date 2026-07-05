//
// Copyright 2026 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Operation } from '@dxos/compute';
import { Database } from '@dxos/echo';
import { Message } from '@dxos/types';

import { ReadwiseOperation } from '../types';
import { type SuggestedItem, decomposeAnnotation, findAnnotation, findExistingSuggestion } from './decompose';

/**
 * UI-facing handler for `ReadwiseOperation.Decompose`: runs `decomposeAnnotation` (idempotent —
 * a no-op if a suggestion already exists) and reads back the resulting chat's suggestion message
 * plus the card's own annotation text, so the `TriageCard` container gets everything it needs to
 * render in one round-trip.
 */
const handler: Operation.WithHandler<typeof ReadwiseOperation.Decompose> = ReadwiseOperation.Decompose.pipe(
  Operation.withHandler(
    Effect.fn(function* ({ card }) {
      const { db } = yield* Database.Service;
      const annotation = yield* findAnnotation(db, card);
      const chat = yield* decomposeAnnotation({ db }, card);
      const suggestion = yield* findExistingSuggestion(db, chat);
      // `Message.properties` is an untyped `Record<string, unknown>` on the schema (a shared bag
      // for many message kinds) — read back defensively, mirroring `decompose.test.ts`'s own cast
      // at this exact boundary.
      const items = (suggestion?.properties?.suggestedItems as readonly SuggestedItem[] | undefined) ?? [];
      return { chat, annotationText: Message.extractText(annotation), items };
    }),
  ),
);

export default handler;
