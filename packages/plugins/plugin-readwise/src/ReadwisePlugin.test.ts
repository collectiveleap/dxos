//
// Copyright 2026 DXOS.org
//

import { Atom } from '@effect-atom/atom-react';
import * as Effect from 'effect/Effect';
import { describe, test } from 'vitest';

import { ActivationEvents, Capabilities, Capability, Plugin } from '@dxos/app-framework';
import { OperationHandlerSet } from '@dxos/compute';
import { Obj, Ref } from '@dxos/echo';
import { EffectEx } from '@dxos/effect';
import { DXN, URI } from '@dxos/keys';
import { AssistantCapabilities, AssistantOperation } from '@dxos/plugin-assistant';
import { AssistantPlugin } from '@dxos/plugin-assistant/plugin';
import { ClientCapabilities } from '@dxos/plugin-client';
import { ClientPlugin } from '@dxos/plugin-client/plugin';
import { initializeIdentity } from '@dxos/plugin-client/testing';
import { createComposerTestApp } from '@dxos/plugin-testing/harness';
import { Task } from '@dxos/types';

import { ReadwisePlugin } from '#plugin';
import { ReadwiseOperation } from '#types';

import { TRIAGE_TAG } from './constants';
import { meta } from './meta';

/**
 * Test-only shim contributing `AssistantCapabilities.CompanionChatCache` — the one capability
 * `AssistantOperation.EnsureCompanionChat`'s handler needs that this repo's vitest Node project
 * doesn't otherwise provide. Under Node's conditional-exports resolution, `@dxos/plugin-assistant/plugin`
 * resolves `#plugin` to `AssistantPlugin.node.ts` (confirmed via a dedicated investigation) — a
 * deliberately-slimmed headless variant that omits the `AssistantState` module (and therefore this
 * capability) along with `ReactSurface`/`Settings`/`CompanionChatProvisioner`. The full browser
 * plugin (`AssistantPlugin.tsx`, what Composer actually runs) contributes it via `AssistantState`
 * (`packages/plugins/plugin-assistant/src/capabilities/state.ts`). This shim supplies only that one
 * missing capability — scoped to this test file, not a change to `plugin-assistant` itself — so the
 * real, unmodified `EnsureCompanionChat` handler can be exercised end-to-end here.
 */
const CompanionChatCacheShim = Plugin.define(
  Plugin.makeMeta({ key: DXN.make('org.dxos.plugin.readwise.test.companionChatCacheShim'), name: 'Shim' }),
).pipe(
  Plugin.addModule({
    id: 'companion-chat-cache-shim',
    activatesOn: ActivationEvents.Startup,
    activate: Capability.makeModule(() =>
      Effect.succeed(
        Capability.contributes(
          AssistantCapabilities.CompanionChatCache,
          Atom.make<Record<string, Obj.Unknown | undefined>>({}).pipe(Atom.keepAlive),
        ),
      ),
    ),
  }),
  Plugin.make,
);

const moduleId = (name: string) => `${meta.profile.key}.module.${name}`;

describe('ReadwisePlugin', () => {
  test('schema module activates on startup', async ({ expect }) => {
    await using harness = await createComposerTestApp({ plugins: [ClientPlugin({}), ReadwisePlugin()] });
    expect(harness.manager.getActive()).toEqual(expect.arrayContaining([moduleId('schema')]));
  });

  test('operation handler module activates on SetupProcessManager', async ({ expect }) => {
    await using harness = await createComposerTestApp({ plugins: [ClientPlugin({}), ReadwisePlugin()] });
    // Operation handlers are not loaded on startup — SetupProcessManager fires lazily when an
    // operation is invoked (mirrors plugin-chess's `ChessPlugin.test.ts`).
    await harness.fire(ActivationEvents.SetupProcessManager);
    expect(harness.manager.getActive()).toContain(moduleId('OperationHandler'));
  });

  test('the sync action invokes a registered, resolvable ReadwiseOperation.Sync handler', async ({ expect }) => {
    await using harness = await createComposerTestApp({ plugins: [ClientPlugin({}), ReadwisePlugin()] });
    await harness.fire(ActivationEvents.SetupProcessManager);

    // The toolbar's "Sync Readwise" action (`TriageBoard.tsx`) invokes `ReadwiseOperation.Sync`
    // through the operation invoker — proving the operation is registered and resolvable is
    // sufficient here (per the brief) since actually running it needs a live `SyncBinding` +
    // network transport, already covered without network by `operations/sync.test.ts`.
    const handlerSets = harness.getAll(Capabilities.OperationHandler);
    const handler = await EffectEx.runAndForwardErrors(
      OperationHandlerSet.getHandler(OperationHandlerSet.merge(...handlerSets), ReadwiseOperation.Sync),
    );
    expect(handler.meta.key).toBe(ReadwiseOperation.Sync.meta.key);
  });

  test('EnsureCompanionChat resolves and caches a companion Chat for a triage Task card', async ({ expect }) => {
    await using harness = await createComposerTestApp({
      plugins: [ClientPlugin({}), AssistantPlugin(), CompanionChatCacheShim(), ReadwisePlugin()],
    });

    const { personalSpace } = await EffectEx.runAndForwardErrors(
      initializeIdentity(harness.get(ClientCapabilities.Client)),
    );
    const card = personalSpace.db.add(
      Task.make({
        [Obj.Meta]: { tags: [Ref.fromURI(URI.make(TRIAGE_TAG))] },
        title: 'Triage card',
        status: 'todo',
      }),
    );
    await personalSpace.db.flush();

    // Proves per-card AI wiring: the `assistant-chat` companion surface's provisioning operation
    // resolves a `Chat` for a triage `Task` card — any ECHO object qualifies as a companion (see
    // `plugin-assistant`'s `react-surface.tsx` `companionChat` filter, which guards only on
    // `Obj.isObject(data.companionTo)`), so the triage Task needs no special-casing here. The first
    // call for a companion with no existing `Chat.CompanionTo` relation returns a transient
    // (`persisted: false`) chat by design (see `ensure-companion-chat.ts`'s handler, read directly
    // above) — persistence happens once Steve actually sends a message in it, not on ensure.
    const result = await harness.invoke(AssistantOperation.EnsureCompanionChat, {
      db: personalSpace.db,
      companionTo: card,
    });
    expect(result.chat).toBeDefined();
    expect(result.persisted).toBe(false);

    // A second call for the same card returns the same cached transient chat rather than creating
    // another one.
    const second = await harness.invoke(AssistantOperation.EnsureCompanionChat, {
      db: personalSpace.db,
      companionTo: card,
    });
    expect(second.chat.id).toBe(result.chat.id);
  });
});
