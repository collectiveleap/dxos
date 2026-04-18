//
// Copyright 2025 DXOS.org
//

import { Plugin } from '@dxos/app-framework';
import { AppPlugin } from '@dxos/app-toolkit';

import { BlueprintDefinition, McpSettings, ReactSurface } from '#capabilities';
import { meta } from '#meta';

import { translations } from './translations';

export const McpPlugin = Plugin.define(meta).pipe(
  AppPlugin.addBlueprintDefinitionModule({ activate: BlueprintDefinition }),

  AppPlugin.addSettingsModule({ activate: McpSettings }),

  AppPlugin.addSurfaceModule({ activate: ReactSurface }),

  AppPlugin.addTranslationsModule({ translations }),

  Plugin.make,
);
