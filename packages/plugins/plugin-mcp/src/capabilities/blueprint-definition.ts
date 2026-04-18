//
// Copyright 2025 DXOS.org
//

import * as Effect from 'effect/Effect';

import { Capabilities, Capability } from '@dxos/app-framework';
import { AppCapabilities } from '@dxos/app-toolkit';
import { Blueprint } from '@dxos/blueprints';

import { McpCapabilities, type Settings } from '#types';

const BLUEPRINT_KEY_PREFIX = 'org.dxos.blueprint.mcp';

const makeBlueprint = (entry: Settings.McpServerEntry) =>
  Blueprint.make({
    key: `${BLUEPRINT_KEY_PREFIX}.${entry.id}`,
    name: entry.name,
    mcpServers: [{ url: entry.url, protocol: entry.protocol }],
  });

const blueprintDefinition = Capability.makeModule<
  void,
  Capability.Capability<unknown>[]
>(() =>
  Effect.gen(function* () {
    const settings = yield* Capabilities.getAtomValue(McpCapabilities.Settings);

    return settings.servers.map((entry: Settings.McpServerEntry) =>
      Capability.contributes(AppCapabilities.BlueprintDefinition, {
        key: `${BLUEPRINT_KEY_PREFIX}.${entry.id}`,
        make: () => makeBlueprint(entry),
      }),
    );
  }),
);

export default blueprintDefinition;
