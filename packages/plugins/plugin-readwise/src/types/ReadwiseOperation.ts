//
// Copyright 2026 DXOS.org
//

// @import-as-namespace

import * as Schema from 'effect/Schema';

import { AiService } from '@dxos/ai';
import { Chat } from '@dxos/assistant-toolkit';
import { Operation } from '@dxos/compute';
import { Database, DXN, Obj, Ref, Type } from '@dxos/echo';
import {
  // eslint-disable-next-line unused-imports/no-unused-imports
  type Connection,
  SyncBinding,
} from '@dxos/plugin-connector';
import { Task } from '@dxos/types';

import { meta } from '#meta';

import { INTENT_KINDS } from './intent';

const makeKey = (name: string) => DXN.make(`${meta.profile.key}.operation.${name}`);

/**
 * Reconcile Readwise highlights for one {@link SyncBinding}. The binding's source is the
 * {@link Connection} that authenticates the pull; its `cursor` is the durable high-water mark
 * (an ISO `updatedAfter` timestamp) advanced on success. Pull-only (Readwise has no concept of
 * pushing local edits back) and idempotent — re-running with an unchanged cursor re-fetches
 * nothing new and {@link captureHighlights}'s dedup keys make a re-capture of the same page a
 * no-op. Matches the `Connector.sync` contract (`SyncInput`/`SyncOutput` in `@dxos/plugin-connector`)
 * so it can be wired as a `ConnectorEntry.sync` operation.
 */
export const Sync = Operation.make({
  meta: {
    key: makeKey('sync'),
    name: 'Sync Readwise Highlights',
    description: 'Pull new/updated Readwise highlights for one connection binding and capture them into ECHO.',
    icon: 'ph--arrows-clockwise--regular',
  },
  input: Schema.Struct({
    binding: Ref.Ref(SyncBinding.SyncBinding),
  }),
  output: Schema.Struct({
    created: Schema.Number,
    updated: Schema.Number,
    cards: Schema.Number,
  }),
}).pipe(Operation.visible);

/** One candidate item as proposed by the decomposition step (mirrors `SuggestedItem` in `operations/decompose.ts`). */
const SuggestedItemSchema = Schema.Struct({
  suggestedKind: Schema.Literal(...INTENT_KINDS),
  text: Schema.String,
  note: Schema.optional(Schema.String),
});

/** Steve's confirm/edit/reject decision over one suggested item (mirrors `Decision` in `operations/confirm.ts`). */
const DecisionSchema = Schema.Struct({
  suggestedKind: Schema.Literal(...INTENT_KINDS),
  finalKind: Schema.Literal(...INTENT_KINDS),
  text: Schema.String,
  note: Schema.optional(Schema.String),
  accept: Schema.Boolean,
});

/**
 * UI-facing wrapper around `decomposeAnnotation` (see `operations/decompose.ts`) — lets the
 * `TriageCard` container trigger the AI decomposition (and, once it already ran, read back the
 * existing proposal) without reaching into `AiService`/`Database` layer wiring itself. Returns
 * both the companion `Chat` and the parsed `items` so the container never needs a second feed
 * query. Internal to this plugin's own surfaces, so it is excluded from the agent tool registry
 * (mirrors `AssistantOperation.GenerateHomeSuggestions`'s `skipRegistry: true`).
 */
export const Decompose = Operation.make({
  meta: {
    key: makeKey('decompose'),
    name: 'Decompose Readwise Annotation',
    description: "Ask the AI to decompose a triage card's annotation into candidate items.",
    icon: 'ph--sparkle--regular',
    skipRegistry: true,
  },
  services: [Database.Service, AiService.AiService],
  input: Schema.Struct({
    card: Type.getSchema(Task.Task),
  }),
  output: Schema.Struct({
    chat: Type.getSchema(Chat.Chat),
    /** The card's annotation passage + note (see `Message.extractText`), for display alongside the items. */
    annotationText: Schema.String,
    items: Schema.Array(SuggestedItemSchema),
  }),
});

/**
 * UI-facing wrapper around `confirmItems` (see `operations/confirm.ts`) — lets the `TriageCard`
 * container materialize Steve's decisions through the operation-invoker rather than calling the
 * space-layer function directly. Internal to this plugin's own surfaces (`skipRegistry: true`).
 */
export const Confirm = Operation.make({
  meta: {
    key: makeKey('confirm'),
    name: 'Confirm Readwise Triage',
    description: 'Materialize confirmed/edited triage decisions and mark the card done.',
    icon: 'ph--check-circle--regular',
    skipRegistry: true,
  },
  services: [Database.Service],
  input: Schema.Struct({
    card: Type.getSchema(Task.Task),
    decisions: Schema.Array(DecisionSchema),
  }),
  output: Schema.Struct({
    results: Schema.Array(Obj.Unknown),
  }),
});
